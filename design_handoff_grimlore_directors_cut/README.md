# Handoff: Grimlore — Director's Cut

## Overview

A full redesign of Grimlore Forge (Next.js 15 + Firebase + Anthropic, repo `nickalgarcia/studio-grimlore`). It replaces the v3 "cinematic game-menu" direction that is currently in the codebase.

The DM's brief: easy to use, fantasy but not medieval (comics, Lord of the Rings, Star Wars, D&D), and above all **a repository** of notes, rules and recaps that is pleasant to navigate. The art direction blends three references:

- **Jonathan Hickman's data pages**: black-and-white infographic structure, section glyphs, tick-strip timelines.
- **Dan Mora (World's Finest)**: one saturated "spot" color used loudly for whatever matters now, comic caption boxes, halftone dots, panel grids.
- **Dune (Villeneuve)**: monumental condensed headlines, a lot of negative space, and quiet mono labels.

The core idea is that **the campaign is a comic series and every session is an issue.** Recaps become issues with covers and three-panel strips, and **the Loom** charts every plot thread and key person across all issues.

## About the design files

`Grimlore Directors Cut.dc.html` is a **design reference built in HTML**: one self-contained, inline-styled prototype that opens in a browser with no build step (it loads `support.js` and `image-slot.js` from the same folder). It is **not production code**. Recreate it in the existing codebase using its stack: Next.js App Router, React, Tailwind 3, the shadcn/ui primitives in `src/components/ui/`, `lucide-react`, and the Firestore hooks in `src/firebase/`. Do not port the inline styles or the single-component structure.

`Grimlore Chronicle.dc.html` is the previous iteration of this same direction (wiki-first, sidebar nav). It is included only for reference; the Director's Cut supersedes it.

## Fidelity

**High-fidelity.** Colors, type, sizes, borders and interactions are final; match them. Content is **sample data** written for the prototype and should come from Firestore. That includes the campaign "The Ondermere Succession", the issue titles, recaps, house rules, prep scenes, and two party members (Odo Fennick, Vashti Corr) that were added to reach the real party size of seven.

## What changes from v3 (what's in the repo now)

| v3 (current code) | Director's Cut |
|---|---|
| Modes TABLE / FORGE / CODEX | **STORY** (home) / **TABLE**, plus a **RULES** button |
| Codex index + detail pane | **Pages**: one page template for every entity, opened from links, search, or the Loom |
| Forge prep document | **Prep** screen for the next issue (same `SessionPrepOutput`, laid out as a script) |
| Session list | **Longbox** (cover shelf) + **Issue** reader |
| — | **The Loom** (threads × issues chart) |
| — | **Rulebook** (house rules + core 5e + conditions), with pinning to the Table |
| ⌘K Spotlight modal | Always-visible **command bar**: search, or `+` to capture a note |
| Ash / bone / oxblood, violet AI | Two palettes (**Hyperspace**, **World's Finest**) × light/dark; AI is "holo" cyan/teal |
| Animated backdrop, parallax, camera moves | **Removed.** Flat grounds, hard borders, near-zero motion |
| Archivo + JetBrains Mono, radius 0 | **Big Shoulders Display + Newsreader + JetBrains Mono**, radius 0 |

Delete `backdrop.tsx` and the motion layers along with their flags. Keep the hard-edged `--radius: 0`.

## Information architecture and routes

| Route | Screen | Reached from |
|---|---|---|
| `/` | **Story**: header, Longbox, Loom, selected-issue panel | logo, STORY tab, END SESSION |
| `/issue/[n]` | **Issue** reader (full recap) | "READ FULL RECAP →", recap search results, any session link on a Page |
| `/page/[kind]/[id]` | **Page** (person, lore, thread, …) | inline `[[links]]`, search, Loom row labels, "In this issue" chips, on-stage cards, scene cast chips |
| `/rules` (`#rule-id`, `#cond-name`) | **Rulebook** | ■ RULES button, rule/condition search, "At hand" cards |
| `/prep` | **Prep** for the next issue | "OPEN PREP →", dashed #15 cover, Loom NEXT column |
| `/table` | **Table** (live console) | TABLE tab, RUN buttons |

The STORY tab is active on `/`, `/issue`, `/page` and `/prep`. RULES and TABLE each have their own active state. In the prototype, the selected issue on Story is local state; in production keep it in the URL as `?issue=14` so it survives reloads.

## Design tokens

### Palettes

The prototype drives everything from CSS custom properties on `body`, switched by `data-palette` (`hyperspace` | `heroic`) and `data-theme` (`dark` | `light`). Keep that model: map these onto the shadcn HSL tokens in `globals.css` (`--background`, `--foreground`, `--primary` …) plus the custom names below. **Hyperspace dark is the default.**

| Token | Role | Hyperspace dark | Hyperspace light | World's Finest dark | World's Finest light |
|---|---|---|---|---|---|
| `--bg` | page ground | `#0a0e17` | `#e6eaf0` | `#0d1030` | `#f2ede1` |
| `--panel` | raised surface, hover fill | `#121826` | `#f4f6f9` | `#161a44` | `#fbf8f1` |
| `--ink` | text, borders, solid UI | `#e8ecf4` | `#0d1220` | `#f3efe6` | `#101436` |
| `--mute` | secondary text | `#94a0b8` | `#4f5a70` | `#a9acd0` | `#4b4f7a` |
| `--line` | hairlines | `rgba(232,236,244,.12)` | `rgba(13,18,32,.13)` | `rgba(243,239,230,.13)` | `rgba(16,20,54,.13)` |
| `--line2` | stronger hairlines, inputs | `rgba(232,236,244,.28)` | `rgba(13,18,32,.30)` | `rgba(243,239,230,.30)` | `rgba(16,20,54,.30)` |
| `--spot` | the one loud color: live, active, hostile, CTAs | `#ffcf33` | `#1d4ed8` | `#ff3b30` | `#c8102e` |
| `--spot-on` | text on spot fill | `#0a0e17` | `#ffffff` | `#0d1030` | `#ffffff` |
| `--sand` | secondary status (SEEDED, UNFRIENDLY) | `#ff7a5c` | `#b4372a` | `#ffc629` | `#8a6400` |
| `--cap` | comic caption-box fill | `#ffcf33` | `#ffd85c` | `#ffc629` | `#ffd447` |
| `--cap-ink` | caption text | `#0a0e17` | `#0d1220` | `#0d1030` | `#101436` |
| `--holo` | AI co-pilot only | `#4fd6ff` | `#0b6f8f` | `#6ee7ff` | `#0e6b8c` |
| `--scrim` | overlays | `rgba(8,7,6,.72)` | `rgba(40,34,26,.45)` | same | same |

Rules:
- `--spot` is the only saturated UI color. Use it for one thing per region: the active turn, LIVE status, the primary CTA, HOSTILE, the selected issue.
- `--holo` appears **only** on co-pilot UI and "draft with co-pilot" buttons.
- Every pair above passes 4.5:1 for body text (checked against `--bg` and `--panel`).
- The palette and theme are user preferences. The prototype persists them in `localStorage` keys `grimlore.palette` and `grimlore.theme`. In production, use the user doc or localStorage, and avoid a flash of the wrong theme by setting the attributes before hydration.

### Loom lane colors (fixed, palette-independent)

Each thread or person gets one lane color, stored on the entity (`color` already exists on `Faction`; add it to `Thread` and `Npc`). The prototype uses: `#ff5a2a` `#ffc629` `#4fd6ff` `#b48cff` `#5ee38a` `#ff6fb1`. Lanes reuse colors across the THREADS and PEOPLE groups.

### Typography

Load all three via `next/font/google`.

| Role | Family | Weights | Usage |
|---|---|---|---|
| Display | **Big Shoulders Display** | 700, 800, 900 | All headlines, names, buttons, nav. Always `text-transform: uppercase`. Line-height .84–.95 for big sizes |
| Reading | **Newsreader** (opsz 6..72) | 400, 400 italic, 600 | Body prose, ledes (italic), list titles, inputs |
| Labels / data | **JetBrains Mono** | 500, 700 | Section labels, meta, counts, chips, kbd. 700 weight, letter-spacing .12–.20em, uppercase |

Scale used:
- **Hero h1**: Big Shoulders 900, `clamp(52px, 6.4vw, 104px)` on Story, and `clamp(56–64px, 7–7.6vw, 112–124px)` on Issue, Page, Rules and Prep. Line-height .84. One word or phrase may be colored `--spot`.
- **Section h2 / issue title**: Big Shoulders 900, 52px, line-height .86.
- **Card title**: Big Shoulders 900, 23–32px.
- **Lede**: Newsreader italic, 19–23px, line-height 1.38–1.45, max-width 40–46ch.
- **Body prose**: Newsreader, 20–21px, line-height 1.6–1.64, max-width 66–68ch.
- **List and secondary text**: Newsreader, 15–18px.
- **Section label**: JetBrains Mono 700, 12px, letter-spacing .2em.
- **Micro label**: JetBrains Mono 700, 11px, letter-spacing .14–.16em.
- **Floor**: 11px. Two spots in the prototype use 10px (Loom lane status, turn-strip conditions); raise them to 11px in production (review item U6).

### Section glyphs (Hickman)

These are plain Unicode characters in front of section labels and list items, and they are the only icon system for content types: `●` person · `▲` lore/place/item · `○` thread · `▬` recap/issue · `■` rule · `◆` note/capture · `◇` co-pilot. Use `lucide-react` for functional icons only, if any; the prototype needs none.

### Borders, shadows, spacing

- **Radius is 0 everywhere.** The one exception is circles: Loom nodes, color dots and the live dot.
- Border weights carry meaning: `3px solid --ink` for comic panels, covers, section-closing rules and the party dock top; `1.5px solid --ink` for rule cards, buttons and tabs; `1px --line` for list separators.
- Dashed borders mean "not yet": `3px dashed --spot` for the next issue and secrets, `3px dashed --line2` for empty or stub states.
- **The only shadow is a hard offset "print" shadow**: `8px 8px 0 --spot` (command dropdown), `10px 10px 0 --spot` (issue cover), `6px 6px 0 --spot` (toast). No blur shadows.
- **Halftone texture**: `radial-gradient(var(--spot-on) 1.1px, transparent 1.6px)` at a `9px 9px` size, opacity .22, used only inside "word" panels.
- **Page padding**: `32–36px clamp(20px,3vw,48px) 96px`. Content max-width is 1240px.
- **Gaps**: 44–56px between page sections, 10–12px between panels and cards, 6–8px between chips.
- **Section header pattern**: a flex row of `glyph LABEL`, a 1px `--line2` rule with `flex:1`, and right-aligned `--mute` meta.

### Motion

Almost none, by design:
- Cover lift: `translateY(-8px)` with a .18s transition.
- Loom lane dimming: opacity .28 with a .15s transition.
- Turn-strip card width: .2s.
- Secret blur: `filter: blur(8px)` to none over .2s.
- Toast: shown for 2.6s.

Respect `prefers-reduced-motion` by dropping the transitions.

## Global chrome

### Header

- **Bar**: sticky, 64px tall, `--bg` background, 1px `--line` bottom border, padding `0 20px`.
- **Row**: flex, gap 14px. Every child except the command bar is `flex:none; white-space:nowrap`.

Left to right:
1. **Wordmark.** "GRIMLORE" in Big Shoulders 900, 26px, letter-spacing .07em. The prototype's "D·CUT" suffix is a prototype label; drop it.
2. **Mode tabs** (`role=tablist`). A 1.5px `--ink` border wraps two flush buttons, STORY and TABLE, each Big Shoulders 800, 16px, letter-spacing .1em, padding 8px 16px.
   - Active STORY: `--ink` fill with `--bg` text.
   - Active TABLE: `--spot` fill with `--spot-on` text.
   - TABLE is prefixed by a 7px `currentColor` dot.
3. **■ RULES.** 38px tall, 1.5px `--line2` border, same type as the tabs. When active, `--ink` fill.
4. **Command bar.** `flex:1; min-width:0; max-width:620px; margin-left:auto`. See below.
5. **Palette swatches** (`role=radiogroup`). Two 24px squares, each split diagonally at 135° between that palette's dark `--bg` and `--spot`: Hyperspace is `#0a0e17` / `#ffcf33`, World's Finest is `#0d1030` / `#ff3b30`. Each has a 1.5px `--line2` border. The selected one gets `outline: 2px solid --ink; outline-offset: 2px`.
6. **Theme toggle.** 38px tall, 1px `--line2` border, JetBrains Mono 700 12px .14em. Shows a half-filled 12px circle followed by "DARK" or "LIGHT".

### Command bar (search + capture)

This replaces the ⌘K Spotlight modal with a field that is always visible.

**Field.** 42px tall, `--panel` fill, 1.5px `--line2` border. It holds a leading glyph, an input (Newsreader 18px) and a trailing `/` kbd hint. Placeholder: "Search anything — or start with + to capture a note".

**Shortcuts.** `/` (when not already typing) and ⌘K / Ctrl-K focus the field. Esc clears it and blurs.

**Search mode** (the default):
- The leading glyph is `⌕` in `--mute`.
- As soon as the field is non-empty, a dropdown opens: absolutely positioned 48px below the field, `--bg` fill, 2px `--ink` border, shadow `8px 8px 0 --spot`.
- Up to 7 results. Each row is a grid of `24px glyph | title (Newsreader 600 18px) over subtitle (italic 15px, --mute) | TYPE (mono 11px)`.
- ↑/↓ move the highlighted row (`--panel` fill); Enter or a click opens it.
- Where results go:
  - RECAP → `/issue/n`
  - RULE → `/rules#…`
  - everything else → `/page/…`
- If nothing matches: "No page yet. Start with + to capture it as a note."

**Capture mode** (the input starts with `+`):
- The leading glyph becomes a `+` and the border turns `--spot`.
- The dropdown shows a single row:
  - first line: "◆ CAPTURE TO SESSION 15 NOTES" and "ENTER ↵", in `--spot`
  - second line: the note text, Newsreader 19px
  - third line: "WILL LINK → VERRIN · ODO", listing the known entity names found in the text
- Enter appends the note to tonight's captures and shows a toast like "CAPTURED TO #15 · LINKED ODO".
- Capture must work from every screen, not only the Table.

### Toast

- Fixed, centred, 28px from the bottom.
- `--ink` fill with `--bg` text, mono 700 13px.
- Shadow `6px 6px 0 --spot`.
- Has `role=status` and auto-hides after 2.6s.

---

## Screens

### 1 · Story (`/`)

The home screen. From top to bottom it shows the campaign masthead, the cover shelf, the Loom, and the selected issue. Page padding is `36px clamp(20px,3vw,48px) 96px`, with a 52px gap between sections.

**Masthead.** A flex-wrap row with space-between and items aligned to the end.
- **Left side:**
  - Mono label: "CAMPAIGN · 14 ISSUES · 10 LINES TRACKED".
  - h1: "The Ondermere **Succession**", with the second word in `--spot`.
- **Right side:** the **Next-issue card**, `flex:0 1 420px` with a 3px `--ink` border.
  - **Body**, padding 14px 16px:
    - mono label in `--spot`: "NEXT · ISSUE #15 · SAT 25 OCT"
    - title in Big Shoulders 900, 28px
    - italic `--mute` "Pull: …" line, listing the threads marked pull-next
    - link: "OPEN PREP →"
  - **RUN button** on the right: 96px wide, `--spot` fill, 3px `--ink` left border, Big Shoulders 900 22px, reading "RUN" over "→".

**The Longbox.**
- **Header** (section header pattern): "■ THE LONGBOX", with "EVERY SESSION IS AN ISSUE · DROP ART ON A COVER" as the meta.
- **Shelf.** A horizontal scroller (gap 12px, padding 8px 2px 14px) that is scrolled to the right end on load, so the newest issue is visible.
- **Each cover**:
  - Width 150px, aspect ratio 2/3, 3px `--ink` border, `--panel` fill when there is no art.
  - Inside: the cover image (`Session.coverUrl`, user-uploadable).
  - Top-left: the number "#14" in Big Shoulders 900 30px, on an `--ink` block with `--bg` text.
  - Below the cover: the title in Big Shoulders 800 16px, uppercase.
- **Selected cover**: the border, the number block and the title turn `--spot`, and the cover lifts `translateY(-8px)`. Clicking a cover selects it.
- **Last item**: a 150px × 2/3 **next-issue** tile with a 3px dashed `--spot` border, "#15" in Big Shoulders 900 44px, and "NEXT · SAT". It links to `/prep`.

**The Loom.** This is the signature component.

- **Header.** "○ THE LOOM" plus a legend:
  - ● APPEARS
  - — ACTIVE (a solid 3px line)
  - ┄ DORMANT (a dashed line made from `repeating-linear-gradient(90deg, ink 0 4px, transparent 4px 8px)`)
  - ◯ PULL NEXT (a ring with a 2px `--spot` border)
- **Grid.** `grid-template-columns: 230px repeat(15, minmax(0,1fr))`, min-width 860px, inside a horizontal scroller.
  - The 15 columns are issues 1–14 plus **NEXT**.
  - **Column headers** are 30px buttons in mono 700 12px. The selected issue has a `--spot` fill. NEXT has a 1.5px dashed `--spot` outline and links to `/prep`.
- **Group heads.** Two of them, THREADS and PEOPLE: full-width rows in mono 700 11px `--mute`, padding 14px 0 6px.
- **Each lane** is one row, 40px tall, with a 1px `--line` bottom border.
  - **Label cell**: a 16×4px swatch in the lane color, the name in Newsreader 600 16px (ellipsis on overflow), and a status in mono 11px.
    - LIVE and HOSTILE use `--spot`.
    - SEEDED and UNFRIENDLY use `--sand`.
    - Everything else uses `--mute`.
    - Clicking the label opens the page.
  - **Each cell** holds a 3px horizontal line centred vertically (top 19px), plus a 15px node.
    - The line spans from the first appearance to the last. In the first cell it starts at 50%; in the last cell it ends at 50%.
    - The line is solid in the lane color, except where the gap between two appearances is 3 or more issues: there it is dashed.
    - Lanes flagged pull-next extend a dashed `--spot` line into the NEXT column and end in a **hollow ring**: a 2.5px `--spot` border with a `--bg` fill.
    - Nodes on issues where the lane appears are filled in the lane color, with a 3px `--bg` border so they punch out of the line.
    - The selected issue's column gets a `--panel` background across all lanes.
  - **Hover**: hovering any part of a lane dims every other lane to opacity .28.
  - **Click**: clicking a cell selects that issue; clicking a NEXT cell goes to `/prep`.
- **Data**: lanes are Threads and key NPCs. Each lane needs `sessions: number[]` (the issues where the entity is mentioned), `status`, `color` and `pullNext`. See Schema.

**Selected issue panel.** A flex-wrap row with a 36px gap.
- **Left column**, `0 1 300px`, min-width 240px:
  - Mono `--spot` label: "ISSUE #14 · 3 DAYS AGO".
  - Title as the section h2.
  - Logline in italic, 19px.
  - "IN THIS ISSUE" chips, one per lane that appears in this issue: a 1.5px `--line2` border, a 10px dot in the lane color, and the name. Each chip opens its page.
  - Link: "READ FULL RECAP →".
- **Right column**, `1 1 560px`: the **three-panel strip**.
  - Layout: `grid-template-columns: repeat(auto-fit, minmax(200px,1fr))`, gap 10px.
  - Every panel: min-height 320px, 3px `--ink` border.
  - **Caption box**, pinned top-left at an inset of 10px: `--cap` fill, `--cap-ink` text, 2px `--ink` border, Newsreader italic 16px, padding 8px 10px.
  - **Panel number** "1 / 3", bottom-right, on an `--ink` block.
  - **Image panels** show the beat's art (uploadable) and use `--panel` as a fallback.
  - **Word panels** have a `--spot` fill with the halftone overlay. The big word is Big Shoulders 900 at `clamp(44px,4.6vw,72px)`, line-height .82, in `--spot-on`, rotated −3deg, positioned at left/right 16px and bottom 56px. The caption still sits on top.
  - **No beats yet**: show a 3px dashed `--line2` box with "NOT ILLUSTRATED YET", an explanation line, and a holo button "◇ DRAFT 3 BEATS".

### 2 · Issue (`/issue/[n]`)

The full recap of one session.

**Breadcrumb row**: "← STORY / THE LONGBOX / ISSUE #14" in mono 12px `--mute`.
- **Right side**: prev/next buttons, 34px tall, with a 1.5px `--line2` border.
  - On #1, "← #1" is disabled at opacity .35.
  - On the latest played issue, the next button becomes "RUN #15 →" with a `--spot` fill.

**Hero**: a flex-wrap row aligned to the end, gap 40px, padding-bottom 36px, with a 3px `--ink` bottom border.
- **Cover**: `clamp(200px,22vw,280px)` wide, aspect 2/3, 3px `--ink` border, shadow `10px 10px 0 --spot`. The number "#14" is shown in a 44px `--ink` block.
- **Text**:
  - Mono `--spot` label: "ISSUE #14 · 3 DAYS AGO".
  - h1 title (text-wrap balance).
  - Italic logline, 23px, max 40ch.

**Three-panel strip**: the same as on Story, but bigger. Min-height 380px, columns at `minmax(220px,1fr)`, the word at `clamp(52px,5.4vw,86px)`, and captions at 17px.

**Body**: a flex-wrap row with a 56px gap.
- **Article**, `1.5 1 480px`, max 66ch: "▬ THE RECAP" header, then paragraphs in Newsreader 21px / 1.64 with an 18px paragraph gap.
  - `[[Entity]]` links render as the entity name with a `2px solid --spot` bottom border and open the page.
  - Auto-detected (unbracketed) names render with a `1px dotted --mute` bottom border, the same convention as the Chronicle reference.
  - If there's no recap: a dashed box "RECAP NOT WRITTEN YET" with "◇ DRAFT FROM NOTES". The co-pilot drafts; the DM edits; it never publishes on its own.
- **Aside**, `1 1 300px`, max 400px:
  - **"○ IN THIS ISSUE"** plus a count. Rows of a 12px color dot, the name (Newsreader 600 18px) and a mono kind label (PERSON or THREAD).
  - **"LEFT OPEN AFTER #14"**. Every unresolved thread opened on or before this issue, with its state: "PULLED HERE" in `--spot` if it appears in this issue, otherwise "WAITING" in `--mute`.

### 3 · Page (`/page/[kind]/[id]`)

One template serves every entity. Kinds are PERSON, LORE (place, item or faction) and THREAD; anything else falls back to the generic layout.

**Breadcrumb**: "← STORY / KIND / NAME".

**Hero**, with padding-bottom 32px and a 3px `--ink` bottom border:
- Mono row: a 16×4 swatch in the lane color, the glyph and kind, then tags, each colored `--spot` or `--mute`. For example: "KEY NPC · HOUSE VERRIN · HOSTILE", where HOSTILE is `--spot`.
- h1 name (balance).
- Italic lede, 23px, max 42ch.

**Body**: a flex-wrap row with a 52px gap.
- **Article**, `1.5 1 480px`, max 68ch, gap 30px:
  - **Sections**: each is a mono label (`--spot` for the "now" section, `--mute` otherwise) followed by Newsreader 20px / 1.6 prose.
    - PERSON: "WANTS · NOW" and "KNOWS"
    - LORE: "WHERE IT IS" and "WHAT'S KNOWN"
    - THREAD: "WHERE IT STANDS" and "WHAT EACH SIDE OFFERS"
  - **DM EYES ONLY**: a 2px dashed `--spot` box, padding 26px 24px 22px. Its tab is rotated −2deg and sits at top −15px, left 18px: `--spot` fill, Big Shoulders 900 17px, letter-spacing .12em.
  - **History list**: labelled "WITH THE PARTY" for people and "HOW IT'S UNFOLDED" otherwise. Rows are a grid of `64px #N (mono 13px --spot) | text (18px)` with 1px `--line` top borders. Clicking a row opens `/issue/n`.
  - **Stub**: an entity with no written content shows a dashed box "STUB PAGE" with "◇ DRAFT FROM RECAPS".
- **Aside**, `1 1 300px`, max 400px, gap 26px:
  - **Image**: aspect 4/5, 3px `--ink` border. Portrait for people, image for everything else.
  - **"AT A GLANCE" box**: 1.5px `--ink` border with an `--ink` header bar. Fact rows are `KEY (mono 11px --mute) | value (17px, right-aligned)`, followed by FIRST SEEN and LAST SEEN, derived from the issues where the entity is mentioned.
  - **"ON THE LOOM · 6 OF 14"**: 14 tick buttons, 15×20px. Filled ticks use the lane color with a 1.5px border; empty ones are transparent with a `--line2` border. Each opens its issue. Below them, "#1" and "#14" axis labels.
  - **"MENTIONED IN"**: up to 4 most-recent issues (▬, "Issue #N — Title", the logline in italics), then related pages (glyph, name, "Linked page").

### 4 · Rulebook (`/rules`)

**Hero**:
- Mono label: "■ RULES · 5 HOUSE · 5 CORE · 12 CONDITIONS".
- h1: "The **Rulebook**", with the second word in `--spot`.
- Italic lede: "Your house rules on top of the 5e core. Every change says what it replaced, and why — so nobody argues at the table."
- **Filter tabs**: ALL / HOUSE / 5E / TONIGHT / PINNED. Each is 36px tall with a 1.5px `--ink` border, mono 700 12px; the active one has an `--ink` fill.
  - TONIGHT means rules flagged as relevant to the current scene.
  - PINNED with nothing pinned shows an empty state: "Nothing pinned yet. Pin a rule and it rides along on the Table screen."

**Body**: a grid of `minmax(180px,230px) minmax(0,1fr)` with a 44px gap.
- **Index** (left, sticky at top 90px):
  - Every rule, each with an `H` marker (`--spot`) or `5E` marker (`--mute`) in mono 10–11px, then the title in Newsreader 16px, with 1px `--line` separators.
  - A final entry, "◆ Conditions", jumps to the conditions grid.
  - Clicking scrolls to the card (90px offset) and outlines it with `outline: 3px solid --spot; outline-offset: 4px`.
- **Groups**: COMBAT, MAGIC, EXPLORATION and TABLE. Each has the section header pattern with a count.
- **Rule card**: 1.5px `--ink` border, `scroll-margin-top: 90px`.
  - **Header bar** (1.5px bottom border, mono 11px):
    - kind badge: "HOUSE RULE" (`--spot` fill) or "5E CORE" (`--ink` fill)
    - meta: "SINCE ISSUE #4" or "PHB 195"
    - optional "● IN PLAY TONIGHT" in `--spot`
    - right-aligned pin toggle, 26px tall: "◇ PIN TO TABLE", or "◆ PINNED TO TABLE" with an `--ink` fill
  - **Body**, padding 16px 18px 18px: the title in Big Shoulders 900 32px, then the rule text in Newsreader 20px / 1.5.
  - **House rules** add a two-column block above a 1px `--line` rule:
    - **REPLACES**: the original rule in 17px `--mute`, struck through with a 1px line.
    - **WHY**: 17px italic.
- **Conditions · quick reference**: `repeat(auto-fill, minmax(230px,1fr))`. Cells share 1.5px `--ink` borders, so the outer edge is drawn only on top and left. Each cell has the name in Big Shoulders 900 22px and a one-line effect in 16px. A condition opened from search gets a `--spot` fill with `--spot-on` text.
  - Use the existing `Condition` union. The 12 shown are Blinded, Charmed, Frightened, Grappled, Incapacitated, Invisible, Paralyzed, Poisoned, Prone, Restrained, Stunned and Unconscious; add Deafened, Exhausted, Petrified and Concentrating to match the type.

### 5 · Prep (`/prep`)

Prep for the next issue, laid out as a comic script. It renders the existing `SessionPrepOutput`, plus `scenes` (new; see Schema).

**Hero**: a flex-wrap row aligned to the end, with a 3px bottom rule.
- **Cover slot**: `clamp(160px,16vw,210px)` wide, aspect 2/3, 3px dashed `--spot` border. "#15" sits on a `--spot` block.
- **Text**:
  - Mono row: "PREP" badge (`--spot` fill), "SAT 25 OCT · 19:00", and "IN 2 DAYS" in `--spot`.
  - h1 title.
  - Buttons: "◇ REDRAFT WITH CO-PILOT" (holo outline, 48px) and "RUN ISSUE #15 →" (`--spot` fill, Big Shoulders 900 21px).
- **Stats column**, `0 1 260px`: PULLING n THREADS · SCENES 4 · READY x / y DONE. READY turns `--spot` when everything is done.

**○ The Pull** (from the Loom, last 5 issues): one row per open thread, as a grid of `name | ticks | age | toggle`.
- **Name**: a 16×4 swatch plus Newsreader 600 18px. Clicking it opens the page.
- **Ticks**: 5 squares, 12×16px, for issues 10–14.
- **Age**: "TOUCHED LAST ISSUE" or "QUIET n ISSUES", in `--spot` when n ≥ 4.
- **Toggle**: 110×32px, "● PULLING" (`--ink` fill) or "○ SKIP". Skipped rows sit at opacity .7.
- Pull state writes `Thread.pullNext` and drives the Loom's NEXT rings and the "Pull: …" line on Story.

**▬ The Script**: 4 scene cards in `repeat(auto-fit, minmax(240px,1fr))` with a 12px gap.
- **Card**: 3px `--ink` border, `--panel` fill.
- **Header bar**: "SCENE n" plus the role (OPEN / PRESSURE / TURN / CLIFFHANGER) on `--ink`. The CLIFFHANGER header uses a `--spot` fill.
- **Thumbnail**: a 130px slot.
- **Body**:
  - title in Big Shoulders 900 27px
  - location in mono 12px `--mute`
  - beat in Newsreader 17px
  - cast chips (1.5px `--line2` border) that open pages
- **Scene 1** has a "⇄ TRY ALTERNATE OPENING" toggle that swaps in `alternateOpening`.

**▲ Complications**: three numbered rows (`44px numeral | text`) with a "ROLL d3" button (`--ink` fill). Rolling highlights one row with a `--spot` fill and a 3px border. This comes from `complications`.

**● Spotlights**: one row per party member (`92px name | opportunity | last`).
- "last" is the issue number of their last spotlight.
- If 5 or more issues have passed, it reads "OVERDUE · #8" in `--spot`.
- This comes from `characterSpotlights` plus the new `Character.lastSpotlightSession`.

**◆ Before the table**: a checklist from `prepReminders`. Each item is a `role=checkbox` tile: a 20px box that becomes an `--ink` fill with ✓ when done, with struck-through `--mute` text. Done state is new (`SessionPrepState.done: number[]`).

### 6 · Table (`/table`)

The live console. It fills the viewport below the header: a flex column with min-height `calc(100vh - 64px)`.

**Live bar**: `--spot` fill, `--spot-on` text, Big Shoulders 800 19px uppercase, padding 10px 24px.
- Left: "● LIVE · ISSUE #15" and "Scene 3 — The Gilded Hall · Night".
- Right: the elapsed time in mono 14px, from `LiveSessionState.startedAt`.
- **"◇ CO-PILOT" toggle**: inverted (`--spot-on` fill) when open.
- **"END SESSION"**: a 2px `--spot-on` outline. It **must confirm** (review item U1) before archiving the session and returning to Story.

**Turn strip**: padding 16px 24px with a 3px `--ink` bottom border.
- **Left**: "ROUND" over the round number in Big Shoulders 900 64px.
- **Centre**: initiative as a row of cards, **rotated so the active combatant is always first**.
  - **NOW** card: 250px wide, `--spot` fill, initiative in 44px, name in Big Shoulders 900 30px.
  - **ON DECK** card: 180px wide, `--panel` fill, 3px `--ink` border.
  - **Everyone else**: 120px wide, 1.5px `--line2` border. Cards after the 6th sit at opacity .55; overflow is hidden.
  - **Every card** shows its initiative, the name (ellipsis on overflow), an HP bar (6px, 1.5px `currentColor` border, fill = hp%) with "cur/max" beside it, and conditions or "FOE".
  - PC HP comes from `Character.currentHp/maxHp`; monster HP comes from `Combatant`.
- **Right**: a 150px column. "NEXT TURN →" is Big Shoulders 900 24px on an `--ink` fill that hovers to `--spot`. "← BACK" is 32px. Next wraps to the top of the order and increments the round; Back reverses that.
- Preserve the existing combat-tracker invariants: the active turn is tracked by id, with the `seq` tiebreak.

**Body**: a flex-wrap row.
- **Scene column**, `1 1 560px`, padding 24px:
  - Mono label "▲ SCENE 3 · UPPER WARD · NIGHT", with the scene name in Big Shoulders 900 at `clamp(40px,4vw,60px)`.
  - **Panels**: a grid of `repeat(auto-fit, minmax(260px,1fr))` with a 10px gap. CONSTRAINT, PRESSURE and WAY OUT are comic panels: 3px `--ink` border, `--panel` fill, min-height 150px, an `--ink` label tab at the top-left corner, and text in Newsreader 21px.
  - **SECRET panel**: a 3px dashed `--spot` border, a full-width `--spot` header bar reading "SECRET · TAP TO REVEAL", and text blurred at 8px until tapped. The players can see the screen.
  - **On stage**: cards in a grid of `minmax(280px,1fr)`, each with an 84×104 portrait, the name, a disposition chip, and WANTS and KNOWS lines. Clicking a card opens the page.
    - **Disposition chips**: HOSTILE is a `--spot` fill; UNFRIENDLY is a `--spot` outline with `--spot` text; everything else is a `--line2` outline with `--mute` text.
  - **"■ AT HAND"**: pinned rules as compact cards (title in Big Shoulders 900 19px, HOUSE or 5E tag, 15px text). Tapping one opens `/rules#id`. A "RULEBOOK →" link sits at the right.
  - **"◆ CAPTURED TONIGHT"**: a list of `54px elapsed time | note` entries, fed by the command bar's `+` capture.
- **Co-pilot column**, `0 1 380px`, min-width 300px, 1px `--line` left border, hideable:
  - Header "◇ CO-PILOT" in `--holo` with a holo hairline.
  - **Messages**: the DM's messages are right-aligned on a `--panel` fill with a 1px `--line2` border; the AI's messages are left-aligned on a plain ground, labelled "CO-PILOT" in `--holo`.
  - **Quick prompts**: holo-outlined mono chips such as "Guard tactics", "Name a servant" and "If they refuse".
  - **Input**: a textarea (Newsreader 17px), with SEND as a `--holo` fill.
  - **The textarea stays enabled while streaming, and a Stop button appears** (review item U5).

**Party dock**: `grid-template-columns: repeat(7, minmax(0,1fr))`, so **all seven fit without scrolling** (review item U4). It has a 3px `--ink` top border and a `--panel` fill.
- **Each plate**, padding 12px 14px:
  - name (Big Shoulders 900 20px, ellipsis) and class/level (mono 11px)
  - an 8px HP bar
  - "cur/max", plus "BLOODIED" when below 50%, at which point the bar and number turn `--spot`
  - "AC n" and "PP n" in mono 12px
- The plate of the PC whose turn it is gets a `--bg` fill.

---

## State

| State | Where | Notes |
|---|---|---|
| palette, theme | user prefs / localStorage `grimlore.palette`, `grimlore.theme` | applied as `data-palette`, `data-theme` on `<body>` before paint |
| selected issue | URL `?issue=n` on `/` | defaults to the latest played issue |
| Loom hover lane | local | visual only |
| command text, highlighted index | local, in the header | `+` prefix switches to capture |
| page id | route | |
| rules filter, focused rule | URL hash and `?filter=` | |
| pinned rules | `Rule.pinned` (Firestore) | shown in Table "At hand" |
| pull toggles | `Thread.pullNext` | feeds the Loom NEXT column, the Story next card and Prep |
| prep alt-opening, d3 roll | local | |
| prep checklist | `SessionPrepState.done: number[]` | |
| active turn, round | existing `CombatState` | unchanged invariants |
| secret revealed | local, resets per scene | |
| co-pilot open | local / prefs | |
| captures | `LiveSessionState.captures[]` | |

## Schema changes

These extend `src/lib/types.ts`. Keep the existing per-user Firestore paths.

- **`Session`**: add these fields.
  - `title`, `logline`
  - `coverUrl?`
  - `beats?: { kind: 'image' | 'word'; caption: string; word?: string; imageUrl?: string }[]` (max 3)
  - `recap?: string` (markdown with `[[Name]]` links; migrate from `summary`)
  - `status: 'played' | 'next'`, `scheduledAt?`
  - `mentions: { kind: CodexKind | 'thread'; id: string }[]`
- **`mentions` is what the Loom is built from.** Compute it on save by parsing `[[links]]` plus exact-name matches against known entities. Every lane's `sessions[]` is the inverse of this index. Don't store appearance arrays on entities.
- **`Thread`**: add `color`, `pullNext: boolean`, `body?` (sections), and `secret?`. `status` stays `'live' | 'seeded' | 'cold'`.
- **`Npc`**: add `portraitUrl?`, `secret?`, `color?`, and `history?: { session: number; text: string }[]` (co-pilot draftable).
- **`Character`**: add `lastSpotlightSession?`.
- **New `rules` subcollection**: `{ id, title, kind: 'house' | 'core', category: 'combat' | 'magic' | 'exploration' | 'table', text, replaces?, why?, sinceSession?, ref?, pinned, tonight? }`. Conditions stay a code constant keyed by `Condition`.
- **`LiveSessionState`**: add `captures: { id, at: string, text, links: string[] }[]`. Keep `notes` for the free-text tab or migrate it.
- **`SessionPrepState.prep`**: add `scenes?: { role, title, where, beat, castIds: string[] }[]` and `done?: number[]`. `openThreadsToPull` becomes thread ids.

## Assets

None ship with the design. Every image is a user-supplied slot: issue covers, panel art, portraits, scene thumbnails. Store them in Firebase Storage and add an upload or drag-drop affordance. Empty slots render as `--panel` fills. Glyphs are Unicode; no icon font and no SVG illustration.

## Open questions

1. **Auto-detection of names.** Should unbracketed name matches count toward the Loom, or only explicit `[[links]]`? The recommendation is both, with auto-detected matches shown dotted and confirmable.
2. **Session numbering.** Should "Issue" be a display label over `sessionNumber`, or a separate field? The recommendation is a display label only.
3. **Rules scope.** Per campaign, or per user and shared across campaigns? The recommendation is per user, with a per-campaign "in use" flag.
4. **Prep scenes.** Should the prep AI flow be extended to emit `scenes`, or should scenes be DM-authored only?
5. **Mobile.** The design is desktop-first (laptop at the table). Under ~1100px, the co-pilot column should become a sheet and the turn strip should show NOW and ON DECK only.

## Files

- `Grimlore Directors Cut.dc.html`: the design (all six screens; switch between them with the header controls). Open it in a browser.
- `support.js` and `image-slot.js`: runtime for the prototype only.
- `Grimlore Chronicle.dc.html`: the previous iteration, for reference.
- `CLAUDE_CODE_PROMPT.md`: a staged prompt to paste into Claude Code.
