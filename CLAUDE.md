# Circle of Fifths Trainer — project context

A **pure-theory, interactive Circle of Fifths** for understanding keys/harmony and
helping with songwriting. The 6th tool in the **Fretworks** toolbox (sibling to
ChordTrainer, DiatonicChordsTrainer, MelodicMinorTrainer, AlteredTrainer). Single
dev + end user: Zak.

- Full build spec: `../CIRCLE-OF-FIFTHS-PLAN.md`.
- Toolbox-wide conventions (git-dep workflow, multi-zone, single PWA,
  verify-in-prod, naming): `../CLAUDE.md`.

## Integration
- New repo, Vite `base: '/circle/'`, served as a Vercel zone (add a `/circle/(.*)`
  rewrite to `fretworks/vercel.json` + a `/`-scoped old-domain redirect here).
- Register in `@fretworks/design` `tools.js`: `key:"circle"`, `name:"Circle of
  Fifths Trainer"`, `path:"/circle/"`, **accent warm amber `#f0a05a`**.
- Single-file React + Vite, inline styles, `@fretworks/design` git dependency,
  shared `AppHeader`/`TabBar`, dark `#0f0e17`, Fraunces title, audio engine like
  the other trainers (tap a slice/chord to hear it).
- **Fonts:** the app root **must** set `fontFamily: var(--font-body)` — the shared
  CSS does not set a global body font, so prose otherwise falls back to serif
  (ChordTrainer does the same on its root). Headings use `--font-heading`
  (Space Grotesk); reserve `--font-mono` for note/numeral *data* (chip notes, the
  Learn note column, wheel numerals), not for sentences.
- Tabs: **Learn · Circle · Write · Quiz**.

## The wheel — locked design choices (mockup v6)
- **Pie slices**, two rings: outer = 12 major keys, inner = 12 relative minors.
  12 o'clock = C / Am; clockwise = +sharp, counter-clockwise = +flat. Slice `i`
  centred at `-90 + i*30°`, spanning ±15°. **Large wheel, nearly edge-to-edge**,
  with a comfortable gap above it. Tap a slice to set the home key (outer→major,
  inner→minor).
- **Out-of-key slices = true neutral dark grey `#1c1c1c`** — no colour tone.
- **Accent = warm amber `#f0a05a`** (never a cool/violet main accent). Selected
  home key = solid amber (dark ink); other in-key chords = dark amber `#46381f`
  with light-amber text.
- **Three toggles, no "Keys" toggle:**
  - **Chords** — amber-highlight the 7 in-key chord slices (incl. vii°). Majors +
    relative minors form a tidy cluster (IV·I·V outer + ii·vi·iii beneath).
  - **Numbers** — Roman numerals in their **own thin ring** under each name (a
    faint divider arc separates them). Numerals are **small**; the **chord names
    are the largest, most prominent labels**. Names **centre in their ring when
    Numbers is off**, and nudge outward when it's on.
  - **Sharps / flats** — mark the selected key's accidental **note** positions
    (outer ring) with a **muted-teal `#5fa194` thin dashed line on the slice
    border**. Low-key, and cool vs. the warm amber so the two highlight types never
    blend. Do NOT use a heavy or inset outline.
- The per-key ♯/♭ **counts** are NOT drawn on the wheel — teach those in **Learn**
  with a graphic (order of sharps/flats + how many each key has).
- **Layout height is locked** (fixed svg + reserved readout height + fixed
  home-key label width) so changing keys never reflows/moves the wheel.
- A small **legend** + the selected key's spelled-out accidentals sit in the
  readout below the wheel.
- **Geometry** (viewBox `0 0 360 360`, centre 180,180): outer ring r 113–179 (name
  r≈146 centred / 154 nudged, numeral r≈121, divider r≈131); inner ring r 47–109
  (name r≈78/87, numeral r≈57, divider r≈66); centre hole r<47 for the key label.

## Music facts — VERIFY before shipping (Zak's standard = exact correctness)
- 12 keys clockwise `MAJ` = `C G D A E B F♯ D♭ A♭ E♭ B♭ F`. Relative minors `MIN` =
  `Am Em Bm F♯m C♯m G♯m D♯m B♭m Fm Cm Gm Dm` (MIN[c] is the relative minor of MAJ[c]).
- Signatures: C 0, G 1♯, D 2♯, A 3♯, E 4♯, B 5♯, F♯ 6♯, D♭ 5♭, A♭ 4♭, E♭ 3♭, B♭ 2♭,
  F 1♭. Order of sharps `F♯ C♯ G♯ D♯ A♯ E♯`; order of flats `B♭ E♭ A♭ D♭ G♭ C♭`.
- Diatonic chords of major key index `c` (all mod 12): `I=MAJ[c]`, `ii=MIN[c-1]`,
  `iii=MIN[c+1]`, `IV=MAJ[c-1]`, `V=MAJ[c+1]`, `vi=MIN[c]`, `vii°=MAJ[c+5]°`.
  Minor key `c` (natural minor) = the same 7 chords re-rooted: `i=MIN[c]`,
  `ii°=MAJ[c+5]°`, `III=MAJ[c]`, `iv=MIN[c-1]`, `v=MIN[c+1]`, `VI=MAJ[c-1]`,
  `VII=MAJ[c+1]`. A key's signature = the relative major's, so `ACC[c]` serves both.
- Accidental **note** positions for key `c` (outer-ring indices): sharps →
  `6,7,8,…` (mod 12); flats → `10,9,8,…`.
- **Enharmonic caveat:** on sharp keys an accidental can land on a flat-spelled
  slice (e.g. C♯ on the `D♭` slice). The mockup marks the correct pitch position;
  the build should refine the note **spelling** per key.
- Write a Node script that checks the signature + the 7-chord diatonic set for all
  12 keys (major *and* minor) BEFORE wiring the UI.

## Tabs (scope)
- **Learn** — what the circle is, how to read it (fifths/sharps/flats, relative
  minors), + the graphic reference for the order/number of sharps & flats.
- **Circle** — the wheel above (the centrepiece).
- **Write** (songwriting) — progression **builder** (click chords → hear the loop),
  **modulation** guide (closest keys), **beyond-diatonic** (borrowed + secondary
  dominants). Reuses the wheel. See the plan.
- **Quiz** — **Mixed** mode (default) + four single topics: chords in a key,
  sharps/flats in a key, relative minor, name the key from its signature. Rounds
  are a fixed **10 questions** (`QUIZ_LENGTH`) with a progress bar and an
  **end screen** (score / %, message, Play again); switching mode restarts.
