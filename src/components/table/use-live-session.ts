'use client';

import * as React from 'react';
import { collection, deleteField, doc, serverTimestamp } from 'firebase/firestore';
import { recapFields, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { addDocumentNonBlocking, setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import type { LiveSessionMessage } from '@/app/actions';
import type { LiveSessionInput } from '@/ai/flows/live-session-flow';
import { useToast } from '@/hooks/use-toast';
import { recapOf } from '@/lib/issues';
import type { Campaign, Capture, Character, LiveSessionState, Npc, Scene, Session } from '@/lib/types';

/**
 * Campaign context is passed in rather than queried: the provider already
 * streams these collections, and subscribing again here would double them.
 * The hook owns only the one document nothing else reads, liveSession/current.
 */
export type LiveSessionContext = {
  campaign: Campaign | null;
  sessions: (Session & { id: string })[] | null;
  characters: (Character & { id: string })[] | null;
  /** The room the party is in, so the co-pilot answers about this scene. */
  scene?: Scene | null;
  onStage?: Npc[];
};

/** Display messages carry a stable id for React keys; stripped before sending. */
export type DisplayMessage = LiveSessionMessage & { id: string };

export type EndSessionInput = {
  sessionNumber: number;
  title?: string;
  coverUrl?: string;
};

/**
 * All live-session state: the co-pilot conversation, free notes, captures,
 * spotlights and the clock. Owned by the campaign provider, so it survives
 * route changes and `+` capture works from every screen.
 *
 * The documented fixes are load-bearing and unchanged:
 *   - hydrate once per mount, so debounced writes echoing back cannot clobber
 *     whatever the DM has typed since (the provider remounts this hook per
 *     campaign, so switching campaigns hydrates the right document)
 *   - 800ms debounced persist, reading state through refs so `persist` keeps a
 *     stable identity and streaming tokens do not re-render consumers
 *   - SSE partial-line buffering, because a `data:` line can arrive split
 *     across two network chunks
 */
export function useLiveSession(
  campaignId: string | null,
  { campaign, sessions, characters, scene, onStage }: LiveSessionContext,
) {
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();

  const liveSessionDocRef = useMemoFirebase(() => {
    if (!user || !campaignId) return null;
    return doc(firestore, 'users', user.uid, 'campaigns', campaignId, 'liveSession', 'current');
  }, [user, campaignId, firestore]);
  const { data: storedSession, isLoading: storedSessionLoading } =
    useDoc<LiveSessionState>(liveSessionDocRef);

  const [messages, setMessages] = React.useState<DisplayMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  // Captures from the command bar's `+`. Held here, not written separately,
  // because this hook's merge write would race any other writer of the doc.
  const [captures, setCaptures] = React.useState<Capture[]>([]);
  const [spotlit, setSpotlit] = React.useState<string[]>([]);

  const notesRef = React.useRef('');
  const [hasNotes, setHasNotes] = React.useState(false);
  // State for rendering the clock, mirrored in a ref for `persist`.
  const [startedAt, setStartedAtState] = React.useState<string | null>(null);
  const startedAtRef = React.useRef<string | null>(null);
  const setStartedAt = (v: string | null) => { startedAtRef.current = v; setStartedAtState(v); };

  // ── Hydration: once per mount. ──
  const [hydrated, setHydrated] = React.useState(false);
  const [initialNotes, setInitialNotes] = React.useState('');
  const [notesKey, setNotesKey] = React.useState(0);

  React.useEffect(() => {
    if (hydrated || storedSessionLoading) return;
    if (storedSession) {
      setMessages(storedSession.messages ?? []);
      // Merged, not replaced: a capture taken in the first moments after load,
      // before the stored doc arrived, would otherwise be dropped here.
      setCaptures(prev => [...(storedSession.captures ?? []), ...prev]);
      setSpotlit(storedSession.spotlit ?? []);
      notesRef.current = storedSession.notes ?? '';
      setInitialNotes(storedSession.notes ?? '');
      setHasNotes((storedSession.notes ?? '').trim().length > 0);
      setStartedAt(typeof storedSession.startedAt === 'string' ? storedSession.startedAt : null);
      setNotesKey(k => k + 1);
    }
    setHydrated(true);
  }, [storedSession, storedSessionLoading, hydrated]);

  // ── Persistence: 800ms debounce, state read through refs. ──
  const messagesRef = React.useRef<DisplayMessage[]>([]);
  React.useEffect(() => { messagesRef.current = messages; }, [messages]);
  const capturesRef = React.useRef<Capture[]>([]);
  React.useEffect(() => { capturesRef.current = captures; }, [captures]);
  const spotlitRef = React.useRef<string[]>([]);
  React.useEffect(() => { spotlitRef.current = spotlit; }, [spotlit]);

  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const persist = React.useCallback(() => {
    if (!hydrated || !liveSessionDocRef) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setDocumentNonBlocking(liveSessionDocRef, {
        campaignId,
        messages: messagesRef.current,
        notes: notesRef.current,
        captures: capturesRef.current,
        spotlit: spotlitRef.current,
        // Client ISO string: it is displayed, not ordered on, and a pending
        // server timestamp would read back null. Absent until START.
        ...(startedAtRef.current ? { startedAt: startedAtRef.current } : {}),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }, 800);
  }, [hydrated, liveSessionDocRef, campaignId]);

  React.useEffect(() => { persist(); }, [messages, captures, spotlit, startedAt, persist]);

  /**
   * Append a capture. It deliberately does not start the session clock: a
   * note captured midweek shouldn't make Saturday's session read as running.
   */
  const addCapture = React.useCallback((text: string, links: string[]): Capture => {
    const capture: Capture = { id: crypto.randomUUID(), at: new Date().toISOString(), text, links };
    setCaptures(prev => [...prev, capture]);
    return capture;
  }, []);

  const handleNotesChange = React.useCallback((val: string) => {
    notesRef.current = val;
    setHasNotes(val.trim().length > 0);
    persist();
  }, [persist]);

  const toggleSpotlit = React.useCallback((characterId: string) => {
    setSpotlit(prev => (prev.includes(characterId) ? prev.filter(id => id !== characterId) : [...prev, characterId]));
  }, []);

  /** RUN / START: the clock begins here, and only here. */
  const start = React.useCallback(() => {
    if (startedAtRef.current) return;
    setStartedAt(new Date().toISOString());
  }, []);

  /** Stop a streaming reply (review item U5). What has arrived so far stays. */
  const stop = React.useCallback(() => { abortRef.current?.abort(); }, []);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  const campaignContext = React.useMemo((): LiveSessionInput['campaignContext'] => {
    const sessionLog = sessions
      ?.slice(0, 10)
      .map(s => `Session ${s.sessionNumber}: ${recapOf(s)}`)
      .join('\n\n') ?? '';
    const where = [scene?.name, scene?.location, scene?.timeOfDay].filter(Boolean).join(' · ');
    return {
      campaignName: campaign?.name ?? 'Unknown Campaign',
      campaignDescription: campaign?.description,
      sessionNumber: sessions?.[0]?.sessionNumber,
      sessionLog: sessionLog || undefined,
      ...(where ? { currentLocation: where } : {}),
      characters: characters?.slice(0, 8).map(c => ({
        name: c.name, class: c.class, species: c.species, backstory: c.backstory,
      })),
      ...(onStage?.length ? {
        activeNpcs: onStage.slice(0, 12).map(n => ({ name: n.name, description: n.description?.slice(0, 300), location: n.location })),
      } : {}),
    };
  }, [campaign, sessions, characters, scene, onStage]);

  const toApiMessages = (msgs: DisplayMessage[]): LiveSessionMessage[] =>
    msgs.map(({ id: _id, ...m }) => m);

  const sendMessage = React.useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMsg: DisplayMessage = { role: 'user', content: content.trim(), id: crypto.randomUUID() };
    const assistantMsg: DisplayMessage = { role: 'assistant', content: '', id: crypto.randomUUID() };
    const newMessages = [...messagesRef.current, userMsg];

    setMessages([...newMessages, assistantMsg]);
    setInput('');
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let failure = 'Failed to get response.';
    let accumulated = '';

    try {
      const idToken = await user?.getIdToken();
      if (!idToken) throw new Error('Not authenticated');

      const res = await fetch('/api/live-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ messages: toApiMessages(newMessages), campaignContext }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        // For an auth failure the route's body says why (expired sign-in, not
        // on the allowlist, server can't verify). Show that instead of the
        // generic line, which reads like a network blip and hides the fix.
        if ([401, 403, 503].includes(res.status)) failure = (await res.text()) || failure;
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      // SSE events are split on network chunk boundaries, so a `data:` line can
      // arrive in two pieces. Hold the trailing partial line until it completes,
      // otherwise it fails to parse and that slice of the reply is lost.
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data) continue;
          try {
            const event = JSON.parse(data);
            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
              accumulated += event.delta.text;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...assistantMsg, content: accumulated };
                return updated;
              });
            }
          } catch { /* non-JSON SSE lines (ping, etc.) */ }
        }
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') {
        // Stopped by the DM: keep what arrived, drop an empty reply bubble.
        if (!accumulated) setMessages(newMessages);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: failure });
        setMessages(newMessages);
      }
    } finally {
      abortRef.current = null;
      setIsLoading(false);
    }
  }, [isLoading, user, campaignContext, toast]);

  // ── END SESSION (review item U1) ──
  const [isEnding, setIsEnding] = React.useState(false);

  /**
   * Turn tonight into an issue. In order, so a failure part-way loses nothing:
   *   1. create the session document (number, notes, captures; no recap yet,
   *      the DM drafts that from the Issue page). If this fails, stop here and
   *      leave the table exactly as it was.
   *   2. archive liveSession/current as liveSession/s{N}
   *   3. stamp SPOTLIT characters' lastSpotlightSession
   *   4. reset liveSession/current, deleting startedAt so the old clock can't
   *      come back on reload (the bug U1 called out)
   */
  const endSession = React.useCallback(async ({ sessionNumber, title, coverUrl }: EndSessionInput): Promise<boolean> => {
    if (!user || !campaignId || !liveSessionDocRef) return false;
    setIsEnding(true);
    abortRef.current?.abort();
    if (saveTimer.current) clearTimeout(saveTimer.current);

    const base = ['users', user.uid, 'campaigns', campaignId] as const;
    const snapshot = {
      messages: messagesRef.current,
      notes: notesRef.current,
      captures: capturesRef.current,
      spotlit: spotlitRef.current,
      ...(startedAtRef.current ? { startedAt: startedAtRef.current } : {}),
    };

    try {
      await addDocumentNonBlocking(collection(firestore, ...base, 'sessions'), {
        campaignId,
        sessionNumber,
        date: serverTimestamp(),
        ...recapFields(''),
        notes: snapshot.notes,
        captures: snapshot.captures,
        ...(title ? { title } : {}),
        ...(coverUrl ? { coverUrl } : {}),
      });
    } catch {
      setIsEnding(false);
      toast({ variant: 'destructive', title: 'Issue not saved', description: 'Nothing was cleared. Check your connection and try again.' });
      persist();
      return false;
    }

    await setDocumentNonBlocking(doc(firestore, ...base, 'liveSession', `s${sessionNumber}`), {
      campaignId, ...snapshot, updatedAt: serverTimestamp(),
    }, { merge: false });

    await Promise.all(snapshot.spotlit.map(id =>
      updateDocumentNonBlocking(doc(firestore, ...base, 'characters', id), { lastSpotlightSession: sessionNumber, campaignId })
        .catch(() => { /* a deleted character just isn't stamped */ }),
    ));

    await setDocumentNonBlocking(liveSessionDocRef, {
      campaignId, messages: [], notes: '', captures: [], spotlit: [],
      startedAt: deleteField(), updatedAt: serverTimestamp(),
    }, { merge: true });

    setMessages([]);
    setCaptures([]);
    setSpotlit([]);
    notesRef.current = '';
    setInitialNotes('');
    setHasNotes(false);
    setNotesKey(k => k + 1);
    setStartedAt(null);
    setInput('');
    setIsEnding(false);
    return true;
  }, [user, campaignId, liveSessionDocRef, firestore, toast, persist]);

  return {
    messages, input, setInput, isLoading, sendMessage, stop,
    textareaRef,
    initialNotes, notesKey, handleNotesChange, hasNotes,
    captures, addCapture,
    spotlit, toggleSpotlit,
    startedAt, start,
    isEnding, endSession,
    /** False until the stored session has loaded; RUN waits for it. */
    hydrated,
  };
}
