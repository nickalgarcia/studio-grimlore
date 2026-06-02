'use client';

import React from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import type { Campaign, Faction, FactionDisposition, Npc } from '@/lib/types';
import { getLiveSessionResponse } from '@/app/actions';
import {
  PlusCircle, Trash2, Loader2, Edit, ChevronDown, ChevronUp,
  Swords, Shield, Minus, Users, Brain, Save, X
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Disposition config
// ─────────────────────────────────────────────────────────────────────────────

const DISPOSITIONS: FactionDisposition[] = ['Hostile', 'Unfriendly', 'Neutral', 'Friendly', 'Allied'];

const DISPOSITION_CONFIG: Record<FactionDisposition, { color: string; bg: string; label: string }> = {
  Hostile:    { color: 'text-red-400',    bg: 'bg-red-500',    label: 'Hostile' },
  Unfriendly: { color: 'text-orange-400', bg: 'bg-orange-500', label: 'Unfriendly' },
  Neutral:    { color: 'text-yellow-400', bg: 'bg-yellow-500', label: 'Neutral' },
  Friendly:   { color: 'text-green-400',  bg: 'bg-green-500',  label: 'Friendly' },
  Allied:     { color: 'text-primary',    bg: 'bg-primary',    label: 'Allied' },
};

const FACTION_COLORS = [
  '#3db8a8', '#e8734a', '#9b72cf', '#c94f4f',
  '#8ab4d4', '#8ebc7a', '#d4c9a8', '#b07acc',
];

// ─────────────────────────────────────────────────────────────────────────────
// Disposition meter
// ─────────────────────────────────────────────────────────────────────────────
function DispositionMeter({
  value, onChange, readonly = false,
}: {
  value: FactionDisposition;
  onChange?: (d: FactionDisposition) => void;
  readonly?: boolean;
}) {
  const activeIdx = DISPOSITIONS.indexOf(value);
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {DISPOSITIONS.map((d, i) => {
          const cfg = DISPOSITION_CONFIG[d];
          const isActive = i <= activeIdx;
          return (
            <button
              key={d}
              onClick={() => !readonly && onChange?.(d)}
              disabled={readonly}
              title={d}
              className={cn(
                'flex-1 h-2.5 rounded-full transition-all',
                isActive ? cfg.bg : 'bg-white/10',
                !readonly && 'cursor-pointer hover:opacity-80',
              )}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground font-headline tracking-wide">
        <span className="text-red-400/70">Hostile</span>
        <span className={DISPOSITION_CONFIG[value].color + ' font-semibold'}>{value}</span>
        <span className="text-primary/70">Allied</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI "What would they do?" panel
// ─────────────────────────────────────────────────────────────────────────────
function FactionAiPanel({
  faction, campaignName, campaignDescription, sessionContext,
}: {
  faction: Faction;
  campaignName: string;
  campaignDescription?: string;
  sessionContext?: string;
}) {
  const [situation, setSituation] = React.useState('');
  const [response, setResponse] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const { toast } = useToast();

  const handleAsk = async () => {
    if (!situation.trim()) return;
    setIsLoading(true);
    setResponse('');

    const systemContext = [
      `Campaign: ${campaignName}`,
      campaignDescription ? `Premise: ${campaignDescription}` : '',
      `You are roleplaying as the leadership council of the faction: ${faction.name}`,
      `Faction description: ${faction.description}`,
      faction.leader ? `Leader: ${faction.leader}` : '',
      faction.homeBase ? `Base of operations: ${faction.homeBase}` : '',
      `Current disposition toward the party: ${faction.disposition}`,
      faction.currentAgenda ? `Current agenda: ${faction.currentAgenda}` : '',
      faction.whatTheyKnow ? `What they know about the party: ${faction.whatTheyKnow}` : '',
      sessionContext ? `Recent campaign events: ${sessionContext}` : '',
    ].filter(Boolean).join('\n');

    const { data, error } = await getLiveSessionResponse({
      messages: [{
        role: 'user',
        content: `Given everything you know about ${faction.name} and their current situation, how would they respond to this:\n\n${situation}\n\nAnswer as the faction's leadership — what do they decide, what orders do they give, and what might the party see or hear as a result? Be specific and grounded in the faction's goals and current disposition.`,
      }],
      campaignContext: {
        campaignName,
        campaignDescription,
      },
    });

    setIsLoading(false);
    if (error || !data) {
      toast({ variant: 'destructive', title: 'Could not get response', description: error ?? 'Try again.' });
      return;
    }
    setResponse(data.response);
  };

  return (
    <div className="space-y-3 pt-3 border-t border-border/50">
      <p className="label-forge flex items-center gap-2">
        <Brain className="h-3.5 w-3.5" /> What Would They Do?
      </p>
      <Textarea
        value={situation}
        onChange={e => setSituation(e.target.value)}
        placeholder={`Describe a situation and ask how ${faction.name} would respond...`}
        className="min-h-[80px] text-sm font-body"
        disabled={isLoading}
      />
      <Button
        onClick={handleAsk}
        disabled={!situation.trim() || isLoading}
        size="sm"
        variant="outline"
        className="border-primary/30 text-primary hover:bg-primary/10"
      >
        {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Brain className="h-3.5 w-3.5 mr-2" />}
        Ask Claude
      </Button>
      {response && (
        <div className="bg-primary/5 border border-primary/15 rounded-lg p-4 text-sm font-body leading-relaxed whitespace-pre-wrap text-foreground/90">
          {response}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Faction card
// ─────────────────────────────────────────────────────────────────────────────
function FactionCard({
  faction, npcs, campaignName, campaignDescription, onUpdate, onDelete,
}: {
  faction: Faction;
  npcs: Npc[];
  campaignName: string;
  campaignDescription?: string;
  onUpdate: (id: string, data: Partial<Faction>) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [editingAgenda, setEditingAgenda] = React.useState(false);
  const [editingKnowledge, setEditingKnowledge] = React.useState(false);
  const [agendaDraft, setAgendaDraft] = React.useState(faction.currentAgenda ?? '');
  const [knowledgeDraft, setKnowledgeDraft] = React.useState(faction.whatTheyKnow ?? '');

  const factionNpcs = npcs.filter(n => n.factionId === faction.id);
  const cfg = DISPOSITION_CONFIG[faction.disposition];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Color accent bar */}
      <div className="h-1" style={{ backgroundColor: faction.color ?? '#3db8a8' }} />

      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex-shrink-0 border-2"
              style={{ backgroundColor: (faction.color ?? '#3db8a8') + '22', borderColor: faction.color ?? '#3db8a8' }}
            />
            <div>
              <h3 className="font-headline text-lg leading-tight">{faction.name}</h3>
              {faction.leader && (
                <p className="text-xs text-muted-foreground">Led by {faction.leader}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setExpanded(o => !o)}
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-white/8 text-muted-foreground/50 transition-colors"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="h-7 w-7 flex items-center justify-center rounded hover:bg-red-500/15 text-muted-foreground/30 hover:text-red-400 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {faction.name}?</AlertDialogTitle>
                  <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(faction.id)}
                    className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground font-body leading-relaxed line-clamp-2">
          {faction.description}
        </p>

        {/* Disposition meter */}
        <DispositionMeter
          value={faction.disposition}
          onChange={d => onUpdate(faction.id, { disposition: d })}
        />

        {/* NPC count */}
        {factionNpcs.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5 text-primary/50" />
            <span>{factionNpcs.map(n => n.name).join(', ')}</span>
          </div>
        )}

        {/* Expanded section */}
        {expanded && (
          <div className="space-y-4 pt-2">

            {/* Current agenda */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="label-forge">Current Agenda</p>
                {!editingAgenda && (
                  <button onClick={() => setEditingAgenda(true)}
                    className="text-xs text-muted-foreground/50 hover:text-primary transition-colors">
                    <Edit className="h-3 w-3" />
                  </button>
                )}
              </div>
              {editingAgenda ? (
                <div className="space-y-2">
                  <Textarea
                    value={agendaDraft}
                    onChange={e => setAgendaDraft(e.target.value)}
                    placeholder="What is this faction actively doing right now?"
                    className="min-h-[70px] text-sm font-body"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => { onUpdate(faction.id, { currentAgenda: agendaDraft }); setEditingAgenda(false); }}>
                      <Save className="h-3.5 w-3.5 mr-1" />Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setAgendaDraft(faction.currentAgenda ?? ''); setEditingAgenda(false); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm font-body text-foreground/75 leading-relaxed">
                  {faction.currentAgenda || <span className="text-muted-foreground italic">Not set — click edit to add</span>}
                </p>
              )}
            </div>

            {/* What they know */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="label-forge">What They Know About the Party</p>
                {!editingKnowledge && (
                  <button onClick={() => setEditingKnowledge(true)}
                    className="text-xs text-muted-foreground/50 hover:text-primary transition-colors">
                    <Edit className="h-3 w-3" />
                  </button>
                )}
              </div>
              {editingKnowledge ? (
                <div className="space-y-2">
                  <Textarea
                    value={knowledgeDraft}
                    onChange={e => setKnowledgeDraft(e.target.value)}
                    placeholder="What does this faction know about the party?"
                    className="min-h-[70px] text-sm font-body"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => { onUpdate(faction.id, { whatTheyKnow: knowledgeDraft }); setEditingKnowledge(false); }}>
                      <Save className="h-3.5 w-3.5 mr-1" />Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setKnowledgeDraft(faction.whatTheyKnow ?? ''); setEditingKnowledge(false); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm font-body text-foreground/75 leading-relaxed">
                  {faction.whatTheyKnow || <span className="text-muted-foreground italic">Not set — click edit to add</span>}
                </p>
              )}
            </div>

            {/* AI panel */}
            <FactionAiPanel
              faction={faction}
              campaignName={campaignName}
              campaignDescription={campaignDescription}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
interface FactionManagerProps {
  campaign: Campaign;
}

export function FactionManager({ campaign }: FactionManagerProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const factionsRef = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'users', user.uid, 'campaigns', campaign.id, 'factions');
  }, [user, firestore, campaign.id]);
  const { data: factions, isLoading } = useCollection<Faction>(factionsRef);

  const npcsRef = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'users', user.uid, 'campaigns', campaign.id, 'npcs');
  }, [user, firestore, campaign.id]);
  const { data: npcs } = useCollection<Npc>(npcsRef);

  // Create dialog state
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [leader, setLeader] = React.useState('');
  const [homeBase, setHomeBase] = React.useState('');
  const [disposition, setDisposition] = React.useState<FactionDisposition>('Neutral');
  const [color, setColor] = React.useState(FACTION_COLORS[0]);
  const [isCreating, setIsCreating] = React.useState(false);

  const resetDialog = () => {
    setName(''); setDescription(''); setLeader('');
    setHomeBase(''); setDisposition('Neutral');
    setColor(FACTION_COLORS[(factions?.length ?? 0) % FACTION_COLORS.length]);
  };

  const handleCreate = async () => {
    if (!factionsRef || !name.trim()) return;
    setIsCreating(true);
    try {
      await addDocumentNonBlocking(factionsRef, {
        campaignId: campaign.id,
        name, description, leader, homeBase, disposition, color,
        createdAt: serverTimestamp(),
      });
      toast({ title: `${name} added to factions!` });
      resetDialog();
      setDialogOpen(false);
    } catch {
      toast({ variant: 'destructive', title: 'Could not create faction' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdate = (id: string, data: Partial<Faction>) => {
    if (!user) return;
    const ref = doc(firestore, 'users', user.uid, 'campaigns', campaign.id, 'factions', id);
    updateDocumentNonBlocking(ref, data);
  };

  const handleDelete = (id: string) => {
    if (!user) return;
    const ref = doc(firestore, 'users', user.uid, 'campaigns', campaign.id, 'factions', id);
    deleteDocumentNonBlocking(ref);
    toast({ title: 'Faction removed.' });
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-headline font-bold">Faction Tracker</h2>
          <p className="text-muted-foreground mt-1 font-body text-sm">
            Track political relationships, agendas, and faction reactions.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Faction
        </Button>
      </div>

      {/* Disposition legend */}
      <div className="flex gap-3 flex-wrap">
        {DISPOSITIONS.map(d => {
          const cfg = DISPOSITION_CONFIG[d];
          const count = factions?.filter(f => f.disposition === d).length ?? 0;
          if (count === 0) return null;
          return (
            <div key={d} className="flex items-center gap-1.5 text-xs">
              <div className={cn('w-2 h-2 rounded-full', cfg.bg)} />
              <span className={cfg.color}>{d}</span>
              <span className="text-muted-foreground">({count})</span>
            </div>
          );
        })}
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        </div>
      ) : factions && factions.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-6">
          {factions.map(faction => (
            <FactionCard
              key={faction.id}
              faction={faction}
              npcs={npcs ?? []}
              campaignName={campaign.name}
              campaignDescription={campaign.description}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 border border-dashed border-primary/20 rounded-xl space-y-3">
          <Shield className="h-12 w-12 mx-auto text-primary/20" />
          <h3 className="font-headline text-xl text-foreground/60">No factions yet</h3>
          <p className="text-muted-foreground text-sm">
            Add the factions active in your campaign — guilds, nations, cults, armies.
          </p>
          <Button onClick={() => setDialogOpen(true)} variant="outline">
            <PlusCircle className="mr-2 h-4 w-4" /> Add Your First Faction
          </Button>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) resetDialog(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-headline text-xl">Add Faction</DialogTitle>
            <DialogDescription>Add a political group, army, guild, or organization active in your campaign.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input placeholder="Faction Name *" value={name} onChange={e => setName(e.target.value)} autoFocus className="text-base" />
            <Textarea placeholder="Description — who are they, what do they want?" value={description} onChange={e => setDescription(e.target.value)} className="min-h-[80px] text-base font-body" />
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Leader (optional)" value={leader} onChange={e => setLeader(e.target.value)} className="text-base" />
              <Input placeholder="Home base (optional)" value={homeBase} onChange={e => setHomeBase(e.target.value)} className="text-base" />
            </div>
            <div>
              <p className="label-forge mb-2">Initial Disposition</p>
              <DispositionMeter value={disposition} onChange={setDisposition} />
            </div>
            <div>
              <p className="label-forge mb-2">Faction Color</p>
              <div className="flex gap-2">
                {FACTION_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={cn(
                      'w-7 h-7 rounded-full border-2 transition-all',
                      color === c ? 'border-white scale-110' : 'border-transparent'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
            <Button onClick={handleCreate} disabled={isCreating || !name.trim()}>
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
              Add Faction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
