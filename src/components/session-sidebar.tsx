'use client';

import * as React from 'react';
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import type { Session, Character, Campaign } from '@/lib/types';
import { Loader2 } from 'lucide-react';

// Character color dots — one per slot, cycles if more than 6
const PC_COLORS = [
  '#3db8a8', // teal
  '#8ab4d4', // steel blue
  '#8ebc7a', // sage green
  '#d4c9a8', // parchment
  '#b07acc', // violet
  '#c47a5a', // burnt orange
];

interface SessionSidebarProps {
  campaignId: string;
}

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
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`;
  return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''} ago`;
}

export function SessionSidebar({ campaignId }: SessionSidebarProps) {
  const { user } = useUser();
  const firestore = useFirestore();

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

  return (
    <aside className="w-64 flex-shrink-0 border-r border-primary/10 flex flex-col overflow-hidden">

      {/* Campaign name */}
      <div className="px-5 py-4 border-b border-primary/8">
        <p className="label-forge mb-1">Campaign</p>
        <p className="font-headline text-sm text-accent leading-tight">
          {campaign?.name ?? '—'}
        </p>
      </div>

      {/* Session log */}
      <div className="px-3 pt-4 pb-2">
        <p className="label-forge px-2 mb-3">Session Log</p>
        {sessionsLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-primary/40" />
          </div>
        ) : sessions && sessions.length > 0 ? (
          <div className="space-y-1">
            {sessions.slice(0, 6).map((session, i) => (
              <div
                key={session.id}
                className={`px-3 py-2.5 rounded-lg border transition-colors ${
                  i === 0
                    ? 'border-primary/25 bg-primary/6'
                    : 'border-transparent hover:border-primary/15 hover:bg-primary/3'
                }`}
              >
                <div className="session-label mb-0.5">
                  Session {toRoman(session.sessionNumber)}
                </div>
                <div className="text-sm text-foreground/80 leading-tight line-clamp-1">
                  {session.summary?.slice(0, 40) || `Session ${session.sessionNumber}`}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {i === 0 ? 'Current' : timeAgo(session.date)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground px-2 italic">No sessions logged yet.</p>
        )}
      </div>

      {/* Divider */}
      <div className="mx-3 my-2 border-t border-primary/8" />

      {/* Party roster */}
      <div className="px-3 pb-4">
        <p className="label-forge px-2 mb-3">The Party</p>
        {charsLoading ? (
          <div className="flex justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary/40" />
          </div>
        ) : characters && characters.length > 0 ? (
          <div className="space-y-0.5">
            {characters.slice(0, 8).map((char, i) => (
              <div key={char.id} className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-white/3">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: PC_COLORS[i % PC_COLORS.length] }}
                />
                <span className="text-sm text-foreground/75 flex-1 leading-none">{char.name}</span>
                {char.class && (
                  <span className="text-xs text-muted-foreground italic">{char.class}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground px-2 italic">No characters added yet.</p>
        )}
      </div>
    </aside>
  );
}
