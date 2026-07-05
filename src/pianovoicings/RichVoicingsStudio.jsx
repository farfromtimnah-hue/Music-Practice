// ============================================================================
// RICH VOICINGS PIANO STUDIO — teacher-only section
// ----------------------------------------------------------------------------
// Serves pre-voiced, rich pop-gospel progressions and shows exactly which keys
// to play with each hand. LH = blue, RH = yellow. Self-paced reference &
// practice — not a timed play-along. Two levels (Foundations / Pop Gospel),
// all 12 keys, curated voicings transposed from C. Sibling to the Cut Capo and
// Open Voicings studios.
// ============================================================================
import { useState, useMemo, useEffect } from "react";
import {
  KEYS, LEVELS, keyByName, offsetForKey, surpriseKey, transposeChord, pcOf,
} from "./library.js";

const LS_KEY = "richVoicings.key";
const LS_LEVEL = "richVoicings.level";

const LH_COLOR = "#4fc3f7"; // blue  (matches --sharp)
const RH_COLOR = "#f0c040"; // yellow (matches --gold)

// ---------------------------------------------------------------------------
// Keyboard geometry (horizontal, whites then blacks overlaid). The rendered
// range is computed per progression and the whole keyboard is fit to the
// screen width, so BOTH hands (bass + treble) are always visible at once — no
// scrolling, and no note ever falls off the end after transposition.
// ---------------------------------------------------------------------------
const WHITE_W = 34, WHITE_H = 156, BLACK_W = 20, BLACK_H = 98, KB_TOP = 4;
const BLACK_PCS = new Set([1, 3, 6, 8, 10]);
const isWhite = (midi) => !BLACK_PCS.has(pcOf(midi));

// Snap a midi note outward to the nearest white key (down for low, up for high).
const snapWhite = (midi, dir) => {
  let m = midi;
  while (!isWhite(m)) m += dir;
  return m;
};

function buildKeys(lowMidi, highMidi) {
  const whites = [];
  const blacks = [];
  let wi = 0;
  for (let midi = lowMidi; midi <= highMidi; midi++) {
    if (BLACK_PCS.has(pcOf(midi))) {
      // sits on the boundary between the previous white and the next white
      blacks.push({ midi, x: wi * WHITE_W - BLACK_W / 2 });
    } else {
      whites.push({ midi, x: wi * WHITE_W });
      wi++;
    }
  }
  return { whites, blacks, width: wi * WHITE_W };
}

// ---------------------------------------------------------------------------
// Piano keyboard SVG — lights the current chord's LH (blue) / RH (yellow) keys
// ---------------------------------------------------------------------------
function Keyboard({ chord, lowMidi, highMidi }) {
  const KB = useMemo(() => buildKeys(lowMidi, highMidi), [lowMidi, highMidi]);

  // midi -> { hand, label }
  const lit = useMemo(() => {
    const map = new Map();
    if (chord) {
      for (const n of chord.lh) map.set(n.midi, { hand: "lh", label: n.label });
      for (const n of chord.rh) map.set(n.midi, { hand: "rh", label: n.label });
    }
    return map;
  }, [chord]);

  const fillFor = (hand) => (hand === "lh" ? LH_COLOR : RH_COLOR);

  return (
    <div className="rv-kbwrap">
      <svg viewBox={`0 0 ${KB.width} ${WHITE_H + KB_TOP}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img" aria-label="Piano keyboard — blue keys are left hand, yellow keys are right hand">
        {/* white keys */}
        {KB.whites.map((k) => {
          const info = lit.get(k.midi);
          return (
            <g key={`w${k.midi}`}>
              <rect x={k.x} y={KB_TOP} width={WHITE_W} height={WHITE_H} rx="4"
                fill={info ? fillFor(info.hand) : "#f7f7fb"} stroke="#2a2a40" strokeWidth="1" />
              {info && (
                <text x={k.x + WHITE_W / 2} y={WHITE_H - 12} textAnchor="middle" fontSize="13"
                  fontWeight="700" fontFamily="Oswald,sans-serif" fill="#1a1208">{info.label}</text>
              )}
            </g>
          );
        })}
        {/* black keys (overlaid) */}
        {KB.blacks.map((k) => {
          const info = lit.get(k.midi);
          return (
            <g key={`b${k.midi}`}>
              <rect x={k.x} y={KB_TOP} width={BLACK_W} height={BLACK_H} rx="3"
                fill={info ? fillFor(info.hand) : "#16161f"} stroke="#000" strokeWidth="1" />
              {info && (
                <text x={k.x + BLACK_W / 2} y={BLACK_H - 8} textAnchor="middle" fontSize="10"
                  fontWeight="700" fontFamily="Oswald,sans-serif" fill="#1a1208">{info.label}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------
export default function RichVoicingsStudio({ onBack }) {
  const [levelId, setLevelId] = useState(() => {
    const s = localStorage.getItem(LS_LEVEL);
    return s && LEVELS[s] ? s : "foundations";
  });
  const [keyName, setKeyName] = useState(() => {
    const s = localStorage.getItem(LS_KEY);
    return s && keyByName(s).name === s ? s : "C";
  });
  const [progIdx, setProgIdx] = useState(0);
  const [chordIdx, setChordIdx] = useState(0);

  const level = LEVELS[levelId];
  const progressions = level.progressions;
  const progression = progressions[progIdx % progressions.length];
  const key = keyByName(keyName);

  useEffect(() => { localStorage.setItem(LS_LEVEL, levelId); }, [levelId]);
  useEffect(() => { localStorage.setItem(LS_KEY, keyName); }, [keyName]);

  // Reset position when the level changes (progression sets differ).
  useEffect(() => { setProgIdx(0); setChordIdx(0); }, [levelId]);

  // Transpose the whole progression into the chosen key.
  const chords = useMemo(() => {
    const offset = offsetForKey(key);
    return progression.chords.map((c) => transposeChord(c, offset, key.acc));
  }, [progression, key]);

  const safeChordIdx = Math.min(chordIdx, chords.length - 1);
  const current = chords[safeChordIdx];

  // Keyboard range: span every note the WHOLE progression uses (so it never
  // reflows between chords), padded a little and snapped to white keys.
  const [lowMidi, highMidi] = useMemo(() => {
    let lo = Infinity, hi = -Infinity;
    for (const c of chords) for (const n of [...c.lh, ...c.rh]) {
      if (n.midi < lo) lo = n.midi;
      if (n.midi > hi) hi = n.midi;
    }
    return [snapWhite(lo - 2, -1), snapWhite(hi + 2, +1)];
  }, [chords]);

  const prevChord = () => setChordIdx((i) => (i - 1 + chords.length) % chords.length);
  const nextChord = () => setChordIdx((i) => (i + 1) % chords.length);
  const newProgression = () => {
    setProgIdx((i) => (i + 1) % progressions.length);
    setChordIdx(0);
  };
  const doSurprise = () => { setKeyName(surpriseKey().name); };

  return (
    <div className="shell">
      <style>{RV_STYLE}</style>
      <div className="rv-screen">
        <div className="rv-header">
          <button className="rv-back" onClick={onBack}>← Back</button>
          <div className="rv-title">Rich Voicings Piano</div>
          <div className="rv-tune-note">two-hand · pop-gospel</div>
        </div>

        <div className="rv-intro">
          Pre-voiced rich progressions with the exact keys for each hand.
          <b style={{ color: LH_COLOR }}> Blue = left hand</b> ·
          <b style={{ color: RH_COLOR }}> yellow = right hand</b>. Self-paced.
        </div>

        {/* Level toggle */}
        <div className="rv-modebar">
          {Object.values(LEVELS).map((lv) => (
            <button key={lv.id} className={`rv-modebtn ${levelId === lv.id ? "on" : ""}`}
              onClick={() => setLevelId(lv.id)}>{lv.label}</button>
          ))}
        </div>
        <div className="rv-blurb">{level.blurb}</div>

        {/* Key controls */}
        <div className="rv-keyrow">
          <label className="rv-field">
            <span>Key</span>
            <select value={keyName} onChange={(e) => setKeyName(e.target.value)}>
              {KEYS.map((k) => <option key={k.name} value={k.name}>{k.name}</option>)}
            </select>
          </label>
          <button className="rv-mini-btn" onClick={doSurprise}>🎲 Surprise me</button>
        </div>

        {/* Progression header + New progression */}
        <div className="rv-row-between">
          <div className="rv-prog-name">
            {progression.name}
            <span className="rv-prog-count">{progIdx % progressions.length + 1}/{progressions.length}</span>
          </div>
          <button className="rv-mini-btn" onClick={newProgression}>New progression →</button>
        </div>

        {/* Chord chip row */}
        <div className="rv-chips">
          {chords.map((c, i) => (
            <button key={i} className={`rv-chip ${i === safeChordIdx ? "on" : ""}`}
              onClick={() => setChordIdx(i)}>
              <span className="rv-chip-sym">{c.symbol}</span>
              <span className="rv-chip-num">{c.num}</span>
            </button>
          ))}
        </div>

        {/* Current chord symbol */}
        <div className="rv-current">{current.symbol}</div>

        {/* Keyboard */}
        <Keyboard chord={current} lowMidi={lowMidi} highMidi={highMidi} />

        {/* Which notes, per hand */}
        <div className="rv-handrow">
          <div className="rv-hand">
            <span className="rv-hand-lbl" style={{ color: LH_COLOR }}>Left hand</span>
            <span className="rv-hand-val">{current.lh.map((n) => n.label).join(" · ") || "—"}</span>
          </div>
          <div className="rv-hand">
            <span className="rv-hand-lbl" style={{ color: RH_COLOR }}>Right hand</span>
            <span className="rv-hand-val">{current.rh.map((n) => n.label).join(" · ") || "—"}</span>
          </div>
        </div>

        {/* Prev / Next */}
        <div className="rv-nav">
          <button className="rv-navbtn" onClick={prevChord}>← Prev</button>
          <button className="rv-navbtn" onClick={nextChord}>Next →</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles (scoped by rv- prefix; reuses the app's CSS variables)
// ---------------------------------------------------------------------------
const RV_STYLE = `
.rv-screen{display:flex;flex-direction:column;padding:14px 14px 40px;gap:13px;min-height:100vh;}
.rv-header{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.rv-title{font-family:'Oswald',sans-serif;font-size:18px;font-weight:700;color:var(--teacher);letter-spacing:1px;}
.rv-tune-note{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);text-align:right;}
.rv-back{background:none;border:none;color:var(--muted);font-size:14px;cursor:pointer;font-family:'Source Sans 3',sans-serif;padding:0;}
.rv-intro{font-size:12px;color:var(--muted);line-height:1.5;background:rgba(192,132,252,.06);border:1px solid rgba(192,132,252,.25);border-radius:10px;padding:9px 11px;}
.rv-intro b{font-weight:700;}
.rv-modebar{display:flex;gap:6px;background:var(--surface);border:1.5px solid var(--border);border-radius:12px;padding:4px;}
.rv-modebtn{flex:1;padding:10px 4px;border:none;border-radius:9px;background:transparent;color:var(--muted);font-family:'Oswald',sans-serif;font-size:13px;font-weight:600;letter-spacing:.5px;cursor:pointer;transition:all .15s;}
.rv-modebtn.on{background:rgba(192,132,252,.16);color:var(--teacher);}
.rv-blurb{font-size:11.5px;color:var(--muted);line-height:1.4;text-align:center;}
.rv-keyrow{display:flex;gap:8px;align-items:flex-end;}
.rv-field{flex:1;display:flex;flex-direction:column;gap:4px;}
.rv-field span{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);}
.rv-field select{padding:10px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface);color:var(--text);font-size:15px;font-family:'Source Sans 3',sans-serif;}
.rv-field select:focus{outline:none;border-color:var(--teacher);}
.rv-mini-btn{padding:10px 12px;border-radius:10px;border:1.5px solid var(--teacher);background:rgba(192,132,252,.08);color:var(--teacher);font-family:'Oswald',sans-serif;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;}
.rv-row-between{display:flex;align-items:center;justify-content:space-between;gap:10px;}
.rv-prog-name{font-family:'Oswald',sans-serif;font-size:15px;font-weight:600;color:var(--text);letter-spacing:.5px;display:flex;align-items:baseline;gap:8px;}
.rv-prog-count{font-size:11px;color:var(--muted);font-weight:400;letter-spacing:1px;}
.rv-chips{display:flex;gap:6px;flex-wrap:wrap;}
.rv-chip{flex:1;min-width:64px;padding:8px 6px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface);cursor:pointer;display:flex;flex-direction:column;gap:2px;align-items:center;transition:all .15s;}
.rv-chip.on{border-color:var(--gold);background:var(--surface2);}
.rv-chip-sym{font-family:'Oswald',sans-serif;font-size:15px;font-weight:600;color:var(--text);}
.rv-chip.on .rv-chip-sym{color:var(--gold);}
.rv-chip-num{font-size:10px;color:var(--muted);letter-spacing:.5px;}
.rv-current{font-family:'Oswald',sans-serif;font-size:34px;font-weight:700;color:var(--gold);letter-spacing:1px;text-align:center;margin-top:2px;}
.rv-kbwrap{background:var(--surface);border:1.5px solid var(--border);border-radius:12px;padding:8px;}
.rv-handrow{display:flex;gap:8px;}
.rv-hand{flex:1;display:flex;flex-direction:column;gap:3px;background:var(--surface);border:1.5px solid var(--border);border-radius:11px;padding:9px 11px;}
.rv-hand-lbl{font-size:10px;letter-spacing:1px;text-transform:uppercase;font-weight:700;}
.rv-hand-val{font-family:'Oswald',sans-serif;font-size:17px;color:var(--text);letter-spacing:1px;}
.rv-nav{display:flex;gap:8px;}
.rv-navbtn{flex:1;padding:13px;border-radius:11px;border:1.5px solid var(--border);background:var(--surface);color:var(--text);font-family:'Oswald',sans-serif;font-size:15px;font-weight:600;letter-spacing:1px;cursor:pointer;}
.rv-navbtn:active{border-color:var(--teacher);background:var(--surface2);}
`;
