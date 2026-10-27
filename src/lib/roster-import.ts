import type { Disposition, MentionKind, NpcImportance, NpcStatus } from '@/lib/types';
import { KIND_PRIORITY, MIN_DETECT_LENGTH, type MentionTarget } from '@/lib/mentions';

/**
 * Bulk import of NPCs, places and factions from a spreadsheet.
 *
 * Pure functions only (no Firestore), so the parsing and matching rules can be
 * tested on their own; the writes live in `roster-import-write.ts`.
 *
 * The input is whatever the DM has: rows copied out of Excel / Numbers / Google
 * Sheets (tab-separated on the clipboard) or a saved .csv. Columns are matched
 * by header name, so extra columns like "Group" or "Added?" are reported and
 * ignored rather than rejected, and column order doesn't matter.
 *
 * Nothing existing is ever overwritten. A row whose name or alias matches an
 * entity already in the campaign can only add aliases to it, because aliases
 * have no editor anywhere else in the app and the Loom depends on them.
 */

export type ImportKind = Extract<MentionKind, 'npc' | 'place' | 'faction'>;

export const IMPORT_KINDS: ImportKind[] = ['npc', 'place', 'faction'];

export const IMPORT_KIND_PLURAL: Record<ImportKind, string> = {
  npc: 'NPCs',
  place: 'Places',
  faction: 'Factions',
};

/** Firestore field names, exactly as `types.ts` spells them. */
type NpcField =
  | 'name' | 'aliases' | 'description' | 'location' | 'status' | 'importance'
  | 'disposition' | 'faction' | 'wants' | 'knows' | 'look' | 'secret' | 'lastSeenSession';
type PlaceField = 'name' | 'aliases' | 'description';
type FactionField =
  | 'name' | 'aliases' | 'description' | 'leader' | 'homeBase' | 'disposition'
  | 'currentAgenda' | 'whatTheyKnow';
type Field = NpcField | PlaceField | FactionField;

/**
 * Accepted headers per field, compared after `normHeader` (lowercase, letters
 * and digits only), so "Secret (DM only)" and "secret" both land on `secret`.
 * Labels from the app's own edit dialog are included so a sheet written by
 * looking at that dialog just works.
 */
const HEADERS: Record<ImportKind, Partial<Record<Field, string[]>>> = {
  npc: {
    name: ['name'],
    aliases: ['aliases', 'alias', 'alsocalled', 'aka', 'othernames'],
    description: ['description', 'desc'],
    location: ['location', 'where'],
    status: ['status'],
    importance: ['importance'],
    disposition: ['disposition', 'attitude'],
    faction: ['faction', 'factionname'],
    wants: ['wants', 'wantsthisscene'],
    knows: ['knows', 'knowsthisscene'],
    look: ['look', 'lookforgeneratedart', 'appearance'],
    secret: ['secret', 'secretdmonly', 'dmsecret', 'dmonly'],
    lastSeenSession: ['lastseen', 'lastseensession'],
  },
  place: {
    name: ['name'],
    aliases: ['aliases', 'alias', 'alsocalled', 'aka', 'othernames'],
    description: ['description', 'desc'],
  },
  faction: {
    name: ['name'],
    aliases: ['aliases', 'alias', 'alsocalled', 'aka', 'othernames'],
    description: ['description', 'desc'],
    leader: ['leader'],
    homeBase: ['homebase', 'base', 'headquarters'],
    disposition: ['disposition', 'attitude'],
    currentAgenda: ['currentagenda', 'agenda', 'wants'],
    whatTheyKnow: ['whattheyknow', 'knows'],
  },
};

const STATUSES: NpcStatus[] = ['Active', 'Inactive', 'Dead', 'Unknown'];
const IMPORTANCES: NpcImportance[] = ['Key', 'Minor'];
const DISPOSITIONS: Disposition[] = ['Hostile', 'Unfriendly', 'Neutral', 'Friendly', 'Allied'];

export function normHeader(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Case- and whitespace-insensitive key for comparing names. */
export function nameKey(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

// ── Parsing ───────────────────────────────────────────────────────────────

/**
 * Clipboard copies from every spreadsheet app are tab-separated, and a .csv
 * almost never contains a tab, so a tab anywhere means TSV.
 */
export function detectDelimiter(text: string): ',' | '\t' {
  return text.includes('\t') ? '\t' : ',';
}

/**
 * Whether the quote at `open` (the first character of a cell) starts a quoted
 * field: only if it has a closing quote that ends the cell, i.e. is followed
 * by the delimiter, a line end or the end of the text. Otherwise the quote is
 * literal text. Without this check an unclosed quote (a description starting
 * `"Never trust a priest`) swallowed every row after it into one cell, and a
 * nickname like `"Mad" Mags` lost its quote marks.
 */
function opensQuotedField(text: string, open: number, delimiter: string): boolean {
  for (let j = open + 1; j < text.length; j++) {
    if (text[j] !== '"') continue;
    if (text[j + 1] === '"') { j++; continue; } // escaped quote
    const after = text[j + 1];
    return after === undefined || after === delimiter || after === '\r' || after === '\n';
  }
  return false;
}

/**
 * RFC 4180 parser: quoted fields, `""` escapes, newlines inside quotes, CRLF /
 * LF / CR line ends, leading BOM. Excel quotes TSV cells the same way when a
 * cell holds a newline or a quote, so one parser serves both.
 */
export function parseDelimited(input: string, delimiter: ',' | '\t' = detectDelimiter(input)): string[][] {
  const text = input.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  // A quote only opens a quoted field at the very start of a cell, and only
  // when it is properly closed (`opensQuotedField`); elsewhere it is literal
  // text (Excel writes `5' 5"` unquoted in TSV).
  let atCellStart = true;

  const endField = () => { row.push(field); field = ''; atCellStart = true; };
  const endRow = () => { endField(); rows.push(row); row = []; };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && atCellStart && opensQuotedField(text, i, delimiter)) {
      inQuotes = true; atCellStart = false; continue;
    }
    if (ch === delimiter) { endField(); continue; }
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      endRow();
      continue;
    }
    field += ch;
    atCellStart = false;
  }
  // A trailing newline must not produce a phantom empty row.
  if (field !== '' || row.length > 0) endRow();
  return rows;
}

// ── Mapping ───────────────────────────────────────────────────────────────

export type ColumnMap = {
  /** 0-based index of the header row inside the parsed table. */
  headerIndex: number;
  columns: Partial<Record<Field, number>>;
  /** Headers that matched no field, in sheet order, for the preview to list. */
  ignored: string[];
};

/**
 * The header row is the first row with a cell that maps to `name`, so title
 * rows or notes above the table are skipped (the roster sheet has two).
 * Returns null when no row has a Name column.
 */
export function mapColumns(table: string[][], kind: ImportKind): ColumnMap | null {
  const lookup = new Map<string, Field>();
  for (const [field, names] of Object.entries(HEADERS[kind]) as [Field, string[]][]) {
    for (const n of names) lookup.set(n, field);
  }

  const headerIndex = table.findIndex(r => r.some(c => lookup.get(normHeader(c)) === 'name'));
  if (headerIndex === -1) return null;

  const columns: ColumnMap['columns'] = {};
  const ignored: string[] = [];
  table[headerIndex].forEach((cell, i) => {
    const field = lookup.get(normHeader(cell));
    // First column wins if a sheet repeats a header.
    if (field && columns[field] === undefined) columns[field] = i;
    else if (cell.trim()) ignored.push(cell.trim());
  });
  return { headerIndex, columns, ignored };
}

/** Aliases are separated by semicolons or line breaks; commas appear inside names. */
export function splitAliases(raw: string, name: string): string[] {
  const own = nameKey(name);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[;\n]/)) {
    const a = part.trim().replace(/\s+/g, ' ');
    const k = nameKey(a);
    if (!a || k === own || seen.has(k)) continue;
    seen.add(k);
    out.push(a);
  }
  return out;
}

function pickEnum<T extends string>(raw: string, allowed: readonly T[]): T | undefined {
  const k = raw.trim().toLowerCase();
  return allowed.find(v => v.toLowerCase() === k);
}

// ── Matching against the campaign ─────────────────────────────────────────

/** What a row is about to do. */
export type RowAction =
  /** Creates a new document. */
  | { type: 'new' }
  /** Same entity already exists; can only add the aliases it is missing. */
  | { type: 'existing'; id: string; existingName: string; newAliases: string[] }
  /** Names or aliases point at two or more existing entities; skipped. */
  | { type: 'ambiguous'; names: string[] }
  /** An earlier row in the same paste already claims this name. */
  | { type: 'repeat'; line: number }
  | { type: 'invalid'; reason: string };

export type ImportRow = {
  /** Row number as the spreadsheet shows it (1-based), for the preview. */
  line: number;
  name: string;
  aliases: string[];
  /**
   * The new document minus `campaignId` and kind defaults; those are added at
   * write time. Values are only ever strings, numbers or string arrays.
   */
  fields: Record<string, string | number | string[]>;
  action: RowAction;
  warnings: string[];
  /**
   * Names this row would write that already belong to a different page. Such
   * rows start unticked: a shared name can move existing `[[links]]` and stops
   * auto-detection for both pages, so it should be a deliberate choice.
   */
  sharedNames: string[];
};

export type ImportPlan = {
  kind: ImportKind;
  rows: ImportRow[];
  ignoredColumns: string[];
};

export type PlanContext = {
  /** Existing entities of the kind being imported. */
  existing: readonly { id: string; name: string; aliases?: string[] }[];
  /** Factions in the campaign, for resolving an NPC's Faction column to an id. */
  factions: readonly { id: string; name: string; aliases?: string[] }[];
  /**
   * Every mentionable entity of every kind (`mentionTargets`). Used only to
   * warn when an imported name or alias is already taken by a *different*
   * page: the mentions index skips auto-detection for shared names.
   */
  targets: readonly MentionTarget[];
};

/**
 * Whether a row has anything to write: a new entity, or aliases an existing
 * one lacks. These are the rows the preview offers.
 */
export function canImport(row: ImportRow): boolean {
  return row.action.type === 'new'
    || (row.action.type === 'existing' && row.action.newAliases.length > 0);
}

/** Rows the preview ticks to begin with: importable, and no shared names. */
export function tickedByDefault(row: ImportRow): boolean {
  return canImport(row) && row.sharedNames.length === 0;
}

const KIND_WORD: Record<MentionKind, string> = {
  npc: 'an NPC', party: 'a party member', place: 'a place', faction: 'a faction', item: 'an item', thread: 'a thread',
};
const KIND_NOUN: Record<MentionKind, string> = {
  npc: 'NPC', party: 'party member', place: 'place', faction: 'faction', item: 'item', thread: 'thread',
};

/**
 * What sharing `name` with `others` would do, matching `createMatcher` in
 * mentions.ts: a `[[link]]` goes to the kind that comes first in
 * KIND_PRIORITY, and auto-detection skips a name two pages claim.
 */
function sharedNameWarning(name: string, kind: ImportKind, others: readonly MentionTarget[]): string {
  const rank = (k: MentionKind) => KIND_PRIORITY.indexOf(k);
  const top = [...others].sort((a, b) => rank(a.ref.kind) - rank(b.ref.kind))[0];
  const link = rank(kind) < rank(top.ref.kind)
    ? `[[${name}]] links, including ones already in recaps, would point at this ${KIND_NOUN[kind]} instead`
    : `[[${name}]] links keep going to the ${KIND_NOUN[top.ref.kind]}`;
  const detect = name.length >= MIN_DETECT_LENGTH
    ? ', and the Loom stops auto-detecting the name for both pages'
    : '';
  return `"${name}" is also ${KIND_WORD[top.ref.kind]} (${top.name}). ${link}${detect}. Left unticked.`;
}

export function planImport(text: string, kind: ImportKind, ctx: PlanContext): ImportPlan | { error: string } {
  if (!text.trim()) return { error: 'Paste some rows or choose a file first.' };
  const table = parseDelimited(text);
  const map = mapColumns(table, kind);
  if (!map) {
    return { error: 'No "Name" column found. Include the header row when you copy, or add a column headed Name.' };
  }

  const { columns } = map;
  const cell = (r: string[], f: Field) => {
    const i = columns[f];
    return i === undefined ? '' : (r[i] ?? '').trim();
  };

  // name key → the entities that claim it, across names and aliases.
  const index = (list: PlanContext['existing']) => {
    const m = new Map<string, { id: string; name: string }[]>();
    for (const e of list) {
      for (const n of [e.name, ...(e.aliases ?? [])]) {
        const k = nameKey(n ?? '');
        if (!k) continue;
        const arr = m.get(k) ?? [];
        if (!arr.some(x => x.id === e.id)) arr.push({ id: e.id, name: e.name });
        m.set(k, arr);
      }
    }
    return m;
  };
  const existingByKey = index(ctx.existing);
  const factionsByKey = index(ctx.factions);

  const targetsByKey = new Map<string, MentionTarget[]>();
  for (const t of ctx.targets) {
    for (const n of [t.name, ...(t.aliases ?? [])]) {
      const k = nameKey(n ?? '');
      if (!k) continue;
      const arr = targetsByKey.get(k) ?? [];
      if (!arr.some(x => x.ref.kind === t.ref.kind && x.ref.id === t.ref.id)) arr.push(t);
      targetsByKey.set(k, arr);
    }
  }

  const claimedInPaste = new Map<string, number>();
  const rows: ImportRow[] = [];

  for (let i = map.headerIndex + 1; i < table.length; i++) {
    const r = table[i];
    if (r.every(c => !c.trim())) continue;
    const line = i + 1;
    const name = cell(r, 'name').replace(/\s+/g, ' ');
    const warnings: string[] = [];

    if (!name) {
      rows.push({ line, name: '', aliases: [], fields: {}, warnings, sharedNames: [], action: { type: 'invalid', reason: 'No name' } });
      continue;
    }

    const aliases = splitAliases(cell(r, 'aliases'), name);
    const keys = [name, ...aliases].map(nameKey);

    // ── Action ──
    let action: RowAction;
    const repeatOf = keys.map(k => claimedInPaste.get(k)).find(n => n !== undefined);
    const hits = new Map<string, { id: string; name: string }>();
    for (const k of keys) for (const e of existingByKey.get(k) ?? []) hits.set(e.id, e);

    if (repeatOf !== undefined) {
      action = { type: 'repeat', line: repeatOf };
    } else if (hits.size > 1) {
      action = { type: 'ambiguous', names: [...hits.values()].map(e => e.name) };
    } else if (hits.size === 1) {
      const [hit] = [...hits.values()];
      const current = ctx.existing.find(e => e.id === hit.id);
      const have = new Set([current?.name ?? '', ...(current?.aliases ?? [])].map(nameKey));
      // The row's own name counts too: importing "Korrak" with alias "Korr"
      // onto an existing "Korr" should add "Korrak".
      const newAliases = [name, ...aliases].filter(a => !have.has(nameKey(a)));
      action = { type: 'existing', id: hit.id, existingName: hit.name, newAliases };
    } else {
      action = { type: 'new' };
    }
    if (action.type !== 'repeat') for (const k of keys) if (!claimedInPaste.has(k)) claimedInPaste.set(k, line);

    // ── Fields (only matter for new rows, but warnings help either way) ──
    const fields: ImportRow['fields'] = { name };
    if (aliases.length) fields.aliases = aliases;
    const description = cell(r, 'description');
    if (description) fields.description = description;
    else if (action.type === 'new') warnings.push('No description. The app asks for one when you next edit it.');

    const text = (f: Field) => { const v = cell(r, f); if (v) fields[f] = v; };

    if (kind === 'npc') {
      text('location'); text('wants'); text('knows'); text('look'); text('secret');

      const status = cell(r, 'status');
      if (status) {
        const v = pickEnum(status, STATUSES);
        if (v) fields.status = v;
        else warnings.push(`Status "${status}" isn't one of ${STATUSES.join(', ')}; left as Active.`);
      }
      const importance = cell(r, 'importance');
      if (importance) {
        const v = pickEnum(importance, IMPORTANCES);
        if (v) fields.importance = v;
        else warnings.push(`Importance "${importance}" isn't Key or Minor; left as Minor.`);
      }
      const disposition = cell(r, 'disposition');
      if (disposition) {
        const v = pickEnum(disposition, DISPOSITIONS);
        if (v) fields.disposition = v;
        else warnings.push(`Disposition "${disposition}" isn't one of ${DISPOSITIONS.join(', ')}; left blank.`);
      }
      const faction = cell(r, 'faction');
      if (faction) {
        const found = factionsByKey.get(nameKey(faction)) ?? [];
        if (found.length === 1) {
          fields.factionId = found[0].id;
          fields.factionName = found[0].name;
        } else if (found.length > 1) {
          warnings.push(`"${faction}" matches more than one faction; saved without a faction.`);
        } else {
          warnings.push(`No faction called "${faction}" in this campaign. Import factions first, or this NPC is saved without one.`);
        }
      }
      const lastSeen = cell(r, 'lastSeenSession');
      if (lastSeen) {
        const n = Number(lastSeen);
        if (Number.isInteger(n) && n > 0) fields.lastSeenSession = n;
        else warnings.push(`Last seen "${lastSeen}" isn't a session number; left blank.`);
      }
    } else if (kind === 'faction') {
      text('leader'); text('homeBase'); text('currentAgenda'); text('whatTheyKnow');
      const disposition = cell(r, 'disposition');
      if (disposition) {
        const v = pickEnum(disposition, DISPOSITIONS);
        if (v) fields.disposition = v;
        else warnings.push(`Disposition "${disposition}" isn't one of ${DISPOSITIONS.join(', ')}; left as Neutral.`);
      }
    }

    // ── Shared-name warnings ──
    // Only for names this row would actually write, and only when the clash is
    // with a different page from the one being matched.
    const ownId = action.type === 'existing' ? action.id : null;
    const written = action.type === 'new' ? [name, ...aliases]
      : action.type === 'existing' ? action.newAliases : [];
    const sharedNames: string[] = [];
    for (const n of written) {
      const others = (targetsByKey.get(nameKey(n)) ?? [])
        .filter(t => !(t.ref.kind === kind && t.ref.id === ownId));
      if (others.length) {
        sharedNames.push(n);
        warnings.push(sharedNameWarning(n, kind, others));
      }
    }

    rows.push({ line, name, aliases, fields, action, warnings, sharedNames });
  }

  return { kind, rows, ignoredColumns: map.ignored };
}

/** Counts for the preview's summary line. */
export function summarize(rows: readonly ImportRow[], included: ReadonlySet<number>) {
  let creates = 0, aliasUpdates = 0, skipped = 0;
  for (const r of rows) {
    if (!included.has(r.line)) { skipped++; continue; }
    if (r.action.type === 'new') creates++;
    else if (r.action.type === 'existing') aliasUpdates++;
  }
  return { creates, aliasUpdates, skipped };
}
