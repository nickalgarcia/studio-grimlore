# Grimlore Forge — context for Claude Code

Personal DM command center for Nick's homebrew D&D 5e campaign (a seven-player party).
One owner, used live at the table on a laptop. Treat it as a single-user app, not a SaaS.

- **Table** mode — run a session: scene stage, live notes, party dock, combat tracker, AI co-pilot.
- **Forge** mode — prep between sessions: session prep, campaign overview/summary, idea + inspiration generators.
- **Codex** mode — browse/edit world entries (NPCs, places, factions, party, items, sessions, concepts).
- **Spotlight** (⌘K / Ctrl+K) — search everything, plus rules lookup.

## Stack

Next.js 15 App Router (one client-rendered route), React 18, TypeScript, Tailwind 3 + shadcn/ui (Radix),
Firebase Auth (email/password) + Firestore (client SDK, realtime listeners), `firebase-admin` on the
server only to verify ID tokens, Anthropic Messages API via raw `fetch` (no SDK), Zod for AI I/O.

## Commands

| Command | Notes |
|---|---|
| `npm run dev` | Dev server on **port 9002** |
| `npm run typecheck` | **Run before calling any change done.** Currently passes clean. |
| `npm run build` | `next.config.js` sets `ignoreBuildErrors` — a green build does NOT mean types pass |
| `npm run lint` | Not functional yet: ESLint isn't installed |

No test runner yet.

## Environment

`.env.local` (gitignored — never commit it, never print its values):
- `ANTHROPIC_API_KEY` — server-only. Never prefix with `NEXT_PUBLIC_`, never import `anthropic-client.ts` from a client component.
- `ALLOWED_UIDS` — server-only, comma-separated Firebase uids allowed to use the AI. Fails closed:
  unset or empty means every AI call is refused. Must also be set in Vercel.
- `NEXT_PUBLIC_FIREBASE_*` — public by design (Firebase web config).

## Deployment

The owner ships via GitHub Desktop → Vercel. Don't push, deploy, or run `firebase deploy` unless asked.
`firestore.rules` is deployed separately with the Firebase CLI (project in `.firebaserc`).
`apphosting.yaml`, `.idx/`, `docs/backend.json`, and the README are leftovers from the Firebase Studio
scaffold. `docs/blueprint.md` describes an OLD design (purple/green/parchment) — ignore it.
**Never run `cleanup.sh`** — it deletes `.git` and force-pushes.

## Where things live

```
src/app/(app)/layout.tsx         auth gate → CampaignProvider → Header; routes / issue/[n] page/[kind]/[id] rules prep table
                                 (Director's Cut redesign in progress on redesign/directors-cut: see docs/DIRECTORS-CUT-PLAN.md)
src/app/actions.ts               server actions, one per AI feature, take idToken first, return { data, error }
src/app/api/live-session/route.ts  streaming co-pilot (SSE passthrough); verifies Firebase ID token
src/ai/anthropic-client.ts       callClaude / callClaudeJson, CLAUDE_MODEL
src/ai/flows/*.ts                one file per AI feature: zod schema + prompt builder
src/components/campaign/campaign-provider.tsx  shared data for every route: campaigns, codex, threads, mentions, live session
src/components/shell/            header, command-bar (search + `+` capture; replaced the ⌘K Spotlight)
src/components/modes/            table-mode, forge-mode: v3 screens mounted by /table and /prep until Stage 6
src/lib/mentions.ts, loom.ts     derived mentions index (never stored) and Loom geometry
src/components/table/            co-pilot, live-notes, party-dock, scene-stage, use-live-session
src/components/codex/            use-codex-entries (merges every collection into CodexEntry[]), detail/dialog
src/components/combat-tracker.tsx  largest file; persists to combatState
src/components/markdown.tsx      safe renderer for AI output (builds React nodes; no innerHTML)
src/firebase/                    provider, useCollection/useDoc/useMemoFirebase, non-blocking writes, error emitter
src/firebase/require-user.ts     server-only auth gate for AI entry points (admin.ts verifies the token)
src/lib/types.ts                 every Firestore document type
src/lib/codex.ts                 Codex kind colours/labels/order
firestore.rules                  owner-only rules per subcollection
```

## Data model (Firestore)

Everything lives under `users/{uid}/`:
- `concepts/{id}` — saved generator output (carries `userId`)
- `campaigns/{campaignId}` with subcollections: `characters`, `npcs`, `factions`, `locations`,
  `sessions`, `scenes`, `threads`, `combatState`, `sessionPrep`, `liveSession/current`.
  Rules also exist for `plotHooks`, `encounterIdeas`, `npcConcepts`, which no current code uses.

Adding a collection = add the type to `types.ts`, copy an existing rules block (including the
`campaignId == campaignId` check), and tell the owner the rules need deploying. Firestore default-denies
anything without a rule, which surfaces as a "permission" error.

## Conventions that are load-bearing (don't "simplify" them away)

- Refs passed to `useCollection` / `useDoc` must be built with `useMemoFirebase`.
- Inside `src/firebase/firestore/`, import from `@/firebase/provider`, not the `@/firebase` barrel (circular).
- Firestore throws on `undefined` field values: use `stripUndefined()` or conditional spreads.
- Use `clientCreatedAt()` (ISO string) where a field is ordered on; `serverTimestamp()` only for `updatedAt`.
  Newest scene by `createdAt` *is* the current scene.
- `use-live-session.ts`: hydrate once per mount, 800 ms debounced persist, messages read via ref,
  SSE partial-line buffering. Each exists to fix a real bug.
- Combat tracker stays mounted (hidden) when switching to Scene so in-flight edits survive.
- `grid-rows-[minmax(0,1fr)]` on the cockpit containers keeps the party dock on screen.
- Comments in this codebase explain *why*. Keep that style; don't strip them.

## Design system (Director's Cut)

Spec: `design_handoff_grimlore_directors_cut/README.md` (authoritative; match its sizes and borders).

- **Palettes:** Hyperspace (default) and World's Finest, each dark and light. Set by `data-palette` /
  `data-theme` on `<html>`, applied before paint by `PREFS_SCRIPT` (`src/lib/prefs.ts`), persisted in
  localStorage `grimlore.palette` / `grimlore.theme`. Switchers: `components/shell/appearance.tsx`.
- **Tokens** (`src/app/globals.css`, HSL triplets): `bg`, `panel`, `ink`, `mute`, `spot`, `spot-on`, `sand`,
  `cap`, `cap-ink`, `holo`, plus `line` / `line2` / `scrim` (whole rgba colours, no `/opacity`). Use these
  names in new code (`bg-spot text-spot-on`, `border-line2`); shadcn's names map onto them.
- **`--spot` is the only saturated UI colour**, one thing per region. Text on a spot fill is `text-spot-on`.
- **`--holo` is reserved for the AI co-pilot** and "draft with co-pilot" buttons.
- The v3 names (`bone*`, `oxblood*`, `violet*`, `brass`, `.label-forge`, `.surface-*`) are temporary
  aliases for the v3 stand-in screens. Don't use them in new code; they're removed in Stage 6.
- **Fonts:** `font-headline` = Big Shoulders (always uppercase, pinned to its display cut, opsz 72),
  `font-body` = Newsreader (prose, inputs), `font-mono` = JetBrains Mono (labels, numbers).
- **Edges:** radius 0 (circles excepted). Borders carry meaning: 3px ink for panels and covers, 1.5px for
  cards/buttons/tabs, 1px `line` for separators; dashed = "not yet". The only shadow is the hard print
  shadow (`shadow-print-sm/print/print-lg`, offset in spot). No blur shadows.
- **Glyphs:** Unicode only for content types (`GLYPH` in `src/lib/pages.ts`); lucide for functional icons.
- **Motion:** nearly none: only the transitions the spec lists, all dropped under `prefers-reduced-motion`.
- **Readability:** 11px floor for anything read mid-session (HP, AC, names, AI output).

## AI conventions

- All Anthropic calls are server-side, through `callClaude` / `callClaudeJson` (or the streaming route).
- The model id lives in one place: `CLAUDE_MODEL` in `src/ai/anthropic-client.ts`.
- Each flow owns a Zod input schema. Give every string/array a `.max()`; inputs are paid for per token.
- Render model output with `<Markdown>`, never `dangerouslySetInnerHTML`.

## Security rules for any change

- Every AI entry point (server action or route) must verify the caller's Firebase ID token on the server
  before spending tokens. Server actions take `idToken` as their first argument and run their body
  through `gated()` in `actions.ts`, which calls `requireUser()` (`src/firebase/require-user.ts`);
  clients pass `await idTokenFor(user)`. Routes call `requireUser()` directly.
- Only `src/app/actions.ts` carries `'use server'`. Don't add the directive to flow files: every
  exported async function in such a file becomes a public endpoint.
- No secrets in client code, logs returned to the browser, or commits. Don't read or echo `.env*`.
- New Firestore paths need rules; keep everything scoped to `request.auth.uid == userId`.

## Open work

`docs/REVIEW-2026-10.md` is a prioritized list of security, UX, and housekeeping fixes with IDs
(S1…, U1…, H1…). When asked to "work through the review", take items in order and tick them off there.
