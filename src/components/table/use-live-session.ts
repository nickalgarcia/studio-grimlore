'use client';

import * as React from 'react';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { idTokenFor, recapFields, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { addDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { getSessionRecap } from '@/app/actions';
import type { LiveSessionMessage } from '@/app/actions';
import type { LiveSessionInput } from '@/ai/flows/live-session-flow';
import { useToast } from '@/hooks/use-toast';
import type { Campaign, Capture, Character, LiveSessionState, Session } from '@/lib/types';

/**
 * Campaign context is passed in rather than queried.
 *
 * The shell already streams sessions and characters for the Codex; subscribing
 * again here meant four listeners doing two collections' work for as long as
 * Table was open. The hook owns only the one document nothing else reads —
 * liveSession/current.
 */
export type LiveSessionContext = {
  campaign: Campaign | null;
  sessions: (Session & { id: string })[] | null;
  characters: (Character & { id: string })[] | null;
};

/** Display messages carry a stable id for React keys; stripped before sending. */
export type DisplayMessage = LiveSessionMessage & { id: string };

/**
 * All live-session state, lifted out of the old single component so the design
 * can put the conversation in the co-pilot column and the notes on the stage
 * while both keep talking to one piece of logic.
 *
 * Every documented fix moves across unchanged — they are load-bearing:
 *   - hydrate once per mount, so debounced writes echoing back cannot clobber
 *     whatever the DM has typed since
 *   - 800ms debounced persist, reading messages through a ref so `persist`
 *     keeps a stable identity and streaming tokens do not re-render consumers
 *   - SSE partial-line buffering, because a `data:` line can arrive split
 *     across two network chunks
 */
export function useLiveSession(
  campaignId: string | null,
  { campaign, sessions, characters }: LiveSessionContext,
) {
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();

  const sessionsRef = useMemoFirebase(() => {
    if (!user || !campaignId) return null;
    return collection(firestore, 'users', user.uid, 'campaigns', campaignId, 'sessions');
  }, [user, campaignId, firestore]);

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

  const notesRef = React.useRef('');
  const [hasNotes, setHasNotes] = React.useState(false);
  const startedAtRef = React.useRef<string | null>(null);

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
      notesRef.current = storedSession.notes ?? '';
      setInitialNotes(storedSession.notes ?? '');
      setHasNotes((storedSession.notes ?? '').trim().length > 0);
      startedAtRef.current =
        typeof storedSession.startedAt === 'string' ? storedSession.startedAt : null;
      setNotesKey(k => k + 1);
    }
    setHydrated(true);
  }, [storedSession, storedSessionLoading, hydrated]);

  // ── Persistence: 800ms debounce, messages read through a ref. ──
  const messagesRef = React.useRef<DisplayMessage[]>([]);
  React.useEffect(() => { messagesRef.current = messages; }, [messages]);
  const capturesRef = React.useRef<Capture[]>([]);
  React.useEffect(() => { capturesRef.current = captures; }, [captures]);

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
        // Stamped on the first write of a session so the status bar has a real
        // clock to count from. Client ISO string: it is displayed, not ordered
        // on, and a pending server timestamp would read back null.
        ...(startedAtRef.current ? { startedAt: startedAtRef.current } : {}),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }, 800);
  }, [hydrated, liveSessionDocRef, campaignId]);

  React.useEffect(() => { persist(); }, [messages, captures, persist]);

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
    if (!startedAtRef.current && val.trim()) startedAtRef.current = new Date().toISOString();
    persist();
  }, [persist]);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  const [isClosing, setIsClosing] = React.useState(false);
  const [recapPreview, setRecapPreview] = React.useState<string | null>(null);
  const [showCloseFlow, setShowCloseFlow] = React.useState(false);

  const campaignContext = React.useMemo((): LiveSessionInput['campaignContext'] => {
    const sessionLog = sessions
      ?.slice(0, 10)
      .map(s => `Session ${s.sessionNumber}: ${s.summary}`)
      .join('\n\n') ?? '';
    return {
      campaignName: campaign?.name ?? 'Unknown Campaign',
      campaignDescription: campaign?.description,
      sessionNumber: sessions?.[0]?.sessionNumber,
      sessionLog: sessionLog || undefined,
      characters: characters?.slice(0, 8).map(c => ({
        name: c.name, class: c.class, species: c.species, backstory: c.backstory,
      })),
    };
  }, [campaign, sessions, characters]);

  const toApiMessages = (msgs: DisplayMessage[]): LiveSessionMessage[] =>
    msgs.map(({ id: _id, ...m }) => m);

  const sendMessage = React.useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;
    if (!startedAtRef.current) startedAtRef.current = new Date().toISOString();

    const userMsg: DisplayMessage = { role: 'user', content: content.trim(), id: crypto.randomUUID() };
    const assistantMsg: DisplayMessage = { role: 'assistant', content: '', id: crypto.randomUUID() };
    const newMessages = [...messagesRef.current, userMsg];

    setMessages([...newMessages, assistantMsg]);
    setInput('');
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let failure = 'Failed to get response.';

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
      let accumulated = '';
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
      // An abort is a deliberate cancellation, not a failure worth reporting.
      if ((e as Error)?.name !== 'AbortError') {
        toast({ variant: 'destructive', title: 'Error', description: failure });
        setMessages(newMessages);
      }
    } finally {
      abortRef.current = null;
      setIsLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isLoading, user, campaignContext, toast]);

  const clearSession = React.useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setCaptures([]);
    notesRef.current = '';
    startedAtRef.current = null;
    setInitialNotes('');
    setNotesKey(k => k + 1);
    setHasNotes(false);
    setRecapPreview(null);
    setShowCloseFlow(false);
    setInput('');
    textareaRef.current?.focus();
  }, []);

  const handleCloseSession = React.useCallback(async () => {
    if (!notesRef.current.trim() && messagesRef.current.length === 0 && capturesRef.current.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nothing to recap',
        description: 'Add some notes or have a conversation first.',
      });
      return;
    }
    setIsClosing(true);
    setShowCloseFlow(true);

    const highlights = messagesRef.current
      .filter(m => m.role === 'assistant')
      .slice(-5)
      .map(m => m.content.slice(0, 300))
      .join('\n\n---\n\n');

    const nextSessionNumber = (sessions?.[0]?.sessionNumber ?? 0) + 1;

    const { data, error } = await getSessionRecap(await idTokenFor(user), {
      campaignName: campaign?.name ?? 'Campaign',
      sessionNumber: nextSessionNumber,
      dmNotes: [
        notesRef.current.trim(),
        capturesRef.current.length ? `Captured during play:\n${capturesRef.current.map(c => `- ${c.text}`).join('\n')}` : '',
      ].filter(Boolean).join('\n\n') || 'No notes taken.',
      conversationHighlights: highlights || undefined,
      characters: characters?.slice(0, 8).map(c => ({ name: c.name, class: c.class })),
      previousSummary: campaign?.aiSummary,
    });

    setIsClosing(false);

    if (error || !data) {
      toast({ variant: 'destructive', title: 'Could not generate recap', description: error ?? 'Try again.' });
      return;
    }
    setRecapPreview(data.recap);
  }, [campaign, characters, sessions, toast, user]);

  const handleSaveRecap = React.useCallback(async () => {
    if (!recapPreview || !sessionsRef || !user) return;
    setIsClosing(true);
    const nextSessionNumber = (sessions?.[0]?.sessionNumber ?? 0) + 1;
    try {
      await addDocumentNonBlocking(sessionsRef, {
        campaignId,
        sessionNumber: nextSessionNumber,
        ...recapFields(recapPreview),
        date: serverTimestamp(),
      });
      toast({ title: `Session ${nextSessionNumber} logged!`, description: 'The recap has been saved to your campaign.' });
      clearSession();
    } catch {
      toast({ variant: 'destructive', title: 'Could not save session', description: 'Check your connection and try again.' });
    } finally {
      setIsClosing(false);
    }
  }, [recapPreview, sessionsRef, user, sessions, campaignId, toast, clearSession]);

  return {
    campaign, sessions, characters,
    messages, input, setInput, isLoading, sendMessage,
    textareaRef,
    initialNotes, notesKey, handleNotesChange, hasNotes,
    captures, addCapture,
    startedAt: startedAtRef.current,
    clearSession,
    isClosing, recapPreview, setRecapPreview, showCloseFlow, setShowCloseFlow,
    handleCloseSession, handleSaveRecap,
  };
}
