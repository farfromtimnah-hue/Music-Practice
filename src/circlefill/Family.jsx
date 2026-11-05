import { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard } from "../keyboard/KeyboardStudio.jsx";
import { scaleByName, scaleMidis, scaleFreqs, earnSticker, pretty, sideOf } from "./circleData.js";
import { playScale, stopScale, ensureCtx } from "./circleAudio.js";
import Sticker from "./Sticker.jsx";

const KeyboardIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M8 5v8M12 5v14M16 5v8" />
  </svg>
);
const SpeakerIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16.5 8.5a5 5 0 0 1 0 7" />
  </svg>
);

// Shown after the notes screen of every key.
export default function FamilyReveal({ keyName, studentName, nextLabel, onNext, onLog }) {
  const scale = scaleByName(keyName);
  const side = sideOf(keyName);
  const [isNew, setIsNew] = useState(false);
  const [showKb, setShowKb] = useState(false);
  const [playIdx, setPlayIdx] = useState(-1);
  const logRef = useRef(onLog);
  logRef.current = onLog;

  // Earn and save the sticker the first time this screen appears for this key.
  useEffect(() => {
    const fresh = earnSticker(studentName, keyName);
    setIsNew(fresh);
    if (fresh && logRef.current) logRef.current({ type: "sticker_earned", key: keyName });
    return () => stopScale();
  }, [keyName, studentName]);

  const midis = useMemo(() => scaleMidis(keyName), [keyName]);
  const lit = useMemo(() => {
    const map = new Map();
    // while playing, light the notes heard so far; otherwise the whole family
    const upto = playIdx >= 0 ? playIdx : midis.length - 1;
    midis.forEach((m, i) => { if (i <= upto) map.set(m, { label: scale.notes[i], finger: "" }); });
    return map;
  }, [midis, scale, playIdx]);

  const hear = () => {
    ensureCtx();
    setPlayIdx(-1);
    playScale(scaleFreqs(keyName), (i) => setPlayIdx(i), () => setPlayIdx(-1));
  };

  return (
    <div className="cg-reveal">
      <Sticker k={keyName} size={150} pop={isNew} />
      <div className="cg-reveal-title">The family of {pretty(keyName)}</div>
      <div className="cg-line" aria-label={scale.notes.map(pretty).join(" ")}>
        {scale.notes.map((n, i) => (
          <span key={i} className={`cg-note ${n.length > 1 ? "acc " + side : ""} ${playIdx === i ? "now" : ""}`}>{pretty(n)}</span>
        ))}
      </div>
      <div className="cg-actions">
        <button className="cg-btn" onClick={() => setShowKb((v) => !v)} aria-pressed={showKb}>
          <KeyboardIcon /> {showKb ? "Hide keyboard" : "Show on keyboard"}
        </button>
        <button className="cg-btn" onClick={hear}><SpeakerIcon /> Hear it</button>
      </div>
      {showKb && <div className="cg-kb"><Keyboard lit={lit} /></div>}
      <button className="primary-btn cg-next" onClick={() => { stopScale(); onNext(); }}>{nextLabel}</button>
    </div>
  );
}
