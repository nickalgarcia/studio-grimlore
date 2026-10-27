'use client';

import * as React from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useCampaign } from '@/components/campaign/campaign-provider';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { mentionTargets } from '@/lib/mentions';
import {
  IMPORT_KINDS, IMPORT_KIND_PLURAL, canImport, planImport, summarize, tickedByDefault,
  type ImportKind, type ImportPlan, type ImportRow,
} from '@/lib/roster-import';
import { applyImport } from '@/lib/roster-import-write';
import { cn } from '@/lib/utils';
import { AlertTriangle, Loader2, Upload } from 'lucide-react';

type Step = 'input' | 'review' | 'saving';

/** A roster is a few hundred rows at most; anything bigger is the wrong file. */
const MAX_BYTES = 1_000_000;

/** What each kind reads, for the help line. Mirrors HEADERS in roster-import.ts. */
const COLUMNS_READ: Record<ImportKind, string> = {
  npc: 'Name, Aliases, Description, Location, Status, Importance, Disposition, Faction, Wants, Knows, Look, Secret, Last seen',
  place: 'Name, Aliases, Description',
  faction: 'Name, Aliases, Description, Leader, Home base, Disposition, Agenda, What they know',
};

const LABEL = 'font-mono font-bold text-[11px] tracking-[0.16em] uppercase text-mute';

/**
 * Bulk import of NPCs, places or factions from spreadsheet rows.
 *
 * Paste-first: copying cells out of any spreadsheet puts tab-separated text on
 * the clipboard, which needs no export step and no xlsx library. A .csv file
 * works too. Always previews before writing, like the data upgrade dialog,
 * because this writes many documents at once.
 */
export function RosterImportDialog({
  open, onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { activeCampaign, codex, threads } = useCampaign();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [step, setStep] = React.useState<Step>('input');
  const [kind, setKind] = React.useState<ImportKind>('npc');
  const [text, setText] = React.useState('');
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [plan, setPlan] = React.useState<ImportPlan | null>(null);
  const [included, setIncluded] = React.useState<Set<number>>(new Set());
  const [dragOver, setDragOver] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const { npcs, locations, factions, characters } = codex.raw;
  // Matching against a half-loaded campaign would offer duplicates as new.
  const loading = npcs === null || locations === null || factions === null;

  const reset = () => {
    setStep('input');
    setText('');
    setFileName(null);
    setError(null);
    setPlan(null);
    setIncluded(new Set());
    setDragOver(false);
  };

  const handleOpenChange = (o: boolean) => {
    // Closing mid-save is allowed: offline, the commit waits for the connection
    // and the dialog would otherwise be stuck until a reload. The writes carry
    // on in the background and `save` still toasts the result, so the state is
    // left alone here and `save` resets it when it finishes.
    if (!o && step !== 'saving') reset();
    onOpenChange(o);
  };

  const readFile = (file: File) => {
    if (!/\.(csv|tsv|txt)$/i.test(file.name)) {
      setError('Choose a .csv or .tsv file, or paste the rows instead. For an .xlsx, select the cells in Excel and copy them.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('That file is over 1 MB, which is far more than a roster. Check it is the right file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      setText(String(e.target?.result ?? ''));
      setFileName(file.name);
      setError(null);
    };
    reader.readAsText(file);
  };

  const preview = () => {
    const existing = kind === 'npc' ? npcs : kind === 'place' ? locations : factions;
    const result = planImport(text, kind, {
      existing: existing ?? [],
      factions: factions ?? [],
      targets: mentionTargets({ npcs, characters, locations, factions, threads }),
    });
    if ('error' in result) {
      setError(result.error);
      return;
    }
    if (result.rows.length === 0) {
      setError('Found the header row but no rows under it.');
      return;
    }
    setError(null);
    setPlan(result);
    setIncluded(new Set(result.rows.filter(tickedByDefault).map(r => r.line)));
    setStep('review');
  };

  const toggle = (line: number) => setIncluded(prev => {
    const next = new Set(prev);
    if (next.has(line)) next.delete(line); else next.add(line);
    return next;
  });

  const counts = plan ? summarize(plan.rows, included) : { creates: 0, aliasUpdates: 0, skipped: 0 };
  const total = counts.creates + counts.aliasUpdates;
  const sharedCount = plan ? plan.rows.filter(r => canImport(r) && r.sharedNames.length > 0).length : 0;

  const save = async () => {
    if (!plan || !user || !activeCampaign || total === 0) return;
    setStep('saving');
    try {
      const rows = plan.rows.filter(r => included.has(r.line));
      const { created, updated } = await applyImport(firestore, user.uid, activeCampaign.id, plan.kind, rows);
      const noun = IMPORT_KIND_PLURAL[plan.kind].toLowerCase();
      toast({
        title: `Imported ${created} ${noun}`,
        description: updated ? `Added aliases to ${updated} already in the campaign.` : undefined,
      });
      reset();
      onOpenChange(false);
    } catch {
      // Batches that landed show as "already here" on a re-run, so retrying is safe.
      toast({
        variant: 'destructive',
        title: 'Import stopped part way',
        description: 'Check your connection, then preview again. Rows that saved will show as already here.',
      });
      setStep('review');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-headline text-xl uppercase tracking-wide">Import roster</DialogTitle>
          <DialogDescription>
            Add {IMPORT_KIND_PLURAL[kind].toLowerCase()} to {activeCampaign?.name ?? 'this campaign'} from a spreadsheet.
            Nothing already in the campaign is overwritten.
          </DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-4">
            <div role="group" aria-label="What to import" className="inline-flex border-[1.5px] border-ink">
              {IMPORT_KINDS.map(k => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={kind === k}
                  onClick={() => { setKind(k); setError(null); }}
                  className={cn(
                    'px-4 py-1.5 font-headline font-extrabold text-[15px] tracking-[0.1em] uppercase',
                    kind === k ? 'bg-ink text-bg' : 'hover:bg-panel',
                  )}
                >
                  {IMPORT_KIND_PLURAL[k]}
                </button>
              ))}
            </div>

            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) readFile(f);
              }}
              className={cn(
                'border-[1.5px] border-dashed p-4 flex items-center gap-3',
                dragOver ? 'border-ink bg-panel' : 'border-line2',
              )}
            >
              <Upload className="h-4 w-4 text-mute flex-none" />
              <p className="text-sm flex-1 min-w-0">
                {fileName
                  ? <>Loaded <span className="font-mono">{fileName}</span></>
                  : <>Drop a <span className="font-mono">.csv</span> here, or paste rows below.</>}
              </p>
              <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>Choose file</Button>
              <input
                ref={fileInputRef}
                id="roster-import-file"
                type="file"
                accept=".csv,.tsv,.txt,text/csv"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ''; }}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="roster-import-text" className={LABEL}>Rows</label>
              <Textarea
                id="roster-import-text"
                value={text}
                onChange={e => { setText(e.target.value); setFileName(null); setError(null); }}
                placeholder={'Copy the cells from your spreadsheet, header row included, and paste them here.'}
                className="min-h-[180px] font-mono text-[12px]"
              />
              <p className="text-[12px] text-mute">
                Reads these columns by header name, in any order: {COLUMNS_READ[kind]}. Separate aliases with
                semicolons. Other columns are ignored.
              </p>
            </div>

            {error && <p role="alert" className="text-sm text-spot">{error}</p>}

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
              <Button onClick={preview} disabled={!text.trim() || loading}>
                {loading && <Loader2 className="animate-spin" />}
                {loading ? 'Loading campaign' : 'Preview'}
              </Button>
            </DialogFooter>
          </div>
        )}

        {(step === 'review' || step === 'saving') && plan && (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm">
                <strong>{counts.creates}</strong> new · <strong>{counts.aliasUpdates}</strong> already here, getting new aliases
                · <strong>{counts.skipped}</strong> skipped
              </p>
              {plan.ignoredColumns.length > 0 && (
                <p className="text-[12px] text-mute">Ignored columns: {plan.ignoredColumns.join(', ')}</p>
              )}
              {sharedCount > 0 && (
                <p className="text-[12px] text-mute">
                  {sharedCount} {sharedCount === 1 ? 'row starts' : 'rows start'} unticked because a name is already
                  used by another page. Read the warning before ticking.
                </p>
              )}
            </div>

            <ul className="border-t border-line">
              {plan.rows.map(row => (
                <RowItem
                  key={row.line}
                  row={row}
                  checked={included.has(row.line)}
                  disabled={step === 'saving' || !canImport(row)}
                  onToggle={() => toggle(row.line)}
                />
              ))}
            </ul>

            {step === 'saving' && (
              <p className="text-[12px] text-mute">
                Saving. If the connection has dropped you can close this; the import finishes when you are back online.
              </p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('input')} disabled={step === 'saving'}>Back</Button>
              <Button onClick={save} disabled={step === 'saving' || total === 0}>
                {step === 'saving' && <Loader2 className="animate-spin" />}
                Import {total}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function actionLabel(row: ImportRow): string {
  const a = row.action;
  switch (a.type) {
    case 'new': return 'New';
    case 'existing':
      return a.newAliases.length
        ? `Adds ${a.newAliases.length} alias${a.newAliases.length === 1 ? '' : 'es'} to ${a.existingName}`
        : `Already here as ${a.existingName}`;
    case 'repeat': return `Repeats row ${a.line}`;
    case 'ambiguous': return `Matches ${a.names.join(' and ')}`;
    case 'invalid': return a.reason;
  }
}

function RowItem({
  row, checked, disabled, onToggle,
}: {
  row: ImportRow;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const id = `roster-row-${row.line}`;
  const aliases = row.action.type === 'existing' ? row.action.newAliases : row.aliases;
  return (
    <li className={cn('grid grid-cols-[20px_minmax(0,1fr)_auto] gap-x-3 gap-y-1 py-2.5 border-b border-line', !canImport(row) && 'opacity-60')}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        className="mt-1 h-4 w-4 accent-[hsl(var(--spot))]"
      />
      <label htmlFor={id} className="min-w-0">
        <span className="font-body text-[15px] font-semibold">{row.name || '—'}</span>
        {aliases.length > 0 && (
          <span className="block text-[12px] text-mute break-words">
            {row.action.type === 'existing' ? 'New aliases: ' : 'Aliases: '}{aliases.join(' · ')}
          </span>
        )}
      </label>
      <span className={cn(
        'font-mono text-[11px] tracking-[0.12em] uppercase text-right max-w-[18rem] pt-1',
        row.action.type === 'new' ? 'text-ink' : 'text-mute',
      )}>
        <span className="text-mute mr-2">Row {row.line}</span>{actionLabel(row)}
      </span>
      {row.warnings.length > 0 && (
        <ul className="col-start-2 col-span-2 space-y-0.5">
          {row.warnings.map((w, i) => (
            <li key={i} className="flex gap-1.5 text-[12px] text-mute">
              <AlertTriangle aria-hidden="true" className="h-3 w-3 flex-none mt-[3px]" />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
