/* ------------------------------------------------------------------
   Headstock.jsx — SVG headstocks for guitar (3+3), 4-string bass
   (4-in-line) and 5-string bass (4+1).

   Every peg is individually addressable so the active string's peg can
   be highlighted, and each peg is labelled with its note name.

   ------------------------------------------------------------------
   STRING -> PEG MAPPING (the part that must be right)

   All three layouts are drawn as seen from the FRONT, neck pointing
   down-screen, nut at the bottom, headstock tip at the top.

   Guitar, 3+3. Low E is the thickest string; held in playing position
   it is the topmost string, and on the front view it runs along the
   LEFT (bass) side. Its peg is the one FURTHEST FROM THE NUT on that
   side — i.e. nearest the tip. Strings never cross on the way to their
   posts, so on each side the string nearest the nut takes the post
   nearest the nut:

       left / bass side (low E A D)      right / treble side (G B e)
         tip   [E2] <- furthest            [E4] <- furthest from nut
               [A2]                        [B3]
         nut   [D3] <- nearest nut         [G3] <- nearest nut

   Reading the left column top(tip)->bottom(nut) gives E A D, and the
   right column tip->nut gives e B G. So going low->high around the
   head: E A D up the bass side, then G B e coming back down the treble
   side. That is the standard Fender/Gibson 3+3 arrangement.

   Bass 4-in-line. All four posts on one side (the bass side, left
   here). Low E is furthest from the nut, G is nearest the nut, so
   tip->nut reads E A D G.

   Bass 5-string, 4+1. Four posts on the bass side and one on the
   treble side. The lone treble-side post is the LOW B (the fattest
   string, which needs the straightest pull and sits furthest from the
   nut); E A D G run down the bass side as on a 4-string.
   ------------------------------------------------------------------ */

/* Peg layouts in SVG user units. `side` is which edge the post sits on.
   Order of the array is always LOW -> HIGH, matching TUNINGS[].strings,
   so pegs[i] belongs to strings[i]. */

const LAYOUTS = {
  guitar: {
    width: 300,
    height: 420,
    // 3+3. Bass side x=70, treble side x=230.
    // Low E furthest from the nut on the bass side (smallest y = tip).
    pegs: [
      { x: 70, y: 96, side: "left", nutOffset: 0 },   // E2  furthest from nut
      { x: 70, y: 168, side: "left", nutOffset: 1 },  // A2
      { x: 70, y: 240, side: "left", nutOffset: 2 },  // D3  nearest nut
      { x: 230, y: 240, side: "right", nutOffset: 2 },// G3  nearest nut
      { x: 230, y: 168, side: "right", nutOffset: 1 },// B3
      { x: 230, y: 96, side: "right", nutOffset: 0 }, // E4  furthest from nut
    ],
  },
  bass4: {
    width: 300,
    height: 460,
    // 4-in-line, all posts on the bass side. E furthest from the nut.
    pegs: [
      { x: 84, y: 92, side: "left", nutOffset: 0 },   // E1 furthest
      { x: 84, y: 176, side: "left", nutOffset: 1 },  // A1
      { x: 84, y: 260, side: "left", nutOffset: 2 },  // D2
      { x: 84, y: 344, side: "left", nutOffset: 3 },  // G2 nearest nut
    ],
  },
  bass5: {
    width: 300,
    height: 460,
    // 4+1. Low B alone on the treble side, furthest from the nut.
    pegs: [
      { x: 226, y: 92, side: "right", nutOffset: 0 }, // B0 lone, treble side
      { x: 84, y: 92, side: "left", nutOffset: 0 },   // E1
      { x: 84, y: 176, side: "left", nutOffset: 1 },  // A1
      { x: 84, y: 260, side: "left", nutOffset: 2 },  // D2
      { x: 84, y: 344, side: "left", nutOffset: 3 },  // G2 nearest nut
    ],
  },
};

/* Where each string crosses the nut.

   Strings are evenly spaced across the nut, but the ORDER matters and is
   not simply low->high left->right. A string must never cross another on
   its way from the nut to its post, so the string whose post is on the
   left edge has to leave the nut on the left, and vice versa.

   Concretely: on a 4+1 bass the low B's post is alone on the RIGHT, so B
   is the RIGHTMOST string at the nut. Spacing them naively low->high
   would drag the B diagonally across all four other strings — which is
   both ugly and physically wrong.

   So: lay the slots out left->right, give the left-side pegs the leftmost
   slots (nearest-the-tip peg gets the outermost slot, matching how the
   fan opens up), and give the right-side pegs the rightmost slots. */
function nutXs(pegs, width) {
  const count = pegs.length;
  // The string group is centred on the neck and spans a fixed share of
  // the nut, independent of layout, so a 4-in-line bass spreads its
  // strings evenly across the nut instead of bunching them to one side.
  const span = width * 0.30;
  const left = (width - span) / 2;
  const slot = (k) => (count === 1 ? left + span / 2 : left + (span * k) / (count - 1));

  const leftPegs = [];
  const rightPegs = [];
  pegs.forEach((p, i) => (p.side === "left" ? leftPegs : rightPegs).push(i));

  // Within each side, the peg furthest from the nut (smallest y) takes the
  // slot furthest out toward that side's edge.
  leftPegs.sort((a, b) => pegs[a].y - pegs[b].y);
  rightPegs.sort((a, b) => pegs[a].y - pegs[b].y);

  const xs = new Array(count);
  leftPegs.forEach((idx, k) => { xs[idx] = slot(k); });
  rightPegs.forEach((idx, k) => { xs[idx] = slot(count - 1 - k); });
  return xs;
}

/* Outline of the headstock.

   Shaped like a real head rather than a rounded rectangle: a broad,
   softly-crowned tip at the top, a gentle waist about a third of the way
   down, then a flare back out to full width where it meets the nut. */
function headstockPath(w, h) {
  const tip = 22;
  const nutY = h - 44;
  const waistY = h * 0.42;
  return [
    `M ${w * 0.34} ${tip}`,
    // left shoulder out to the widest point near the tip
    `C ${w * 0.19} ${tip + 10}, ${w * 0.12} ${h * 0.13}, ${w * 0.115} ${h * 0.24}`,
    // pull in to the waist
    `C ${w * 0.11} ${h * 0.33}, ${w * 0.125} ${h * 0.37}, ${w * 0.135} ${waistY}`,
    // flare back out toward the nut
    `C ${w * 0.15} ${h * 0.62}, ${w * 0.155} ${h * 0.76}, ${w * 0.165} ${nutY}`,
    `L ${w * 0.835} ${nutY}`,
    `C ${w * 0.845} ${h * 0.76}, ${w * 0.85} ${h * 0.62}, ${w * 0.865} ${waistY}`,
    `C ${w * 0.875} ${h * 0.37}, ${w * 0.89} ${h * 0.33}, ${w * 0.885} ${h * 0.24}`,
    `C ${w * 0.88} ${h * 0.13}, ${w * 0.81} ${tip + 10}, ${w * 0.66} ${tip}`,
    // crown across the tip
    `C ${w * 0.56} ${tip - 8}, ${w * 0.44} ${tip - 8}, ${w * 0.34} ${tip}`,
    "Z",
  ].join(" ");
}

export default function Headstock({
  tuningId = "guitar",
  strings = [],
  activeIndex = -1,
  onSelect = null,
}) {
  const layout = LAYOUTS[tuningId] || LAYOUTS.guitar;
  const { width: W, height: H } = layout;
  const pegs = layout.pegs.slice(0, strings.length);
  const nutY = H - 44;
  const nutX = nutXs(pegs, W);
  const uid = `hs-${tuningId}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="tn-headstock"
      role="img"
      aria-label={`${tuningId} headstock`}
    >
      <defs>
        {/* Wood grain: a warm base plus subtle turbulence for figure. */}
        <linearGradient id={`${uid}-wood`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3a2314" />
          <stop offset="18%" stopColor="#6b4526" />
          <stop offset="45%" stopColor="#8a5c34" />
          <stop offset="70%" stopColor="#6b4526" />
          <stop offset="100%" stopColor="#33200f" />
        </linearGradient>
        <filter id={`${uid}-grain`} x="0" y="0" width="100%" height="100%">
          {/* Grain runs LENGTHWISE down the neck: tight variation across
              the width (high x frequency), stretched along it (low y). */}
          <feTurbulence type="fractalNoise" baseFrequency="0.055 0.004" numOctaves="4" seed="11" result="n" />
          <feColorMatrix in="n" type="saturate" values="0" result="g" />
          <feComponentTransfer in="g" result="soft">
            <feFuncA type="linear" slope="0.20" />
          </feComponentTransfer>
          <feComposite in="soft" in2="SourceGraphic" operator="atop" />
        </filter>
        {/* Metal for the tuner posts. */}
        <linearGradient id={`${uid}-metal`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f2f4f8" />
          <stop offset="30%" stopColor="#b9c0cc" />
          <stop offset="55%" stopColor="#7d8795" />
          <stop offset="80%" stopColor="#aeb6c2" />
          <stop offset="100%" stopColor="#5e6675" />
        </linearGradient>
        <linearGradient id={`${uid}-post`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6f7885" />
          <stop offset="35%" stopColor="#e6eaf0" />
          <stop offset="65%" stopColor="#aab2be" />
          <stop offset="100%" stopColor="#5b6370" />
        </linearGradient>
        {/* Bone/nut material. */}
        <linearGradient id={`${uid}-nut`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f6f1e2" />
          <stop offset="55%" stopColor="#ddd5bf" />
          <stop offset="100%" stopColor="#b9b09a" />
        </linearGradient>
        {/* Glow for the active peg. */}
        <filter id={`${uid}-glow`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id={`${uid}-glowfill`}>
          <stop offset="0%" stopColor="#ffd977" stopOpacity="0.95" />
          <stop offset="60%" stopColor="#f0c040" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#f0c040" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ---- headstock body ---- */}
      <path d={headstockPath(W, H)} fill="#1a1008" opacity="0.85"
            transform="translate(3,4)" />
      <path d={headstockPath(W, H)} fill={`url(#${uid}-wood)`} />
      <path d={headstockPath(W, H)} fill={`url(#${uid}-wood)`}
            filter={`url(#${uid}-grain)`} opacity="0.5" />
      {/* bevelled edge highlight */}
      <path d={headstockPath(W, H)} fill="none" stroke="#c89a63"
            strokeOpacity="0.35" strokeWidth="1.5" />

      {/* ---- neck stub below the nut ---- */}
      <rect x={W * 0.19} y={nutY} width={W * 0.62} height="46"
            fill={`url(#${uid}-wood)`} />
      <rect x={W * 0.19} y={nutY} width={W * 0.62} height="46"
            fill="#000" opacity="0.18" />

      {/* ---- the nut ---- */}
      <rect x={W * 0.17} y={nutY - 7} width={W * 0.66} height="11" rx="2.5"
            fill={`url(#${uid}-nut)`} />
      <rect x={W * 0.17} y={nutY - 7} width={W * 0.66} height="3.5" rx="1.5"
            fill="#fffdf4" opacity="0.5" />

      {/* ---- strings: nut -> post ---- */}
      {pegs.map((p, i) => {
        const active = i === activeIndex;
        // Thicker strings for the low end, tapering to the high strings.
        const w = 3.4 - (i / Math.max(1, pegs.length - 1)) * 1.9;
        return (
          <g key={`s-${i}`}>
            <line
              x1={nutX[i]} y1={nutY - 6} x2={p.x} y2={p.y}
              stroke="#0a0a0f" strokeOpacity="0.5"
              strokeWidth={w + 1.6} strokeLinecap="round"
            />
            <line
              x1={nutX[i]} y1={nutY - 6} x2={p.x} y2={p.y}
              stroke={active ? "#ffd977" : "#c9ced8"}
              strokeWidth={w} strokeLinecap="round"
            />
            <line
              x1={nutX[i]} y1={nutY - 6} x2={p.x} y2={p.y}
              stroke="#ffffff" strokeOpacity={active ? 0.7 : 0.45}
              strokeWidth={w * 0.34} strokeLinecap="round"
            />
          </g>
        );
      })}

      {/* ---- tuner pegs ---- */}
      {pegs.map((p, i) => {
        const active = i === activeIndex;
        const s = strings[i];
        const outward = p.side === "left" ? -1 : 1;
        const buttonX = p.x + outward * 34;
        const clickable = typeof onSelect === "function";
        return (
          <g
            key={`p-${i}`}
            data-peg={s?.label || i}
            onClick={clickable ? () => onSelect(i) : undefined}
            style={clickable ? { cursor: "pointer" } : undefined}
          >
            {/* glow behind the active peg */}
            {active && (
              <circle cx={p.x} cy={p.y} r="30" fill={`url(#${uid}-glowfill)`} />
            )}

            {/* shaft from post out to the button */}
            <rect
              x={p.side === "left" ? buttonX : p.x}
              y={p.y - 4}
              width={34} height={8} rx="4"
              fill={`url(#${uid}-metal)`}
              stroke="#3b414c" strokeWidth="0.8"
            />
            {/* tuner button (the part you actually turn) */}
            <ellipse
              cx={buttonX} cy={p.y} rx="13" ry="9"
              fill={`url(#${uid}-metal)`}
              stroke="#39404a" strokeWidth="1.2"
              filter={active ? `url(#${uid}-glow)` : undefined}
            />
            <ellipse cx={buttonX} cy={p.y - 2.2} rx="8.5" ry="4"
                     fill="#ffffff" opacity="0.35" />

            {/* the post the string winds around */}
            <circle cx={p.x} cy={p.y} r="13"
                    fill="#2b3038" stroke="#171b21" strokeWidth="1" />
            <circle cx={p.x} cy={p.y} r="10.5" fill={`url(#${uid}-post)`}
                    stroke={active ? "#f0c040" : "#464e5a"}
                    strokeWidth={active ? 2.4 : 1}
                    filter={active ? `url(#${uid}-glow)` : undefined} />
            {/* string winding on the post */}
            <circle cx={p.x} cy={p.y} r="6.4" fill="none"
                    stroke="#8e97a4" strokeWidth="1.6" opacity="0.85" />
            <circle cx={p.x} cy={p.y} r="3.4" fill="#1d2128" />
            <circle cx={p.x - 3} cy={p.y - 3.4} r="2.6"
                    fill="#ffffff" opacity="0.5" />

            {/* note label, sitting outboard of the tuner button */}
            <text
              x={buttonX + outward * 26}
              y={p.y + 6}
              textAnchor="middle"
              className={`tn-peg-label${active ? " on" : ""}`}
            >
              {s?.label || ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
