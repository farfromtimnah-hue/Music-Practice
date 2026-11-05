import { useState, useMemo, useEffect } from "react";
import {
  SHARP_ORDER, FLAT_ORDER, SHARP_KEYS, FLAT_KEYS, CIRCLE_ORDER, LETTERS, sideOf, pretty, prevKey,
} from "./circleData.js";
import { HandStep } from "./Hand.jsx";
import FamilyReveal from "./Family.jsx";

// ============================================================
// FILL IN THE CIRCLE: the blank-circle version of the key practice.
//
// Four stages, in this order:
//   1. Sharp side names   C, G, D, A, E, B, F#, C#
//   2. Sharp side details how many sharps, then which ones
//   3. Flat side names    F, Bb, Eb, Ab, Db, Gb, Cb
//   4. Flat side details  how many flats, then which ones
//
// The note options are the full set for that side: sharps + naturals on the
// sharp side, flats + naturals on the flat side. Naturals are decoys.
// ============================================================

const PALETTE = ["A", "Ab", "B", "Bb", "C", "C#", "Cb", "D", "Db", "E", "Eb", "F", "F#", "G", "Gb"];

const sharpCount = (k) => (k === "C" ? 0 : SHARP_KEYS.indexOf(k));
const flatCount = (k) => FLAT_KEYS.indexOf(k) + 1;
const countFor = (k, side) => (side === "sharp" ? sharpCount(k) : flatCount(k));
const notesFor = (k, side) =>
  side === "sharp"
    ? SHARP_ORDER.slice(0, sharpCount(k)).map((n) => n + "#")
    : FLAT_ORDER.slice(0, flatCount(k)).map((n) => n + "b");

// 7 naturals on the top row, 7 accidentals under them
const noteOptions = (side) => [...LETTERS, ...LETTERS.map((l) => l + (side === "sharp" ? "#" : "b"))];

const STAGES = [
  { id: "names-sharp", kind: "names", side: "sharp", keys: SHARP_KEYS, title: "Sharp side: fill in the keys" },
  { id: "info-sharp", kind: "info", side: "sharp", keys: SHARP_KEYS, title: "Sharp side: how many, and which" },
  { id: "names-flat", kind: "names", side: "flat", keys: FLAT_KEYS, title: "Flat side: fill in the keys" },
  { id: "info-flat", kind: "info", side: "flat", keys: FLAT_KEYS, title: "Flat side: how many, and which" },
];
// Hand mode swaps the two names stages for hand screens. C is already filled.
const HAND_STAGES = [
  { ...STAGES[0], id: "hand-sharp", kind: "hand", keys: SHARP_KEYS.slice(1), title: "Sharp side: use your hand" },
  STAGES[1],
  { ...STAGES[2], id: "hand-flat", kind: "hand", title: "Flat side: use your hand" },
  STAGES[3],
];

const ACC = { sharp: "♯", flat: "♭" };

export function BlankCircle({ filled, counts = {}, active, stageKeys = CIRCLE_ORDER, token, onSlot, marks = {}, small, center }) {
  const cx = 160, cy = 160, R = 148, rIn = 62, n = CIRCLE_ORDER.length;
  return (
    <svg viewBox="0 0 320 320" className={`cf-circle ${small ? "cf-circle-sm" : ""}`} role="img" aria-label="Circle of fifths to fill in">
      {CIRCLE_ORDER.map((k, i) => {
        const a1 = (i / n) * 2 * Math.PI - Math.PI / 2;
        const a2 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2;
        const r1 = rIn + 3, r2 = R;
        const path = `M ${cx + r1 * Math.cos(a1)} ${cy + r1 * Math.sin(a1)} L ${cx + r2 * Math.cos(a1)} ${cy + r2 * Math.sin(a1)} A ${r2} ${r2} 0 0 1 ${cx + r2 * Math.cos(a2)} ${cy + r2 * Math.sin(a2)} L ${cx + r1 * Math.cos(a2)} ${cy + r1 * Math.sin(a2)} A ${r1} ${r1} 0 0 0 ${cx + r1 * Math.cos(a1)} ${cy + r1 * Math.sin(a1)} Z`;
        const am = (a1 + a2) / 2, lr = (r1 + r2) / 2;
        const lx = cx + lr * Math.cos(am), ly = cy + lr * Math.sin(am);
        const isFilled = !!filled[k];
        const isActive = active === k;
        const inStage = stageKeys.includes(k);
        const side = sideOf(k);
        let fill = "#161625";
        if (isFilled) fill = side === "sharp" ? "rgba(79,195,247,.16)" : side === "flat" ? "rgba(239,154,154,.16)" : "rgba(165,214,167,.16)";
        if (isActive) fill = "rgba(240,192,64,.2)";
        const stroke = isActive ? "#f0c040" : inStage ? "#44446a" : "#2a2a40";
        const cnt = counts[k];
        const fs = k.length > 1 ? 11 : 13;
        return (
          <g key={k} onClick={onSlot && !isFilled ? () => onSlot(k) : undefined} style={onSlot && !isFilled ? { cursor: "pointer" } : undefined}>
            <path d={path} fill={fill} stroke={stroke} strokeWidth={isActive ? 2.5 : 1} />
            {isFilled ? (
              <>
                <text x={lx} y={cnt != null ? ly - 4 : ly} textAnchor="middle" dominantBaseline="central" fontSize={fs} fontWeight="700" fontFamily="Oswald,sans-serif" fill="#e8e8f0">{pretty(k)}</text>
                {cnt != null && (
                  <text x={lx} y={ly + 9} textAnchor="middle" dominantBaseline="central" fontSize="8" fontWeight="600" fontFamily="Oswald,sans-serif" fill={side === "flat" ? "#ef9a9a" : "#4fc3f7"}>
                    {cnt}{cnt === 0 ? "" : ACC[side]}
                  </text>
                )}
              </>
            ) : (
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central" fontSize="13" fontFamily="Oswald,sans-serif" fill={isActive ? "#f0c040" : marks[k] ? "#e8e8f0" : "#3a3a58"}>{marks[k] || "?"}</text>
            )}
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={rIn - 1} fill="#13131f" stroke="#2a2a40" strokeWidth="1" />
      {(center || ["FILL IN", "THE CIRCLE"]).map((t, i, arr) => (
        <text key={i} x={cx} y={cy + (i - (arr.length - 1) / 2) * 14} textAnchor="middle" dominantBaseline="central" fontSize="9" fill="#8888aa" fontFamily="Oswald" letterSpacing="2">{t}</text>
      ))}
      {token && (() => {
        const i = CIRCLE_ORDER.indexOf(token);
        const am = ((i + 0.5) / n) * 2 * Math.PI - Math.PI / 2;
        const tr = rIn + 3 + 9;
        return (
          <g className="cg-token" style={{ transform: `translate(${cx + tr * Math.cos(am)}px, ${cy + tr * Math.sin(am)}px)` }}>
            <circle r="8" fill="#f0c040" stroke="#0a0a0f" strokeWidth="2" />
          </g>
        );
      })()}
    </svg>
  );
}

export default function CircleFill({ onBack, onLog, mode = "classic", studentName }) {
  const hand = mode === "hand";
  const stages = hand ? HAND_STAGES : STAGES;
  const [stage, setStage] = useState(0);          // 0..3, 4 = results
  const [filled, setFilled] = useState(hand ? { C: true } : {});   // key -> true once named
  const [counts, setCounts] = useState({});       // key -> count, once the count is answered
  const [picked, setPicked] = useState(null);     // slot the student tapped, overrides the guided order
  const [misses, setMisses] = useState({});       // key -> wrong taps while naming
  const [flash, setFlash] = useState(null);       // palette button that was just wrong
  const [nameOk, setNameOk] = useState(hand ? { C: true } : {});     // key -> true when named first try
  const [countOk, setCountOk] = useState({});
  const [notesOk, setNotesOk] = useState({});
  const [infoIdx, setInfoIdx] = useState(0);
  const [handIdx, setHandIdx] = useState(0);      // hand mode: which key of the side we are finding
  const [phase, setPhase] = useState("count");    // info stages: count, notes, reveal (one question per screen)
  const [countPick, setCountPick] = useState(null);
  const [sel, setSel] = useState([]);
  const [checked, setChecked] = useState(false);

  // hand mode logs its own start (classic mode is logged by the home button)
  useEffect(() => { if (hand && onLog) onLog({ type: "hand_fill_start" }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const st = stages[stage];
  const stageKeys = st ? st.keys : [];
  const firstOpen = st && st.kind === "names" ? st.keys.find((k) => !filled[k]) : null;
  const handKey = st && st.kind === "hand" ? st.keys[handIdx] : null;
  const active = st && st.kind === "names" ? (picked && !filled[picked] && st.keys.includes(picked) ? picked : firstOpen) : st && st.kind === "info" ? st.keys[infoIdx] : handKey;
  const namesDone = st && st.kind === "names" && !firstOpen;

  const resetInfo = () => { setInfoIdx(0); setPhase("count"); setCountPick(null); setSel([]); setChecked(false); };

  const restart = () => {
    setStage(0); setFilled(hand ? { C: true } : {}); setCounts({}); setPicked(null); setMisses({}); setFlash(null);
    setNameOk(hand ? { C: true } : {}); setCountOk({}); setNotesOk({}); setHandIdx(0); resetInfo();
    onLog && onLog({ type: hand ? "hand_fill_start" : "circle_fill_start" });
  };

  const pickName = (opt) => {
    if (!active || namesDone) return;
    if (opt === active) {
      setFilled((f) => ({ ...f, [active]: true }));
      if (!misses[active]) setNameOk((o) => ({ ...o, [active]: true }));
      setPicked(null); setFlash(null);
    } else {
      setMisses((m) => ({ ...m, [active]: (m[active] || 0) + 1 }));
      setFlash(opt);
      setTimeout(() => setFlash(null), 500);
    }
  };

  const nextStage = () => {
    setPicked(null); resetInfo(); setHandIdx(0);
    const nx = stage + 1;
    setStage(nx);
    if (nx >= stages.length) {
      onLog && onLog({ type: hand ? "hand_fill_complete" : "circle_fill_complete", correct: score.total, total: score.max });
    }
  };

  // hand mode: the hand (or I know it) found the key. Full credit, nothing is ever marked wrong.
  const handSolved = () => {
    setFilled((f) => ({ ...f, [handKey]: true }));
    setNameOk((o) => ({ ...o, [handKey]: true }));
  };
  const handNext = () => {
    if (handIdx + 1 >= st.keys.length) nextStage();
    else setHandIdx(handIdx + 1);
  };

  const answerCount = (n) => {
    if (countPick !== null) return;
    const k = st.keys[infoIdx];
    setCountPick(n);
    setCountOk((o) => ({ ...o, [k]: n === countFor(k, st.side) }));
    setCounts((c) => ({ ...c, [k]: countFor(k, st.side) }));
  };

  const toggle = (o) => { if (!checked) setSel((s) => (s.includes(o) ? s.filter((x) => x !== o) : [...s, o])); };

  const check = () => {
    const k = st.keys[infoIdx];
    const right = notesFor(k, st.side).slice().sort().join();
    setNotesOk((o) => ({ ...o, [k]: sel.slice().sort().join() === right }));
    setChecked(true);
  };

  const nextInfo = () => {
    if (infoIdx + 1 >= st.keys.length) { nextStage(); return; }
    setInfoIdx(infoIdx + 1); setPhase("count"); setCountPick(null); setSel([]); setChecked(false);
  };

  const score = useMemo(() => {
    const all = [...SHARP_KEYS, ...FLAT_KEYS];
    const c = (m) => all.filter((k) => m[k]).length;
    const names = c(nameOk), cnt = c(countOk), notes = c(notesOk);
    return { names, cnt, notes, total: names + cnt + notes, max: all.length * 3 };
  }, [nameOk, countOk, notesOk]);

  // ---------- results ----------
  if (stage >= stages.length) {
    const pct = Math.round((score.total / score.max) * 100);
    const msg = pct === 100 ? "Perfect. You filled in the whole circle from memory." : pct >= 80 ? "Really strong. Try again to make it perfect." : pct >= 60 ? "Good work. Do it again and watch it improve." : "Keep going. Every pass builds the memory.";
    return (
      <div className="cf-shell">
        <div className="cf-results">
          <div className="cf-hint">Fill in the circle</div>
          <BlankCircle filled={filled} counts={counts} active={null} stageKeys={[]} />
          <div className="cf-score">{pct}%</div>
          <div className="cf-line">{hand ? "Keys found" : "Keys named first try"}: {score.names} of 15</div>
          <div className="cf-line">Counts right: {score.cnt} of 15</div>
          <div className="cf-line">Notes right: {score.notes} of 15</div>
          <div className="cf-msg">{msg}</div>
          <button className="primary-btn" onClick={restart}>Try Again</button>
          <button className="ghost-btn" onClick={onBack}>{hand ? "Back" : "Back to Home"}</button>
        </div>
      </div>
    );
  }

  // ---------- practice ----------
  const infoKey = st.kind === "info" ? st.keys[infoIdx] : null;
  const answerNotes = infoKey ? notesFor(infoKey, st.side) : [];
  const accWord = st.side === "sharp" ? "sharps" : "flats";
  const needHint = st.kind === "names" && active && (misses[active] || 0) >= 2;
  const doneCount = st.kind === "names" ? st.keys.filter((k) => filled[k]).length : st.kind === "hand" ? st.keys.filter((k) => filled[k]).length : infoIdx + (phase === "reveal" ? 1 : 0);
  const lastInfo = st.kind === "info" && infoIdx + 1 >= st.keys.length;
  const revealNext = lastInfo ? (stage === 3 ? "See results" : "Next: flat side") : "Next key";
  const reveal = st.kind === "info" && phase === "reveal";

  return (
    <div className="cf-shell">
      <div className="cf-head">
        <button className="cf-back" onClick={onBack}>{"\u2190"} Exit</button>
        <div className="cf-stage">Part {stage + 1} of 4</div>
        <div className="cf-count">{doneCount}/{st.keys.length}</div>
      </div>

      {reveal ? (
        <FamilyReveal key={infoKey} keyName={infoKey} studentName={studentName || "teacher"} nextLabel={revealNext} onNext={nextInfo} onLog={onLog} />
      ) : (
        <>
          <div className="cf-title">{st.title}</div>
          <BlankCircle filled={filled} counts={counts} active={active} stageKeys={stageKeys} small={st.kind !== "names"} />
        </>
      )}

      {st.kind === "hand" && (
        <HandStep
          key={handKey}
          prev={prevKey(handKey)}
          target={handKey}
          side={st.side}
          nextLabel={handIdx + 1 >= st.keys.length ? (stage === 0 ? "Next: how many sharps" : "Next: how many flats") : "Next key"}
          onSolved={handSolved}
          onNext={handNext}
        />
      )}

      {st.kind === "names" && (
        <>
          <div className="cf-hint">
            {namesDone
              ? "Every key on this side is filled in."
              : stage === 0
              ? "Start at the top with C. Then go clockwise, one fifth at a time. Tap the gold slot's key name."
              : "Start next to C and go counterclockwise. Each step is a fifth down. Tap the gold slot's key name."}
          </div>
          <div className="cf-hint cf-small">You can also tap a different empty slot to fill it first.</div>
          <div className="cf-slots">
            {st.keys.map((k) => (
              <button key={k} className={`cf-slot ${filled[k] ? "on" : ""} ${active === k ? "cur" : ""}`} disabled={!!filled[k]} onClick={() => setPicked(k)} aria-label={filled[k] ? `${k} filled` : "empty slot"}>
                {filled[k] ? pretty(k) : "?"}
              </button>
            ))}
          </div>
          {!namesDone && (
            <>
              <div className="cf-ask">What key goes in the gold slot?</div>
              <div className="cf-pal">
                {PALETTE.map((p) => (
                  <button key={p} className={`cf-pbtn ${flash === p ? "bad" : ""} ${needHint && p === active ? "hint" : ""}`} onClick={() => pickName(p)}>{pretty(p)}</button>
                ))}
              </div>
              <div className={`feedback ${flash ? "no" : ""}`}>{flash ? "Not that one. Try again." : needHint ? "Hint: the glowing key is the answer." : ""}</div>
            </>
          )}
          {namesDone && <button className="primary-btn" onClick={nextStage}>{stage === 0 ? "Next: how many sharps \u2192" : "Next: how many flats \u2192"}</button>}
        </>
      )}

      {st.kind === "info" && phase === "count" && (
        <>
          <div className="q-card"><div className="q-text">How many {accWord} does the key of {pretty(infoKey)} have?</div></div>
          <div className="cf-nums">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => {
              const right = n === countFor(infoKey, st.side);
              let cls = "multi-btn";
              if (countPick !== null) { if (right) cls += " multi-right"; else if (n === countPick) cls += " multi-wrong"; }
              return <button key={n} className={cls} disabled={countPick !== null} onClick={() => answerCount(n)}>{n}</button>;
            })}
          </div>
          {countPick !== null && (
            <>
              <div className="feedback ok" style={{ color: countPick === countFor(infoKey, st.side) ? "var(--green)" : "var(--dim)" }}>
                {countPick === countFor(infoKey, st.side) ? "\u2713 Correct" : `\u2717 It has ${countFor(infoKey, st.side)}`}
              </div>
              <button className="primary-btn cg-next" onClick={() => setPhase("notes")}>Next</button>
            </>
          )}
        </>
      )}

      {st.kind === "info" && phase === "notes" && (
        <>
          <div className="q-card"><div className="q-text">{answerNotes.length === 0 && infoKey === "C" ? "Which notes are sharp or flat in C? Tap none, then Check." : `Which notes are ${st.side} in ${pretty(infoKey)}? Tap every one.`}</div></div>
          {[["Plain", LETTERS], [st.side === "sharp" ? "Sharp" : "Flat", LETTERS.map((l) => l + (st.side === "sharp" ? "#" : "b"))]].map(([lbl, opts]) => (
            <div key={lbl} className="cg-grp">
              <div className="cg-grp-lbl">{lbl}</div>
              <div className="cf-notes">
                {opts.map((o) => {
                  const inRight = answerNotes.includes(o), isSel = sel.includes(o);
                  let cls = "multi-btn";
                  if (checked) { if (inRight && isSel) cls += " multi-right"; else if (!inRight && isSel) cls += " multi-wrong"; else if (inRight) cls += " multi-missed"; }
                  else if (isSel) cls += " multi-selected";
                  return <button key={o} className={cls} disabled={checked} onClick={() => toggle(o)}>{pretty(o)}</button>;
                })}
              </div>
            </div>
          ))}
          {!checked && <button className="primary-btn cg-next" onClick={check}>Check Answer</button>}
          {checked && (
            <>
              <div className="feedback" style={{ color: notesOk[infoKey] ? "var(--green)" : "var(--dim)" }}>
                {notesOk[infoKey] ? "\u2713 Correct" : `\u2717 Correct: ${answerNotes.length ? answerNotes.map(pretty).join(", ") : "none"}`}
              </div>
              <button className="primary-btn cg-next" onClick={() => setPhase("reveal")}>Next</button>
            </>
          )}
        </>
      )}
    </div>
  );
}
