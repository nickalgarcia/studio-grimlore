'use client';

import * as React from 'react';
import { getLiveSessionResponse } from '@/app/actions';
import type { LiveSessionMessage } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, Swords, RotateCcw, Copy, MapPin, Users } from 'lucide-react';
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import type { Session, Character, Campaign } from '@/lib/types';
import type { LiveSessionInput } from '@/ai/flows/live-session-flow';

// ─────────────────────────────────────────────────────────────────────────────
// Suggestion chips shown at session start
// ─────────────────────────────────────────────────────────────────────────────
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

  // Load campaign data
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

  // Conversation state
  const [messages, setMessages] = React.useState<LiveSessionMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Build the campaign context object (sent with every request)
  const campaignContext = React.useMemo((): LiveSessionInput['campaignContext'] => {
    const sessionLog = sessions
      ?.slice(0, 10)
      .map(s => `Session ${s.sessionNumber}: ${s.summary}`)
      .join('\n\n') ?? '';

    const latestSession = sessions?.[0];

    return {
      campaignName: campaign?.name ?? 'Unknown Campaign',
      campaignDescription: campaign?.description,
      sessionNumber: latestSession?.sessionNumber,
      sessionLog: sessionLog || undefined,
      characters: characters?.slice(0, 8).map(c => ({
        name: c.name,
        class: c.class,
        species: c.species,
        backstory: c.backstory,
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
      const { data, error } = await getLiveSessionResponse({
        messages: newMessages,
        campaignContext,
      });

      if (error || !data) {
        toast({ variant: 'destructive', title: 'Error', description: error ?? 'Something went wrong.' });
        setMessages(messages); // revert
        return;
      }

      setMessages([...newMessages, { role: 'assistant', content: data.response }]);
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to get response.' });
      setMessages(messages);
    } finally {
      setIsLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearSession = () => {
    setMessages([]);
    setInput('');
    textareaRef.current?.focus();
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({ title: 'Copied!' });
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto gap-4">

      {/* Session context banner */}
      <Card className="border-accent/30 bg-accent/5">
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Swords className="h-4 w-4 text-accent" />
              <span className="font-headline font-semibold text-base">
                {campaign?.name ?? 'Loading campaign...'}
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
            {hasMessages && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSession}
                className="ml-auto h-7 text-sm text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                New session
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto space-y-4 min-h-0 max-h-[55vh] pr-1">
        {!hasMessages ? (
          /* Welcome state */
          <div className="space-y-6 py-4">
            <div className="text-center space-y-2">
              <h3 className="font-headline text-2xl font-semibold">Session Assistant</h3>
              <p className="text-base text-muted-foreground max-w-md mx-auto">
                I know your campaign. Ask me anything mid-session — unexpected player moves,
                NPC reactions, complications, dialogue, whatever you need.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="text-left text-sm p-4 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/40 transition-all text-foreground/70 hover:text-foreground font-body leading-snug"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Message thread */
          <div className="space-y-4 py-2">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar dot */}
                <div
                  className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-0.5
                    ${msg.role === 'user'
                      ? 'bg-primary/20 text-primary'
                      : 'bg-accent/20 text-accent'
                    }`}
                >
                  {msg.role === 'user' ? 'DM' : '✦'}
                </div>

                {/* Bubble */}
                <div
                  className={`relative group max-w-[85%] rounded-2xl px-4 py-3 leading-relaxed
                    ${msg.role === 'user'
                      ? 'bg-primary/15 text-foreground rounded-tr-sm'
                      : 'bg-white/5 border border-white/10 text-foreground/90 rounded-tl-sm'
                    }`}
                >
                  <div className="whitespace-pre-wrap font-body text-base leading-relaxed">{msg.content}</div>

                  {/* Copy button (assistant only) */}
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => copyMessage(msg.content)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10"
                      title="Copy"
                    >
                      <Copy className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Loading bubble */}
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

      {/* Input area */}
      <div className="flex gap-2 items-end">
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