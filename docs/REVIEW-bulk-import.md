# Review brief: bulk roster import (`feat/bulk-import`)

You're reviewing one branch against `main`. Read `CLAUDE.md` first; everything there still applies.
**Review only.** Don't push, don't deploy, don't run `firebase deploy`, and don't merge. Small fixes
are fine if Nick asks for them after he reads your findings.

```bash
git checkout feat/bulk-import
git diff main --stat   # works whether or not the change has been committed yet
git diff main
npm run typecheck      # passes on the branch
```

## Why this exists

The Loom (Story screen) draws a lane per NPC and finds each NPC's appearances by scanning recaps
for the NPC's **name or aliases** (`src/lib/mentions.ts`). Nick's campaign, *Shards of the Fallen God*,
is ten sessions in, and a lot of the NPCs the recaps name were never added to the app, so they have
no lane and no history.

Two gaps caused that, and this branch closes both:

1. **Adding NPCs, places and factions is one at a time** through the Codex dialog. Nick has a
   spreadsheet of about 39 missing NPCs. Now he can paste the rows in and import them in one go.
2. **The Obsidian session import already extracted `npcsIntroduced`, showed it, and discarded it.**
   It now offers to create the unknown names as NPCs when the session is saved.

A third finding shaped the design: **nothing in the UI can edit `aliases`** on any entity. The
field exists on `Npc`, `Location`, `Faction` and `Thread`, and the mentions index depends on it,
but no dialog writes it. So the importer doubles as the only alias editor. When a row matches an
NPC that already exists, the importer adds the missing aliases to it and changes nothing else.

## What changed

| File | Change |
|---|---|
| `src/lib/roster-import.ts` | **New.** Pure: delimited-text parser, header→field mapping, enum coercion, matching against existing entities, per-row actions and warnings. No Firebase imports. |
| `src/lib/roster-import-write.ts` | **New.** Firestore writes: `newDocument()` (defaults) and `applyImport()` (chunked `writeBatch`). |
| `src/components/roster-import-dialog.tsx` | **New.** Paste or drop a CSV, choose NPCs / Places / Factions, preview with checkboxes, then import. |
| `src/components/campaign-switcher.tsx` | New menu item "Import NPCs, places & factions…" (`onImportRoster` prop). |
| `src/components/shell/header.tsx` | Mounts the dialog, keyed by campaign id. |
| `src/components/obsidian-import-dialog.tsx` | Review step lists introduced NPCs with checkboxes. Ticked names are created after the session saves. |

There are no new collections, no rules changes, no AI calls, no server actions and no new
dependencies. Everything runs client-side as the signed-in owner, the same pattern `lib/migrate.ts` uses.

## How it works

**Input.** Copying cells from Excel, Numbers or Google Sheets puts tab-separated text on the
clipboard, so pasting is the main path. A quote at the start of a cell opens a quoted field only if
it has a closing quote that ends the cell; otherwise it's literal text, so an unclosed `"Never trust…`
or a nickname like `"Mad" Mags` can't swallow the rows after it. That avoids an export step and an xlsx library. A `.csv`
file also works. `detectDelimiter` treats any tab in the text as TSV and otherwise assumes CSV.

**Header row.** It's the first row with a cell that maps to `name`. Nick's roster sheet has two title
rows above the table, and they get skipped. Headers are normalized to lowercase letters and digits
only, so `Secret (DM only)` maps to `secret`. Unrecognized columns are listed in the preview as
ignored, not treated as errors.

**Row actions** (`RowAction` in `roster-import.ts`):

| Action | When | What happens if ticked |
|---|---|---|
| `new` | No existing entity of this kind has any of the row's names or aliases | Document created |
| `existing` | Exactly one does | Only `aliases: arrayUnion(...)` plus `campaignId`. Offered only if it has new aliases. |
| `ambiguous` | The row's names hit two or more existing entities | Skipped |
| `repeat` | An earlier row in the same paste claims one of the names | Skipped |
| `invalid` | No name | Skipped |

Matching is exact, case-insensitive and whitespace-collapsed (`nameKey`). It's deliberately **not
fuzzy**: "The Gray Scribe" doesn't match "Gray Scribe" unless one of them lists the other as an
alias. A wrong merge would be silent, but a missed one shows up as a duplicate in the Codex.

**Shared-name warnings.** If a name or alias the row would write already belongs to a *different*
page of any kind, the row gets a warning and **starts unticked**. This comes from a real case: an
earlier recap draft called the Gray Scribe "Vaelthir", which is also a city. The warning follows
`createMatcher` in `mentions.ts`: auto-detection skips the name for *both* pages, and a `[[link]]`
goes to whichever kind comes first in `KIND_PRIORITY` (NPC, party, faction, place…). So an NPC alias
equal to a place's name moves every existing `[[Vaelthir]]` link to the NPC; the warning says so.

**Defaults.** These mirror what `codex-entry-dialog.tsx` writes when its selects are left alone:
NPCs get `status: 'Active'` and `importance: 'Minor'`, factions get `disposition: 'Neutral'` and
`createdAt: serverTimestamp()`. A missing description is written as `''` and produces a warning,
because the type requires it and the dialog will ask for it on the next edit.

**Batches.** Writes are split into batches of 450, the same limit as `migrate.ts`, committed in order.
The dialog can be closed while saving (offline, a commit waits for the connection); the writes carry
on and the result still arrives as a toast.
The import isn't atomic overall. A re-run is safe because rows that already saved come back as
`existing` with no new aliases, so they can't be ticked.

**Obsidian path.** The session is saved first and alone. Then the ticked NPCs are created with
`description: "First appeared in Session N."` and `lastSeenSession: N`. If the NPC write fails, the
user gets a toast and the session isn't rolled back, because re-running the whole import would
duplicate the session.

## Please look hard at

1. **Rules fit.** `npcs` and `factions` only check ownership. `locations` also checks
   `request.resource.data.campaignId == campaignId` on create **and** update. Confirm that both the
   `set` and the `arrayUnion` update satisfy every rule. `firestore.rules` is unchanged.
2. **`arrayUnion` on documents with no `aliases` field.** It should create the array. Confirm this
   for documents older than the field.
3. **The shared-name warning's claim.** Read `createMatcher` / `claim()` in `mentions.ts` and check
   that a name shared by two targets is skipped for detection only. If that's wrong, fix the warning text.
4. **Empty descriptions.** Check that the Codex, Page and Table views render `description: ''`
   without looking broken.
5. **`lastSeenSession` from the Obsidian path.** The type says "Written by 'put on stage'". Check
   whether anything (Prep's "quiet for N issues", sorting, the Table) assumes it is only ever set
   that way, and whether setting it on creation is wrong.
6. **Stale preview.** The plan is computed once at Preview time. If the codex listener updates
   between Preview and Import, for example from another tab, a `new` row could become a duplicate.
   For a single-user app I judged that acceptable. Say so if you disagree.
7. **Obsidian pre-ticking.** Every unknown name starts ticked. The parser sometimes returns
   non-names like "the acolytes". That's a product call for Nick, but flag it if the UI makes
   unticking unclear.
8. **Design system.** Check against `design_handoff_grimlore_directors_cut/README.md`: radius 0,
   1.5px borders, `--spot` used once per region, the 11px text floor, mono labels, and
   `text-spot` for the error line. The checkboxes are native, with `accent-color` set to spot,
   because `components/ui/checkbox.tsx` still has shadcn's rounded style and isn't used anywhere.
9. **`COLUMNS_READ` in the dialog duplicates `HEADERS` in the lib.** That's a small risk of drift.
   Decide whether to derive one from the other.
10. **Parser edge cases.** A quote only opens a quoted field at the start of a cell, so Excel's
    unquoted `5' 5"` in TSV survives. Look for any input that breaks this, such as stray CRs or a
    final row with no newline.

## Already verified (ad hoc; there's no test runner yet, see H7 in `REVIEW-2026-10.md`)

The pure functions were transpiled with the repo's TypeScript and run under Node against these cases:

- CSV quoting, `""` escapes, a BOM, CRLF line ends, a newline inside a quoted cell, a literal `"` mid-cell in TSV
- A roster-shaped paste with two title rows and extra columns. The ignored-column list was exactly `Group, Sessions, Check before adding, Added?`.
- Existing "Korr the Announcer" + row aliases `Korr; Korrak` → `existing`, adds both
- Existing "Old Sarn" (alias Sarn) + row with alias Sarn → `existing`, no new aliases, not selectable
- A row aliasing two different existing NPCs → `ambiguous`
- Repeated name later in the paste (case-insensitive) → `repeat` pointing at the first row
- An alias equal to an existing place's name → shared-name warning
- An unknown faction name, invalid Status/Importance/Disposition values, and a missing description → warnings, field dropped
- Faction and place column sets. The place import ignores a `Status` column.
- `summarize()` counts, and `newDocument()` defaults for all three kinds

If you add Vitest (H7), these make a ready-made first suite for `roster-import.ts`.

## Not tested

Nothing has been clicked through in a browser, because the session that wrote this had no signed-in
app to run. Please run `npm run dev` (port 9002), sign in, and walk through the steps below, or tell
Nick exactly what to try.

## Manual test

Use a throwaway campaign if possible. From the campaign menu, choose **Import NPCs, places & factions…**:

1. **Factions** first. Paste:
   ```
   Name	Aliases	Disposition	Home base
   Circle of the Sundering	the Circle	Allied	Mirathen
   ```
2. **NPCs**. Paste the block below. Expect: one ignored column (`Group`); The Gray Scribe linked to
   the Circle; Hessa warned about the unknown faction; Bad Enum warned three times; the second
   `korr` marked as repeating row 2.
   ```
   Name	Aliases	Group	Status	Importance	Disposition	Faction	Description
   Korr the Announcer	Korr; Korrak	Met	Unknown	Minor	Neutral		Arena announcer
   The Gray Scribe	Gray Scribe; First Echo	Met	Active	Key	Allied	Circle of the Sundering	Patron
   Hessa Lund		Met	Dead	Minor	Neutral	Ashfall Legion
   Bad Enum		Met	Sleeping	Boss	Grumpy		x
   korr							dupe
   ```
3. Import it, then paste the same block again. Every row should now show as already here and be
   unselectable. Then add `; the Announcer` to Korr's aliases and paste again: only Korr should be
   offered, adding one alias.
4. Open the Story screen and check that a recap mentioning "Korrak" or "First Echo" now puts those
   issues on the right Loom lanes.
5. **Obsidian:** import a short session note that names one new NPC and one existing one. The new
   name should be ticked and the existing one labelled "Already in campaign". After saving, the NPC
   should exist with "First appeared in Session N."

## Out of scope (possible follow-ups, not bugs)

- Updating fields other than aliases on existing entities
- An alias editor in the Codex or Page edit dialog, which is the real fix for gap 3
- Importing characters or threads
- Reading `.xlsx` directly (pasting covers it)
