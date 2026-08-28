'use client';

import * as React from 'react';
import { doc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { ArrowUpRight, Pencil, Trash2 } from 'lucide-react';
import { dispositionTone, EDITABLE_KINDS, KIND_COLLECTION, KIND_LABEL } from '@/lib/codex';
import { cn } from '@/lib/utils';
import { FactionAiPanel } from './faction-ai-panel';
import type {
  Campaign, Character, CodexEntry, Faction, Location, Npc, SavedConcept, Session,
} from '@/lib/types';

function Field({ label, value }: { label: string; value?: string | number }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="space-y-1">
      <div className="label-forge">{label}</div>
      <div className="text-sm text-foreground/85 font-body whitespace-pre-wrap leading-relaxed">
        {value}
      </div>
    </div>
  );
}

/** Field list per kind. Sessions render their whole summary, not a snippet. */
function DetailFields({ entry }: { entry: CodexEntry }) {
  switch (entry.kind) {
    case 'npc': {
      const n = entry.source as Npc;
      return (
        <>
          <Field label="Description" value={n.description} />
          <Field label="Wants" value={n.wants} />
          <Field label="Knows" value={n.knows} />
          <Field label="Location" value={n.location} />
          <Field label="Faction" value={n.factionName} />
          <Field label="Status" value={n.status} />
          <Field label="Importance" value={n.importance} />
        </>
      );
    }
    case 'place': {
      const l = entry.source as Location;
      return <Field label="Description" value={l.description} />;
    }
    case 'faction': {
      const f = entry.source as Faction;
      return (
        <>
          <Field label="Description" value={f.description} />
          <Field label="Current agenda" value={f.currentAgenda} />
          <Field label="What they know" value={f.whatTheyKnow} />
          <Field label="Leader" value={f.leader} />
          <Field label="Home base" value={f.homeBase} />
        </>
      );
    }
    case 'party': {
      const c = entry.source as Character;
      const hp = c.currentHp !== undefined && c.maxHp !== undefined
        ? `${c.currentHp} / ${c.maxHp}`
        : undefined;
      return (
        <>
          <Field label="Class" value={[c.class, c.species].filter(Boolean).join(' · ')} />
          <Field label="Hit points" value={hp} />
          <Field label="AC" value={c.armorClass} />
          <Field label="Speed" value={c.speed} />
          <Field label="Passive perception" value={c.passivePerception} />
          <Field label="Passive investigation" value={c.passiveInvestigation} />
          <Field label="Passive insight" value={c.passiveInsight} />
          <Field label="Origin" value={c.originCity} />
          <Field label="Backstory" value={c.backstory} />
          <Field label="Development log" value={c.developmentLog} />
        </>
      );
    }
    case 'session': {
      const s = entry.source as Session;
      return <Field label="Summary" value={s.summary} />;
    }
    case 'concept': {
      const c = entry.source as SavedConcept;
      return (
        <>
          <Field label="Type" value={c.type} />
          <Field label="Content" value={c.content} />
        </>
      );
    }
    default:
      return null;
  }
}

export function CodexDetail({
  entry, campaign, sessionContext, onEdit, onDeleted, onPutOnStage,
}: {
  entry: CodexEntry | null;
  campaign: Campaign;
  sessionContext?: string;
  onEdit: (entry: CodexEntry) => void;
  onDeleted: (entry: CodexEntry) => void;
  onPutOnStage?: (entry: CodexEntry) => void;
}) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  if (!entry) {
    return (
      <div className="p-6 text-sm text-muted-foreground font-body italic">
        Select an entry to see its details.
      </div>
    );
  }

  const handleDelete = () => {
    if (!user) return;
    // Concepts are not campaign subcollection documents — they live one level
    // up, under the user. Everything else resolves through KIND_COLLECTION.
    const ref = entry.kind === 'concept'
      ? doc(firestore, 'users', user.uid, 'concepts', entry.id)
      : (() => {
          const name = KIND_COLLECTION[entry.kind];
          if (!name) return null;
          return doc(firestore, 'users', user.uid, 'campaigns', campaign.id, name, entry.id);
        })();

    if (!ref) return;
    deleteDocumentNonBlocking(ref);
    toast({ title: `${KIND_LABEL[entry.kind]} removed` });
    onDeleted(entry);
  };

  const tone = dispositionTone(entry.disposition);
  const canEdit = EDITABLE_KINDS.includes(entry.kind);

  return (
    <div className="p-5 space-y-5 overflow-y-auto">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-1 h-4 flex-shrink-0"
            style={{ background: entry.accent }}
            aria-hidden="true"
          />
          <span className="label-forge">{KIND_LABEL[entry.kind]}</span>
          {entry.lastSeen && (
            <span className="text-[10px] text-muted-foreground ml-auto">{entry.lastSeen}</span>
          )}
        </div>
        <h3 className="font-headline text-2xl leading-tight">{entry.name}</h3>
        <div className="flex items-center gap-2 flex-wrap">
          {entry.disposition && (
            <Badge
              variant="outline"
              className={cn(
                'text-xs',
                tone === 'hostile' && 'border-destructive/50 text-destructive',
                tone === 'ally' && 'border-primary/50 text-primary',
                tone === 'unknown' && 'border-border text-muted-foreground',
              )}
            >
              {entry.disposition}
            </Badge>
          )}
          {entry.where && (
            <span className="text-xs text-muted-foreground">{entry.where}</span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <DetailFields entry={entry} />
      </div>

      {entry.kind === 'faction' && (
        <FactionAiPanel
          faction={entry.source as Faction}
          campaignName={campaign.name}
          campaignDescription={campaign.description}
          sessionContext={sessionContext}
        />
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-border/50">
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => onEdit(entry)}>
            <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
          </Button>
        )}
        {entry.kind === 'npc' && onPutOnStage && (
          <Button variant="outline" size="sm" onClick={() => onPutOnStage(entry)}>
            <ArrowUpRight className="h-3.5 w-3.5 mr-2" /> Put on stage
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="sr-only">Delete {entry.name}</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {entry.name}?</AlertDialogTitle>
              <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
