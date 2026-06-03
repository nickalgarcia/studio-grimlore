'use client';

import React from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, deleteField } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { PlusCircle, Trash2, Loader2, User, Edit, Wand2, Users, Eye, Filter } from 'lucide-react';
import type { Campaign, Npc, NpcStatus, NpcImportance, Faction } from '@/lib/types';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
  DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getNpc } from '@/app/actions';
import type { GenerateNpcOutput } from '@/app/actions';
import { Skeleton } from './ui/skeleton';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Status config
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<NpcStatus, { color: string; dot: string; label: string }> = {
  Active:   { color: 'text-green-400',  dot: 'bg-green-400',  label: 'Active' },
  Inactive: { color: 'text-yellow-400', dot: 'bg-yellow-400', label: 'Inactive' },
  Dead:     { color: 'text-red-400',    dot: 'bg-red-400',    label: 'Dead' },
  Unknown:  { color: 'text-gray-400',   dot: 'bg-gray-400',   label: 'Unknown' },
};

const NPC_STATUSES: NpcStatus[] = ['Active', 'Inactive', 'Dead', 'Unknown'];
const NPC_IMPORTANCES: NpcImportance[] = ['Key', 'Minor'];

// ─────────────────────────────────────────────────────────────────────────────
// Truncated content with expand dialog
// ─────────────────────────────────────────────────────────────────────────────
const TruncatedContent: React.FC<{ title: string; content: string }> = ({ title, content }) => {
  if (!content) return null;
  const isLong = content.length > 150;
  const truncated = isLong ? `${content.substring(0, 150)}...` : content;
  return (
    <div>
      <h4 className="font-semibold mb-1 text-accent-foreground">{title}</h4>
      <div className="text-muted-foreground whitespace-pre-wrap text-sm relative">
        {truncated}
        {isLong && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="link" className="p-0 h-auto text-accent-foreground/80 hover:text-accent-foreground text-xs absolute bottom-0 right-0 bg-gradient-to-l from-card via-card to-transparent pl-8">
                <Eye className="mr-1 h-3 w-3" /> Show More
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle className="font-headline text-2xl">{title}</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh] pr-6">
                <p className="whitespace-pre-wrap py-4">{content}</p>
              </ScrollArea>
              <DialogFooter>
                <DialogClose asChild><Button type="button">Close</Button></DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
};

interface NpcManagerProps {
  campaign: Campaign;
}

export function NpcManager({ campaign }: NpcManagerProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  // ── Data ──
  const npcsRef = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'users', user.uid, 'campaigns', campaign.id, 'npcs');
  }, [user, firestore, campaign.id]);
  const { data: npcs, isLoading: npcsLoading } = useCollection<Npc>(npcsRef);

  const factionsRef = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'users', user.uid, 'campaigns', campaign.id, 'factions');
  }, [user, firestore, campaign.id]);
  const { data: factions } = useCollection<Faction>(factionsRef);

  // ── Filters ──
  const [filterStatus, setFilterStatus] = React.useState<NpcStatus | 'All'>('All');
  const [filterImportance, setFilterImportance] = React.useState<NpcImportance | 'All'>('All');
  const [filterLocation, setFilterLocation] = React.useState<string>('All');
  const [filterFaction, setFilterFaction] = React.useState<string>('All');
  const [searchQuery, setSearchQuery] = React.useState('');

  const locations = React.useMemo(() => {
    const locs = new Set<string>();
    npcs?.forEach(n => { if (n.location) locs.add(n.location); });
    return Array.from(locs).sort();
  }, [npcs]);

  const filteredNpcs = React.useMemo(() => {
    return (npcs ?? []).filter(n => {
      if (filterStatus !== 'All' && (n.status ?? 'Active') !== filterStatus) return false;
      if (filterImportance !== 'All' && (n.importance ?? 'Minor') !== filterImportance) return false;
      if (filterLocation !== 'All' && n.location !== filterLocation) return false;
      if (filterFaction !== 'All' && n.factionId !== filterFaction) return false;
      if (searchQuery && !n.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [npcs, filterStatus, filterImportance, filterLocation, filterFaction, searchQuery]);

  const hasActiveFilters = filterStatus !== 'All' || filterImportance !== 'All' ||
    filterLocation !== 'All' || filterFaction !== 'All' || searchQuery;

  // ── Create state ──
  const [isCreateFormOpen, setIsCreateFormOpen] = React.useState(false);
  const [newNpcName, setNewNpcName] = React.useState('');
  const [newNpcDescription, setNewNpcDescription] = React.useState('');
  const [newNpcLocation, setNewNpcLocation] = React.useState('');
  const [newNpcStatus, setNewNpcStatus] = React.useState<NpcStatus>('Active');
  const [newNpcImportance, setNewNpcImportance] = React.useState<NpcImportance>('Minor');
  const [newNpcFactionId, setNewNpcFactionId] = React.useState<string>('none');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // ── Edit state ──
  const [isEditFormOpen, setIsEditFormOpen] = React.useState(false);
  const [editingNpc, setEditingNpc] = React.useState<Npc | null>(null);
  const [editedName, setEditedName] = React.useState('');
  const [editedDescription, setEditedDescription] = React.useState('');
  const [editedLocation, setEditedLocation] = React.useState('');
  const [editedStatus, setEditedStatus] = React.useState<NpcStatus>('Active');
  const [editedImportance, setEditedImportance] = React.useState<NpcImportance>('Minor');
  const [editedFactionId, setEditedFactionId] = React.useState('none');

  // ── AI generate state ──
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [generatedNpc, setGeneratedNpc] = React.useState<GenerateNpcOutput | null>(null);
  const [generationLocation, setGenerationLocation] = React.useState('');

  const handleCreateNpc = async () => {
    if (!npcsRef || !newNpcName.trim() || !newNpcDescription.trim()) return;
    setIsSubmitting(true);
    const faction = factions?.find(f => f.id === newNpcFactionId);
    try {
      await addDocumentNonBlocking(npcsRef, {
        campaignId: campaign.id,
        name: newNpcName,
        description: newNpcDescription,
        ...(newNpcLocation ? { location: newNpcLocation } : {}),
        status: newNpcStatus,
        importance: newNpcImportance,
        ...(newNpcFactionId && newNpcFactionId !== 'none' ? { factionId: newNpcFactionId, factionName: faction?.name } : {}),
      });
      setNewNpcName(''); setNewNpcDescription(''); setNewNpcLocation('');
      setNewNpcStatus('Active'); setNewNpcImportance('Minor'); setNewNpcFactionId('none');
      toast({ title: 'NPC added!' });
      setIsCreateFormOpen(false);
    } catch {
      toast({ variant: 'destructive', title: 'Could not add NPC' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNpc = (npcId: string) => {
    if (!user || !npcId) return;
    const npcDocRef = doc(firestore, 'users', user.uid, 'campaigns', campaign.id, 'npcs', npcId);
    deleteDocumentNonBlocking(npcDocRef);
    toast({ title: 'NPC removed.' });
  };

  const handleOpenEditDialog = (npc: Npc) => {
    setEditingNpc(npc);
    setEditedName(npc.name);
    setEditedDescription(npc.description);
    setEditedLocation(npc.location || '');
    setEditedStatus(npc.status ?? 'Active');
    setEditedImportance(npc.importance ?? 'Minor');
    setEditedFactionId(npc.factionId ?? 'none');
    setIsEditFormOpen(true);
  };

  const handleUpdateNpc = async () => {
    if (!user || !editingNpc || !editedName.trim() || !editedDescription.trim()) return;
    setIsSubmitting(true);
    const faction = factions?.find(f => f.id === editedFactionId);
    try {
      const npcDocRef = doc(firestore, 'users', user.uid, 'campaigns', campaign.id, 'npcs', editingNpc.id);
      await updateDocumentNonBlocking(npcDocRef, {
        name: editedName,
        description: editedDescription,
        location: editedLocation || deleteField(),
        status: editedStatus,
        importance: editedImportance,
        factionId: editedFactionId && editedFactionId !== 'none' ? editedFactionId : deleteField(),
        factionName: faction?.name ?? deleteField(),
      });
      toast({ title: 'NPC updated!' });
      setIsEditFormOpen(false);
      setEditingNpc(null);
    } catch {
      toast({ variant: 'destructive', title: 'Could not update NPC' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateNpc = async () => {
    setIsGenerating(true);
    setGeneratedNpc(null);
    const { data, error } = await getNpc({
      campaignContext: `Campaign: ${campaign.name}\nDescription: ${campaign.description}`,
      locationContext: generationLocation || undefined,
    });
    if (data) setGeneratedNpc(data);
    else toast({ variant: 'destructive', title: 'NPC Generation Failed', description: error ?? 'Unknown error' });
    setIsGenerating(false);
  };

  const buildNpcDescription = (npc: GenerateNpcOutput): string => {
    return [
      npc.appearance && `Appearance: ${npc.appearance}`,
      npc.personality && `Personality: ${npc.personality}`,
      npc.backstory && `Backstory: ${npc.backstory}`,
      npc.motivation && `Motivation: ${npc.motivation}`,
      npc.secret && `Secret: ${npc.secret}`,
      npc.speechPattern && `Speech: ${npc.speechPattern}`,
    ].filter(Boolean).join('\n\n');
  };

  const handleSaveGeneratedNpc = async () => {
    if (!npcsRef || !generatedNpc) return;
    try {
      const loc = generatedNpc.location || generationLocation;
      await addDocumentNonBlocking(npcsRef, {
        campaignId: campaign.id,
        name: generatedNpc.name,
        description: buildNpcDescription(generatedNpc),
        ...(loc ? { location: loc } : {}),
        status: 'Active' as NpcStatus,
        importance: 'Minor' as NpcImportance,
      });
      toast({ title: `Added ${generatedNpc.name}!` });
      setGeneratedNpc(null);
      setGenerationLocation('');
      setIsGenerateDialogOpen(false);
    } catch {
      toast({ variant: 'destructive', title: 'Could not save NPC' });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="text-center">
        <h2 className="text-4xl font-headline font-bold">NPC Dossier</h2>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
          Manage the allies, adversaries, and acquaintances in "{campaign.name}".
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex justify-center gap-4">
        <Dialog open={isCreateFormOpen} onOpenChange={setIsCreateFormOpen}>
          <DialogTrigger asChild>
            <Button><PlusCircle className="mr-2 h-4 w-4" /> Add NPC Manually</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-headline text-2xl">Add a New NPC</DialogTitle>
              <DialogDescription>Provide the details for a new non-player character.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Input placeholder="NPC Name *" value={newNpcName} onChange={e => setNewNpcName(e.target.value)} disabled={isSubmitting} />
              <Input placeholder="Location (e.g., 'Mirathen')" value={newNpcLocation} onChange={e => setNewNpcLocation(e.target.value)} disabled={isSubmitting} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="label-forge mb-1.5">Status</p>
                  <Select value={newNpcStatus} onValueChange={v => setNewNpcStatus(v as NpcStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {NPC_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="label-forge mb-1.5">Importance</p>
                  <Select value={newNpcImportance} onValueChange={v => setNewNpcImportance(v as NpcImportance)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {NPC_IMPORTANCES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {factions && factions.length > 0 && (
                <div>
                  <p className="label-forge mb-1.5">Faction (optional)</p>
                  <Select value={newNpcFactionId} onValueChange={setNewNpcFactionId}>
                    <SelectTrigger><SelectValue placeholder="No faction" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No faction</SelectItem>
                      {factions.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Textarea
                placeholder="Description, personality, and backstory..."
                value={newNpcDescription}
                onChange={e => setNewNpcDescription(e.target.value)}
                disabled={isSubmitting}
                className="min-h-[120px] font-body"
              />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="secondary" disabled={isSubmitting}>Cancel</Button></DialogClose>
              <Button onClick={handleCreateNpc} disabled={isSubmitting || !newNpcName.trim() || !newNpcDescription.trim()}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                Save NPC
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isGenerateDialogOpen} onOpenChange={open => { if (!open) { setGeneratedNpc(null); setGenerationLocation(''); } setIsGenerateDialogOpen(open); }}>
          <DialogTrigger asChild>
            <Button variant="outline"><Wand2 className="mr-2" /> Generate NPC with AI</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-headline text-2xl">Generate a New NPC</DialogTitle>
              <DialogDescription>Need an NPC on the fly? Let the AI create one for you.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Optional: Where is the NPC? (e.g., 'a tavern in Mirathen')"
                value={generationLocation}
                onChange={e => setGenerationLocation(e.target.value)}
                disabled={isGenerating}
              />
              <Button onClick={handleGenerateNpc} disabled={isGenerating} className="w-full">
                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                {isGenerating ? 'Generating...' : 'Generate NPC'}
              </Button>
            </div>
            <ScrollArea className="max-h-[50vh] pr-6">
              {isGenerating && (
                <div className="space-y-4 pt-4">
                  <Skeleton className="h-6 w-1/2" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                  </div>
                </div>
              )}
              {generatedNpc && (
                <Card className="mt-4 animate-in fade-in">
                  <CardHeader>
                    <CardTitle className="font-headline text-xl">{generatedNpc.name}</CardTitle>
                    {generatedNpc.location && <CardDescription>{generatedNpc.location}</CardDescription>}
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {generatedNpc.appearance && <div><p className="font-semibold text-accent-foreground mb-1">Appearance</p><p className="text-muted-foreground">{generatedNpc.appearance}</p></div>}
                    {generatedNpc.personality && <div><p className="font-semibold text-accent-foreground mb-1">Personality</p><p className="text-muted-foreground">{generatedNpc.personality}</p></div>}
                    {generatedNpc.motivation && <div><p className="font-semibold text-accent-foreground mb-1">Motivation</p><p className="text-muted-foreground">{generatedNpc.motivation}</p></div>}
                    {generatedNpc.secret && <div><p className="font-semibold text-accent-foreground mb-1">🔒 Secret</p><p className="text-muted-foreground italic">{generatedNpc.secret}</p></div>}
                    {generatedNpc.speechPattern && <div><p className="font-semibold text-accent-foreground mb-1">Speech</p><p className="text-muted-foreground">{generatedNpc.speechPattern}</p></div>}
                  </CardContent>
                </Card>
              )}
            </ScrollArea>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="secondary" disabled={isGenerating}>Cancel</Button></DialogClose>
              <Button onClick={handleSaveGeneratedNpc} disabled={!generatedNpc}>
                <PlusCircle className="mr-2 h-4 w-4" /> Save to Campaign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center p-4 rounded-lg border border-border/50 bg-card/50">
        <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <Input
          placeholder="Search by name..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-44 h-8 text-sm"
        />
        <Select value={filterImportance} onValueChange={v => setFilterImportance(v as any)}>
          <SelectTrigger className="w-28 h-8 text-sm"><SelectValue placeholder="Importance" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All</SelectItem>
            {NPC_IMPORTANCES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={v => setFilterStatus(v as any)}>
          <SelectTrigger className="w-28 h-8 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All</SelectItem>
            {NPC_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        {locations.length > 0 && (
          <Select value={filterLocation} onValueChange={setFilterLocation}>
            <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Location" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Locations</SelectItem>
              {locations.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {factions && factions.length > 0 && (
          <Select value={filterFaction} onValueChange={setFilterFaction}>
            <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Faction" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Factions</SelectItem>
              {factions.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground"
            onClick={() => { setFilterStatus('All'); setFilterImportance('All'); setFilterLocation('All'); setFilterFaction('All'); setSearchQuery(''); }}>
            Clear filters
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {filteredNpcs.length} of {npcs?.length ?? 0} NPCs
        </span>
      </div>

      {/* NPC grid */}
      {npcsLoading ? (
        <div className="text-center"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /></div>
      ) : filteredNpcs.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredNpcs.map(npc => {
            const statusCfg = STATUS_CONFIG[npc.status ?? 'Active'];
            const isKey = (npc.importance ?? 'Minor') === 'Key';
            return (
              <Card key={npc.id} className={cn(
                'flex flex-col group',
                isKey && 'border-accent/25'
              )}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2.5">
                      <div className={cn('w-2 h-2 rounded-full flex-shrink-0 mt-1', statusCfg.dot)} title={npc.status ?? 'Active'} />
                      <CardTitle className="font-headline text-xl leading-tight">{npc.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenEditDialog(npc)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {npc.name}?</AlertDialogTitle>
                            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteNpc(npc.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    {npc.location && <CardDescription className="text-xs">📍 {npc.location}</CardDescription>}
                    {isKey && <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-accent/40 text-accent/80">Key NPC</Badge>}
                    {npc.factionName && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{npc.factionName}</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 font-body flex-grow min-h-[100px]">
                  <TruncatedContent title="Description" content={npc.description} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : npcs && npcs.length > 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No NPCs match your filters.</p>
          <Button variant="ghost" size="sm" className="mt-2"
            onClick={() => { setFilterStatus('All'); setFilterImportance('All'); setFilterLocation('All'); setFilterFaction('All'); setSearchQuery(''); }}>
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="text-center py-16 bg-card/50 border border-dashed rounded-xl">
          <Users className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-2xl font-headline">A Quiet World...</h3>
          <p className="mt-2 text-muted-foreground">Add your first NPC to begin populating your campaign world.</p>
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={isEditFormOpen} onOpenChange={setIsEditFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl">Edit {editingNpc?.name}</DialogTitle>
            <DialogDescription>Update the NPC's details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input placeholder="NPC Name" value={editedName} onChange={e => setEditedName(e.target.value)} disabled={isSubmitting} />
            <Input placeholder="Location" value={editedLocation} onChange={e => setEditedLocation(e.target.value)} disabled={isSubmitting} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="label-forge mb-1.5">Status</p>
                <Select value={editedStatus} onValueChange={v => setEditedStatus(v as NpcStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NPC_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="label-forge mb-1.5">Importance</p>
                <Select value={editedImportance} onValueChange={v => setEditedImportance(v as NpcImportance)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NPC_IMPORTANCES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {factions && factions.length > 0 && (
              <div>
                <p className="label-forge mb-1.5">Faction</p>
                <Select value={editedFactionId} onValueChange={setEditedFactionId}>
                  <SelectTrigger><SelectValue placeholder="No faction" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No faction</SelectItem>
                    {factions.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Textarea placeholder="NPC description..." value={editedDescription} onChange={e => setEditedDescription(e.target.value)} disabled={isSubmitting} className="min-h-[120px] font-body" />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="secondary" disabled={isSubmitting}>Cancel</Button></DialogClose>
            <Button onClick={handleUpdateNpc} disabled={isSubmitting || !editedName.trim() || !editedDescription.trim()}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
