import { STICKERS, STICKER_WORDS, pretty, sideOf } from "./circleData.js";

// Round badge. Tints match BlankCircle: blue for sharp keys, rose for flat keys, green for C.
const TINT = {
  sharp: { bg: "rgba(79,195,247,.16)", bd: "rgba(79,195,247,.55)" },
  flat: { bg: "rgba(239,154,154,.16)", bd: "rgba(239,154,154,.55)" },
  neither: { bg: "rgba(165,214,167,.16)", bd: "rgba(165,214,167,.55)" },
};

export default function Sticker({ k, size = 96, earned = true, pop = false }) {
  const t = TINT[sideOf(k)];
  const style = earned
    ? { width: size, height: size, background: t.bg, borderColor: t.bd }
    : { width: size, height: size };
  return (
    <div className={`cg-sticker ${earned ? "on" : "off"} ${pop ? "pop" : ""}`} style={style} role="img" aria-label={earned ? `${pretty(k)} sticker, ${STICKER_WORDS[k]}` : `${pretty(k)} sticker not earned yet`}>
      {earned && <div className="cg-sticker-emoji" style={{ fontSize: size * 0.46 }}>{STICKERS[k]}</div>}
      <div className="cg-sticker-name" style={{ fontSize: Math.max(11, size * 0.15) }}>{pretty(k)}</div>
    </div>
  );
}
