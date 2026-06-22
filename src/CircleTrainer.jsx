// Circle of Fifths Trainer — single-file React app. Pure theory + songwriting.
// All music data comes from ./theory.js (Node-verified). Shared chrome from
// @fretworks/design. Design choices locked in CLAUDE.md (mockup v6).
import { useEffect, useMemo, useRef, useState } from "react";
import { AppHeader, TabBar } from "@fretworks/design";
import {
  MAJ, MIN, MIN_ROOT, MAJ_PC, MIN_PC, SIGNATURE, SHARP_ORDER, FLAT_ORDER,
  diatonic, diatonicMajor, accidentalPositions, keyName, signatureText, chordFreqs,
} from "./theory.js";

// ── Palette (locked v6) ──────────────────────────────────────────────────────
const AMBER = "#f0a05a";       // accent
const AMBER_DARK = "#46381f";  // in-key (non-home) fill
const AMBER_TEXT = "#f3c79c";  // text on dark-amber
const TEAL = "#5fa194";        // muted-teal accidental marker
const GREY = "#1c1c1c";        // out-of-key (true neutral)
const INK = "#19160a";         // text on solid amber
const SPOKE = "#0f0e17";       // bg-coloured spokes between slices
const MUTED = "#9a96b0";

// ── Wheel geometry (viewBox 0 0 360 360, centre 180,180) ─────────────────────
const C = 180;
const RINGS = {
  outer: { rIn: 113, rOut: 179, name: 146, nameOut: 154, num: 121, div: 131 },
  inner: { rIn: 47, rOut: 109, name: 78, nameOut: 87, num: 57, div: 66 },
};
const GAP = 1.1; // half-gap (deg) → thin bg spokes between slices
const rad = (d) => (d * Math.PI) / 180;
const polar = (r, d) => [+(C + r * Math.cos(rad(d))).toFixed(2), +(C + r * Math.sin(rad(d))).toFixed(2)];
function sector(rIn, rOut, a0, a1) {
  const [xo0, yo0] = polar(rOut, a0), [xo1, yo1] = polar(rOut, a1);
  const [xi1, yi1] = polar(rIn, a1), [xi0, yi0] = polar(rIn, a0);
  return `M${xo0} ${yo0}A${rOut} ${rOut} 0 0 1 ${xo1} ${yo1}L${xi1} ${yi1}A${rIn} ${rIn} 0 0 0 ${xi0} ${yi0}Z`;
}
function arc(r, a0, a1) {
  const [x0, y0] = polar(r, a0), [x1, y1] = polar(r, a1);
  return `M${x0} ${y0}A${r} ${r} 0 0 1 ${x1} ${y1}`;
}
const GEOM = ["outer", "inner"].flatMap((ring) => {
  const R = RINGS[ring];
  return Array.from({ length: 12 }, (_, i) => {
    const ctr = -90 + i * 30, a0 = ctr - 15 + GAP, a1 = ctr + 15 - GAP;
    return {
      ring, i, id: ring + i,
      path: sector(R.rIn, R.rOut, a0, a1),
      name: polar(R.name, ctr), nameOut: polar(R.nameOut, ctr), num: polar(R.num, ctr),
      divider: arc(R.div, ctr - 13, ctr + 13),
    };
  });
});

// ── Chromatic name helper (for beyond-diatonic convenience labels) ───────────
const SHARP_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const FLAT_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
const spellPc = (pc, prefer) => (prefer === "flat" ? FLAT_NAMES : SHARP_NAMES)[((pc % 12) + 12) % 12];

// ── tiny utils ───────────────────────────────────────────────────────────────
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const ri = (n) => Math.floor(Math.random() * n);
const shuffle = (a) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = ri(i + 1);[x[i], x[j]] = [x[j], x[i]]; } return x; };

// ── Audio ────────────────────────────────────────────────────────────────────
function useAudio() {
  const ref = useRef(null);
  const ctx = () => {
    if (!ref.current) ref.current = new (window.AudioContext || window.webkitAudioContext)();
    if (ref.current.state === "suspended") ref.current.resume();
    return ref.current;
  };
  const voice = (c, freqs, t0, dur) => {
    const master = c.createGain();
    master.connect(c.destination);
    master.gain.setValueAtTime(0.0001, t0);
    master.gain.exponentialRampToValueAtTime(0.2, t0 + 0.02);
    master.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    freqs.forEach((f) => {
      const o = c.createOscillator(); o.type = "triangle"; o.frequency.value = f;
      const g = c.createGain(); g.gain.value = 1 / freqs.length;
      o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur);
    });
  };
  return {
    chord: (pc, q) => { const c = ctx(); voice(c, chordFreqs(pc, q), c.currentTime, 0.75); },
    sequence: (items) => {
      const c = ctx(); let t = c.currentTime + 0.05; const step = 0.62;
      items.forEach((it) => { voice(c, chordFreqs(it.rootPc, it.quality), t, step * 0.95); t += step; });
    },
  };
}

// ── The wheel ────────────────────────────────────────────────────────────────
function Wheel({ home, tg }) {
  const chords = diatonic(home.ring, home.index);
  const cmap = {}; chords.forEach((ch) => { cmap[ch.ring + ch.index] = ch; });
  const homeId = (home.ring === "minor" ? "inner" : "outer") + home.index;
  const accSet = new Set(tg.sharps ? accidentalPositions(home.index).map((a) => "outer" + a.index) : []);
  return (
    <svg viewBox="0 0 360 360" role="img" aria-label={`Circle of fifths, home key ${keyName(home.ring, home.index)}`}>
      {GEOM.map((g) => {
        const isHome = g.id === homeId;
        const ch = cmap[g.id];
        const active = isHome || (tg.chords && ch);
        const fill = isHome ? AMBER : active ? AMBER_DARK : GREY;
        const label = g.ring === "outer" ? MAJ[g.i] : MIN[g.i];
        const color = isHome ? INK : active ? AMBER_TEXT : MUTED;
        const np = tg.numbers ? g.nameOut : g.name;
        const showNum = tg.numbers && active && ch;
        return (
          <g key={g.id} className="cof-slice" data-ring={g.ring} data-i={g.i}>
            <path d={g.path} fill={fill} stroke={SPOKE} strokeWidth="0.5" />
            {g.ring === "outer" && accSet.has(g.id) && (
              <path d={g.path} fill="none" stroke={TEAL} strokeWidth="1.5" strokeDasharray="3 3" strokeLinejoin="round" />
            )}
            {showNum && (
              <path d={g.divider} fill="none" stroke={color} strokeWidth="1" opacity="0.55" />
            )}
            <text x={np[0]} y={np[1]} textAnchor="middle" dominantBaseline="central"
              fill={color} style={{ font: `700 ${g.ring === "outer" ? 15 : 12.5}px var(--font-heading)` }}>{label}</text>
            {showNum && (
              <text x={g.num[0]} y={g.num[1]} textAnchor="middle" dominantBaseline="central"
                fill={isHome ? INK : "#caa784"} style={{ font: `600 ${g.ring === "outer" ? 10 : 9}px var(--font-heading)`, letterSpacing: "-0.02em" }}>{ch.roman}</text>
            )}
          </g>
        );
      })}
      <circle cx="180" cy="180" r="46" fill="#141320" stroke="#2a2840" />
      <text x="180" y="173" textAnchor="middle" dominantBaseline="central" fill="var(--text-strong)"
        style={{ font: "800 30px var(--font-display)" }}>{home.ring === "minor" ? MIN_ROOT[home.index] : MAJ[home.index]}</text>
      <text x="180" y="197" textAnchor="middle" dominantBaseline="central" fill={MUTED}
        style={{ font: "600 10px var(--font-mono)", letterSpacing: "1.5px" }}>{home.ring === "minor" ? "MINOR" : "MAJOR"}</text>
    </svg>
  );
}

const Toggle = ({ on, onClick, children }) => (
  <button className={`cof-toggle${on ? " on" : ""}`} aria-pressed={on} onClick={onClick}>{children}</button>
);

// ── Circle tab ───────────────────────────────────────────────────────────────
function CircleTab({ home, setHome, tg, setTg, audio }) {
  const chords = diatonic(home.ring, home.index);
  const pick = (ring, i) => {
    const hr = ring === "outer" ? "major" : "minor";
    setHome({ ring: hr, index: i });
    audio.chord(ring === "outer" ? MAJ_PC[i] : MIN_PC[i], ring === "outer" ? "maj" : "min");
  };
  return (
    <div className="cof-pad">
      <div className="cof-toggles">
        <Toggle on={tg.chords} onClick={() => setTg((t) => ({ ...t, chords: !t.chords }))}>Chords</Toggle>
        <Toggle on={tg.numbers} onClick={() => setTg((t) => ({ ...t, numbers: !t.numbers }))}>Numbers</Toggle>
        <Toggle on={tg.sharps} onClick={() => setTg((t) => ({ ...t, sharps: !t.sharps }))}>♯ / ♭</Toggle>
      </div>
      <div className="cof-wheelwrap" onClick={(e) => {
        const g = e.target.closest(".cof-slice"); if (g) pick(g.dataset.ring, +g.dataset.i);
      }}>
        <Wheel home={home} tg={tg} />
      </div>
      <div className="cof-readout">
        <div className="cof-readhead">
          <strong>{keyName(home.ring, home.index)}</strong>
          <span>{signatureText(home.index)}</span>
        </div>
        {tg.chords && (
          <div className="cof-chordline">
            {chords.map((ch) => (
              <button key={ch.roman} className="cof-chip" onClick={() => audio.chord(ch.rootPc, ch.quality)}>
                <b>{ch.roman}</b>{ch.name}
              </button>
            ))}
          </div>
        )}
        {tg.sharps && <div className="cof-legend"><span className="cof-dash" /> accidental note in this key</div>}
        <div className="cof-hint">Tap a wedge to set its key and hear it · outer ring = major, inner = relative minor.</div>
      </div>
    </div>
  );
}

// ── Learn tab ────────────────────────────────────────────────────────────────
function LearnTab({ home, setHome, audio }) {
  const rows = MAJ.map((_, c) => {
    const s = SIGNATURE[c];
    return {
      key: MAJ[c],
      sig: s.count === 0 ? "—" : `${s.count}${s.type === "sharp" ? "♯" : "♭"}`,
      notes: accidentalPositions(c).map((a) => a.name).join(" ") || "—",
      rel: MIN[c],
    };
  });
  return (
    <div className="cof-pad">
      <div className="cof-card">
        <h3>What the circle is</h3>
        <p>Step <b>clockwise</b> and every key is a <b>fifth</b> higher — and gains <b>one sharp</b>.
          Step <b>counter-clockwise</b> and you drop a fifth and gain <b>one flat</b>. Twelve steps bring you home.</p>
        <p>The <b>inner ring</b> is each key’s <b>relative minor</b> — same notes, same sharps/flats, darker mood
          (C major and A minor share everything).</p>
        <p>Neighbours sound related because they share almost all their notes — which is exactly why the circle is
          a map for <b>chords, key signatures and key changes</b> all at once.</p>
      </div>

      <div className="cof-card">
        <h3>See it live</h3>
        <p className="cof-dim">Tap any wedge — the centre shows the key, the amber cluster is its chords.</p>
        <div className="cof-wheelwrap cof-wheel-sm" onClick={(e) => {
          const g = e.target.closest(".cof-slice");
          if (g) { const ring = g.dataset.ring, i = +g.dataset.i; setHome({ ring: ring === "outer" ? "major" : "minor", index: i }); audio.chord(ring === "outer" ? MAJ_PC[i] : MIN_PC[i], ring === "outer" ? "maj" : "min"); }
        }}>
          <Wheel home={home} tg={{ chords: true, numbers: true, sharps: false }} />
        </div>
      </div>

      <div className="cof-card">
        <h3>Order of sharps &amp; flats</h3>
        <p>Each new key adds the <b>next</b> accidental in this fixed order — so a key with 3 sharps has the first three.</p>
        <div className="cof-orderrow"><span className="cof-ordlbl">Sharps</span>
          {SHARP_ORDER.map((n, k) => <span key={n} className="cof-ordpip" style={{ opacity: 1 - k * 0.1 }}>{n}</span>)}</div>
        <div className="cof-orderrow"><span className="cof-ordlbl">Flats</span>
          {FLAT_ORDER.map((n, k) => <span key={n} className="cof-ordpip flat" style={{ opacity: 1 - k * 0.1 }}>{n}</span>)}</div>
        <table className="cof-table">
          <thead><tr><th>Key</th><th>Signature</th><th>Sharps / flats</th><th>Rel. minor</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.key}><td><b>{r.key}</b></td><td>{r.sig}</td><td className="cof-mono">{r.notes}</td><td>{r.rel}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

// ── Write tab ────────────────────────────────────────────────────────────────
const MAJ_TEMPLATES = [
  { name: "Pop I–V–vi–IV", romans: ["I", "V", "vi", "IV"] },
  { name: "Jazz ii–V–I", romans: ["ii", "V", "I"] },
  { name: "’50s I–vi–IV–V", romans: ["I", "vi", "IV", "V"] },
  { name: "Anthem vi–IV–I–V", romans: ["vi", "IV", "I", "V"] },
];
const MIN_TEMPLATES = [
  { name: "Minor pop i–♭VI–♭III–♭VII", romans: ["i", "VI", "III", "VII"] },
  { name: "Lament i–iv–v–i", romans: ["i", "iv", "v", "i"] },
  { name: "Drive i–♭VII–♭VI–♭VII", romans: ["i", "VII", "VI", "VII"] },
];

function modulations(home) {
  const c = home.index, out = [];
  out.push({ to: `${MAJ[(c + 1) % 12]} major`, why: "Dominant — up a fifth, shares 6 of 7 notes. The smoothest lift.", pivot: "Pivot: your V is the new key’s I." });
  out.push({ to: `${MAJ[(c + 11) % 12]} major`, why: "Subdominant — down a fifth, shares 6 of 7 notes. Relaxed.", pivot: "Pivot: your IV is the new key’s I." });
  if (home.ring !== "minor") {
    out.push({ to: `${MIN_ROOT[c]} minor`, why: "Relative minor — identical notes, darker mood.", pivot: "Pivot: any chord (the sets are the same)." });
    const pj = MIN_ROOT.indexOf(MAJ[c]);
    if (pj >= 0) out.push({ to: `${MIN_ROOT[pj]} minor`, why: "Parallel minor — same tonic, sudden mood flip.", pivot: "Pivot: the shared V chord." });
  } else {
    out.push({ to: `${MAJ[c]} major`, why: "Relative major — identical notes, brighter mood.", pivot: "Pivot: any chord (the sets are the same)." });
    const pj = MAJ.indexOf(MIN_ROOT[c]);
    if (pj >= 0) out.push({ to: `${MAJ[pj]} major`, why: "Parallel major — same tonic, brighten the room.", pivot: "Pivot: the shared V chord." });
  }
  return out;
}

function beyondDiatonic(home) {
  const c = home.index;
  if (home.ring !== "minor") {
    const T = MAJ_PC[c], pref = SIGNATURE[c].type === "sharp" ? "sharp" : "flat";
    return [
      { deg: "iv", name: spellPc((T + 5) % 12, pref) + "m", note: "Borrowed minor iv — a wistful shadow over the IV." },
      { deg: "♭VI", name: spellPc((T + 8) % 12, pref), note: "Borrowed ♭VI — bold, cinematic lift." },
      { deg: "♭VII", name: spellPc((T + 10) % 12, pref), note: "♭VII — Mixolydian / rock cadence back home." },
      { deg: "V/V", name: spellPc((T + 2) % 12, "sharp") + "7", note: "Secondary dominant — pulls hard into the V." },
      { deg: "V/vi", name: spellPc((T + 4) % 12, "sharp") + "7", note: "Secondary dominant — tonicises the vi." },
    ];
  }
  const T = MIN_PC[c], pref = SIGNATURE[c].type === "sharp" ? "sharp" : "flat";
  return [
    { deg: "V (major)", name: spellPc((T + 7) % 12, "sharp") + "7", note: "Raise the 7th for a strong major V7 → i." },
    { deg: "♭II", name: spellPc((T + 1) % 12, pref), note: "Neapolitan — dramatic pre-dominant." },
    { deg: "IV (major)", name: spellPc((T + 5) % 12, pref), note: "Borrowed major IV — a Dorian brightening." },
    { deg: "vii°7", name: spellPc((T + 11) % 12, "sharp") + "°7", note: "Leading-tone diminished — tense pull to i." },
  ];
}

function WriteTab({ home, setHome, audio }) {
  const chords = diatonic(home.ring, home.index);
  const byRoman = {}; chords.forEach((ch) => { byRoman[ch.roman] = ch; });
  const [seq, setSeq] = useState([]);
  const templates = home.ring === "minor" ? MIN_TEMPLATES : MAJ_TEMPLATES;
  const loadTemplate = (romans) => setSeq(romans.map((r) => byRoman[r]).filter(Boolean));
  return (
    <div className="cof-pad">
      <div className="cof-card">
        <h3>Progression builder <span className="cof-dim">· {keyName(home.ring, home.index)}</span></h3>
        <p className="cof-dim">Tap chords to add them, then play the loop. Change the home key on the Circle tab.</p>
        <div className="cof-palette">
          {chords.map((ch) => (
            <button key={ch.roman} className="cof-pchord" onClick={() => { setSeq((s) => [...s, ch]); audio.chord(ch.rootPc, ch.quality); }}>
              <span className="cof-prom">{ch.roman}</span><span>{ch.name}</span>
            </button>
          ))}
        </div>
        <div className="cof-seq">
          {seq.length === 0 ? <span className="cof-dim">Your progression appears here…</span> :
            seq.map((ch, k) => (
              <button key={k} className="cof-seqchip" title="Remove" onClick={() => setSeq((s) => s.filter((_, j) => j !== k))}>
                <b>{ch.roman}</b> {ch.name} <span className="cof-x">×</span>
              </button>
            ))}
        </div>
        <div className="cof-btnrow">
          <button className="fw-btn fw-btn-primary" disabled={!seq.length} onClick={() => audio.sequence(seq)}>▶ Play</button>
          <button className="fw-btn fw-btn-ghost" disabled={!seq.length} onClick={() => setSeq([])}>Clear</button>
        </div>
        <div className="cof-templates">
          {templates.map((t) => <button key={t.name} className="cof-tmpl" onClick={() => loadTemplate(t.romans)}>{t.name}</button>)}
        </div>
      </div>

      <div className="cof-card">
        <h3>Modulation — closest keys</h3>
        <p className="cof-dim">The easiest places to change key from {keyName(home.ring, home.index)}.</p>
        {modulations(home).map((m) => (
          <div key={m.to} className="cof-modrow">
            <div className="cof-modto">{m.to}</div>
            <div className="cof-modwhy">{m.why}<br /><span className="cof-pivot">{m.pivot}</span></div>
          </div>
        ))}
      </div>

      <div className="cof-card">
        <h3>Beyond the key</h3>
        <p className="cof-dim">Chromatic colours that still resolve home. The numeral is the idea; the name is for this key.</p>
        {beyondDiatonic(home).map((b) => (
          <div key={b.deg} className="cof-modrow">
            <div className="cof-modto cof-bd">{b.deg}<span className="cof-bdname">{b.name}</span></div>
            <div className="cof-modwhy">{b.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Quiz tab ─────────────────────────────────────────────────────────────────
const QUIZ_MODES = [
  { id: "mixed", label: "Mixed" },
  { id: "chords", label: "Chords in a key" },
  { id: "accidentals", label: "Sharps / flats" },
  { id: "relmin", label: "Relative minor" },
  { id: "namekey", label: "Name the key" },
];
const QUIZ_LENGTH = 10;

function genQuestion(mode) {
  if (mode === "mixed") mode = ["chords", "accidentals", "relmin", "namekey"][ri(4)];
  if (mode === "chords") {
    const c = ri(12);
    const set = diatonicMajor(c);
    const pickRoman = ["ii", "iii", "IV", "V", "vi", "vii°"][ri(6)];
    const correct = set.find((x) => x.roman === pickRoman).name;
    const pool = new Set(set.map((x) => x.name));
    diatonicMajor((c + 1) % 12).forEach((x) => pool.add(x.name));
    diatonicMajor((c + 11) % 12).forEach((x) => pool.add(x.name));
    pool.delete(correct);
    const opts = shuffle([correct, ...shuffle([...pool]).slice(0, 3)]);
    return { q: `In ${MAJ[c]} major, what is the ${pickRoman} chord?`, opts, correct, why: `${MAJ[c]} major: ${set.map((x) => x.roman + " " + x.name).join(" · ")}.` };
  }
  if (mode === "accidentals") {
    const c = 1 + ri(11); // skip C (no accidentals) for a better question
    const s = SIGNATURE[c];
    const correct = `${s.count} ${s.count === 1 ? s.type : s.type + "s"}`;
    const pool = new Set();
    while (pool.size < 6) { const n = ri(7), t = Math.random() < 0.5 ? "sharp" : "flat"; if (n > 0) pool.add(`${n} ${n === 1 ? t : t + "s"}`); }
    pool.delete(correct);
    const opts = shuffle([correct, ...[...pool].slice(0, 3)]);
    return { q: `How many accidentals does ${MAJ[c]} major have?`, opts, correct, why: `${MAJ[c]} major — ${signatureText(c)}.` };
  }
  if (mode === "relmin") {
    const c = ri(12);
    const correct = `${MIN_ROOT[c]} minor`;
    const pool = shuffle(MIN_ROOT.filter((_, j) => j !== c)).slice(0, 3).map((r) => `${r} minor`);
    return { q: `What is the relative minor of ${MAJ[c]} major?`, opts: shuffle([correct, ...pool]), correct, why: `${MAJ[c]} major and ${correct} share the same key signature (${signatureText(c)}).` };
  }
  // namekey
  const c = 1 + ri(11);
  const s = SIGNATURE[c];
  const correct = `${MAJ[c]} major`;
  const pool = shuffle(MAJ.filter((_, j) => j !== c)).slice(0, 3).map((m) => `${m} major`);
  return { q: `Which major key has ${s.count} ${s.count === 1 ? s.type : s.type + "s"}?`, opts: shuffle([correct, ...pool]), correct, why: `${correct} — ${signatureText(c)}.` };
}

function QuizTab() {
  const [mode, setMode] = useState("mixed");
  const [q, setQ] = useState(() => genQuestion("mixed"));
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [qNum, setQNum] = useState(1);
  const [done, setDone] = useState(false);

  const choose = (opt) => {
    if (picked) return;
    setPicked(opt);
    if (opt === q.correct) setScore((s) => s + 1);
  };
  const advance = () => {
    if (qNum >= QUIZ_LENGTH) { setDone(true); return; }
    setQNum((n) => n + 1); setPicked(null); setQ(genQuestion(mode));
  };
  const reset = (m) => { setMode(m); setScore(0); setQNum(1); setPicked(null); setDone(false); setQ(genQuestion(m)); };

  const modeRow = (
    <div className="cof-quizmodes">
      {QUIZ_MODES.map((m) => (
        <button key={m.id} className={`cof-toggle${mode === m.id ? " on" : ""}`} onClick={() => reset(m.id)}>{m.label}</button>
      ))}
    </div>
  );

  if (done) {
    const pct = Math.round((score / QUIZ_LENGTH) * 100);
    const msg = pct === 100 ? "Perfect round! 🏆" : pct >= 80 ? "Strong work! 🎉" : pct >= 50 ? "Getting there 👍" : "Keep practising 🎯";
    return (
      <div className="cof-pad">
        {modeRow}
        <div className="cof-card cof-endscreen">
          <div className="cof-endtitle">Round complete</div>
          <div className="cof-endscore">{score}<span>/{QUIZ_LENGTH}</span></div>
          <div className="cof-endpct">{pct}%</div>
          <div className="cof-endmsg">{msg}</div>
          <button className="fw-btn fw-btn-primary" onClick={() => reset(mode)}>Play again</button>
          <div className="cof-enddim">…or pick another mode above.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="cof-pad">
      {modeRow}
      <div className="cof-card">
        <div className="cof-quizmeta"><span>Question {qNum} of {QUIZ_LENGTH}</span><span>Score {score}</span></div>
        <div className="cof-progress"><div style={{ width: `${((qNum - (picked ? 0 : 1)) / QUIZ_LENGTH) * 100}%` }} /></div>
        <div className="cof-quizq">{q.q}</div>
        <div className="cof-quizopts">
          {q.opts.map((o) => {
            let cls = "cof-opt";
            if (picked) { if (o === q.correct) cls += " right"; else if (o === picked) cls += " wrong"; }
            return <button key={o} className={cls} disabled={!!picked} onClick={() => choose(o)}>{o}</button>;
          })}
        </div>
        {picked && (
          <div className="cof-quizfb">
            <div className={picked === q.correct ? "cof-ok" : "cof-no"}>{picked === q.correct ? "✓ Correct" : `✗ Answer: ${q.correct}`}</div>
            <p className="cof-dim">{q.why}</p>
            <button className="fw-btn fw-btn-primary" onClick={advance}>{qNum >= QUIZ_LENGTH ? "See results →" : "Next →"}</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── App ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "learn", icon: "📖", label: "Learn" },
  { id: "circle", icon: "🧭", label: "Circle" },
  { id: "write", icon: "✍️", label: "Write" },
  { id: "quiz", icon: "❓", label: "Quiz" },
];

export default function App() {
  const [tab, setTab] = useState("circle");
  const [home, setHome] = useState(() => store.get("cof_home", { ring: "major", index: 0 }));
  const [tg, setTg] = useState(() => store.get("cof_tg", { chords: true, numbers: false, sharps: false }));
  const audio = useAudio();
  useEffect(() => store.set("cof_home", home), [home]);
  useEffect(() => store.set("cof_tg", tg), [tg]);
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font-body)", WebkitFontSmoothing: "antialiased", "--accent": AMBER, "--accent-ink": INK }}>
      <style>{STYLES}</style>
      <AppHeader toolKey="circle" />
      <TabBar toolKey="circle" accent={AMBER} tabs={TABS} active={tab} onChange={setTab} />
      <main className="fw-app-shell">
        {tab === "learn" && <LearnTab home={home} setHome={setHome} audio={audio} />}
        {tab === "circle" && <CircleTab home={home} setHome={setHome} tg={tg} setTg={setTg} audio={audio} />}
        {tab === "write" && <WriteTab home={home} setHome={setHome} audio={audio} />}
        {tab === "quiz" && <QuizTab />}
      </main>
    </div>
  );
}

// ── Styles (scoped cof-*; pseudo-classes need a stylesheet) ───────────────────
const STYLES = `
.cof-pad { padding: 14px 14px calc(30px + env(safe-area-inset-bottom, 0px)); }
.cof-toggles, .cof-quizmodes { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; }
.cof-toggles { margin: 2px 0 24px; }
.cof-quizmodes { margin-bottom: 14px; }
.cof-toggle { font:700 13px var(--font-heading); padding:8px 14px; border:1px solid var(--border); border-radius:var(--r-pill); background:transparent; color:var(--muted); cursor:pointer; transition:.16s; }
.cof-toggle:hover { color:var(--text); border-color:var(--border-2); }
.cof-toggle.on { background:var(--accent); color:var(--accent-ink); border-color:var(--accent); }
.cof-wheelwrap { display:flex; justify-content:center; }
.cof-wheelwrap svg { width:min(94vw, 440px); height:auto; }
.cof-wheel-sm svg { width:min(72vw, 300px); }
.cof-slice { cursor:pointer; }
.cof-slice text { pointer-events:none; user-select:none; }
.cof-slice:hover path { filter:brightness(1.18); }
.cof-readout { margin-top:20px; min-height:128px; text-align:center; }
.cof-readhead { display:flex; flex-wrap:wrap; gap:6px 10px; align-items:baseline; justify-content:center; }
.cof-readhead strong { font:600 var(--fs-xl)/1 var(--font-display); color:var(--text-strong); }
.cof-readhead span { font:500 var(--fs-sm) var(--font-mono); color:var(--muted); }
.cof-chordline { display:flex; flex-wrap:wrap; gap:4px; justify-content:center; margin-top:12px; }
.cof-chip { font:600 10.5px var(--font-mono); padding:4px 6px; border:1px solid var(--border); border-radius:var(--r-sm); background:var(--surface-2); color:var(--text); cursor:pointer; transition:.16s; white-space:nowrap; }
.cof-chip:hover { border-color:var(--accent); }
.cof-chip b { color:var(--accent); margin-right:3px; }
.cof-legend { display:flex; align-items:center; gap:8px; justify-content:center; margin-top:12px; color:var(--muted); font:500 12px var(--font-mono); }
.cof-dash { width:24px; border-top:2px dashed ${TEAL}; display:inline-block; }
.cof-hint { text-align:center; color:var(--faint); font-size:var(--fs-xs); margin-top:14px; line-height:1.5; }
.cof-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--r-lg); padding:16px 18px; margin-bottom:14px; }
.cof-card h3 { font:600 var(--fs-lg) var(--font-heading); color:var(--text-strong); margin:0 0 10px; }
.cof-card p { font-size:var(--fs-sm); line-height:1.6; color:var(--text); margin:0 0 10px; }
.cof-card p:last-child { margin-bottom:0; }
.cof-card b { color:var(--text-strong); }
.cof-dim { color:var(--muted) !important; }
.cof-orderrow { display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin:6px 0; }
.cof-ordlbl { font:700 var(--fs-xs) var(--font-heading); color:var(--muted); width:46px; }
.cof-ordpip { font:700 13px var(--font-mono); color:var(--accent); background:var(--surface-2); border:1px solid var(--border); border-radius:var(--r-sm); padding:3px 7px; }
.cof-ordpip.flat { color:${TEAL}; }
.cof-table { width:100%; border-collapse:collapse; margin-top:12px; font-size:var(--fs-sm); }
.cof-table th { text-align:left; font:700 var(--fs-xs) var(--font-heading); color:var(--muted); padding:6px 8px; border-bottom:1px solid var(--border); }
.cof-table td { padding:6px 8px; border-bottom:1px solid var(--surface-3); color:var(--text); }
.cof-table td b { color:var(--accent); }
.cof-mono { font-family:var(--font-mono); color:var(--muted); }
.cof-palette { display:grid; grid-template-columns:repeat(auto-fit, minmax(58px,1fr)); gap:7px; margin:4px 0 12px; }
.cof-pchord { display:flex; flex-direction:column; align-items:center; gap:2px; padding:8px 4px; border:1px solid var(--border); border-radius:var(--r-md); background:var(--surface-2); color:var(--text); cursor:pointer; transition:.16s; }
.cof-pchord:hover { border-color:var(--accent); transform:translateY(-1px); }
.cof-prom { font:700 var(--fs-xs) var(--font-mono); color:var(--accent); }
.cof-pchord span:last-child { font:600 var(--fs-sm) var(--font-heading); }
.cof-seq { display:flex; flex-wrap:wrap; gap:7px; min-height:38px; align-items:center; padding:8px; background:var(--surface-2); border:1px dashed var(--border); border-radius:var(--r-md); }
.cof-seqchip { font:600 12px var(--font-mono); padding:6px 9px; border:1px solid var(--border-2); border-radius:var(--r-md); background:var(--surface); color:var(--text); cursor:pointer; }
.cof-seqchip b { color:var(--accent); }
.cof-seqchip .cof-x { color:var(--faint); margin-left:3px; }
.cof-seqchip:hover .cof-x { color:#ff6b6b; }
.cof-btnrow { display:flex; gap:8px; margin:12px 0; }
.cof-btnrow .fw-btn:disabled { opacity:.4; cursor:not-allowed; }
.cof-templates { display:flex; flex-wrap:wrap; gap:7px; }
.cof-tmpl { font:600 var(--fs-xs) var(--font-body); padding:6px 10px; border:1px solid var(--border); border-radius:var(--r-pill); background:transparent; color:var(--muted); cursor:pointer; transition:.16s; }
.cof-tmpl:hover { color:var(--accent); border-color:var(--accent); }
.cof-modrow { display:flex; gap:12px; padding:10px 0; border-top:1px solid var(--surface-3); }
.cof-modrow:first-of-type { border-top:none; }
.cof-modto { flex:0 0 96px; font:700 var(--fs-sm) var(--font-heading); color:var(--text-strong); }
.cof-modwhy { flex:1; font-size:var(--fs-sm); color:var(--text); line-height:1.5; }
.cof-pivot { color:var(--muted); font-family:var(--font-body); font-size:var(--fs-xs); }
.cof-bd { display:flex; flex-direction:column; gap:2px; color:var(--accent); }
.cof-bdname { color:var(--muted); font:600 var(--fs-xs) var(--font-mono); }
.cof-quizmeta { display:flex; justify-content:space-between; font:600 var(--fs-xs) var(--font-body); color:var(--muted); margin-bottom:8px; }
.cof-progress { height:4px; background:var(--surface-3); border-radius:var(--r-pill); overflow:hidden; margin-bottom:16px; }
.cof-progress > div { height:100%; background:var(--accent); border-radius:var(--r-pill); transition:width .3s ease; }
.cof-quizq { font:600 var(--fs-lg) var(--font-heading); color:var(--text-strong); margin:6px 0 16px; line-height:1.4; }
.cof-endscreen { text-align:center; padding:26px 18px; }
.cof-endtitle { font:600 var(--fs-lg) var(--font-heading); color:var(--muted); }
.cof-endscore { font:800 56px var(--font-display) ; color:var(--accent); line-height:1.05; margin-top:6px; }
.cof-endscore span { font-size:24px; color:var(--muted); }
.cof-endpct { font:700 var(--fs-xl) var(--font-heading); color:var(--text-strong); margin-top:2px; }
.cof-endmsg { font-size:var(--fs-base); color:var(--text); margin:8px 0 18px; }
.cof-enddim { font-size:var(--fs-xs); color:var(--faint); margin-top:12px; }
.cof-quizopts { display:grid; gap:8px; }
.cof-opt { font:600 var(--fs-base) var(--font-heading); text-align:left; padding:12px 14px; border:1px solid var(--border); border-radius:var(--r-md); background:var(--surface-2); color:var(--text); cursor:pointer; transition:.14s; }
.cof-opt:hover:not(:disabled) { border-color:var(--accent); }
.cof-opt:disabled { cursor:default; }
.cof-opt.right { border-color:#39d98a; background:color-mix(in srgb,#39d98a 16%,transparent); color:#d6ffe9; }
.cof-opt.wrong { border-color:#ff6b6b; background:color-mix(in srgb,#ff6b6b 14%,transparent); color:#ffd9d9; }
.cof-quizfb { margin-top:14px; }
.cof-ok { font:700 var(--fs-base) var(--font-heading); color:#39d98a; margin-bottom:4px; }
.cof-no { font:700 var(--fs-base) var(--font-heading); color:#ff8a8a; margin-bottom:4px; }
.cof-quizfb p { font-size:var(--fs-sm); line-height:1.5; margin:0 0 12px; }
@media (prefers-reduced-motion: reduce) { .cof-pchord, .cof-opt, .cof-toggle, .cof-tmpl, .cof-chip { transition:none; } }
`;
