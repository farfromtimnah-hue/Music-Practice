import { useRef, useState } from "react";
import { LETTERS, FINGER_NAMES, fingerLetters, letterOf, pretty } from "./circleData.js";

// Geometry (viewBox 340 x 290). Fingers are drawn as thick round lines so the
// hand stays clean and geometric. Index 0 is the thumb.
const FINGERS = [
  { x1: 88, y1: 235, x2: 38, y2: 168 },   // thumb
  { x1: 115, y1: 190, x2: 115, y2: 58 },  // pointer
  { x1: 175, y1: 190, x2: 175, y2: 38 },  // middle
  { x1: 235, y1: 190, x2: 235, y2: 55 },  // ring
  { x1: 295, y1: 190, x2: 295, y2: 95 },  // pinky
];
const W = 54; // finger width in viewBox units

// The hand with its seven letter tiles. Start letter sits on the first finger.
// Drag a tile onto the glowing finger, or tap a tile and then tap the finger.
export default function Hand({ mode, startLetter, onSolved, disabled }) {
  const letters = fingerLetters(startLetter, mode); // expected letter per used finger
  const n = letters.length;
  const offset = mode === "sharp" ? 0 : 1;          // flat mode skips the thumb
  const [placed, setPlaced] = useState([startLetter]);
  const [tries, setTries] = useState(0);
  const [sel, setSel] = useState(null);
  const [msg, setMsg] = useState("");
  const [bad, setBad] = useState(-1);               // finger index that just got a wrong tile
  const [drag, setDrag] = useState(null);           // { letter, x, y }
  const dragRef = useRef(null);

  const nextIdx = placed.length;                    // index into letters (0 based)
  const solved = placed.length >= n;
  const glow = !solved && tries >= 2 ? letters[nextIdx] : null;

  const place = (letter, fi) => {
    if (solved || disabled) return;
    if (fi !== nextIdx) { setMsg("Use the glowing finger."); setSel(null); return; }
    if (letter === letters[fi]) {
      const np = [...placed, letter];
      setPlaced(np); setTries(0); setSel(null); setMsg("");
      if (np.length >= n) onSolved && onSolved(letter);
    } else {
      setTries((t) => t + 1); setSel(null); setMsg("Try again");
      setBad(fi); setTimeout(() => setBad(-1), 320);
    }
  };

  const fingerFromPoint = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const g = el && el.closest && el.closest("[data-finger]");
    return g ? Number(g.getAttribute("data-finger")) - offset : null;
  };

  const down = (e, letter) => {
    if (solved || disabled) return;
    e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { letter, sx: e.clientX, sy: e.clientY, moved: false };
  };
  const move = (e) => {
    const d = dragRef.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 8) d.moved = true;
    if (d.moved) setDrag({ letter: d.letter, x: e.clientX, y: e.clientY });
  };
  const up = (e) => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d) return;
    if (!d.moved) { setSel((s) => (s === d.letter ? null : d.letter)); setMsg(""); return; }
    const fi = fingerFromPoint(e.clientX, e.clientY);
    if (fi === null || fi < 0) { setMsg("Drop it on a finger."); return; }
    place(d.letter, fi);
  };
  const cancel = () => { dragRef.current = null; setDrag(null); };

  const tapFinger = (fi) => {
    if (solved || disabled) return;
    if (sel) place(sel, fi);
    else setMsg(fi === nextIdx ? "Tap a letter first." : "Use the glowing finger.");
  };

  return (
    <div className="cg-hand">
      <svg viewBox="0 0 340 290" className="cg-hand-svg" role="img" aria-label={`Hand. Start letter ${startLetter} is on the ${FINGER_NAMES[offset].toLowerCase()}.`}>
        {/* outlines first, then fills, so the hand reads as one shape */}
        {FINGERS.map((f, i) => {
          const folded = mode === "flat" && i === 0;
          const g = folded ? { x1: 88, y1: 240, x2: 66, y2: 214 } : f;
          return <line key={"o" + i} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke="#2a2a40" strokeWidth={W + 4} strokeLinecap="round" opacity={folded ? 0.35 : 1} />;
        })}
        <rect x="86" y="168" width="238" height="116" rx="40" fill="#2a2a40" />
        {FINGERS.map((f, i) => {
          const folded = mode === "flat" && i === 0;
          const g = folded ? { x1: 88, y1: 240, x2: 66, y2: 214 } : f;
          return <line key={"f" + i} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke="#1c1c2e" strokeWidth={W} strokeLinecap="round" opacity={folded ? 0.35 : 1} />;
        })}
        <rect x="88" y="170" width="234" height="112" rx="38" fill="#1c1c2e" />
        {/* finger names, small, in the palm */}
        {FINGERS.map((f, i) => i === 0 ? null : <text key={"n" + i} x={f.x1} y="236" textAnchor="middle" fontSize="11" fontFamily="Oswald,sans-serif" letterSpacing="1" fill="#8888aa">{FINGER_NAMES[i].toUpperCase()}</text>)}
        {mode === "flat" && <text x="60" y="268" textAnchor="middle" fontSize="11" fontFamily="Oswald,sans-serif" letterSpacing="1" fill="#8888aa">THUMB IN</text>}

        {/* finger targets */}
        {FINGERS.map((f, i) => {
          if (mode === "flat" && i === 0) return null;
          const li = i - offset;                      // index into letters
          const isPlaced = li < placed.length;
          const isNext = li === nextIdx && !solved;
          const isStart = li === 0;
          const isPinky = li === n - 1;
          const stroke = isNext ? "#f0c040" : isPlaced ? "rgba(129,199,132,.7)" : "#44446a";
          const fill = isPlaced ? "rgba(129,199,132,.16)" : "#13131f";
          return (
            <g key={"t" + i} data-finger={i} onClick={() => tapFinger(li)} style={{ cursor: "pointer" }} className={bad === li ? "cg-shake" : ""}>
              <line x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke="transparent" strokeWidth={W} strokeLinecap="round" />
              <circle cx={f.x2} cy={f.y2} r="25" fill={fill} stroke={stroke} strokeWidth={isNext ? 3 : 1.5} className={isPlaced && !isStart ? "cg-lock" : ""} />
              <text x={f.x2} y={f.y2 + 1} textAnchor="middle" dominantBaseline="central" fontSize="28" fontWeight="700" fontFamily="Oswald,sans-serif" fill={isPlaced ? (solved && isPinky ? "#f0c040" : "#e8e8f0") : "#44446a"}>
                {isPlaced ? placed[li] : isNext ? "?" : ""}
              </text>
            </g>
          );
        })}
      </svg>

      <div className={`cg-msg ${msg === "Try again" ? "bad" : ""}`} aria-live="polite">{msg}</div>

      {!solved && (
        <div className="cg-tiles" role="group" aria-label="Letters">
          {LETTERS.map((l) => (
            <button
              key={l}
              className={`cg-tile ${sel === l ? "sel" : ""} ${glow === l ? "glow" : ""}`}
              onPointerDown={(e) => down(e, l)}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={cancel}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel((s) => (s === l ? null : l)); } }}
              aria-pressed={sel === l}
              aria-label={`Letter ${l}`}
            >{l}</button>
          ))}
        </div>
      )}
      {drag && <div className="cg-ghost" style={{ transform: `translate(${drag.x - 28}px, ${drag.y - 28}px)` }}>{drag.letter}</div>}
    </div>
  );
}

// Hand plus "I know it" for one question: find the next key after `prev`.
// target is the key we expect (used only to name the answer on screen).
export function HandStep({ prev, target, side, nextLabel, onSolved, onNext }) {
  const start = letterOf(prev);
  const answer = letterOf(target);
  const [view, setView] = useState("hand");   // hand | know
  const [done, setDone] = useState(false);
  const [note, setNote] = useState("");

  const finish = () => { if (done) return; setDone(true); onSolved && onSolved(answer); };
  const guess = (l) => {
    if (l === answer) { setNote(""); finish(); }
    else { setNote("Try the hand"); setView("hand"); }
  };

  if (done) {
    return (
      <div className="cg-answer">
        <div className="cg-answer-big" aria-live="polite">{answer}</div>
        <div className="cg-answer-line">The key is <strong>{pretty(target)}</strong></div>
        <button className="primary-btn cg-next" onClick={onNext}>{nextLabel}</button>
      </div>
    );
  }
  return (
    <div className="cg-step">
      <div className="cg-ask">
        Put <strong>{start}</strong> on your {side === "sharp" ? "thumb" : "pointer"}. What letter lands on the pinky?
      </div>
      {note && <div className="cg-callout" role="status"><span aria-hidden="true">{"☝"}</span> {note}</div>}
      {view === "hand" ? (
        <>
          <Hand key={start + side} mode={side} startLetter={start} onSolved={(l) => { setNote(""); finish(l); }} />
          <button className="ghost-btn cg-know" onClick={() => { setNote(""); setView("know"); }}>I know it</button>
        </>
      ) : (
        <div className="cg-know-pane">
          <div className="cg-ask">Tap the pinky letter.</div>
          <div className="cg-tiles">
            {LETTERS.map((l) => <button key={l} className="cg-tile" onClick={() => guess(l)}>{l}</button>)}
          </div>
          <button className="ghost-btn cg-know" onClick={() => setView("hand")}>Use the hand</button>
        </div>
      )}
    </div>
  );
}
