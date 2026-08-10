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
    kind: "guitar",
    width: 300,
    height: 420,
    postR: 11,        // guitar posts are modest next to the head
    buttonRx: 12,
    buttonRy: 8.5,
    shaft: 30,
    stringW: [2.6, 2.3, 2.0, 1.6, 1.3, 1.1],  // low -> high, wound to plain
    wound: 3,         // the lowest 3 are wound
    // 3+3. Posts sit INSIDE the wood: the head is ~0.13..0.87 wide here, so
    // x=96/204 leaves a clear margin of wood outboard of every post.
    pegs: [
      { x: 96, y: 104, side: "left" },   // E2  furthest from nut
      { x: 96, y: 176, side: "left" },   // A2
      { x: 96, y: 248, side: "left" },   // D3  nearest nut
      { x: 204, y: 248, side: "right" }, // G3  nearest nut
      { x: 204, y: 176, side: "right" }, // B3
      { x: 204, y: 104, side: "right" }, // E4  furthest from nut
    ],
  },
  bass4: {
    kind: "bass",
    width: 300,
    height: 470,
    postR: 19,        // bass posts are MUCH larger relative to the head
    buttonRx: 17,
    buttonRy: 12,
    shaft: 34,
    stringW: [5.4, 4.5, 3.7, 3.0],
    wound: 4,         // all four bass strings read as wound
    // 4-in-line, all posts on the bass side, mounted well inside the wood
    // with head extending on BOTH sides of every post.
    pegs: [
      { x: 140, y: 108, side: "left" },  // E1 furthest
      { x: 140, y: 196, side: "left" },  // A1
      { x: 140, y: 284, side: "left" },  // D2
      { x: 140, y: 352, side: "left" },  // G2 nearest nut
    ],
  },
  bass5: {
    kind: "bass",
    width: 320,
    height: 470,
    postR: 19,
    buttonRx: 17,
    buttonRy: 12,
    shaft: 34,
    stringW: [6.2, 5.4, 4.5, 3.7, 3.0],
    wound: 5,
    // 4+1. Low B alone on the treble side. It sits NEAREST the nut on that
    // side so its short lateral hop peels off the treble edge of the string
    // band without ever reaching across the other four.
    pegs: [
      { x: 212, y: 150, side: "right" }, // B0 lone, treble side
      { x: 128, y: 108, side: "left" },  // E1
      { x: 128, y: 196, side: "left" },  // A1
      { x: 128, y: 284, side: "left" },  // D2
      { x: 128, y: 352, side: "left" },  // G2 nearest nut
    ],
  },
};

/* Where each string crosses the nut.

   On a real instrument the nut span and the post span are SIMILAR widths,
   which is exactly why the strings look near-vertical and near-parallel:
   each one runs straight up the head and only makes a short lateral hop at
   the very end to meet its post. A narrow nut cluster feeding wide-set
   posts would produce a dramatic fan, which no real headstock has.

   Order matters as well as spacing. A string must never cross another, so
   the nut slots must be in the same left-to-right order as the posts they
   feed. Sorting the strings by post x and handing out slots in that order
   guarantees no crossings: two strings can only cross if their nut order
   and their post order disagree.

   For a same-side group the posts share one x, so post x alone does not
   order them. Ties break by y — the peg FURTHEST from the nut (smallest y)
   takes the slot furthest out toward that side's edge, so its longer run
   stays outboard of the shorter ones and they never touch. */
function nutXs(pegs, width, nutSpan, nutHalf) {
  const count = pegs.length;
  if (count === 0) return [];

  // Nut span is a large share of the neck width, close to the post span, so
  // the strings stay near-vertical instead of fanning.
  const span = nutSpan;
  // Centre the band on the neck, then lean it toward the posts. On a
  // 4-in-line every post sits on one side, so a strictly centred band leaves
  // the outer strings reaching sideways into a hook. Leaning the band toward
  // the post column — which is what the neck actually does on such a bass —
  // keeps every run near-vertical. Clamped so the band always stays on the
  // nut, and a symmetric layout (3+3) is unaffected because its posts
  // average out to the centreline.
  const postMid = pegs.reduce((a, p) => a + p.x, 0) / count;
  const half = span / 2;
  // The band may lean at most as far as the nut's own half-width allows,
  // so it never runs off the end of the nut.
  const limit = Math.max(0, nutHalf - half);
  const lean = Math.max(-limit, Math.min(limit, (postMid - width / 2) * 0.55));
  const left = width / 2 + lean - half;
  const slot = (k) => (count === 1 ? left + span / 2 : left + (span * k) / (count - 1));

  // Sort string indices into the left-to-right order their posts sit in.
  const order = pegs.map((_, i) => i).sort((a, b) => {
    const pa = pegs[a];
    const pb = pegs[b];
    if (pa.x !== pb.x) return pa.x - pb.x;
    // Same post column: outermost slot goes to the peg furthest from the nut.
    return pa.side === "left" ? pa.y - pb.y : pb.y - pa.y;
  });

  const xs = new Array(count);
  order.forEach((idx, k) => { xs[idx] = slot(k); });
  return xs;
}

/* The path a string takes from the nut to its post.

   Real strings do not run diagonally across the headstock. They leave the
   nut and travel up the head essentially parallel to their neighbours,
   then make a short lateral hop into the post right at the end. Drawing
   that as a straight nut->post line is what produced the fan.

   So: hold the nut x all the way up to `hopY`, just short of the post,
   then curve across to the post. The hop is short and happens late, which
   is what makes the strings read as near-vertical and near-parallel. */
function stringPath(nx, nutTopY, peg) {
  const dx = Math.abs(peg.x - nx);
  const run = nutTopY - peg.y;   // vertical distance nut -> post
  // Scale the hop to how far the string actually has to move sideways: a
  // string nearly in line with its post barely deviates, one that must
  // reach further gets a longer, gentler curve instead of a tight hook.
  // Capped well short of the full run so the string still reads as vertical.
  const hop = Math.min(run - 8, Math.max(34, dx * 2.4));
  const startY = peg.y + hop;
  return [
    `M ${nx} ${nutTopY}`,
    `L ${nx} ${startY}`,
    // Ease across into the post: leaves the straight run vertically and
    // settles onto the post from the side, the way a string actually lies.
    `C ${nx} ${startY - hop * 0.5}, ${peg.x} ${peg.y + hop * 0.55}, ${peg.x} ${peg.y}`,
  ].join(" ");
}

/* Where each outline meets the nut, as a fraction of the width. The
   outline, the neck stub, the nut itself and the string span all derive
   from this, so they cannot drift apart. */
const NUT_EDGE = { guitar: 0.17, bass: 0.255 };

/* Outline of the headstock. Two genuinely different silhouettes.

   GUITAR — the Taylor in reference/taylor-guitar-3x3.jpg: a WIDE, nearly
   flat crown with a soft peak in the middle and distinct corners where the
   crown meets the sides, then near-straight sides tapering gently inward
   all the way to the nut. No dome, no waist. */
function guitarPath(w, h) {
  const tip = 46;
  const nutY = h - 44;
  // Crown corners sit wide; sides taper gently in toward the nut. The
  // Taylor's nut is only a little narrower than its crown, so the taper is
  // slight — a gentle inward lean, not a trapezoid.
  // Measured off the Taylor reference: the nut is only ~14% narrower than
  // the crown, so the taper is very gentle and the sides read near-straight.
  const cornerX = 0.115;
  const nutEdge = NUT_EDGE.guitar;
  const peakY = tip - 16;      // soft central peak above the corners
  return [
    `M ${w * cornerX} ${tip + 10}`,
    // crown: a short lift into the corner, then nearly flat across the
    // middle with a soft central rise — the Taylor's signature
    `C ${w * 0.135} ${tip - 6}, ${w * 0.30} ${peakY}, ${w * 0.5} ${peakY}`,
    `C ${w * 0.70} ${peakY}, ${w * 0.865} ${tip - 6}, ${w * (1 - cornerX)} ${tip + 10}`,
    // right side: hugs the crown width for a while, then leans gently in
    `C ${w * 0.888} ${h * 0.32}, ${w * 0.862} ${h * 0.66}, ${w * (1 - nutEdge)} ${nutY}`,
    `L ${w * nutEdge} ${nutY}`,
    // left side back up to the crown corner
    `C ${w * 0.138} ${h * 0.66}, ${w * 0.112} ${h * 0.32}, ${w * cornerX} ${tip + 10}`,
    "Z",
  ].join(" ");
}

/* BASS — its own shape, not the guitar reused. Following the Yamaha and
   LTD references: an angular, swept wedge. One long straight-ish bass-side
   edge running the full length, a clipped/angled tip, and a treble side
   that sweeps in sharply to a narrow nut. Reads as clearly a bass. */
function bassPath(w, h) {
  const tip = 26;
  const nutY = h - 44;
  return [
    // clipped angular tip, canted rather than domed
    `M ${w * 0.085} ${tip + 52}`,
    `L ${w * 0.27} ${tip}`,
    `L ${w * 0.80} ${tip + 18}`,
    // treble side: sweeps in from the wide tip, with a shoulder partway
    // down, then runs down to a nut narrower than the crown
    `C ${w * 0.885} ${h * 0.24}, ${w * 0.875} ${h * 0.40}, ${w * 0.815} ${h * 0.56}`,
    `C ${w * 0.775} ${h * 0.70}, ${w * 0.755} ${h * 0.80}, ${w * (1 - NUT_EDGE.bass)} ${nutY}`,
    `L ${w * NUT_EDGE.bass} ${nutY}`,
    // bass side: long and nearly straight, a slight belly near the nut
    `C ${w * 0.245} ${h * 0.80}, ${w * 0.15} ${h * 0.58}, ${w * 0.10} ${h * 0.40}`,
    `C ${w * 0.08} ${h * 0.32}, ${w * 0.075} ${tip + 76}, ${w * 0.085} ${tip + 52}`,
    "Z",
  ].join(" ");
}

function headstockPath(w, h, kind) {
  return kind === "bass" ? bassPath(w, h) : guitarPath(w, h);
}

export default function Headstock({
  tuningId = "guitar",
  strings = [],
  activeIndex = -1,
  onSelect = null,
}) {
  const layout = LAYOUTS[tuningId] || LAYOUTS.guitar;
  const { width: W, height: H, kind, postR, buttonRx, buttonRy, shaft } = layout;
  const pegs = layout.pegs.slice(0, strings.length);
  const nutY = H - 44;
  const isBass = kind === "bass";
  // Strings span most of the nut, and the nut width follows the outline.
  const nutEdge = isBass ? NUT_EDGE.bass : NUT_EDGE.guitar;
  // Strings fill most of the nut. The bass nut is narrow relative to its
  // head (see the Yamaha reference), which keeps the 4-in-line runs close
  // to their single post column instead of reaching sideways.
  const nutX = nutXs(
    pegs,
    W,
    W * (1 - nutEdge * 2) * (isBass ? 0.58 : 0.82),
    (W * (1 - nutEdge * 2)) / 2
  );
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
      <path d={headstockPath(W, H, kind)} fill="#1a1008" opacity="0.85"
            transform="translate(3,4)" />
      <path d={headstockPath(W, H, kind)} fill={`url(#${uid}-wood)`} />
      <path d={headstockPath(W, H, kind)} fill={`url(#${uid}-wood)`}
            filter={`url(#${uid}-grain)`} opacity="0.5" />
      {/* bevelled edge highlight */}
      <path d={headstockPath(W, H, kind)} fill="none" stroke="#c89a63"
            strokeOpacity="0.35" strokeWidth="1.5" />

      {/* ---- neck stub below the nut ----
           Matches where the outline actually meets the nut, which differs
           between the guitar and bass silhouettes. */}
      {(() => {
        const edge = nutEdge;
        const nx = W * edge;
        const nw = W * (1 - edge * 2);
        return (
          <>
            <rect x={nx} y={nutY} width={nw} height="46"
                  fill={`url(#${uid}-wood)`} />
            <rect x={nx} y={nutY} width={nw} height="46"
                  fill="#000" opacity="0.18" />
            {/* the nut, sitting just proud of the neck on both sides */}
            <rect x={nx - W * 0.018} y={nutY - 7} width={nw + W * 0.036}
                  height="11" rx="2.5" fill={`url(#${uid}-nut)`} />
            <rect x={nx - W * 0.018} y={nutY - 7} width={nw + W * 0.036}
                  height="3.5" rx="1.5" fill="#fffdf4" opacity="0.5" />
          </>
        );
      })()}

      {/* ---- strings: nut -> post ----
           Near-vertical up the head, with a short lateral hop into the
           post. Width is per-string (low strings are visibly fatter) and
           the wound ones carry a winding texture. */}
      {pegs.map((p, i) => {
        const active = i === activeIndex;
        const w = layout.stringW[i] ?? 2;
        const d = stringPath(nutX[i], nutY - 6, p);
        const isWound = i < layout.wound;
        return (
          <g key={`s-${i}`}>
            <path
              d={d} fill="none"
              stroke="#0a0a0f" strokeOpacity="0.5"
              strokeWidth={w + 1.8} strokeLinecap="round"
            />
            <path
              d={d} fill="none"
              stroke={active ? "#ffd977" : "#c9ced8"}
              strokeWidth={w} strokeLinecap="round"
            />
            {/* winding: short cross-ticks along the core, so wound strings
                read as ribbed rather than smooth */}
            {isWound && (
              <path
                d={d} fill="none"
                stroke={active ? "#8a6a1e" : "#6f7885"}
                strokeOpacity="0.75"
                strokeWidth={w * 0.92}
                strokeDasharray={`${Math.max(0.9, w * 0.32)} ${Math.max(1.5, w * 0.5)}`}
              />
            )}
            <path
              d={d} fill="none"
              stroke="#ffffff" strokeOpacity={active ? 0.7 : 0.45}
              strokeWidth={w * 0.3} strokeLinecap="round"
            />
          </g>
        );
      })}

      {/* ---- tuner pegs ---- */}
      {pegs.map((p, i) => {
        const active = i === activeIndex;
        const s = strings[i];
        const outward = p.side === "left" ? -1 : 1;
        const buttonX = p.x + outward * (shaft + postR + buttonRx * 0.4);
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
              <circle cx={p.x} cy={p.y} r={postR * 2.4}
                      fill={`url(#${uid}-glowfill)`} />
            )}

            {/* shaft from post out to the button */}
            <rect
              x={p.side === "left" ? buttonX : p.x}
              y={p.y - postR * 0.3}
              width={Math.abs(buttonX - p.x)} height={postR * 0.6}
              rx={postR * 0.3}
              fill={`url(#${uid}-metal)`}
              stroke="#3b414c" strokeWidth="0.8"
            />
            {/* tuner button (the part you actually turn) */}
            <ellipse
              cx={buttonX} cy={p.y} rx={buttonRx} ry={buttonRy}
              fill={`url(#${uid}-metal)`}
              stroke="#39404a" strokeWidth="1.2"
              filter={active ? `url(#${uid}-glow)` : undefined}
            />
            <ellipse cx={buttonX} cy={p.y - buttonRy * 0.25}
                     rx={buttonRx * 0.65} ry={buttonRy * 0.45}
                     fill="#ffffff" opacity="0.35" />

            {/* the post the string winds around */}
            <circle cx={p.x} cy={p.y} r={postR}
                    fill="#2b3038" stroke="#171b21" strokeWidth="1" />
            <circle cx={p.x} cy={p.y} r={postR * 0.81} fill={`url(#${uid}-post)`}
                    stroke={active ? "#f0c040" : "#464e5a"}
                    strokeWidth={active ? 2.4 : 1}
                    filter={active ? `url(#${uid}-glow)` : undefined} />
            {/* string winding on the post */}
            <circle cx={p.x} cy={p.y} r={postR * 0.49} fill="none"
                    stroke="#8e97a4" strokeWidth={postR * 0.13} opacity="0.85" />
            <circle cx={p.x} cy={p.y} r={postR * 0.26} fill="#1d2128" />
            <circle cx={p.x - postR * 0.23} cy={p.y - postR * 0.26}
                    r={postR * 0.2} fill="#ffffff" opacity="0.5" />

            {/* note label, sitting outboard of the tuner button */}
            <text
              x={buttonX + outward * (buttonRx + 14)}
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
