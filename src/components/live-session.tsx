'use client';

import * as React from 'react';
import { getLiveSessionResponse, getSessionRecap } from '@/app/actions';
import type { LiveSessionMessage } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Send, Swords, RotateCcw, Copy, MapPin,
  Users, NotebookPen, ChevronDown, ChevronUp, CheckCircle2, X
} from 'lucide-react';
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, orderBy, doc, serverTimestamp } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import type { Session, Character, Campaign } from '@/lib/types';
import type { LiveSessionInput } from '@/ai/flows/live-session-flow';
import { cn } from '@/lib/utils';

const STARTER_PROMPTS = [
  "The party just did something completely unexpected — help me improvise",
  "Give me a tense NPC for the current location",
  "What would the main antagonist do if they knew where the party is?",
  "I need a complication that raises the stakes right now",
  "Give me a piece of overheard conversation or environmental detail",
  "The party wants to negotiate instead of fight — how does the NPC respond?",
];

interface LiveSessionProps {
  campaignId: string;
}

export function LiveSession({ campaignId }: LiveSessionProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();

  // ── Firestore refs ──
  const campaignDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid, 'campaigns', campaignId);
  }, [user, firestore, campaignId]);
  const { data: campaign } = useDoc<Campaign>(campaignDocRef);

  const sessionsQuery = useMemoFirebase(() => {
    if (!user || !campaignId) return null;
    return query(
      collection(firestore, 'users', user.uid, 'campaigns', campaignId, 'sessions'),
      orderBy('sessionNumber', 'desc')
    );
  }, [user, campaignId, firestore]);
  const { data: sessions } = useCollection<Session>(sessionsQuery);

  const charactersRef = useMemoFirebase(() => {
    if (!user || !campaignId) return null;
    return collection(firestore, 'users', user.uid, 'campaigns', campaignId, 'characters');
  }, [user, campaignId, firestore]);
  const { data: characters } = useCollection<Character>(charactersRef);

  const sessionsRef = useMemoFirebase(() => {
    if (!user || !campaignId) return null;
    return collection(firestore, 'users', user.uid, 'campaigns', campaignId, 'sessions');
  }, [user, campaignId, firestore]);

  // ── Chat state ──
  const [messages, setMessages] = React.useState<LiveSessionMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // ── Notes panel state ──
  const [notesOpen, setNotesOpen] = React.useState(false);
  const [notes, setNotes] = React.useState('');

  // ── Close Session state ──
  const [isClosing, setIsClosing] = React.useState(false);
  const [recapPreview, setRecapPreview] = React.useState<string | null>(null);
  const [showCloseFlow, setShowCloseFlow] = React.useState(false);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;
    const userMessage: LiveSessionMessage = { role: 'user', content: content.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    try {
      const { data, error } = await getLiveSessionResponse({ messages: newMessages, campaignContext });
      if (error || !data) {
        toast({ variant: 'destructive', title: 'Error', description: error ?? 'Something went wrong.' });
        setMessages(messages);
        return;
      }
      setMessages([...newMessages, { role: 'assistant', content: data.response }]);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to get response.' });
      setMessages(messages);
    } finally {
      setIsLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const clearSession = () => {
    setMessages([]);
    setNotes('');
    setRecapPreview(null);
    setShowCloseFlow(false);
    setInput('');
    textareaRef.current?.focus();
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({ title: 'Copied!' });
  };

  // ── Close Session flow ──
  const handleCloseSession = async () => {
    if (!notes.trim() && messages.length === 0) {
      toast({ variant: 'destructive', title: 'Nothing to recap', description: 'Add some notes or have a conversation first.' });
      return;
    }
    setIsClosing(true);
    setShowCloseFlow(true);

    // Build conversation highlights from assistant messages
    const highlights = messages
      .filter(m => m.role === 'assistant')
      .slice(-5)
      .map(m => m.content.slice(0, 300))
      .join('\n\n---\n\n');

    const nextSessionNumber = (sessions?.[0]?.sessionNumber ?? 0) + 1;

    const { data, error } = await getSessionRecap({
      campaignName: campaign?.name ?? 'Campaign',
      sessionNumber: nextSessionNumber,
      dmNotes: notes || 'No notes taken.',
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
  };

  const handleSaveRecap = async () => {
    if (!recapPreview || !sessionsRef || !user) return;
    setIsClosing(true);

    const nextSessionNumber = (sessions?.[0]?.sessionNumber ?? 0) + 1;

    try {
      await addDocumentNonBlocking(sessionsRef, {
        campaignId,
        sessionNumber: nextSessionNumber,
        summary: recapPreview,
        date: serverTimestamp(),
      });
      toast({ title: `Session ${nextSessionNumber} logged!`, description: 'The recap has been saved to your campaign.' });
      clearSession();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Could not save session', description: 'Check your connection and try again.' });
    } finally {
      setIsClosing(false);
    }
  };

  const hasMessages = messages.length > 0;
  const hasContent = hasMessages || notes.trim().length > 0;

  // ── Close Session Review Modal ──
  if (showCloseFlow) {
    return (
      <div className="flex flex-col h-full max-w-3xl mx-auto gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-headline text-xl text-accent">Close Session</h3>
          <Button variant="ghost" size="sm" onClick={() => setShowCloseFlow(false)} className="text-muted-foreground">
            <X className="h-4 w-4 mr-1" /> Back to Session
          </Button>
        </div>

        {isClosing ? (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-12 flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="font-headline text-sm tracking-widest text-muted-foreground">Chronicling the session...</p>
            </CardContent>
          </Card>
        ) : recapPreview ? (
          <>
            <Card className="border-accent/20 bg-accent/5">
              <CardHeader className="pb-2">
                <CardTitle className="font-headline text-base text-accent/80 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Session Recap — Review & Save
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-base leading-relaxed whitespace-pre-wrap text-foreground/90 font-body">
                  {recapPreview}
                </p>
              </CardContent>
            </Card>

            <div className="text-sm text-muted-foreground italic px-1">
              This will be saved as Session {(sessions?.[0]?.sessionNumber ?? 0) + 1}.
              You can edit it later from the Campaigns tab.
            </div>

            <div className="flex gap-3">
              <Button onClick={handleSaveRecap} disabled={isClosing} className="flex-1">
                {isClosing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Save Session Log
              </Button>
              <Button variant="outline" onClick={() => setRecapPreview(null)} disabled={isClosing}>
                Regenerate
              </Button>
            </div>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto gap-3">

      {/* ── Context banner ── */}
      <Card className="border-accent/30 bg-accent/5 flex-shrink-0">
        <CardContent className="py-2.5 px-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Swords className="h-4 w-4 text-accent" />
              <span className="font-headline font-semibold text-base">
                {campaign?.name ?? 'Loading...'}
              </span>
            </div>
            {sessions?.[0] && (
              <Badge variant="outline" className="text-sm border-accent/40 text-accent/80">
                Session {sessions[0].sessionNumber}
              </Badge>
            )}
            {characters?.length ? (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span>{characters.length} characters loaded</span>
              </div>
            ) : null}
            {sessions?.length ? (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <span>{sessions.length} sessions in context</span>
              </div>
            ) : null}
            <div className="ml-auto flex items-center gap-2">
              {hasContent && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCloseSession}
                  disabled={isClosing}
                  className="h-7 text-sm border-primary/30 text-primary hover:bg-primary/10"
                >
                  Close Session
                </Button>
              )}
              {hasMessages && (
                <Button variant="ghost" size="sm" onClick={clearSession}
                  className="h-7 text-sm text-muted-foreground hover:text-foreground">
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  New
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Notes panel (collapsible) ── */}
      <div className="flex-shrink-0">
        <button
          onClick={() => setNotesOpen(o => !o)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/15 bg-primary/3 hover:bg-primary/6 transition-colors text-left"
        >
          <NotebookPen className="h-3.5 w-3.5 text-primary/60" />
          <span className="font-headline text-xs tracking-widest text-muted-foreground uppercase flex-1">
            Session Notes
          </span>
          {notes.trim() && (
            <span className="text-xs text-primary/60 italic mr-2">
              {notes.trim().split('\n').length} line{notes.trim().split('\n').length !== 1 ? 's' : ''}
            </span>
          )}
          {notesOpen
            ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>

        {notesOpen && (
          <div className="mt-1 rounded-lg border border-primary/15 overflow-hidden">
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Jot down names, decisions, moments to remember... These will be used to generate your session recap."
              className="min-h-[120px] max-h-48 resize-none rounded-none border-0 border-t border-primary/10 bg-primary/3 text-base font-body leading-relaxed focus-visible:ring-0"
              autoFocus={notesOpen}
            />
          </div>
        )}
      </div>

      {/* ── Chat area ── */}
      <div className="flex-1 overflow-y-auto space-y-4 min-h-0 max-h-[50vh] pr-1">
        {!hasMessages ? (
          <div className="space-y-6 py-4">
            <div className="text-center space-y-2">
              <h3 className="font-headline text-2xl font-semibold">Session Assistant</h3>
              <p className="text-base text-muted-foreground max-w-md mx-auto">
                I know your campaign. Ask me anything mid-session — unexpected player moves,
                NPC reactions, complications, dialogue, whatever you need.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {STARTER_PROMPTS.map(prompt => (
                <button key={prompt} onClick={() => sendMessage(prompt)}
                  className="text-left text-sm p-4 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/40 transition-all text-foreground/70 hover:text-foreground font-body leading-snug">
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {messages.map((msg, i) => (
              <div key={i} className={cn('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                <div className={cn(
                  'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-0.5',
                  msg.role === 'user' ? 'bg-primary/20 text-primary' : 'bg-accent/20 text-accent'
                )}>
                  {msg.role === 'user' ? 'DM' : '✦'}
                </div>
                <div className={cn(
                  'relative group max-w-[85%] rounded-2xl px-4 py-3 leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-primary/15 text-foreground rounded-tr-sm'
                    : 'bg-white/5 border border-white/10 text-foreground/90 rounded-tl-sm'
                )}>
                  <div className="whitespace-pre-wrap font-body text-base leading-relaxed">{msg.content}</div>
                  {msg.role === 'assistant' && (
                    <button onClick={() => copyMessage(msg.content)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10"
                      title="Copy">
                      <Copy className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold">✦</div>
                <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-accent" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── Input area ── */}
      <div className="flex gap-2 items-end flex-shrink-0">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What's happening at the table? (Enter to send, Shift+Enter for new line)"
          className="resize-none min-h-[52px] max-h-32 font-body text-base"
          disabled={isLoading}
          rows={2}
        />
        <Button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isLoading}
          size="icon"
          className="h-[52px] w-[52px] flex-shrink-0"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
