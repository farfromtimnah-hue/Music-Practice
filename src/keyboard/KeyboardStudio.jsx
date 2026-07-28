// ============================================================================
// KEYBOARD STUDIO — Lara (piano / keys), also visible to Teacher
// ----------------------------------------------------------------------------
// A GATED quiz, not a lookup table. Scales: side → count → which accidentals.
// Chords: root + quality → which notes. Only after every gate is passed (or
// revealed with "Show Me", which never counts against her) does the photo-real
// top-down keyboard appear with the scale/chord lit and fingering on the keys.
// ============================================================================
import { useState, useMemo } from "react";
import {
  SCALES, SCALE_ORDER, scaleByName, SHARP_CHIPS, FLAT_CHIPS,
  RH_FINGERING, LH_FINGERING, PC,
  CHORD_ROOTS, CHORD_QUALITIES, CHORDS, chordName, chordNotes, chordChips,
} from "./theory.js";

// ---------------------------------------------------------------------------
// KEYBOARD GEOMETRY — straight-down orthographic view, two full octaves + the
// closing C, so any one-octave scale plus its octave note always fits.
// Black-key offsets are the real thing: they are NOT centred on the cracks.
// ---------------------------------------------------------------------------
const WHITE_W = 40, WHITE_H = 200, BLACK_W = 24, BLACK_H = 122;
const GAP = 1.4;                       // visible seam between white keys
const OCTAVES = 2;

// Black-key CENTRES, in white-key widths measured from the left edge of C.
// These are the real proportions, not "centred on the crack": in the 2-key
// group C#/D# lean outward (0.90 / 2.10 rather than 1.0 / 2.0), and in the
// 3-key group only G# sits on its boundary (5.00) while F# and A# lean out
// (3.85 / 6.15). Every black key still straddles the seam it belongs to.
const BLACK_CENTERS = {
  1:  0.90,  // C#
  3:  2.10,  // D#
  6:  3.85,  // F#
  8:  5.00,  // G#
  10: 6.15,  // A#
};

const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];

function buildKeyboard() {
  const whites = [];
  const blacks = [];
  const totalWhites = OCTAVES * 7 + 1; // + closing C
  for (let i = 0; i < totalWhites; i++) {
    const oct = Math.floor(i / 7);
    const deg = i % 7;
    whites.push({ midi: oct * 12 + WHITE_PCS[deg], x: i * WHITE_W, i });
  }
  for (let oct = 0; oct < OCTAVES; oct++) {
    for (const [pcStr, center] of Object.entries(BLACK_CENTERS)) {
      const pc = Number(pcStr);
      blacks.push({
        midi: oct * 12 + pc,
        x: (oct * 7 + center) * WHITE_W - BLACK_W / 2,
      });
    }
  }
  return { whites, blacks, width: totalWhites * WHITE_W, height: WHITE_H };
}

const KB = buildKeyboard();

// ---------------------------------------------------------------------------
// Photo-realistic top-down keyboard. Pure SVG — gradients, seams, drop shadows.
// `lit` maps an absolute key index -> { label, finger }.
// ---------------------------------------------------------------------------
export function Keyboard({ lit, accent = "#f0c040" }) {
  const PAD = 10;
  return (
    <div className="kbs-kbwrap">
      <svg
        viewBox={`0 0 ${KB.width + PAD * 2} ${KB.height + PAD * 2 + 6}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label="Piano keyboard viewed from directly overhead, with the highlighted keys and fingering numbers"
      >
        <defs>
          {/* white key: ivory, very slightly brighter at the player's end */}
          <linearGradient id="kbsWhite" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#e9e9ee" />
            <stop offset="18%"  stopColor="#f6f6f9" />
            <stop offset="86%"  stopColor="#fdfdff" />
            <stop offset="100%" stopColor="#e2e2ea" />
          </linearGradient>
          {/* white key, lit */}
          <linearGradient id="kbsWhiteLit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#c99a1e" />
            <stop offset="18%"  stopColor={accent} />
            <stop offset="86%"  stopColor="#ffe9a8" />
            <stop offset="100%" stopColor="#d9a92c" />
          </linearGradient>
          {/* black key: glossy, with a highlight band across the top face */}
          <linearGradient id="kbsBlack" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#0d0d12" />
            <stop offset="22%"  stopColor="#33333f" />
            <stop offset="45%"  stopColor="#1b1b23" />
            <stop offset="100%" stopColor="#070709" />
          </linearGradient>
          <linearGradient id="kbsBlackLit" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#6b5210" />
            <stop offset="22%"  stopColor="#a8801f" />
            <stop offset="45%"  stopColor="#7d6015" />
            <stop offset="100%" stopColor="#4c3a0b" />
          </linearGradient>
          {/* soft shadow cast by the black keys onto the whites */}
          <filter id="kbsShadow" x="-40%" y="-25%" width="200%" height="170%">
            <feDropShadow dx="1.4" dy="2.6" stdDeviation="2.2" floodColor="#000" floodOpacity="0.55" />
          </filter>
          <filter id="kbsGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor={accent} floodOpacity="0.55" />
          </filter>
        </defs>

        <g transform={`translate(${PAD},${PAD})`}>
          {/* felt / case behind the keys */}
          <rect x="-6" y="-6" width={KB.width + 12} height={KB.height + 12} rx="6" fill="#100f16" />
          <rect x="-6" y="-6" width={KB.width + 12} height="5" fill="#5b1220" opacity="0.85" />

          {/* WHITE KEYS */}
          {KB.whites.map((k) => {
            const info = lit.get(k.midi);
            return (
              <g key={`w${k.midi}`} filter={info ? "url(#kbsGlow)" : undefined}>
                <rect
                  x={k.x + GAP / 2} y={0}
                  width={WHITE_W - GAP} height={WHITE_H}
                  rx="3.5" ry="3.5"
                  fill={info ? "url(#kbsWhiteLit)" : "url(#kbsWhite)"}
                  stroke={info ? "#8a6410" : "#b9b9c6"} strokeWidth="0.8"
                />
                {/* seam shading down the right-hand edge */}
                <rect
                  x={k.x + WHITE_W - GAP / 2 - 2} y={0}
                  width={2} height={WHITE_H}
                  fill="#000" opacity={info ? 0.16 : 0.1}
                />
                {info && (
                  <>
                    <text
                      x={k.x + WHITE_W / 2} y={WHITE_H - 46}
                      textAnchor="middle" fontFamily="Oswald,sans-serif"
                      fontSize="20" fontWeight="700" fill="#2a1e04"
                    >{info.finger}</text>
                    <text
                      x={k.x + WHITE_W / 2} y={WHITE_H - 20}
                      textAnchor="middle" fontFamily="Oswald,sans-serif"
                      fontSize="13" fontWeight="600" fill="#4a3a10"
                    >{info.label}</text>
                  </>
                )}
              </g>
            );
          })}

          {/* BLACK KEYS — drawn after so they sit above the whites */}
          {KB.blacks.map((k) => {
            const info = lit.get(k.midi);
            return (
              <g key={`b${k.midi}`} filter="url(#kbsShadow)">
                <rect
                  x={k.x} y={-2}
                  width={BLACK_W} height={BLACK_H}
                  rx="3" ry="3"
                  fill={info ? "url(#kbsBlackLit)" : "url(#kbsBlack)"}
                  stroke={info ? accent : "#000"} strokeWidth={info ? 1.6 : 0.6}
                />
                {/* gloss highlight along the top face */}
                <rect
                  x={k.x + 3} y={2} width={BLACK_W - 6} height={BLACK_H * 0.42}
                  rx="2" fill="#fff" opacity={info ? 0.1 : 0.07}
                />
                {info && (
                  <>
                    <text
                      x={k.x + BLACK_W / 2} y={BLACK_H - 34}
                      textAnchor="middle" fontFamily="Oswald,sans-serif"
                      fontSize="17" fontWeight="700" fill="#fff8e0"
                    >{info.finger}</text>
                    <text
                      x={k.x + BLACK_W / 2} y={BLACK_H - 14}
                      textAnchor="middle" fontFamily="Oswald,sans-serif"
                      fontSize="10.5" fontWeight="600" fill="#ffe9a8"
                    >{info.label}</text>
                  </>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Place a spelled note sequence on the two-octave keyboard. Notes ascend; the
// scale starts in the lower octave so the closing octave note always fits.
// ---------------------------------------------------------------------------
// Notes ascend from the root. The root is dropped into the LOWEST octave that
// still leaves room for the whole shape, so a high-rooted scale like Bb or Cb
// starts at the left of the keyboard instead of crowding the right edge.
export function placeAscending(noteNames) {
  const raw = [];
  let prev = -1;
  for (const n of noteNames) {
    let m = PC[n];
    while (m <= prev) m += 12;
    raw.push(m);
    prev = m;
  }
  // Shift the whole shape down by whole octaves while it still fits above 0.
  let shift = 0;
  while (raw[0] - shift - 12 >= 0) shift += 12;
  return raw.map((m) => m - shift);
}

const sameSet = (a, b) => {
  if (a.length !== b.length) return false;
  const s = [...b].sort();
  return [...a].sort().every((v, i) => v === s[i]);
};

// ---------------------------------------------------------------------------
// Shared gate shell — question, body, feedback, Check / Show Me
// ---------------------------------------------------------------------------
function Gate({ step, total, question, children, feedback, onCheck, checkDisabled, onShowMe }) {
  return (
    <div className="kbs-gate">
      <div className="kbs-gate-step">Step {step} of {total}</div>
      <div className="kbs-gate-q">{question}</div>
      {children}
      {feedback && (
        <div className={`kbs-feedback ${feedback.kind}`}>{feedback.text}</div>
      )}
      <div className="kbs-gate-actions">
        {onCheck && (
          <button className="kbs-primary" disabled={checkDisabled} onClick={onCheck}>
            Check Answer
          </button>
        )}
        <button className="kbs-showme" onClick={onShowMe}>👀 Show Me</button>
      </div>
    </div>
  );
}

// ===========================================================================
// SCALES MODE
// ===========================================================================
function ScalesMode({ onLog, onBack }) {
  const [scaleName, setScaleName] = useState(null);
  const [stage, setStage] = useState("pick");   // pick | side | count | which | reveal
  const [feedback, setFeedback] = useState(null);
  const [pickedSide, setPickedSide] = useState(null);
  const [pickedChips, setPickedChips] = useState([]);
  const [shown, setShown] = useState(false);    // any gate revealed via Show Me
  const [hand, setHand] = useState("rh");

  const scale = scaleName ? scaleByName(scaleName) : null;
  const isC = scale?.side === "neither";

  const reset = () => {
    setScaleName(null); setStage("pick"); setFeedback(null);
    setPickedSide(null); setPickedChips([]); setShown(false); setHand("rh");
  };

  const start = (n) => {
    setScaleName(n); setStage("side"); setFeedback(null);
    setPickedSide(null); setPickedChips([]); setShown(false); setHand("rh");
    onLog({ type: "keyboard_scale_start", scale: n });
  };

  // ---- gate 1: side (or, for C, the count question directly) ----
  const answerSide = (choice) => {
    const correct = isC ? "neither" : scale.side;
    if (choice === correct) {
      setPickedSide(choice);
      setFeedback({ kind: "ok", text: "Correct." });
      setTimeout(() => {
        setFeedback(null);
        // C major is already fully answered by "0" — go straight to the reveal.
        if (isC) { setStage("reveal"); onLog({ type:"keyboard_scale_complete", scale:scale.name, shown }); }
        else setStage("count");
      }, 550);
    } else {
      setFeedback({ kind: "no", text: "Not quite — have another look and try again." });
    }
  };

  const showSide = () => {
    setPickedSide(isC ? "neither" : scale.side);
    setFeedback({
      kind: "shown",
      text: isC
        ? "C major sits in the middle — no sharps and no flats."
        : `${scale.name} major is on the ${scale.side} side.`,
    });
    setShown(true);
    setTimeout(() => {
      setFeedback(null);
      if (isC) { setStage("reveal"); onLog({ type:"keyboard_scale_complete", scale:scale.name, shown:true }); }
      else setStage("count");
    }, 1400);
  };

  // ---- gate 2: how many ----
  const answerCount = (n) => {
    if (n === scale.accidentals.length) {
      setFeedback({ kind: "ok", text: "Correct." });
      setTimeout(() => {
        setFeedback(null);
        if (scale.accidentals.length === 0) { setStage("reveal"); onLog({ type:"keyboard_scale_complete", scale:scale.name, shown }); }
        else setStage("which");
      }, 550);
    } else {
      setFeedback({ kind: "no", text: "Not right — count again and try once more." });
    }
  };

  const showCount = () => {
    const n = scale.accidentals.length;
    setFeedback({
      kind: "shown",
      text: n === 0
        ? "C major has 0 sharps and 0 flats."
        : `${scale.name} major has ${n} ${scale.side === "sharp" ? "sharp" : "flat"}${n === 1 ? "" : "s"}.`,
    });
    setShown(true);
    setTimeout(() => {
      setFeedback(null);
      if (n === 0) { setStage("reveal"); onLog({ type:"keyboard_scale_complete", scale:scale.name, shown:true }); }
      else setStage("which");
    }, 1400);
  };

  // ---- gate 3: which ones (multi-select, all 7 of that type shown) ----
  const chips = pickedSide === "sharp" ? SHARP_CHIPS : FLAT_CHIPS;
  const toggleChip = (c) =>
    setPickedChips((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  const checkWhich = () => {
    if (sameSet(pickedChips, scale.accidentals)) {
      setFeedback({ kind: "ok", text: "Correct — that is the key signature." });
      onLog({ type: "keyboard_scale_complete", scale: scale.name, shown });
      setTimeout(() => { setFeedback(null); setStage("reveal"); }, 700);
    } else {
      setFeedback({ kind: "no", text: "That is not the right set. Adjust your picks and check again." });
    }
  };

  const showWhich = () => {
    setPickedChips(scale.accidentals.slice());
    setFeedback({ kind: "shown", text: `${scale.name} major: ${scale.accidentals.join("  ")}` });
    setShown(true);
    onLog({ type: "keyboard_scale_complete", scale: scale.name, shown: true });
    setTimeout(() => { setFeedback(null); setStage("reveal"); }, 1600);
  };

  // ---- reveal ----
  const lit = useMemo(() => {
    const map = new Map();
    if (stage !== "reveal" || !scale) return map;
    const midis = placeAscending(scale.notes);
    const fing = (hand === "rh" ? RH_FINGERING : LH_FINGERING)[scale.name];
    midis.forEach((m, i) => map.set(m, { label: scale.notes[i], finger: fing[i] }));
    return map;
  }, [stage, scale, hand]);

  if (stage === "pick") {
    return (
      <div className="kbs-body">
        <button className="kbs-back" onClick={onBack}>← Keyboard Studio</button>
        <div className="kbs-h2">Scales</div>
        <div className="kbs-note">
          Pick a key. You will work out its key signature <b>before</b> the keyboard appears.
        </div>
        <div className="kbs-pickgrid">
          {SCALE_ORDER.map((n) => {
            const s = scaleByName(n);
            return (
              <button
                key={n}
                className={`kbs-pick ${s.side}`}
                onClick={() => start(n)}
              >{n}</button>
            );
          })}
        </div>
        <div className="kbs-legend">
          <span><i className="dot sharp" /> Sharp side</span>
          <span><i className="dot flat" /> Flat side</span>
          <span><i className="dot neither" /> Neither</span>
        </div>
      </div>
    );
  }

  const totalGates = isC ? 1 : 3;

  return (
    <div className="kbs-body">
      <button className="kbs-back" onClick={reset}>← Pick another scale</button>
      <div className="kbs-target">{scale.name} <span>major</span></div>

      {stage === "side" && (
        <Gate
          step={1} total={totalGates}
          question={
            isC
              ? "How many sharps or flats does C major have?"
              : `Is ${scale.name} major on the sharp side or the flat side?`
          }
          feedback={feedback}
          onShowMe={showSide}
        >
          {isC ? (
            <div className="kbs-numgrid">
              {[0,1,2,3,4,5,6,7].map((n) => (
                <button key={n} className="kbs-num" onClick={() => answerSide(n === 0 ? "neither" : "wrong")}>{n}</button>
              ))}
            </div>
          ) : (
            <div className="kbs-two">
              <button className="kbs-choice sharp" onClick={() => answerSide("sharp")}>Sharps ♯</button>
              <button className="kbs-choice flat"  onClick={() => answerSide("flat")}>Flats ♭</button>
            </div>
          )}
        </Gate>
      )}

      {stage === "count" && (
        <Gate
          step={2} total={totalGates}
          question={`How many ${pickedSide === "sharp" ? "sharps" : "flats"} does ${scale.name} major have?`}
          feedback={feedback}
          onShowMe={showCount}
        >
          <div className="kbs-numgrid">
            {[0,1,2,3,4,5,6,7].map((n) => (
              <button key={n} className="kbs-num" onClick={() => answerCount(n)}>{n}</button>
            ))}
          </div>
        </Gate>
      )}

      {stage === "which" && (
        <Gate
          step={3} total={totalGates}
          question={`Which ${pickedSide === "sharp" ? "sharps" : "flats"} are in ${scale.name} major? Select them all.`}
          feedback={feedback}
          onCheck={checkWhich}
          checkDisabled={pickedChips.length === 0}
          onShowMe={showWhich}
        >
          <div className="kbs-chips">
            {chips.map((c) => (
              <button
                key={c}
                className={`kbs-chip ${pickedChips.includes(c) ? "on" : ""}`}
                onClick={() => toggleChip(c)}
              >{c}</button>
            ))}
          </div>
          <div className="kbs-hint">{pickedChips.length} selected</div>
        </Gate>
      )}

      {stage === "reveal" && (
        <>
          <div className="kbs-revealbar">
            <span className="kbs-revealtag">{shown ? "Revealed" : "✓ Solved"}</span>
            <span className="kbs-sig">
              {scale.accidentals.length ? scale.accidentals.join("  ") : "no sharps or flats"}
            </span>
          </div>

          <div className="kbs-handbar">
            <button className={`kbs-handbtn ${hand === "rh" ? "on" : ""}`} onClick={() => setHand("rh")}>Right hand</button>
            <button className={`kbs-handbtn ${hand === "lh" ? "on" : ""}`} onClick={() => setHand("lh")}>Left hand</button>
          </div>
          <div className="kbs-handnote">
            Showing <b>{hand === "rh" ? "right hand" : "left hand"}</b> fingering · 1 = thumb, 5 = little finger
          </div>

          <Keyboard lit={lit} />

          <div className="kbs-fingerrow">
            {scale.notes.map((n, i) => (
              <div key={i} className="kbs-fingercell">
                <div className="kbs-fnote">{n}</div>
                <div className="kbs-ffing">{(hand === "rh" ? RH_FINGERING : LH_FINGERING)[scale.name][i]}</div>
              </div>
            ))}
          </div>

          <button className="kbs-primary" onClick={reset}>Try another scale</button>
        </>
      )}
    </div>
  );
}

// ===========================================================================
// CHORDS MODE
// ===========================================================================
function ChordsMode({ onLog, onBack }) {
  const [root, setRoot] = useState(null);
  const [quality, setQuality] = useState(null);
  const [stage, setStage] = useState("pick");   // pick | notes | reveal
  const [picked, setPicked] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [shown, setShown] = useState(false);

  const reset = () => {
    setRoot(null); setQuality(null); setStage("pick");
    setPicked([]); setFeedback(null); setShown(false);
  };

  const notes = root && quality ? chordNotes(root, quality) : [];
  const chips = root && quality ? chordChips(root, quality) : [];
  const label = root && quality ? chordName(root, quality) : "";
  const fingering = CHORD_QUALITIES.find((q) => q.id === quality)?.fingering ?? [];

  const begin = () => {
    setStage("notes"); setPicked([]); setFeedback(null); setShown(false);
    onLog({ type: "keyboard_chord_start", chord: chordName(root, quality) });
  };

  const toggle = (c) =>
    setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  const check = () => {
    if (sameSet(picked, notes)) {
      setFeedback({ kind: "ok", text: "Correct — those are the chord tones." });
      onLog({ type: "keyboard_chord_complete", chord: label, shown });
      setTimeout(() => { setFeedback(null); setStage("reveal"); }, 700);
    } else {
      setFeedback({ kind: "no", text: "Not the right notes. Adjust and check again." });
    }
  };

  const showMe = () => {
    setPicked(notes.slice());
    setFeedback({ kind: "shown", text: `${label} = ${notes.join("  ")}` });
    setShown(true);
    onLog({ type: "keyboard_chord_complete", chord: label, shown: true });
    setTimeout(() => { setFeedback(null); setStage("reveal"); }, 1600);
  };

  const lit = useMemo(() => {
    const map = new Map();
    if (stage !== "reveal" || !notes.length) return map;
    const midis = placeAscending(notes);
    midis.forEach((m, i) => map.set(m, { label: notes[i], finger: fingering[i] }));
    return map;
  }, [stage, notes, fingering]);

  if (stage === "pick") {
    return (
      <div className="kbs-body">
        <button className="kbs-back" onClick={onBack}>← Keyboard Studio</button>
        <div className="kbs-h2">Chords</div>
        <div className="kbs-note">
          Pick a root and a quality. You will spell the chord <b>before</b> the keyboard appears.
        </div>

        <div className="kbs-sublbl">Root</div>
        <div className="kbs-pickgrid">
          {CHORD_ROOTS.map((r) => (
            <button key={r} className={`kbs-pick root ${root === r ? "on" : ""}`} onClick={() => setRoot(r)}>{r}</button>
          ))}
        </div>

        <div className="kbs-sublbl">Quality</div>
        <div className="kbs-qualgrid">
          {CHORD_QUALITIES.map((q) => (
            <button key={q.id} className={`kbs-qual ${quality === q.id ? "on" : ""}`} onClick={() => setQuality(q.id)}>
              {q.label}
            </button>
          ))}
        </div>

        <button className="kbs-primary" disabled={!root || !quality} onClick={begin}>
          {root && quality ? `Start — ${chordName(root, quality)}` : "Pick a root and a quality"}
        </button>
      </div>
    );
  }

  return (
    <div className="kbs-body">
      <button className="kbs-back" onClick={reset}>← Pick another chord</button>
      <div className="kbs-target">{label}</div>

      {stage === "notes" && (
        <Gate
          step={1} total={1}
          question={`Which notes are in ${label}? Select them all.`}
          feedback={feedback}
          onCheck={check}
          checkDisabled={picked.length === 0}
          onShowMe={showMe}
        >
          <div className="kbs-chips">
            {chips.map((c) => (
              <button
                key={c}
                className={`kbs-chip ${picked.includes(c) ? "on" : ""}`}
                onClick={() => toggle(c)}
              >{c}</button>
            ))}
          </div>
          <div className="kbs-hint">{picked.length} selected</div>
        </Gate>
      )}

      {stage === "reveal" && (
        <>
          <div className="kbs-revealbar">
            <span className="kbs-revealtag">{shown ? "Revealed" : "✓ Solved"}</span>
            <span className="kbs-sig">{notes.join("  ")}</span>
          </div>
          <div className="kbs-handnote">
            Showing <b>right hand</b> fingering · root position
          </div>

          <Keyboard lit={lit} />

          <div className="kbs-fingerrow">
            {notes.map((n, i) => (
              <div key={i} className="kbs-fingercell">
                <div className="kbs-fnote">{n}</div>
                <div className="kbs-ffing">{fingering[i]}</div>
              </div>
            ))}
          </div>

          <button className="kbs-primary" onClick={reset}>Try another chord</button>
        </>
      )}
    </div>
  );
}

// ===========================================================================
// ROOT
// ===========================================================================
export default function KeyboardStudio({ onBack, onLog }) {
  const [mode, setMode] = useState(null);
  const log = onLog || (() => {});

  return (
    <>
      <style>{CSS}</style>
      <div className="kbs-screen">
        <div className="kbs-header">
          <button className="kbs-back" onClick={onBack}>← Back</button>
          <div className="kbs-title">🎹 Keyboard Studio</div>
          <div style={{ width: 44 }} />
        </div>

        {!mode && (
          <div className="kbs-body">
            <div className="kbs-note">
              Two ways to practise. Both make you work out the theory first — the
              keyboard only appears once you have the answer.
            </div>
            <button className="kbs-mode" onClick={() => setMode("scales")}>
              <span className="kbs-mode-t">Scales</span>
              <span className="kbs-mode-s">All 15 major keys · key signature → keyboard → fingering</span>
            </button>
            <button className="kbs-mode" onClick={() => setMode("chords")}>
              <span className="kbs-mode-t">Chords</span>
              <span className="kbs-mode-s">Major · minor · diminished · dominant 7 on all 12 roots</span>
            </button>
          </div>
        )}

        {mode === "scales" && <ScalesMode onLog={log} onBack={() => setMode(null)} />}
        {mode === "chords" && <ChordsMode onLog={log} onBack={() => setMode(null)} />}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles — scoped with the kbs- prefix, reusing the app's CSS variables
// ---------------------------------------------------------------------------
const CSS = `
.kbs-screen{display:flex;flex-direction:column;padding:14px 14px 44px;gap:13px;min-height:100vh;max-width:760px;margin:0 auto;}
.kbs-header{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.kbs-title{font-family:'Oswald',sans-serif;font-size:18px;font-weight:700;color:var(--gold);letter-spacing:1px;}
.kbs-back{background:none;border:none;color:var(--muted);font-size:14px;cursor:pointer;font-family:'Source Sans 3',sans-serif;padding:0;text-align:left;align-self:flex-start;}
.kbs-body{display:flex;flex-direction:column;gap:12px;}
.kbs-h2{font-family:'Oswald',sans-serif;font-size:24px;font-weight:700;color:var(--text);letter-spacing:1px;}
.kbs-note{font-size:12.5px;color:var(--muted);line-height:1.55;background:rgba(240,192,64,.06);border:1px solid rgba(240,192,64,.22);border-radius:10px;padding:10px 12px;}
.kbs-note b{color:var(--gold);font-weight:700;}
.kbs-sublbl{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-top:2px;}

.kbs-mode{display:flex;flex-direction:column;gap:4px;align-items:flex-start;text-align:left;padding:16px 18px;border-radius:var(--radius);border:1.5px solid var(--border);background:var(--surface);cursor:pointer;transition:all .15s;}
.kbs-mode:active{border-color:var(--gold);background:var(--surface2);}
.kbs-mode-t{font-family:'Oswald',sans-serif;font-size:20px;font-weight:600;color:var(--gold);letter-spacing:2px;}
.kbs-mode-s{font-size:12px;color:var(--muted);line-height:1.4;}

.kbs-pickgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(62px,1fr));gap:8px;}
.kbs-pick{padding:14px 4px;border-radius:11px;border:1.5px solid var(--border);background:var(--surface);color:var(--text);font-family:'Oswald',sans-serif;font-size:17px;font-weight:600;letter-spacing:1px;cursor:pointer;transition:all .15s;}
.kbs-pick.sharp{border-color:rgba(79,195,247,.45);color:var(--sharp);}
.kbs-pick.flat{border-color:rgba(239,154,154,.45);color:var(--flat);}
.kbs-pick.neither{border-color:rgba(240,192,64,.5);color:var(--gold);}
.kbs-pick:active{background:var(--surface2);}
.kbs-pick.on{border-color:var(--gold);background:rgba(240,192,64,.14);color:var(--gold);}

.kbs-qualgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;}
.kbs-qual{padding:14px 8px;border-radius:11px;border:1.5px solid var(--border);background:var(--surface);color:var(--text);font-family:'Oswald',sans-serif;font-size:15px;font-weight:600;letter-spacing:1px;cursor:pointer;transition:all .15s;}
.kbs-qual.on{border-color:var(--gold);background:rgba(240,192,64,.14);color:var(--gold);}

.kbs-legend{display:flex;gap:14px;justify-content:center;font-size:11px;color:var(--muted);}
.kbs-legend .dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;vertical-align:middle;}
.kbs-legend .dot.sharp{background:var(--sharp);}
.kbs-legend .dot.flat{background:var(--flat);}
.kbs-legend .dot.neither{background:var(--gold);}

.kbs-target{font-family:'Oswald',sans-serif;font-size:38px;font-weight:700;color:var(--gold);letter-spacing:2px;text-align:center;line-height:1.05;}
.kbs-target span{font-size:16px;color:var(--muted);font-weight:400;letter-spacing:3px;text-transform:uppercase;}

.kbs-gate{display:flex;flex-direction:column;gap:12px;background:var(--surface);border:1.5px solid var(--border);border-radius:var(--radius);padding:16px 14px;}
.kbs-gate-step{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);}
.kbs-gate-q{font-size:16px;line-height:1.45;color:var(--text);font-weight:600;}
.kbs-gate-actions{display:flex;gap:8px;flex-wrap:wrap;}
.kbs-gate-actions .kbs-primary{flex:1;min-width:150px;}

.kbs-two{display:grid;grid-template-columns:1fr 1fr;gap:9px;}
.kbs-choice{padding:20px 8px;border-radius:12px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-family:'Oswald',sans-serif;font-size:18px;font-weight:600;letter-spacing:1px;cursor:pointer;transition:all .15s;}
.kbs-choice.sharp{border-color:rgba(79,195,247,.5);color:var(--sharp);}
.kbs-choice.flat{border-color:rgba(239,154,154,.5);color:var(--flat);}
.kbs-choice:active{transform:scale(.97);}

.kbs-numgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}
.kbs-num{padding:16px 0;border-radius:11px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-family:'Oswald',sans-serif;font-size:20px;font-weight:600;cursor:pointer;transition:all .15s;}
.kbs-num:active{border-color:var(--gold);color:var(--gold);}

.kbs-chips{display:grid;grid-template-columns:repeat(auto-fill,minmax(62px,1fr));gap:8px;}
.kbs-chip{padding:14px 2px;border-radius:11px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-family:'Oswald',sans-serif;font-size:16px;font-weight:600;letter-spacing:.5px;cursor:pointer;transition:all .15s;}
.kbs-chip.on{border-color:var(--gold);background:rgba(240,192,64,.18);color:var(--gold);}
.kbs-hint{font-size:11px;color:var(--muted);letter-spacing:1px;}

.kbs-feedback{font-size:13.5px;line-height:1.45;border-radius:10px;padding:10px 12px;}
.kbs-feedback.ok{color:var(--green);background:rgba(129,199,132,.1);border:1px solid rgba(129,199,132,.35);}
.kbs-feedback.no{color:var(--flat);background:rgba(239,154,154,.09);border:1px solid rgba(239,154,154,.32);}
.kbs-feedback.shown{color:var(--gold);background:rgba(240,192,64,.09);border:1px solid rgba(240,192,64,.32);}

.kbs-primary{padding:15px;border-radius:12px;border:none;background:var(--gold);color:#1a1208;font-family:'Oswald',sans-serif;font-size:15px;font-weight:700;letter-spacing:1.5px;cursor:pointer;transition:all .15s;}
.kbs-primary:disabled{opacity:.4;cursor:not-allowed;}
.kbs-primary:active:not(:disabled){transform:scale(.98);}
.kbs-showme{padding:15px 18px;border-radius:12px;border:1.5px solid var(--border);background:var(--surface2);color:var(--muted);font-family:'Oswald',sans-serif;font-size:14px;font-weight:600;letter-spacing:1px;cursor:pointer;}
.kbs-showme:active{border-color:var(--gold);color:var(--gold);}

.kbs-revealbar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;background:var(--surface);border:1.5px solid var(--border);border-radius:12px;padding:11px 13px;}
.kbs-revealtag{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--green);font-weight:700;}
.kbs-sig{font-family:'Oswald',sans-serif;font-size:17px;color:var(--gold);letter-spacing:2px;}

.kbs-handbar{display:flex;gap:6px;background:var(--surface);border:1.5px solid var(--border);border-radius:12px;padding:4px;}
.kbs-handbtn{flex:1;padding:11px 4px;border:none;border-radius:9px;background:transparent;color:var(--muted);font-family:'Oswald',sans-serif;font-size:13.5px;font-weight:600;letter-spacing:1px;cursor:pointer;transition:all .15s;}
.kbs-handbtn.on{background:rgba(240,192,64,.16);color:var(--gold);}
.kbs-handnote{font-size:11.5px;color:var(--muted);text-align:center;}
.kbs-handnote b{color:var(--gold);}

.kbs-kbwrap{background:#0b0b11;border:1.5px solid var(--border);border-radius:12px;padding:8px;overflow:hidden;}

.kbs-fingerrow{display:flex;gap:5px;flex-wrap:wrap;justify-content:center;}
.kbs-fingercell{flex:1;min-width:52px;display:flex;flex-direction:column;align-items:center;gap:2px;background:var(--surface);border:1.5px solid var(--border);border-radius:10px;padding:8px 4px;}
.kbs-fnote{font-family:'Oswald',sans-serif;font-size:15px;font-weight:600;color:var(--text);letter-spacing:.5px;}
.kbs-ffing{font-family:'Oswald',sans-serif;font-size:20px;font-weight:700;color:var(--gold);}

@media (max-width:400px){
  .kbs-target{font-size:32px;}
  .kbs-gate-q{font-size:15px;}
  .kbs-fingercell{min-width:40px;padding:6px 2px;}
  .kbs-fnote{font-size:13px;}
  .kbs-ffing{font-size:17px;}
}
`;
