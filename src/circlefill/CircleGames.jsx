import { useState, useMemo } from "react";
import CircleFill, { BlankCircle } from "./CircleFill.jsx";
import { HandStep } from "./Hand.jsx";
import Sticker from "./Sticker.jsx";
import {
  PATH_SHARP, PATH_FLAT, CIRCLE_ORDER, SCALE_ORDER_KEYS, prevKey, sideOf, readStickers, scaleFreqs,
} from "./circleData.js";
import { ensureCtx, playTone } from "./circleAudio.js";

// ---------------- menu ----------------
function Menu({ go, onBack }) {
  return (
    <div className="cf-shell">
      <div className="cf-title">Circle Games</div>
      <div className="cg-menu">
        <button className="cg-menu-btn" onClick={() => go("hand")}>Fill the circle with your hand</button>
        <button className="cg-menu-btn" onClick={() => go("pass")}>Pass the key</button>
        <button className="cg-menu-btn" onClick={() => go("rebuild")}>Rebuild the circle</button>
        <button className="cg-menu-btn" onClick={() => go("stickers")}>My stickers</button>
        <button className="cg-menu-btn back" onClick={onBack}>Back</button>
      </div>
    </div>
  );
}

// ---------------- my stickers ----------------
function MyStickers({ studentName, onBack }) {
  const got = useMemo(() => readStickers(studentName), [studentName]);
  const n = SCALE_ORDER_KEYS.filter((k) => got[k]).length;
  return (
    <div className="cf-shell">
      <div className="cf-head">
        <button className="cf-back" onClick={onBack}>{"←"} Back</button>
        <div className="cf-stage">My stickers</div>
        <div className="cf-count">{n}/15</div>
      </div>
      <div className="cg-stickers">
        {SCALE_ORDER_KEYS.map((k) => <Sticker key={k} k={k} size={96} earned={!!got[k]} />)}
      </div>
      <div className="cg-count">{n === 0 ? "Finish a key to earn your first sticker." : `${n} of 15 stickers`}</div>
    </div>
  );
}

// ---------------- pass the key ----------------
function PassKey({ onBack, onLog }) {
  const [side, setSide] = useState("sharp");      // sharp | flat
  const [idx, setIdx] = useState(0);              // we are finding path[idx + 1]
  const [filled, setFilled] = useState({ C: true });
  const [token, setToken] = useState("C");
  const [fin, setFin] = useState(null);           // null | "side" | "all"
  const path = side === "sharp" ? PATH_SHARP : PATH_FLAT;
  const from = path[idx], target = path[idx + 1];

  const solved = () => {
    setFilled((f) => ({ ...f, [target]: true }));
    setToken(target);
    playTone(scaleFreqs(target)[0]);               // one soft tone, only after a right answer
  };
  const next = () => {
    if (idx + 2 >= path.length) { setFin(side === "sharp" ? "side" : "all"); if (side === "flat") onLog && onLog({ type: "pass_key_complete" }); }
    else setIdx(idx + 1);
  };
  const startFlat = () => { setSide("flat"); setIdx(0); setToken("C"); setFin(null); };
  const again = () => {
    setSide("sharp"); setIdx(0); setFilled({ C: true }); setToken("C"); setFin(null);
    onLog && onLog({ type: "pass_key_start" });
  };

  if (fin) {
    return (
      <div className="cf-shell">
        <div className="cg-done">
          <BlankCircle filled={filled} active={null} token={token} center={["PASS", "THE KEY"]} />
          <div className="cg-done-title">{fin === "side" ? "Side done" : "All done"}</div>
          {fin === "side"
            ? <button className="primary-btn cg-next" onClick={startFlat}>Next: flat side</button>
            : <button className="primary-btn cg-next" onClick={again}>Play again</button>}
          <button className="ghost-btn cg-know" onClick={onBack}>Back</button>
        </div>
      </div>
    );
  }
  return (
    <div className="cf-shell">
      <div className="cf-head">
        <button className="cf-back" onClick={onBack}>{"←"} Exit</button>
        <div className="cf-stage">{side === "sharp" ? "Sharp side" : "Flat side"}</div>
        <div className="cf-count">{idx + 1}/{path.length - 1}</div>
      </div>
      <BlankCircle filled={filled} active={target} token={token} small center={["PASS", "THE KEY"]} />
      <HandStep key={side + target} prev={from} target={target} side={side}
        nextLabel={idx + 2 >= path.length ? "Done" : "Next key"} onSolved={solved} onNext={next} />
    </div>
  );
}

// ---------------- rebuild the broken circle ----------------
function pickMissing() {
  const all = [...PATH_SHARP.slice(1), ...PATH_FLAT.slice(1)];
  for (let tries = 0; tries < 200; tries++) {
    const pool = all.slice().sort(() => Math.random() - 0.5);
    const chosen = [];
    for (const k of pool) {
      if (chosen.length === 4) break;
      const adj = chosen.some((c) => prevKey(c) === k || prevKey(k) === c);
      if (!adj) chosen.push(k);
    }
    if (chosen.length === 4) return chosen;
  }
  return ["G", "A", "F", "Eb"];
}

function Rebuild({ onBack, onLog }) {
  const [missing, setMissing] = useState(() => pickMissing());
  const [filled, setFilled] = useState({});
  const [open, setOpen] = useState(null);
  const startFilled = (m) => Object.fromEntries(CIRCLE_ORDER.filter((k) => !m.includes(k)).map((k) => [k, true]));
  const fl = { ...startFilled(missing), ...filled };
  const left = missing.filter((k) => !fl[k]);
  const marks = Object.fromEntries(missing.map((k, i) => [k, String(i + 1)]));

  const round = () => {
    const m = pickMissing();
    setMissing(m); setFilled({}); setOpen(null);
    onLog && onLog({ type: "rebuild_start" });
  };
  const solved = () => {
    setFilled((f) => ({ ...f, [open]: true }));
    if (left.length === 1) onLog && onLog({ type: "rebuild_complete" });
  };

  if (open) {
    return (
      <div className="cf-shell">
        <div className="cf-head">
          <button className="cf-back" onClick={() => setOpen(null)}>{"←"} Circle</button>
          <div className="cf-stage">Slot {missing.indexOf(open) + 1}</div>
          <div className="cf-count">{4 - left.length}/4</div>
        </div>
        <BlankCircle filled={fl} active={open} marks={marks} small center={["REBUILD", "THE CIRCLE"]} />
        <HandStep key={open} prev={prevKey(open)} target={open} side={sideOf(open)}
          nextLabel="Back to the circle" onSolved={solved} onNext={() => setOpen(null)} />
      </div>
    );
  }
  return (
    <div className="cf-shell">
      <div className="cf-head">
        <button className="cf-back" onClick={onBack}>{"←"} Exit</button>
        <div className="cf-stage">Rebuild</div>
        <div className="cf-count">{4 - left.length}/4</div>
      </div>
      <BlankCircle filled={fl} active={null} marks={marks} onSlot={(k) => missing.includes(k) && setOpen(k)} center={["REBUILD", "THE CIRCLE"]} />
      {left.length > 0 ? (
        <>
          <div className="cg-ask">Tap a number to fix that slot.</div>
          <div className="cg-slots">
            {missing.map((k, i) => (
              <button key={k} className={`cg-sl ${fl[k] ? "done" : ""}`} disabled={!!fl[k]} onClick={() => setOpen(k)} aria-label={fl[k] ? `Slot ${i + 1} fixed` : `Fix slot ${i + 1}`}>{i + 1}</button>
            ))}
          </div>
        </>
      ) : (
        <div className="cg-done">
          <div className="cg-done-title">Circle rebuilt!</div>
          <button className="primary-btn cg-next" onClick={round}>Another round</button>
          <button className="ghost-btn cg-know" onClick={onBack}>Back</button>
        </div>
      )}
    </div>
  );
}

// ---------------- the games hub ----------------
export default function CircleGames({ onBack, onLog, studentName }) {
  const name = studentName || "teacher";
  const [view, setView] = useState("menu");
  const menu = () => setView("menu");
  const go = (v) => {
    ensureCtx();   // inside the tap, so the sound is ready on iOS. Makes no sound.
    if (v === "pass") onLog && onLog({ type: "pass_key_start" });
    if (v === "rebuild") onLog && onLog({ type: "rebuild_start" });
    setView(v);
  };
  if (view === "hand") return <CircleFill mode="hand" studentName={name} onBack={menu} onLog={onLog} />;
  if (view === "pass") return <PassKey onBack={menu} onLog={onLog} />;
  if (view === "rebuild") return <Rebuild onBack={menu} onLog={onLog} />;
  if (view === "stickers") return <MyStickers studentName={name} onBack={menu} />;
  return <Menu go={go} onBack={onBack} />;
}
