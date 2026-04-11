'use client';

import * as React from 'react';
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import type { Session, Character, Campaign, Npc } from '@/lib/types';
import { Loader2, ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const PC_COLORS = [
  '#3db8a8', '#8ab4d4', '#8ebc7a', '#d4c9a8', '#b07acc', '#c47a5a',
];

function toRoman(n: number): string {
  const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
  const syms = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
  let result = '';
  for (let i = 0; i < vals.length; i++) {
    while (n >= vals[i]) { result += syms[i]; n -= vals[i]; }
  }
  return result;
}

function timeAgo(dateStr: string | any): string {
  if (!dateStr) return '';
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr?.toDate?.() ?? new Date();
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// ─── Stat pill ───────────────────────────────────────────────────────────────
function StatPill({ label, value }: { label: string; value?: number }) {
  return (
    <div className="flex flex-col items-center bg-background/50 rounded px-2 py-1 min-w-[36px]">
      <span className="font-headline text-xs font-bold text-foreground/90 leading-none">
        {value ?? '—'}
      </span>
      <span className="text-[9px] text-muted-foreground leading-none mt-0.5">{label}</span>
    </div>
  );
}

// ─── Character panel ──────────────────────────────────────────────────────────
function CharacterPanel({ char, color }: { char: Character; color: string }) {
  const [open, setOpen] = React.useState(false);
  const hasStats = char.armorClass || char.speed || char.passivePerception;

  return (
    <div className="rounded-md overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-2 py-1.5 hover:bg-white/4 transition-colors rounded-md"
      >
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="text-sm text-foreground/80 flex-1 text-left leading-none">{char.name}</span>
        {char.class && <span className="text-xs text-muted-foreground italic flex-shrink-0">{char.class}</span>}
        {hasStats && (
          open
            ? <ChevronUp className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
            : <ChevronDown className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
        )}
      </button>

      {open && hasStats && (
        <div className="px-2 pb-2 pt-1">
          <div className="flex gap-1.5 flex-wrap">
            {char.armorClass && <StatPill label="AC" value={char.armorClass} />}
            {char.speed && <StatPill label="Spd" value={char.speed} />}
            {char.passivePerception && <StatPill label="Perc" value={char.passivePerception} />}
            {char.passiveInvestigation && <StatPill label="Inv" value={char.passiveInvestigation} />}
            {char.passiveInsight && <StatPill label="Ins" value={char.passiveInsight} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Session panel ────────────────────────────────────────────────────────────
function SessionPanel({
  session, isActive, onSelect,
}: {
  session: Session;
  isActive: boolean;
  onSelect: (s: Session) => void;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className={cn(
      'rounded-lg border transition-colors',
      isActive ? 'border-primary/25 bg-primary/6' : 'border-transparent hover:border-primary/15'
    )}>
      <button
        onClick={() => { setOpen(o => !o); onSelect(session); }}
        className="w-full px-3 py-2 text-left"
      >
        <div className="session-label mb-0.5">Session {toRoman(session.sessionNumber)}</div>
        <div className="text-xs text-foreground/70 leading-snug line-clamp-1">
          {session.summary?.slice(0, 50) || `Session ${session.sessionNumber}`}
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">
          {isActive ? 'Current' : timeAgo(session.date)}
        </div>
      </button>

      {open && session.summary && (
        <div className="px-3 pb-3 border-t border-primary/10 mt-1">
          <p className="text-xs text-foreground/60 leading-relaxed mt-2 line-clamp-6">
            {session.summary}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── NPC search panel ─────────────────────────────────────────────────────────
function NpcSearch({ npcs }: { npcs: Npc[] }) {
  const [query, setQuery] = React.useState('');
  const [selectedNpc, setSelectedNpc] = React.useState<Npc | null>(null);

  const filtered = npcs.filter(n =>
    n.name.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setSelectedNpc(null); }}
          placeholder="Search NPCs..."
          className="w-full bg-background/40 border border-primary/15 rounded-md pl-7 pr-3 py-1.5 text-xs text-foreground/80 placeholder:text-muted-foreground/40 outline-none focus:border-primary/35"
        />
        {query && (
          <button onClick={() => { setQuery(''); setSelectedNpc(null); }}
            className="absolute right-2 top-1/2 -translate-y-1/2">
            <X className="h-3 w-3 text-muted-foreground/50" />
          </button>
        )}
      </div>

      {selectedNpc ? (
        <div className="bg-primary/5 border border-primary/15 rounded-lg p-3 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <p className="font-headline text-xs text-accent/90">{selectedNpc.name}</p>
            <button onClick={() => setSelectedNpc(null)}>
              <X className="h-3 w-3 text-muted-foreground/50" />
            </button>
          </div>
          {selectedNpc.location && (
            <p className="text-[10px] text-muted-foreground">📍 {selectedNpc.location}</p>
          )}
          <p className="text-xs text-foreground/70 leading-relaxed line-clamp-6">
            {selectedNpc.description}
          </p>
        </div>
      ) : query ? (
        <div className="space-y-0.5">
          {filtered.length > 0 ? filtered.map(npc => (
            <button
              key={npc.id}
              onClick={() => setSelectedNpc(npc)}
              className="w-full text-left px-2 py-1.5 rounded hover:bg-white/5 transition-colors"
            >
              <span className="text-xs text-foreground/75">{npc.name}</span>
              {npc.location && (
                <span className="text-[10px] text-muted-foreground ml-2">{npc.location}</span>
              )}
            </button>
          )) : (
            <p className="text-xs text-muted-foreground px-2 italic">No NPCs found.</p>
          )}
        </div>
      ) : (
        <div className="space-y-0.5">
          {npcs.slice(0, 5).map(npc => (
            <button
              key={npc.id}
              onClick={() => setSelectedNpc(npc)}
              className="w-full text-left px-2 py-1.5 rounded hover:bg-white/5 transition-colors"
            >
              <span className="text-xs text-foreground/65">{npc.name}</span>
              {npc.location && (
                <span className="text-[10px] text-muted-foreground ml-2 italic">{npc.location}</span>
              )}
            </button>
          ))}
          {npcs.length > 5 && (
            <p className="text-[10px] text-muted-foreground px-2">+{npcs.length - 5} more — search to find</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Collapsible section ──────────────────────────────────────────────────────
function SidebarSection({
  label, children, defaultOpen = true,
}: {
  label: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-2 mb-2"
      >
        <span className="label-forge">{label}</span>
        {open
          ? <ChevronUp className="h-3 w-3 text-muted-foreground/40" />
          : <ChevronDown className="h-3 w-3 text-muted-foreground/40" />}
      </button>
      {open && children}
    </div>
  );
}

// ─── Main sidebar ─────────────────────────────────────────────────────────────
interface SessionSidebarProps {
  campaignId: string;
}

export function SessionSidebar({ campaignId }: SessionSidebarProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [selectedSession, setSelectedSession] = React.useState<Session | null>(null);

  const campaignRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid, 'campaigns', campaignId);
  }, [user, firestore, campaignId]);
  const { data: campaign } = useDoc<Campaign>(campaignRef);

  const sessionsQuery = useMemoFirebase(() => {
    if (!user || !campaignId) return null;
    return query(
      collection(firestore, 'users', user.uid, 'campaigns', campaignId, 'sessions'),
      orderBy('sessionNumber', 'desc')
    );
  }, [user, campaignId, firestore]);
  const { data: sessions, isLoading: sessionsLoading } = useCollection<Session>(sessionsQuery);

  const charactersRef = useMemoFirebase(() => {
    if (!user || !campaignId) return null;
    return collection(firestore, 'users', user.uid, 'campaigns', campaignId, 'characters');
  }, [user, campaignId, firestore]);
  const { data: characters, isLoading: charsLoading } = useCollection<Character>(charactersRef);

  const npcsRef = useMemoFirebase(() => {
    if (!user || !campaignId) return null;
    return collection(firestore, 'users', user.uid, 'campaigns', campaignId, 'npcs');
  }, [user, campaignId, firestore]);
  const { data: npcs } = useCollection<Npc>(npcsRef);

  return (
    <aside className="w-64 flex-shrink-0 border-r border-primary/10 flex flex-col overflow-y-auto">

      {/* Campaign name */}
      <div className="px-4 py-3 border-b border-primary/8 flex-shrink-0">
        <p className="label-forge mb-0.5">Campaign</p>
        <p className="font-headline text-sm text-accent leading-tight">
          {campaign?.name ?? '—'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">

        {/* Session Log */}
        <SidebarSection label="Session Log">
          {sessionsLoading ? (
            <div className="flex justify-center py-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary/40" />
            </div>
          ) : sessions?.length ? (
            <div className="space-y-1">
              {sessions.slice(0, 6).map((session, i) => (
                <SessionPanel
                  key={session.id}
                  session={session}
                  isActive={i === 0}
                  onSelect={setSelectedSession}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground px-2 italic">No sessions yet.</p>
          )}
        </SidebarSection>

        {/* Party */}
        <SidebarSection label="The Party">
          {charsLoading ? (
            <div className="flex justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary/40" />
            </div>
          ) : characters?.length ? (
            <div className="space-y-0.5">
              {characters.slice(0, 8).map((char, i) => (
                <CharacterPanel
                  key={char.id}
                  char={char}
                  color={PC_COLORS[i % PC_COLORS.length]}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground px-2 italic">No characters added.</p>
          )}
        </SidebarSection>

        {/* NPCs */}
        {npcs && npcs.length > 0 && (
          <SidebarSection label="NPCs" defaultOpen={false}>
            <NpcSearch npcs={npcs} />
          </SidebarSection>
        )}

      </div>
    </aside>
  );
}
