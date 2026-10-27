'use client';

import * as React from 'react';
import { parseObsidianSessionAction } from '@/app/actions';
import type { ParseObsidianSessionOutput } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useFirestore, useUser, useMemoFirebase, idTokenFor, recapFields } from '@/firebase';
import { collection, serverTimestamp } from 'firebase/firestore';
import type { MentionKind, Session } from '@/lib/types';
import { useCampaign } from '@/components/campaign/campaign-provider';
import { mentionTargets, type MentionTarget } from '@/lib/mentions';
import { nameKey, type ImportRow } from '@/lib/roster-import';
import { applyImport } from '@/lib/roster-import-write';
import { Loader2, Upload, FileText, CheckCircle2, RotateCcw, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ObsidianImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignName: string;
  nextSessionNumber: number;
  onImported: () => void;
}

type Step = 'input' | 'parsing' | 'review' | 'saving';

const KIND_WORD: Record<MentionKind, string> = {
  npc: 'NPC', party: 'party member', place: 'place', faction: 'faction', item: 'item', thread: 'thread',
};

/**
 * The parser's "NPCs introduced", each matched against everything already in
 * the campaign by name or alias. Unmatched names can be created as NPCs on
 * save; until this existed the list was shown and then thrown away, which is
 * how a campaign ends up with recaps naming NPCs the Loom has never heard of.
 */
function npcCandidates(names: readonly string[], targets: readonly MentionTarget[]) {
  const byKey = new Map<string, MentionTarget>();
  for (const t of targets) {
    for (const n of [t.name, ...(t.aliases ?? [])]) {
      const k = nameKey(n ?? '');
      if (k && !byKey.has(k)) byKey.set(k, t);
    }
  }
  const seen = new Set<string>();
  const out: { name: string; key: string; match: MentionTarget | null }[] = [];
  for (const raw of names) {
    const name = raw.trim().replace(/\s+/g, ' ');
    const key = nameKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ name, key, match: byKey.get(key) ?? null });
  }
  return out;
}

export function ObsidianImportDialog({
  open, onOpenChange, campaignId, campaignName, nextSessionNumber, onImported,
}: ObsidianImportDialogProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const { codex, threads } = useCampaign();

  const [step, setStep] = React.useState<Step>('input');
  const [markdown, setMarkdown] = React.useState('');
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [parsed, setParsed] = React.useState<ParseObsidianSessionOutput | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  /** Keys (nameKey) of introduced NPCs to create on save. */
  const [npcPicks, setNpcPicks] = React.useState<Set<string>>(new Set());
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const sessionsRef = useMemoFirebase(() => {
    if (!user || !campaignId) return null;
    return collection(firestore, 'users', user.uid, 'campaigns', campaignId, 'sessions');
  }, [user, firestore, campaignId]);

  const reset = () => {
    setStep('input');
    setMarkdown('');
    setFileName(null);
    setParsed(null);
    setDragOver(false);
    setNpcPicks(new Set());
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const { npcs, characters, locations, factions } = codex.raw;
  const candidates = React.useMemo(
    () => npcCandidates(
      parsed?.npcsIntroduced ?? [],
      mentionTargets({ npcs, characters, locations, factions, threads }),
    ),
    [parsed, npcs, characters, locations, factions, threads],
  );

  // Names still unmatched at this render: the codex can load or change while
  // the review is open, so a ticked name may since have matched a page.
  const picked = candidates.filter(c => !c.match && npcPicks.has(c.key));

  const toggleNpc = (key: string) => setNpcPicks(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  // ── File handling ──
  const readFile = (file: File) => {
    if (!file.name.endsWith('.md') && !file.name.endsWith('.txt')) {
      toast({ variant: 'destructive', title: 'Wrong file type', description: 'Please upload a .md or .txt file.' });
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => setMarkdown(e.target?.result as string ?? '');
    reader.readAsText(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  };

  // ── Parse ──
  const handleParse = async () => {
    if (!markdown.trim()) {
      toast({ variant: 'destructive', title: 'No content', description: 'Paste or upload session content first.' });
      return;
    }
    setStep('parsing');

    const { data, error } = await parseObsidianSessionAction(await idTokenFor(user), {
      markdown,
      campaignName,
      hintSessionNumber: nextSessionNumber,
    });

    if (error || !data) {
      toast({ variant: 'destructive', title: 'Could not parse session', description: error ?? 'Try again.' });
      setStep('input');
      return;
    }

    setParsed(data);
    // Pre-tick every introduced name the campaign doesn't know yet. Computed
    // here from the fresh result rather than from `candidates`, which still
    // holds the previous parse until the next render.
    const known = npcCandidates(data.npcsIntroduced, mentionTargets({ npcs, characters, locations, factions, threads }));
    setNpcPicks(new Set(known.filter(c => !c.match).map(c => c.key)));
    setStep('review');
  };

  // ── Save ──
  const handleSave = async () => {
    if (!parsed || !sessionsRef) return;
    setStep('saving');

    try {
      await addDocumentNonBlocking(sessionsRef, {
        campaignId,
        sessionNumber: parsed.sessionNumber,
        ...recapFields(parsed.summary),
        date: serverTimestamp(),
      });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Could not save session', description: 'Check your connection and try again.' });
      setStep('review');
      return;
    }

    // The session is saved first and on its own: if the NPCs fail, retrying the
    // whole import would duplicate the session, so this only reports it.
    let npcNote = '';
    if (picked.length && user) {
      const n = parsed.sessionNumber;
      const rows: ImportRow[] = picked.map((c, i) => ({
        line: i + 1,
        name: c.name,
        aliases: [],
        fields: { name: c.name, description: `First appeared in Session ${n}.`, lastSeenSession: n },
        action: { type: 'new' },
        warnings: [],
        // Only unmatched names get here, so nothing is shared.
        sharedNames: [],
      }));
      try {
        const { created } = await applyImport(firestore, user.uid, campaignId, 'npc', rows);
        npcNote = ` ${created} new NPC${created === 1 ? '' : 's'} added.`;
      } catch {
        toast({
          variant: 'destructive',
          title: 'Session saved, NPCs not created',
          description: 'Add them from the roster import or the Codex.',
        });
      }
    }

    toast({ title: `Session ${parsed.sessionNumber} imported!`, description: `Added to your campaign logs.${npcNote}` });
    onImported();
    handleClose(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-headline text-xl">Import from Obsidian</DialogTitle>
          <DialogDescription className="font-body">
            Upload a <code>.md</code> file or paste your session notes. Claude will parse it into a clean session log.
          </DialogDescription>
        </DialogHeader>

        {/* ── Step 1: Input ── */}
        {step === 'input' && (
          <div className="space-y-4">
            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all',
                dragOver
                  ? 'border-primary/60 bg-primary/8'
                  : 'border-border hover:border-primary/40 hover:bg-primary/4'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.txt"
                onChange={handleFileInput}
                className="hidden"
              />
              {fileName ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText className="h-8 w-8 text-primary" />
                  <p className="font-headline text-sm text-primary">{fileName}</p>
                  <p className="text-xs text-muted-foreground">File loaded — ready to parse</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Drop your <code>.md</code> file here or click to browse</p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or paste markdown</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Paste area */}
            <Textarea
              value={markdown}
              onChange={e => { setMarkdown(e.target.value); setFileName(null); }}
              placeholder="Paste your Obsidian session markdown here..."
              className="min-h-[180px] font-mono text-sm"
            />

            <div className="text-xs text-muted-foreground">
              Session will be imported as Session <strong>{nextSessionNumber}</strong> unless a different number is found in the content.
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <Button onClick={handleParse} disabled={!markdown.trim()}>
                <Wand2 className="h-4 w-4 mr-2" />
                Parse Session
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── Step 2: Parsing ── */}
        {step === 'parsing' && (
          <div className="py-12 flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="font-headline text-sm tracking-widest text-muted-foreground animate-pulse">
              Parsing session notes...
            </p>
          </div>
        )}

        {/* ── Step 3: Review ── */}
        {step === 'review' && parsed && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono font-bold text-[11px] tracking-[0.16em] uppercase text-mute mb-1">Session {parsed.sessionNumber}</p>
                <h3 className="font-headline text-lg text-accent">{parsed.title}</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setStep('input')} className="text-muted-foreground flex-shrink-0">
                <RotateCcw className="h-3.5 w-3.5 mr-1" />Edit
              </Button>
            </div>

            {/* Summary */}
            <div>
              <p className="font-mono font-bold text-[11px] tracking-[0.16em] uppercase text-mute mb-2">Session Summary</p>
              <p className="text-base font-body leading-relaxed text-foreground/90 whitespace-pre-wrap bg-card border border-border rounded-lg p-4">
                {parsed.summary}
              </p>
            </div>

            {/* Key moments */}
            {parsed.keyMoments.length > 0 && (
              <div>
                <p className="font-mono font-bold text-[11px] tracking-[0.16em] uppercase text-mute mb-2">Key Moments</p>
                <ul className="space-y-1.5">
                  {parsed.keyMoments.map((m, i) => (
                    <li key={i} className="flex gap-2 text-sm text-foreground/80">
                      <span className="text-accent/50 flex-shrink-0 pt-0.5">•</span>
                      <span className="font-body">{m}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* NPCs + threads in a grid */}
            <div className="grid grid-cols-2 gap-4">
              {candidates.length > 0 && (
                <div>
                  <p className="font-mono font-bold text-[11px] tracking-[0.16em] uppercase text-mute mb-2">NPCs Introduced</p>
                  <ul className="space-y-1.5">
                    {candidates.map(c => (
                      <li key={c.key} className="flex items-start gap-2 text-sm font-body">
                        {c.match ? (
                          <span className="text-muted-foreground">
                            {c.name}
                            <span className="block text-[12px] text-mute">Already in campaign as {KIND_WORD[c.match.ref.kind]}{c.match.name !== c.name ? ` (${c.match.name})` : ''}</span>
                          </span>
                        ) : (
                          <>
                            <input
                              id={`obsidian-npc-${c.key}`}
                              type="checkbox"
                              checked={npcPicks.has(c.key)}
                              onChange={() => toggleNpc(c.key)}
                              className="mt-1 h-4 w-4 flex-none accent-[hsl(var(--spot))]"
                            />
                            <label htmlFor={`obsidian-npc-${c.key}`}>
                              {c.name}
                              <span className="block text-[12px] text-mute">Create as NPC</span>
                            </label>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {parsed.openThreads.length > 0 && (
                <div>
                  <p className="font-mono font-bold text-[11px] tracking-[0.16em] uppercase text-mute mb-2">New Threads</p>
                  <ul className="space-y-1">
                    {parsed.openThreads.map((t, i) => (
                      <li key={i} className="text-sm text-muted-foreground font-body">{t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep('input')}>Back</Button>
              <Button onClick={handleSave}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Save Session {parsed.sessionNumber}
                {picked.length > 0 && ` + ${picked.length} NPC${picked.length === 1 ? '' : 's'}`}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── Step 4: Saving ── */}
        {step === 'saving' && (
          <div className="py-12 flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="font-headline text-sm tracking-widest text-muted-foreground">Saving to campaign...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
