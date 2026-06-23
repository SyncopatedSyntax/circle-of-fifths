// Independent verification of src/theory.js. Checks are pitch-based and derived
// from first principles (NOT the module's own index formulas), plus a few
// human-readable spot-checks. Run: npm run verify  (node verify.mjs)
import {
  MAJ, MIN_ROOT, MAJ_PC, MIN_PC, SIGNATURE,
  majorScale, diatonicMajor, diatonicMinor, accidentalPositions,
  notePc, keyName, signatureText,
} from "./src/theory.js";

let pass = 0, fail = 0;
const ok = (cond, msg) => { cond ? pass++ : (fail++, console.error("  ✗ " + msg)); };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg} — got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10];
const MAJOR_Q = ["maj", "min", "min", "maj", "maj", "min", "dim"];
const MINOR_Q = ["min", "dim", "maj", "min", "min", "maj", "maj"];
const rootOf = (name) => name.replace(/m$|°$/, "");
const mod = (n) => ((n % 12) + 12) % 12;

// ── 1. Major scales: 7 distinct consecutive letters, correct pitch classes ──
for (let c = 0; c < 12; c++) {
  const scale = majorScale(c);
  ok(scale.length === 7, `${MAJ[c]}: scale has 7 notes`);
  const letters = scale.map((n) => n[0]);
  ok(new Set(letters).size === 7, `${MAJ[c]}: all 7 letters distinct (${scale.join(" ")})`);
  scale.forEach((n, k) =>
    ok(notePc(n) === mod(MAJ_PC[c] + MAJOR_STEPS[k]),
      `${MAJ[c]}: scale degree ${k + 1} = ${n} has pc ${notePc(n)}, want ${mod(MAJ_PC[c] + MAJOR_STEPS[k])}`));
}

// ── 2. Diatonic MAJOR chords: pitch, quality, spelling, slice mapping ──
for (let c = 0; c < 12; c++) {
  const chords = diatonicMajor(c);
  eq(chords.map((x) => x.roman), ["I", "ii", "iii", "IV", "V", "vi", "vii°"], `${MAJ[c]}: romans`);
  const letters = chords.map((x) => rootOf(x.name)[0]);
  ok(new Set(letters).size === 7, `${MAJ[c]} major: 7 distinct chord letters (${chords.map((x) => x.name).join(" ")})`);
  chords.forEach((ch, k) => {
    const wantPc = mod(MAJ_PC[c] + MAJOR_STEPS[k]);
    ok(ch.quality === MAJOR_Q[k], `${MAJ[c]} ${ch.roman}: quality ${ch.quality} want ${MAJOR_Q[k]}`);
    ok(ch.rootPc === wantPc, `${MAJ[c]} ${ch.roman} (${ch.name}): rootPc ${ch.rootPc} want ${wantPc}`);
    ok(notePc(rootOf(ch.name)) === wantPc, `${MAJ[c]} ${ch.roman} (${ch.name}): spelled pc mismatch`);
    const slicePc = ch.ring === "outer" ? MAJ_PC[ch.index] : MIN_PC[ch.index];
    ok(slicePc === wantPc, `${MAJ[c]} ${ch.roman}: slice ${ch.ring}[${ch.index}] pc ${slicePc} want ${wantPc}`);
  });
}

// ── 3. Diatonic MINOR chords: natural-minor pitch/quality, slices match relative major ──
for (let c = 0; c < 12; c++) {
  const chords = diatonicMinor(c);
  eq(chords.map((x) => x.roman), ["i", "ii°", "III", "iv", "v", "VI", "VII"], `${MIN_ROOT[c]}m: romans`);
  chords.forEach((ch, k) => {
    const wantPc = mod(MIN_PC[c] + MINOR_STEPS[k]);
    ok(ch.quality === MINOR_Q[k], `${MIN_ROOT[c]}m ${ch.roman}: quality ${ch.quality} want ${MINOR_Q[k]}`);
    ok(ch.rootPc === wantPc, `${MIN_ROOT[c]}m ${ch.roman} (${ch.name}): rootPc ${ch.rootPc} want ${wantPc}`);
    ok(notePc(rootOf(ch.name)) === wantPc, `${MIN_ROOT[c]}m ${ch.roman} (${ch.name}): spelled pc mismatch`);
  });
  // relative minor shares the relative major's 7 slices
  const majSlices = new Set(diatonicMajor(c).map((x) => x.ring + x.index));
  const minSlices = new Set(chords.map((x) => x.ring + x.index));
  eq([...minSlices].sort(), [...majSlices].sort(), `${MIN_ROOT[c]}m: same 7 slices as relative major`);
}

// ── 4. Signatures + accidental positions ──
const EXPECTED_SIG = [[0, "natural"], [1, "sharp"], [2, "sharp"], [3, "sharp"], [4, "sharp"], [5, "sharp"], [6, "sharp"], [5, "flat"], [4, "flat"], [3, "flat"], [2, "flat"], [1, "flat"]];
for (let c = 0; c < 12; c++) {
  eq([SIGNATURE[c].count, SIGNATURE[c].type], EXPECTED_SIG[c], `${MAJ[c]}: signature`);
  const acc = accidentalPositions(c);
  ok(acc.length === SIGNATURE[c].count, `${MAJ[c]}: ${acc.length} accidentals want ${SIGNATURE[c].count}`);
  // each accidental's slice points at the NATURAL note that gets altered (the
  // "read from the circle" trick), so slice letter must match accidental letter
  acc.forEach((a) =>
    ok(MAJ[a.index][0] === a.name[0], `${MAJ[c]}: accidental ${a.name} highlights slice ${a.index} (${MAJ[a.index]})`));
  // the set of accidental notes must equal the scale notes that carry ♯/♭
  const fromScale = new Set(majorScale(c).filter((n) => n.length > 1));
  const fromAcc = new Set(acc.map((a) => a.name));
  eq([...fromAcc].sort(), [...fromScale].sort(), `${MAJ[c]}: accidentals match scale's altered notes`);
}

// ── 5. Human-readable spot-checks ──
eq(diatonicMajor(0).map((x) => x.name), ["C", "Dm", "Em", "F", "G", "Am", "B°"], "C major chords");
eq(diatonicMajor(2).map((x) => x.name), ["D", "Em", "F♯m", "G", "A", "Bm", "C♯°"], "D major chords (vii°=C♯°)");
eq(diatonicMajor(4).map((x) => x.name), ["E", "F♯m", "G♯m", "A", "B", "C♯m", "D♯°"], "E major chords (vii°=D♯°)");
eq(diatonicMajor(6).map((x) => x.name), ["F♯", "G♯m", "A♯m", "B", "C♯", "D♯m", "E♯°"], "F♯ major chords (vii°=E♯°)");
eq(diatonicMajor(7).map((x) => x.name), ["D♭", "E♭m", "Fm", "G♭", "A♭", "B♭m", "C°"], "D♭ major chords");
eq(diatonicMinor(0).map((x) => x.name), ["Am", "B°", "C", "Dm", "Em", "F", "G"], "A minor chords");
eq(diatonicMinor(3).map((x) => x.name), ["F♯m", "G♯°", "A", "Bm", "C♯m", "D", "E"], "F♯ minor chords");
eq(majorScale(6), ["F♯", "G♯", "A♯", "B", "C♯", "D♯", "E♯"], "F♯ major scale");
eq(signatureText(0), "no sharps or flats", "C signature text");
eq(signatureText(2), "2 sharps — F♯, C♯", "D signature text");
eq(signatureText(11), "1 flat — B♭", "F signature text");
eq(keyName("minor", 0), "A minor", "A minor label");
eq(keyName("major", 6), "F♯ major", "F♯ major label");

console.log(`\n${fail === 0 ? "✓ ALL PASS" : "✗ FAILURES"} — ${pass} checks passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
