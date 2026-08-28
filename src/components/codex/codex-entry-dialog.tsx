'use client';

import * as React from 'react';
import { collection, deleteField, doc, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import { KIND_COLLECTION, KIND_LABEL } from '@/lib/codex';
import type { CodexKind, Faction } from '@/lib/types';

type FieldType = 'text' | 'textarea' | 'number' | 'select';

type FieldDef = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  /**
   * Value a select starts on when the document has none. Without this a select
   * falls back to its first option, which for the disposition scale would mark
   * every newly created NPC 'Hostile'.
   */
  defaultValue?: string;
  /** Rendered side by side with the following fields in a compact row. */
  compact?: boolean;
};

const DISPOSITION_OPTIONS = ['Hostile', 'Unfriendly', 'Neutral', 'Friendly', 'Allied']
  .map(v => ({ value: v, label: v }));

/** NPC disposition is optional, so it gets an explicit "unset" choice. */
const OPTIONAL_DISPOSITION_OPTIONS = [
  { value: '', label: '— Unknown —' },
  ...DISPOSITION_OPTIONS,
];

/**
 * Field schemas, one per kind, carrying exactly the fields the five deleted
 * manager dialogs offered — plus the new scene fields on NPCs.
 */
function fieldsFor(kind: CodexKind, factions: Faction[]): FieldDef[] {
  switch (kind) {
    case 'npc':
      return [
        { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'NPC name' },
        { name: 'description', label: 'Description', type: 'textarea', required: true, placeholder: 'Who they are, how they carry themselves, what they have done…' },
        { name: 'location', label: 'Location', type: 'text', compact: true, placeholder: 'e.g. The Gilded Hall' },
        {
          name: 'status', label: 'Status', type: 'select', compact: true,
          defaultValue: 'Active',
          options: ['Active', 'Inactive', 'Dead', 'Unknown'].map(v => ({ value: v, label: v })),
        },
        {
          name: 'importance', label: 'Importance', type: 'select', compact: true,
          defaultValue: 'Minor',
          options: ['Key', 'Minor'].map(v => ({ value: v, label: v })),
        },
        {
          name: 'disposition', label: 'Disposition', type: 'select', compact: true,
          defaultValue: '', options: OPTIONAL_DISPOSITION_OPTIONS,
        },
        {
          name: 'factionId', label: 'Faction', type: 'select', compact: true,
          defaultValue: 'none',
          options: [
            { value: 'none', label: 'None' },
            ...factions.map(f => ({ value: f.id, label: f.name })),
          ],
        },
        { name: 'wants', label: 'Wants (this scene)', type: 'textarea', placeholder: 'What are they trying to get right now?' },
        { name: 'knows', label: 'Knows (this scene)', type: 'textarea', placeholder: 'What do they currently know?' },
      ];
    case 'place':
      return [
        { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Location name' },
        { name: 'description', label: 'Description', type: 'textarea', required: true, placeholder: 'What the party sees, hears, and can get into trouble with…' },
      ];
    case 'faction':
      return [
        { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Faction name' },
        { name: 'description', label: 'Description', type: 'textarea', required: true, placeholder: 'Who they are and what they stand for…' },
        { name: 'leader', label: 'Leader', type: 'text', compact: true },
        { name: 'homeBase', label: 'Home base', type: 'text', compact: true },
        {
          name: 'disposition', label: 'Disposition', type: 'select', compact: true,
          defaultValue: 'Neutral', options: DISPOSITION_OPTIONS,
        },
        { name: 'currentAgenda', label: 'Current agenda', type: 'textarea', placeholder: 'What are they actively doing right now?' },
        { name: 'whatTheyKnow', label: 'What they know', type: 'textarea', placeholder: 'What do they know about the party?' },
      ];
    case 'party':
      return [
        { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Character name' },
        { name: 'species', label: 'Species', type: 'text', compact: true, placeholder: 'e.g. Human, Elf' },
        { name: 'class', label: 'Class', type: 'text', compact: true, placeholder: 'e.g. Fighter, Wizard' },
        { name: 'originCity', label: 'Origin', type: 'text', compact: true, placeholder: 'e.g. Waterdeep' },
        { name: 'currentHp', label: 'Current HP', type: 'number', compact: true, placeholder: '24' },
        { name: 'maxHp', label: 'Max HP', type: 'number', compact: true, placeholder: '38' },
        { name: 'armorClass', label: 'AC', type: 'number', compact: true, placeholder: '16' },
        { name: 'speed', label: 'Speed', type: 'number', compact: true, placeholder: '30' },
        { name: 'passivePerception', label: 'Passive perception', type: 'number', compact: true, placeholder: '14' },
        { name: 'passiveInvestigation', label: 'Passive investigation', type: 'number', compact: true, placeholder: '12' },
        { name: 'passiveInsight', label: 'Passive insight', type: 'number', compact: true, placeholder: '15' },
        { name: 'backstory', label: 'Backstory', type: 'textarea', required: true, placeholder: 'History, motivations, secrets…' },
        { name: 'developmentLog', label: 'Development log', type: 'textarea', placeholder: 'How they have changed across sessions…' },
      ];
    case 'session':
      return [
        { name: 'summary', label: 'Summary', type: 'textarea', required: true, placeholder: 'What happened this session…' },
      ];
    default:
      return [];
  }
}

const NUMERIC_FIELDS = new Set([
  'currentHp', 'maxHp', 'armorClass', 'speed',
  'passivePerception', 'passiveInvestigation', 'passiveInsight',
]);

export type CodexEntryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: CodexKind;
  campaignId: string;
  /** Existing document being edited, or null to create a new one. */
  initial: Record<string, unknown> | null;
  factions: Faction[];
  onSaved?: (id: string | null) => void;
};

export function CodexEntryDialog({
  open, onOpenChange, kind, campaignId, initial, factions, onSaved,
}: CodexEntryDialogProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const fields = React.useMemo(() => fieldsFor(kind, factions), [kind, factions]);
  const [form, setForm] = React.useState<Record<string, unknown>>({});
  const [isSaving, setIsSaving] = React.useState(false);

  // Reset the draft whenever the dialog opens against a different document, so
  // editing one entry then another can't leak the first one's values.
  React.useEffect(() => {
    if (!open) return;
    setForm(initial ? { ...initial } : {});
  }, [open, initial]);

  const setField = (name: string, value: unknown) =>
    setForm(prev => ({ ...prev, [name]: value }));

  const missingRequired = fields.some(
    f => f.required && !String(form[f.name] ?? '').trim(),
  );

  const handleSave = async () => {
    const collectionName = KIND_COLLECTION[kind];
    if (!user || !collectionName) return;
    if (missingRequired) {
      toast({
        variant: 'destructive',
        title: 'Missing fields',
        description: fields.filter(f => f.required).map(f => f.label).join(' and ') + ' are required.',
      });
      return;
    }

    setIsSaving(true);
    const isEdit = !!initial?.id;

    // Build the payload from the schema so a field that was cleared is removed
    // from the document rather than written as an empty string — otherwise
    // `where`/fallback logic downstream sees '' and treats it as present.
    const payload: Record<string, unknown> = { campaignId };
    for (const f of fields) {
      const raw = form[f.name];
      if (f.type === 'number') {
        const n = raw === '' || raw === undefined || raw === null ? undefined : Number(raw);
        if (n === undefined || Number.isNaN(n)) {
          if (isEdit) payload[f.name] = deleteField();
        } else {
          payload[f.name] = n;
        }
        continue;
      }
      const str = String(raw ?? '').trim();
      if (f.name === 'factionId') {
        if (str && str !== 'none') {
          payload.factionId = str;
          payload.factionName = factions.find(x => x.id === str)?.name ?? deleteField();
        } else if (isEdit) {
          payload.factionId = deleteField();
          payload.factionName = deleteField();
        }
        continue;
      }
      if (str) payload[f.name] = str;
      else if (isEdit) payload[f.name] = deleteField();
    }

    try {
      if (isEdit) {
        const ref = doc(
          firestore, 'users', user.uid, 'campaigns', campaignId, collectionName,
          String(initial!.id),
        );
        await updateDocumentNonBlocking(ref, payload);
        toast({ title: `${KIND_LABEL[kind]} updated` });
        onSaved?.(String(initial!.id));
      } else {
        const ref = collection(firestore, 'users', user.uid, 'campaigns', campaignId, collectionName);
        // Factions carry a createdAt and a swatch colour; nothing else does.
        if (kind === 'faction') {
          payload.createdAt = serverTimestamp();
          if (!payload.disposition) payload.disposition = 'Neutral';
        }
        const created = await addDocumentNonBlocking(ref, payload);
        toast({ title: `${KIND_LABEL[kind]} added` });
        onSaved?.(created?.id ?? null);
      }
      onOpenChange(false);
    } catch {
      toast({ variant: 'destructive', title: `Could not save ${KIND_LABEL[kind].toLowerCase()}` });
    } finally {
      setIsSaving(false);
    }
  };

  const compact = fields.filter(f => f.compact);
  const full = fields.filter(f => !f.compact);

  const renderField = (f: FieldDef) => {
    const value = form[f.name];
    const common = { id: f.name, disabled: isSaving };
    return (
      <div key={f.name} className="space-y-1.5">
        <Label htmlFor={f.name} className="text-xs">
          {f.label}{f.required ? ' *' : ''}
        </Label>
        {f.type === 'textarea' ? (
          <Textarea
            {...common}
            value={String(value ?? '')}
            placeholder={f.placeholder}
            onChange={e => setField(f.name, e.target.value)}
            className="min-h-[90px] font-body"
          />
        ) : f.type === 'select' ? (
          <select
            {...common}
            value={String(value ?? f.defaultValue ?? '')}
            onChange={e => setField(f.name, e.target.value)}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {f.options?.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ) : (
          <Input
            {...common}
            type={f.type === 'number' ? 'number' : 'text'}
            value={value === undefined || value === null ? '' : String(value)}
            placeholder={f.placeholder}
            onChange={e => setField(f.name, e.target.value)}
          />
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">
            {initial?.id ? 'Edit' : 'New'} {KIND_LABEL[kind]}
          </DialogTitle>
          <DialogDescription>
            {initial?.id
              ? 'Changes save to this campaign immediately.'
              : `Add a new ${KIND_LABEL[kind].toLowerCase()} to this campaign.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {compact.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {compact.map(renderField)}
            </div>
          )}
          {full.map(renderField)}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || missingRequired}>
            {isSaving
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
