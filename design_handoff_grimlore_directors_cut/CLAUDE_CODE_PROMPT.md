# Prompt for Claude Code

Paste everything below the line into Claude Code from the root of `studio-grimlore`, with `design_handoff_grimlore_directors_cut/` copied into the working directory. It asks for a plan first and stages the work so each step is reviewable on its own.

---

I'm redesigning Grimlore Forge again: my Next.js + Firebase + Anthropic app for running D&D campaigns. The current code implements a "v3" cinematic design (modes TABLE / FORGE / CODEX, animated backdrop, violet co-pilot). We're replacing it with a new direction called the **Director's Cut**. Everything is in `design_handoff_grimlore_directors_cut/`.

**Read first, in this order:**

1. `design_handoff_grimlore_directors_cut/README.md`. This is the authoritative spec: IA and routes, design tokens for 2 palettes × light/dark, typography, every screen with measurements, state, schema changes, and open questions.
2. `design_handoff_grimlore_directors_cut/Grimlore Directors Cut.dc.html`. This is the design; open it in a browser. Use the header to reach every screen: STORY, TABLE, ■ RULES, the command bar (try `/`, then type `verrin`, then `+ odo took the key`), the palette swatches, and the theme toggle. From Story, open an issue cover, "READ FULL RECAP", a Loom row label, and "OPEN PREP".
3. `docs/REVIEW-2026-10.md`. The open UI items U1, U4, U5 and U6 are designed in; implement them as part of this work.

**The `.dc.html` files are design references, not code to port.** They're single-file and inline-styled so they run in a browser. Rebuild them with this repo's stack: App Router routes, React, Tailwind 3, the shadcn/ui primitives in `src/components/ui/`, and the Firestore hooks in `src/firebase/`. Match the hex values, font sizes and border weights in the README exactly. Radius stays 0.

**Work in six stages. Stop after each one and show me.**

**Stage 1: Plan (no code).** Give me a file-by-file change list, saying which v3 components get deleted (backdrop, motion layers, Codex index, Spotlight modal) versus refactored (combat tracker, live session, session prep). Give me your proposed route structure, and your answers to the five Open Questions in the README. Push back on anything in the spec that fights the existing architecture.

**Stage 2: Schema and the mentions index.** Implement the "Schema changes" section: the new `Session` fields, `Thread.color/pullNext`, the `Npc` additions, `Character.lastSpotlightSession`, the `rules` subcollection, `LiveSessionState.captures`, and the `SessionPrepState` additions. The important piece is **`Session.mentions`**: compute it on save from `[[links]]` and exact name matches, and derive every Loom lane from it. Don't store appearance arrays on entities. Write a one-off migration that backfills `mentions`, `title` and `recap` (from `summary`) for existing sessions. No UI yet.

**Stage 3: Routes and the shell, unstyled.**
- Add the routes `/`, `/issue/[n]`, `/page/[kind]/[id]`, `/rules`, `/prep` and `/table`.
- Build the header with STORY / TABLE tabs, the RULES button, and the **command bar**. It replaces the ⌘K modal: search with keyboard navigation, plus `+` capture with name linking and a toast. Capture must work on every screen.
- Remove the old mode switcher.
- This stage should be functional with default shadcn styling, so we can check navigation before visuals.

**Stage 4: Visual system.**
- Replace the tokens in `globals.css` with the four palette/theme sets from the README. Keep shadcn's HSL-triplet convention and add the custom tokens (`--spot`, `--spot-on`, `--sand`, `--cap`, `--cap-ink`, `--holo`, `--line`, `--line2`).
- Switch fonts via `next/font/google` to Big Shoulders Display, Newsreader and JetBrains Mono.
- Add the palette and theme switchers. Persist them, and set `data-palette` / `data-theme` before first paint so the theme doesn't flash.
- Delete `backdrop.tsx` and all v3 motion.

**Stage 5: Story, Issue and Page.**
- The Longbox: cover uploads to Firebase Storage, and it scrolls to the newest issue.
- **The Loom**: follow the spec for cell geometry, solid vs dashed segments, the NEXT column rings, and lane-dimming on hover.
- The selected-issue panel with the three-panel strip, including image panels and spot-fill "word" panels.
- The Issue reader: render recap `[[links]]` with a solid spot underline and auto-detected names with a dotted underline.
- The single Page template for every entity kind, including the DM-eyes-only secret box, the history list, the tick strip and "Mentioned in".

**Stage 6: Rules, Prep and Table.**
- **Rulebook**: filters, sticky index with scroll-to and outline, house-rule "Replaces / Why", pinning, and the conditions grid. Cover the full `Condition` union.
- **Prep**: render the existing `SessionPrepOutput` as the Pull / Script / Complications / Spotlights / Checklist layout. "The Pull" writes `Thread.pullNext`.
- **Table**:
  - the rotated turn strip (NOW / ON DECK)
  - comic scene panels, with the blurred SECRET panel
  - on-stage cards, At-hand pinned rules, and Captured tonight
  - the hideable co-pilot
  - the 7-across party dock
  - END SESSION confirmation (U1)
  - co-pilot textarea enabled while streaming, plus a Stop button (U5)
  - 11px minimum text (U6)

**Constraints throughout:**
- Preserve the documented fixes in `live-session.tsx` (hydrate-once, 800ms debounced persist, SSE partial-line buffering) and `combat-tracker.tsx` (active turn tracked by id, monotonic `seq` tiebreak).
- Keep server actions authenticated with `requireUser` (review item S1). Any new AI calls, such as drafting beats, a page or prep scenes, go through it too.
- The co-pilot (holo color) is the only place AI UI appears. AI drafts never publish without the DM's edit.
- No hand-drawn SVG illustration. Content glyphs are the Unicode set in the README; `lucide-react` is only for functional icons.
- Desktop-first. Follow the README's note for under ~1100px, but don't design a mobile layout yet.
