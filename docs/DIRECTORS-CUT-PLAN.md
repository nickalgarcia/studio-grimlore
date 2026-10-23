# Director's Cut — implementation plan (Stage 1)

Source of truth: `design_handoff_grimlore_directors_cut/README.md`. This file is the plan for building it
in this repo, the decisions behind it, and what's still open. Later stages tick items off here.

Work happens on a branch (`redesign/directors-cut`), not `main`. Stage 3 removes the v3 modes, and `main`
ships to Vercel on every push, so `main` would be unusable at the table between Stages 3 and 6.

---

## 1. Decisions

**Settled 2026-10-23.** All recommendations below are accepted, with these changes:

- **D1:** editing happens **inline on the Page itself**, not in restyled dialogs. Nick will send designs
  for inline editing, combat setup and the wordmark menu before Stage 6. Until then, those three are
  stubbed with the existing v3 components (entry dialog, combat tracker, campaign switcher).
- **D2:** derive at read time. Approved.
- **D3:** plan for Blaze before Stage 5.
- **D4:** as recommended. Also, after END SESSION confirms, show a toast with a "Draft recap now?"
  action that opens the new issue's recap draft.

The original options follow for reference.

### D1 — Where does editing live? (biggest gap)

The design has no screens for creating or editing anything. v3 can do all of this today, and the
Director's Cut has no place for any of it:

| v3 capability | Where it is now | Recommendation |
|---|---|---|
| Create / edit / delete NPCs, places, factions, PCs, sessions | `codex-entry-dialog.tsx`, Codex | **EDIT** button in the Page and Issue hero, which opens the existing dialog restyled as a sheet. A "+ NEW PAGE" row in the command bar's no-results state. |
| Create threads, change thread status | Prep "track threads", Codex | Same Page editor (thread kind). |
| Edit the current scene (constraint, pressure, secret, way out) and put NPCs on stage | Codex "put on stage" | An **EDIT SCENE** button on the Table scene header, plus **PUT ON STAGE** on a person's Page. |
| Set up combat: add PCs or monsters, roll initiative, HP, conditions | `combat-tracker.tsx` | The turn strip gets a **SET UP** button that opens the existing tracker in a sheet, restyled. It stays mounted while hidden (load-bearing convention). |
| Switch or create campaigns, sign out, Obsidian import, export, campaign summary | campaign switcher in the status bar | A menu on the GRIMLORE wordmark. |
| Idea, NPC and inspiration generators | Forge → Generate | **Drop them as screens.** Their jobs become co-pilot quick prompts ("Name a servant", "Plot hook here"). This keeps "AI only in the co-pilot". |
| Faction AI panel | Codex faction detail | Drop it. Its job becomes "◇ DRAFT FROM RECAPS" on the Page. |

All of these follow the visual system (1.5px borders, mono labels). None of them are designed, so expect
me to make reasonable calls and flag them for review.

### D2 — Store `Session.mentions`, or derive it?

The spec says to compute `mentions` on save and backfill it. The trouble: if the DM adds "Verrin" as an
NPC after issue 3 mentions him, issue 3's stored index won't include him until someone re-saves issue 3.
That makes the Loom quietly wrong, and it would need a re-index pass on every entity add or rename.

The app already loads every session and every entity into memory (a single user, small data), so the
index can be a pure function over recap text and the entity list, memoized, and never stale.

**Recommendation:** derive it at read time with `indexMentions()` in `src/lib/mentions.ts`. Persist only
the DM's decisions on auto-detected matches, as `Session.mentionOverrides: { confirm: Ref[], ignore: Ref[] }`.
That still satisfies "don't store appearance arrays on entities", and the migration gets simpler (no
`mentions` backfill). If you'd rather have it stored as the spec says, I'll store it and re-index every
session whenever an entity is added or renamed.

### D3 — Firebase Storage

Covers, panel art, portraits and scene thumbnails all need Storage, and the project doesn't use it yet.
The Firebase project probably has to move to the pay-as-you-go Blaze plan to create a Storage bucket
(Blaze still has a free allowance). Check the console before Stage 5. Until a bucket exists, the image
slots render as `--panel` fills and the upload control explains why it's off. The rest of the app
doesn't depend on Storage.

### D4 — What is "the next issue"?

The spec adds `Session.status: 'played' | 'next'`. A placeholder "next" session document would break
the assumption that `sessions[0]` is the latest *played* session. `use-live-session.ts` and prep both
rely on that to number the next session.

**Recommendation:** don't create a placeholder session. Derive the next issue as latest played + 1, and
take its title and date from `sessionPrep/current` (add `scheduledAt` there). END SESSION is what
creates the real session document.

---

## 2. Answers to the README's open questions

1. **Auto-detected names:** both count. `[[links]]` are solid and always count. Exact matches are dotted
   and count unless the DM ignores them (D2). Matching is case-sensitive, whole-word, on the name plus a
   new `aliases?: string[]` field (so "Verrin" finds "Lady Sabeth Verrin"). Names under 3 characters are
   skipped (3, not 4: party names like "Odo" are three letters). Captures match case-insensitively. **Caveat:** thread titles ("Who poisoned the Duke") almost never appear verbatim in prose, so
   for past sessions, thread lanes will mostly be empty until they're linked. The recap flow will emit
   `[[Thread]]` links from now on, and the migration offers a co-pilot pass to suggest links for old
   recaps (the DM reviews them).
2. **Session numbering:** "Issue #N" is a display label over `sessionNumber`. No new field.
3. **Rules scope:** per user (`users/{uid}/rules/{id}`), shared across campaigns. `pinned` and `tonight`
   sit on the rule document. Skip the per-campaign "in use" flag until there's a second active campaign.
   Core 5e rules ship as a code constant (SRD 5.1 summaries, CC-BY-4.0 credit), like conditions, so
   they aren't seeded into Firestore. Pinning a core rule writes a small `{ id, core: true, pinned, tonight }`
   document, which keeps one query for "At hand".
4. **Prep scenes:** extend the prep flow to emit `scenes` (role, title, where, beat, cast names → ids
   mapped on the client). The DM edits each card inline. Prep is DM-only, so nothing gets "published".
5. **Under ~1100px:** do the two notes and nothing more. The co-pilot becomes a `Sheet` toggled from the
   live bar, and the turn strip shows only NOW and ON DECK. That also closes review item U7.

---

## 3. Other pushback and corrections to the spec

- **File name in the prompt:** the live-session fixes live in `src/components/table/use-live-session.ts`
  (there's no `live-session.tsx`). Its hydrate-once, 800ms debounce and SSE buffering are kept exactly.
- **Theme attributes go on `<html>`, not `<body>`.** The pre-paint script runs in `<head>`, before `<body>`
  exists. It's a static inline script that reads `localStorage` (wrapped in try/catch). That's the one
  accepted use of an inline script; model output still never goes near `innerHTML`.
- **Only two palettes.** The prototype's CSS also defines `arrakis`, `rivendell` and others. The README
  lists two (Hyperspace and World's Finest), so only those get built.
- **Captures go through the live-session hook, not a separate write.** The hook persists its own state
  with a merge write. A capture written with `arrayUnion` from somewhere else would race it. The hook
  moves up into the app layout, so every screen (and the command bar) can reach it.
- **The clock starts at RUN, not at the first keystroke.** Capturing a note on Tuesday shouldn't start
  Saturday's session clock. `/table` before RUN shows a "READY · ISSUE #15" live bar with a START
  button (not in the design).
- **END SESSION ends the session; the recap happens later.** It confirms (U1), creates the session
  document (number, date, notes, captures), archives `liveSession/current` to `liveSession/s{N}`
  (existing rules already cover any id there), resets `current` with `startedAt: deleteField()`, and
  goes to Story. The recap is drafted from the Issue page ("◇ DRAFT FROM NOTES"). That removes the v3
  close-session flow and closes U3 along with U1.
- **`lastSpotlightSession` needs a writer.** The spec doesn't say what sets it. Proposal: a small
  "SPOTLIT" toggle on each party plate during the session, stamped onto the character at END SESSION.
- **Lane colors:** NPCs and threads without a stored `color` get one from the six lane colors, assigned
  by order. It's only written when the DM picks one, so adding a thread doesn't rewrite the others.
- **`[[Name]]` links are by name**, so renaming an entity would break them. On rename, the old name is
  added to `aliases` automatically.
- **U2 should come along.** The redesign adds many small writes (captures, pins, pull toggles,
  checklist). Today any failed write crashes the whole app. Toasting instead of throwing, plus an
  `app/error.tsx`, is about 40 lines and worth doing in Stage 3.

---

## 4. Route structure

```
src/app/
  layout.tsx                      server: fonts, metadata, pre-paint theme script, FirebaseClientProvider
  (app)/layout.tsx                'use client': AuthGate → CampaignProvider → <Header/> + children + toast
  (app)/page.tsx                  /                 Story (?issue=n)
  (app)/issue/[n]/page.tsx        /issue/14         Issue reader
  (app)/page/[kind]/[id]/page.tsx /page/npc/abc123  Page — kind ∈ npc|pc|place|faction|item|thread|concept
  (app)/rules/page.tsx            /rules#rule-id    Rulebook (?filter=)
  (app)/prep/page.tsx             /prep             Prep
  (app)/table/page.tsx            /table            Table
  error.tsx                       U2 recovery screen
  actions.ts, api/live-session/   unchanged location; still the only 'use server' file
```

- Page URLs use the Firestore id, not a name slug, because ids survive renames. `kind` is the storage
  kind, and display maps it to PERSON (npc, pc), LORE (place, faction, item) or THREAD.
- The `(app)` layout persists across navigation in the App Router, so the Firestore listeners, the live
  session and a streaming co-pilot reply all survive moving between screens.
- The active campaign is kept in `localStorage` (`grimlore.campaign`) and the wordmark menu. The old
  `?mode=` and `?campaign=` parameters go away.

---

## 5. File-by-file change list

### Delete

| File | Why |
|---|---|
| `components/backdrop.tsx`, `hooks/use-parallax.ts`, motion keyframes in `globals.css` and `tailwind.config.ts` (`animate-camA/B`, `rise`, `slideIn` …), `MOTION` flags in `app/page.tsx` | v3 motion is removed |
| `components/spotlight.tsx` | replaced by the command bar |
| `components/grimlore-forge.tsx` | shell replaced by `(app)/layout.tsx` and `Header` |
| `components/modes/table-mode.tsx`, `forge-mode.tsx`, `codex-mode.tsx` | modes replaced by routes |
| `components/codex/codex-index.tsx`, `codex-detail.tsx` | replaced by Page |
| `components/codex/faction-ai-panel.tsx` | AI outside the co-pilot (D1) |
| `components/table/scene-stage.tsx` | replaced by the scene panels and on-stage cards |
| `components/forge/campaign-overview.tsx` | summary and export move to the wordmark menu (D1) |
| `components/idea-generator.tsx`, `inspiration-generator.tsx` | become co-pilot prompts (D1) |
| `components/campaign-switcher.tsx` | replaced by `campaign-menu.tsx` |
| `components/forge-sigil.tsx`, `logo.tsx` | old brand marks |
| `lib/codex.ts`, `components/codex/use-codex-entries.ts` | folded into `lib/pages.ts` and `CampaignProvider` |
| old tokens (`bone*`, `oxblood*`, `violet*`, `brass`, `.label-forge`, `.surface-*`) | replaced in Stage 4; nothing may reference them afterwards |

The flows behind dropped screens (`generate-context-sensitive-ideas`, `generate-npc-flow`,
`lookup-and-inspiration-flows`, `summarize-campaign-flow`) and their actions stay if D1 keeps
their jobs (co-pilot prompts, summary in the menu). Otherwise they go too.

### Refactor

| File | Change |
|---|---|
| `components/combat-tracker.tsx` | Extract state and persistence into `components/table/use-combat.ts`: hydrate once, `activeId` by id, monotonic `seq`, debounced persist, all unchanged. Add `prevTurn()` for ← BACK (reverses the round when it wraps). The tracker UI becomes the SET UP sheet. The turn strip and the sheet share one hook instance. |
| `components/table/use-live-session.ts` | Keep the three fixes. Add `captures` (state + the same persist), `stop()` exposing `abortRef.abort()` (U5), `start()` (RUN stamps `startedAt`), `endSession()` (archive, create session, reset with `deleteField()`) (U1). Remove the recap preview flow. Moves into `CampaignProvider`. |
| `components/table/co-pilot.tsx` | Rewritten in holo. Textarea stays enabled while streaming; only Send is disabled. A Stop button appears (U5). Hideable. Becomes a Sheet under 1100px. |
| `components/table/party-dock.tsx` | `repeat(7, minmax(0,1fr))`, no scroll (U4). BLOODIED under 50%. Active PC plate on `--bg`. SPOTLIT toggle. |
| `components/table/elapsed-clock.tsx` | Kept; restyled for the live bar. |
| `components/table/live-notes.tsx` | Kept as a collapsed "◆ FREE NOTES" under Captured tonight, so `notes` keeps working. |
| `components/session-prep.tsx` | Split. The goals form becomes `prep/draft-dialog.tsx` (holo, opened by "◇ REDRAFT WITH CO-PILOT"). Rendering moves to the Prep screen. Persistence of `sessionPrep/current` is unchanged. |
| `components/codex/codex-entry-dialog.tsx` | Becomes `components/page/page-editor.tsx` (sheet), plus fields for thread, aliases, color, secret, portrait and history (D1). |
| `components/markdown.tsx` | Add an optional `resolveLink(name)` hook so `[[links]]` (solid spot underline) and detected names (dotted) render through the same safe React-node parser. No second parser. |
| `components/auth-gate.tsx`, `obsidian-import-dialog.tsx`, `campaign-manager.tsx` | Restyled only. Obsidian import writes through `writeSession` so new sessions get titles and links. |
| `app/layout.tsx` | New fonts, pre-paint script, `data-palette` / `data-theme`. |
| `app/page.tsx` | Becomes Story inside `(app)`. |
| `app/globals.css`, `tailwind.config.ts` | Four palette × theme token sets as HSL triplets, plus `--spot`, `--spot-on`, `--sand`, `--cap`, `--cap-ink`, `--holo`, `--line`, `--line2`, `--scrim`. `darkMode` becomes the `[data-theme="dark"]` selector. The print-shadow and halftone utilities are added. Motion goes under `motion-safe:`. |
| `components/ui/*` used (button, input, textarea, dialog, alert-dialog, sheet, toast) | Restyled to the new tokens. The toast matches the spec: fixed, centred, print shadow, 2.6s. |
| `lib/types.ts` | Schema changes (Stage 2, below). |
| `ai/flows/generate-session-recap-flow.ts` | Takes entity names and thread titles. Emits `title`, `logline` and a recap with `[[links]]`. Add `.max()` on inputs (part of S5). |
| `ai/flows/generate-session-prep-flow.ts` | Emits `scenes`. Takes open threads `{id,title}` and returns `openThreadsToPull` as ids (new-thread strings still promote). Add `.max()`. |
| `app/actions.ts` | New actions `draftBeats`, `draftPage`, `draftRecap` (with `requireUser` through `gated()`). The existing ones are unchanged. |
| `firestore.rules` | New `users/{userId}/rules/{ruleId}` block (owner-only). **Needs deploying.** |
| `CLAUDE.md` | Rewrite the design-system, "where things live" and "violet" sections at the end. |

### New

```
src/lib/mentions.ts            parseLinks, indexMentions(session, entities, overrides), buildLoom(sessions, lanes)
src/lib/pages.ts               entity → PageModel normaliser; glyphs ● ▲ ○ ▬ ■ ◆ ◇; kind ↔ display; lane colours
src/lib/conditions.ts          all 16 Condition values → one-line effect
src/lib/core-rules.ts          5e core rules constant (SRD 5.1, attribution)
src/lib/prefs.ts               palette/theme/campaign localStorage, try/catch everywhere
src/lib/migrate.ts             idempotent client-side migration (see Stage 2)

src/firebase/storage.ts        upload + URL helpers (no-op with a message if no bucket, D3)
src/firebase/firestore/use-rules.ts, use-sessions.ts (writeSession), use-session-prep.ts

src/components/campaign/campaign-provider.tsx   one context: campaigns, active campaign, entities, sessions,
                                                threads, rules, scene, prep, live session, combat
src/components/shell/header.tsx, command-bar.tsx, campaign-menu.tsx, palette-switcher.tsx, theme-toggle.tsx
src/components/shared/image-slot.tsx, section-header.tsx, glyph.tsx, print-toast.tsx
src/components/story/masthead.tsx, next-issue-card.tsx, longbox.tsx, loom.tsx, issue-panel.tsx, panel-strip.tsx
src/components/issue/issue-reader.tsx, issue-aside.tsx
src/components/page/page-view.tsx, secret-box.tsx, at-a-glance.tsx, tick-strip.tsx, mentioned-in.tsx, page-editor.tsx
src/components/rules/rulebook.tsx, rule-index.tsx, rule-card.tsx, conditions-grid.tsx
src/components/prep/prep-view.tsx, the-pull.tsx, script.tsx, complications.tsx, spotlights.tsx, checklist.tsx, draft-dialog.tsx
src/components/table/live-bar.tsx, turn-strip.tsx, scene-panels.tsx, on-stage.tsx, at-hand.tsx,
                     captured-tonight.tsx, end-session-dialog.tsx, use-combat.ts, combat-setup-sheet.tsx
storage.rules + firebase.json "storage" entry       owner-only, images, < 5 MB. Needs deploying.
```

No new npm dependencies. `next/font/google` ships Big Shoulders Display and Newsreader (with the `opsz`
axis), and `firebase/storage` is already in the `firebase` package.

---

## 6. Stages

- [x] **Stage 1 — Plan.** This document.
- [x] **Stage 2 — Schema and mentions.** *Done 2026-10-23.* Built as `lib/mentions.ts` (scanner and
  index), `lib/loom.ts` (cell geometry, lane colours, Prep ticks), `lib/issues.ts` (`recapOf`, labels,
  `firstSentence`), `firebase/firestore/use-sessions.ts` (`recapFields`, writer, mention overrides),
  `lib/migrate.ts` and `components/migrate-dialog.tsx` (in the v3 campaign menu). Deviations: no
  `Session.status` or `Session.scheduledAt` (D4: `scheduledAt` is on `SessionPrepState`). `history` and
  `aliases` are also on `Thread`, and `imageUrl` on `Location` and `Faction`, for the Page template.
  During the redesign, every session write sets `recap` and `summary` together.
  Original scope: `types.ts` additions: `Session` gets `title`, `logline`,
  `coverUrl`, `beats` (max 3), `recap`, `scheduledAt`, `notes`, `captures`, and `mentionOverrides`
  (D2) or `mentions`. `Thread` gets `color`, `pullNext`, `body`, `secret`, `aliases`. `Npc` gets
  `portraitUrl`, `secret`, `color`, `history`, `aliases`. `Character` gets `lastSpotlightSession`.
  Add `Rule`. `LiveSessionState` gets `captures`. `SessionPrepState` gets `scenes`, `done`,
  `scheduledAt`, and `openThreadsToPull` as ids. Also `lib/mentions.ts`, `writeSession()`, and the
  migration. The migration runs on the client as the signed-in owner, so it needs no service account.
  It's idempotent (guarded by `Campaign.schemaVersion`), shows a dry-run summary first, sets
  `recap ← summary` and `logline ←` the first sentence, and leaves `title` empty (the display falls
  back to "Issue #N"). An optional co-pilot pass drafts titles and links for the DM to review. No UI
  beyond a "run migration" item.
- [ ] **Stage 3 — Routes and shell, unstyled.** `(app)` layout, `CampaignProvider`, all six routes,
  header, command bar (search, ↑/↓/Enter, `/` and ⌘K, Esc, `+` capture with linking and toast), and
  the wordmark menu. Remove the mode switcher and Spotlight. Add U2 (toast, not throw; `error.tsx`).
  To keep the branch usable for a real session mid-redesign, `/table` and `/prep` temporarily mount the
  v3 table and prep components until Stage 6.
- [ ] **Stage 4 — Visual system.** Tokens, fonts, palette and theme switchers with pre-paint, delete
  backdrop and motion, restyle the shadcn primitives in use. Afterwards, `grep` for the old tokens
  must return nothing.
- [ ] **Stage 5 — Story, Issue, Page.** Longbox (Storage covers, scroll to newest), Loom (geometry,
  solid/dashed rule, NEXT rings, hover dimming), issue panel and strip, Issue reader with solid and
  dotted links, the Page template (secret box, history, tick strip, mentioned-in), page editor (D1).
- [ ] **Stage 6 — Rules, Prep, Table.** Rulebook, Prep (The Pull writes `Thread.pullNext`), Table
  (turn strip via `use-combat`, scene panels and blurred secret, on-stage, At hand, Captured tonight,
  co-pilot with U5, 7-across dock with U4, END SESSION with U1, 11px floor with U6, the 1100px
  notes with U7). Tick U1, U3, U4, U5, U6, U7 and U2 in `REVIEW-2026-10.md`. Update `CLAUDE.md`.

Every stage ends with `npm run typecheck` clean. There's no test runner yet, so `lib/mentions.ts`
is written as pure functions, ready for the Vitest item (H7).

## 7. Owner actions (things I can't or shouldn't do)

- Deploy `firestore.rules` after Stage 2 (new `rules` block) and `storage.rules` before Stage 5.
- Enable Firebase Storage, which probably means the Blaze plan (D3).
- Merge the branch when Stage 6 is accepted.
