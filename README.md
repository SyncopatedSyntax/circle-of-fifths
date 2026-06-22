# Circle of Fifths Trainer

An interactive **Circle of Fifths** for understanding keys/harmony and helping
with songwriting — the 6th tool in the **Fretworks** toolbox (sibling to Chord,
Diatonic, Melodic Minor and Altered trainers).

Pure theory: keys, diatonic chords, sharps/flats, and a songwriting workspace.
No fretboard diagrams.

## Commands
- `npm install` then `npm run dev` — local dev
- `npm run build` — production build to `dist/` (this is what Vercel runs)
- `npm run verify` — Node check of the theory module (signatures + diatonic sets,
  all 12 keys, major and minor)

## Architecture
- Single-file React app in `src/CircleTrainer.jsx` (default-exported `App`);
  `src/main.jsx` just mounts it. Inline styles, shared `@fretworks/design`
  chrome (AppHeader / TabBar / drawer). Served under `/circle/` (Vite `base`).
- `src/theory.js` — pure, Node-verifiable music data (no React/DOM).

See `CLAUDE.md` for the locked design choices and verified music facts, and
`../CIRCLE-OF-FIFTHS-PLAN.md` for the full build spec.
