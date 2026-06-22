// ── Circle-of-Fifths theory ──────────────────────────────────────────────────
// Pure, Node-verifiable music data (no React/DOM). The wheel is the source of
// truth for slice POSITIONS; a small key-spelling engine gives correct NAMES so
// enharmonics read right (e.g. E major's vii° is D♯°, not the slice's "E♭").
// Run `npm run verify` (node verify.mjs) after any change — Zak's standard is
// exact correctness.

// 12 keys clockwise from 12 o'clock. Each step is a perfect fifth (+7 semitones).
export const MAJ = ["C", "G", "D", "A", "E", "B", "F♯", "D♭", "A♭", "E♭", "B♭", "F"];

// Relative-minor roots (a minor third below each major). Inner ring, same index.
export const MIN_ROOT = ["A", "E", "B", "F♯", "C♯", "G♯", "D♯", "B♭", "F", "C", "G", "D"];
export const MIN = MIN_ROOT.map((r) => r + "m");

// Pitch class (0 = C) of each slice. Outer = majors, inner = relative minors.
export const MAJ_PC = MAJ.map((_, i) => (i * 7) % 12);     // [0,7,2,9,4,11,6,1,8,3,10,5]
export const MIN_PC = MAJ_PC.map((p) => (p + 9) % 12);     // relative minor = +9 (= −3)

// Key signature by circle index: 0♯ at C, +1♯ clockwise to 6♯ at F♯, then
// flats unwind 5♭…1♭ from D♭ back to F.
export const SIGNATURE = [
  { count: 0, type: "natural" },
  { count: 1, type: "sharp" }, { count: 2, type: "sharp" }, { count: 3, type: "sharp" },
  { count: 4, type: "sharp" }, { count: 5, type: "sharp" }, { count: 6, type: "sharp" },
  { count: 5, type: "flat" }, { count: 4, type: "flat" }, { count: 3, type: "flat" },
  { count: 2, type: "flat" }, { count: 1, type: "flat" },
];

// Order accidentals are added, and which outer-ring slice each lands on (by pitch).
export const SHARP_ORDER = ["F♯", "C♯", "G♯", "D♯", "A♯", "E♯"];
export const FLAT_ORDER = ["B♭", "E♭", "A♭", "D♭", "G♭", "C♭"];
const SHARP_SLICES = [6, 7, 8, 9, 10, 11]; // F♯ on its own slice, C♯ on D♭'s, …
const FLAT_SLICES = [10, 9, 8, 7, 6, 5];   // B♭ on its own slice, E♭ on E♭'s, …

// ── Key spelling engine ──────────────────────────────────────────────────────
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11]; // semitones above tonic, degrees 1–7
const accOffset = (s) => [...s].reduce((n, ch) => n + (ch === "♯" ? 1 : ch === "♭" ? -1 : 0), 0);
const accStr = (diff) =>
  ({ 0: "", 1: "♯", 2: "♯♯", 11: "♭", 10: "♭♭" })[((diff % 12) + 12) % 12] ?? "?";

// Pitch class of a spelled note name, e.g. "D♯" → 3.
export const notePc = (name) => ((LETTER_PC[name[0]] + accOffset(name.slice(1))) % 12 + 12) % 12;

// The correctly spelled 7 notes of major key at circle index c.
export function majorScale(c) {
  const tonic = MAJ[c];
  const tonicPc = MAJ_PC[c];
  const li = LETTERS.indexOf(tonic[0]);
  return MAJOR_STEPS.map((step, k) => {
    const letter = LETTERS[(li + k) % 7];
    const target = (tonicPc + step) % 12;
    return letter + accStr(target - LETTER_PC[letter]);
  });
}

// ── Diatonic chords ──────────────────────────────────────────────────────────
const MAJOR_SHAPE = [
  { roman: "I", quality: "maj", ring: "outer", di: 0, suffix: "" },
  { roman: "ii", quality: "min", ring: "inner", di: -1, suffix: "m" },
  { roman: "iii", quality: "min", ring: "inner", di: +1, suffix: "m" },
  { roman: "IV", quality: "maj", ring: "outer", di: -1, suffix: "" },
  { roman: "V", quality: "maj", ring: "outer", di: +1, suffix: "" },
  { roman: "vi", quality: "min", ring: "inner", di: 0, suffix: "m" },
  { roman: "vii°", quality: "dim", ring: "outer", di: +5, suffix: "°" },
];

const mod12 = (n) => ((n % 12) + 12) % 12;

// Diatonic chords of the MAJOR key at circle index c, in order I…vii°.
export function diatonicMajor(c) {
  const scale = majorScale(c);
  // map each chord's spelled root to its scale degree (I=1, ii=2, … vii°=7)
  const degOf = { I: 0, ii: 1, iii: 2, IV: 3, V: 4, vi: 5, "vii°": 6 };
  return MAJOR_SHAPE.map((s) => {
    const index = mod12(c + s.di);
    const root = scale[degOf[s.roman]];
    return {
      roman: s.roman,
      quality: s.quality,
      ring: s.ring,
      index,
      rootPc: s.ring === "outer" ? MAJ_PC[index] : MIN_PC[index],
      name: root + s.suffix,
    };
  });
}

// Natural-minor diatonic chords: the relative major's 7 chords, re-rooted/renamed.
const MINOR_ROMANS = ["i", "ii°", "III", "iv", "v", "VI", "VII"];
// which relative-major degree each natural-minor degree maps to (vi, vii°, I, ii, iii, IV, V)
const MINOR_FROM_MAJOR = [5, 6, 0, 1, 2, 3, 4];

export function diatonicMinor(c) {
  const maj = diatonicMajor(c);
  return MINOR_ROMANS.map((roman, k) => ({ ...maj[MINOR_FROM_MAJOR[k]], roman }));
}

// Diatonic chords for a home key (ring = "major" | "minor").
export const diatonic = (ring, c) => (ring === "minor" ? diatonicMinor(c) : diatonicMajor(c));

// ── Accidentals ──────────────────────────────────────────────────────────────
// The selected key's accidental notes + which outer-ring slice each marks.
export function accidentalPositions(c) {
  const s = SIGNATURE[c];
  if (s.type === "natural") return [];
  const order = s.type === "sharp" ? SHARP_ORDER : FLAT_ORDER;
  const slices = s.type === "sharp" ? SHARP_SLICES : FLAT_SLICES;
  return Array.from({ length: s.count }, (_, i) => ({ name: order[i], index: slices[i], type: s.type }));
}

// ── Labels & audio ───────────────────────────────────────────────────────────
export const keyName = (ring, c) =>
  ring === "minor" ? `${MIN_ROOT[c]} minor` : `${MAJ[c]} major`;

export function signatureText(c) {
  const s = SIGNATURE[c];
  if (s.type === "natural") return "no sharps or flats";
  const names = accidentalPositions(c).map((a) => a.name).join(", ");
  const word = s.count === 1 ? s.type : s.type + "s";
  return `${s.count} ${word} — ${names}`;
}

// Triad pitch classes above the root, by quality.
const TRIAD = { maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6] };
export const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Frequencies (Hz) for a chord's triad, voiced near middle C.
export function chordFreqs(rootPc, quality) {
  const rootMidi = 60 + rootPc; // C4…B4
  return TRIAD[quality].map((iv) => midiToFreq(rootMidi + iv));
}

// Single-note frequency near middle C, for tapping a key.
export const noteFreq = (pc) => midiToFreq(60 + pc);

// Convenience for UI iteration.
export const INDEXES = Array.from({ length: 12 }, (_, i) => i);
