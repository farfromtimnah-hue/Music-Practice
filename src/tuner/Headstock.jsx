/* ------------------------------------------------------------------
   Headstock.jsx — SVG headstocks for guitar (3+3), 4-string bass
   (4-in-line) and 5-string bass (4+1).

   The artwork is the photoreal set designed in Headstocks.dc.html and
   ported here verbatim, minus the design harness's template syntax:
   the per-peg `{{ hl.<id>.c/.o/.t }}` placeholders became the `hl()`
   helper below, driven by the component's `activeIndex` prop.

   Every peg is individually addressable (`peg-E2` … `peg-G2-5`) so the
   active string's peg can be highlighted, and each peg keeps its
   visible note label.

   ------------------------------------------------------------------
   STRING -> PEG MAPPING (the part that must be right)

   All three layouts are drawn as seen from the FRONT, neck pointing
   down-screen, nut at the bottom, headstock tip at the top.

   Guitar, 3+3. Walking low -> high you go DOWN the bass side, cross
   over at the nut, then back UP the treble side:

       left / bass side (E2 A2 D3)       right / treble side (G3 B3 E4)
         tip   [E2] y=120                  [G3] y=120  <- furthest from nut
               [A2] y=215                  [B3] y=215
         nut   [D3] y=310                  [E4] y=310  <- nearest the nut

   So the high E sits at the BOTTOM of the treble column, directly
   opposite D3, and G3 sits at the top. That is the standard 3+3
   arrangement.

   The treble post column leans OUTBOARD as it descends toward the nut
   (x = 182, 194, 204). The post nearest the nut is therefore also the
   one furthest out, so it must be fed by the OUTERMOST nut slot — which
   is E4's. That is why the nut slots stay exactly where the approved
   artwork put them even though the posts swapped: it is the only
   assignment of the three slots to the three posts that keeps the
   strings from crossing.

   Bass 4-in-line. All four posts on the bass side, tip->nut E A D G.

   Bass 5-string, 4+1. Four posts on the bass side (E A D G, tip->nut)
   and one on the treble side. The lone treble post takes G2 — the
   brief's original ask of putting B0 there is incompatible with "no
   string crosses another", since B0 is the lowest string and sits at
   the bass-side edge of the nut. Note order B0 E1 A1 D2 G2 is
   unchanged.
   ------------------------------------------------------------------ */

/* The peg id for each string, low -> high, matching TUNINGS[].strings
   so PEG_IDS[tuningId][i] belongs to strings[i]. These ids are also the
   `id` on each peg <g>, so they stay individually addressable. */
const PEG_IDS = {
  guitar: ["peg-E2", "peg-A2", "peg-D3", "peg-G3", "peg-B3", "peg-E4"],
  bass4: ["peg-E1-4", "peg-A1-4", "peg-D2-4", "peg-G2-4"],
  bass5: ["peg-B0", "peg-E1-5", "peg-A1-5", "peg-D2-5", "peg-G2-5"],
};

/* Highlight colour for the active peg. The design harness exposed a
   pegState enum (idle/active/intune/flat/sharp/disabled); the app only
   distinguishes active from not, so this is the "active" colour. */
const ACTIVE_C = "#ffb020";
const LABEL_C = "#f0e2c8";

/* Replaces the design file's `{{ hl.<id>.* }}` placeholders: ring
   colour, ring opacity and label colour for the peg at index `i`. */
function hl(i, activeIndex) {
  const on = i === activeIndex;
  return {
    c: on ? ACTIVE_C : "none",
    o: on ? 1 : 0,
    t: on ? ACTIVE_C : LABEL_C,
  };
}

export default function Headstock({
  tuningId = "guitar",
  strings = [],
  activeIndex = -1,
  onSelect = null,
}) {
  const kind = PEG_IDS[tuningId] ? tuningId : "guitar";
  const ids = PEG_IDS[kind];
  const clickable = typeof onSelect === "function";
  const labelOpacity = 0.92;

  /* Props shared by every peg <g>: the id the app addresses it by, and
     the click target when the parent passes onSelect. */
  const peg = (i) => ({
    id: ids[i],
    "data-peg": strings[i]?.label || ids[i],
    onClick: clickable ? () => onSelect(i) : undefined,
    style: clickable ? { cursor: "pointer" } : undefined,
  });

  const common = {
    viewBox: "0 0 300 552",
    className: "tn-headstock",
    role: "img",
    xmlns: "http://www.w3.org/2000/svg",
  };

  if (kind === "bass4") {
    const h = (i) => hl(i, activeIndex);
    return (
      <svg {...common} aria-label="4-string bass headstock">
        <defs>
          <linearGradient id="b4Chrome" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#3a3d40" /><stop offset=".16" stopColor="#dfe4e8" /><stop offset=".38" stopColor="#83898d" /><stop offset=".56" stopColor="#f2f5f7" /><stop offset=".8" stopColor="#54595c" /><stop offset="1" stopColor="#212426" />
          </linearGradient>
          <linearGradient id="b4ChromeV" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#eef2f5" /><stop offset=".28" stopColor="#98a0a5" /><stop offset=".5" stopColor="#43484b" /><stop offset=".74" stopColor="#c2c9ce" /><stop offset="1" stopColor="#2b2e30" />
          </linearGradient>
          <radialGradient id="b4Bush" cx=".32" cy=".26" r=".88">
            <stop offset="0" stopColor="#ffffff" /><stop offset=".3" stopColor="#c6ccd1" /><stop offset=".58" stopColor="#5f6569" /><stop offset=".82" stopColor="#b0b7bc" /><stop offset="1" stopColor="#2a2d2f" />
          </radialGradient>
          <linearGradient id="b4Post" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#2f3234" /><stop offset=".2" stopColor="#dde2e6" /><stop offset=".46" stopColor="#7d8286" /><stop offset=".74" stopColor="#eff3f6" /><stop offset="1" stopColor="#25282a" />
          </linearGradient>
          <linearGradient id="b4Body" x1=".05" y1="0" x2=".95" y2="1">
            <stop offset="0" stopColor="#4a4640" /><stop offset=".26" stopColor="#302d29" /><stop offset=".62" stopColor="#1e1c1a" /><stop offset="1" stopColor="#0f0e0d" />
          </linearGradient>
          <linearGradient id="b4Board" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#1d1310" /><stop offset=".4" stopColor="#40291f" /><stop offset=".72" stopColor="#261811" /><stop offset="1" stopColor="#120b07" />
          </linearGradient>
          <radialGradient id="b4Sheen" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#d8d2c4" stopOpacity=".2" /><stop offset=".55" stopColor="#d8d2c4" stopOpacity=".07" /><stop offset="1" stopColor="#d8d2c4" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="b4Fall" x1="0" y1="0" x2="1" y2=".25">
            <stop offset="0" stopColor="#000" stopOpacity="0" /><stop offset=".45" stopColor="#000" stopOpacity=".16" /><stop offset="1" stopColor="#000" stopOpacity=".62" />
          </linearGradient>
          <linearGradient id="b4Steel" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#3f4348" /><stop offset=".2" stopColor="#aab2b8" /><stop offset=".38" stopColor="#eef2f5" /><stop offset=".58" stopColor="#8d959b" /><stop offset=".8" stopColor="#c3cad0" /><stop offset="1" stopColor="#33373b" />
          </linearGradient>
          <radialGradient id="b4Soft" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#000" stopOpacity=".72" /><stop offset=".55" stopColor="#000" stopOpacity=".34" /><stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <clipPath id="b4Clip">
            <path d="M112,432 C104,346 80,238 72,150 L64,120 L200,40 Q214,38 220,52 L230,100 C232,212 204,348 190,432 Z" />
          </clipPath>

          {/* MASSIVE bass tuner: base sits under the string, front (post + wrap) over it */}
          <path id="b4Helix" fill="none" d="M-5.9,3 Q0,5.2 5.9,1.8 M-5.9,1.5 Q0,3.7 5.9,0.3 M-5.9,0 Q0,2.2 5.9,-1.2 M-5.9,-1.5 Q0,0.7 5.9,-2.7 M-5.9,-3 Q0,-0.8 5.9,-4.2 M-5.9,-4.5 Q0,-2.3 5.9,-5.7 M-5.9,-6 Q0,-3.8 5.9,-7.2 M-5.9,-7.5 Q0,-5.3 5.9,-8.7 M-5.9,-9 Q0,-6.8 5.9,-10.2 M-5.9,-10.5 Q0,-8.3 5.9,-11.7 M-5.9,-12 Q0,-9.8 5.9,-13.2 M-5.9,-13.5 Q0,-11.3 5.9,-14.7 M-5.9,-15 Q0,-12.8 5.9,-16.2 M-5.9,-16.5 Q0,-14.3 5.9,-17.7 M-5.9,-18 Q0,-15.8 5.9,-19.2 M-5.9,-19.5 Q0,-17.3 5.9,-20.7 M-5.9,-21 Q0,-18.8 5.9,-22.2" />
          <g id="b4Base">
            <ellipse cx="4" cy="6" rx="27" ry="21" fill="url(#b4Soft)" />
            <path d="M0,-19 L16.5,-9.5 L16.5,9.5 L0,19 L-16.5,9.5 L-16.5,-9.5 Z" fill="url(#b4Bush)" stroke="#141618" strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M0,-19 L16.5,-9.5 L11,-6.5 L0,-13 L-11,-6.5 L-16.5,-9.5 Z" fill="#fff" opacity=".45" />
            <path d="M0,19 L16.5,9.5 L11,6.4 L0,12.8 L-11,6.4 L-16.5,9.5 Z" fill="#000" opacity=".38" />
            <circle r="11.6" fill="url(#b4ChromeV)" stroke="#1b1e20" strokeWidth=".9" />
            <ellipse rx="8.4" ry="3.8" fill="#111416" />
          </g>
          <g id="b4Front">
            <path d="M-7,4 L-7,-24 Q0,-27.6 7,-24 L7,4 Z" fill="url(#b4Post)" stroke="#191c1e" strokeWidth=".7" />
            <use href="#b4Helix" stroke="#5f666c" strokeWidth="1.7" strokeLinecap="round" />
            <use href="#b4Helix" stroke="#1b1f23" strokeWidth=".5" opacity=".6" transform="translate(0,.7)" />
            <use href="#b4Helix" stroke="#eef2f5" strokeWidth=".55" opacity=".85" transform="translate(-.4,-.6)" />
            <ellipse cy="-24.6" rx="7" ry="3.4" fill="#eef2f5" stroke="#43484b" strokeWidth=".7" />
            <ellipse cy="-24.6" rx="2.8" ry="1.4" fill="#14171a" />
          </g>
          {/* huge clover key on the back, extends LEFT */}
          <g id="b4BtnL">
            <rect x="-14" y="-5.4" width="22" height="10.8" rx="5" fill="url(#b4Chrome)" stroke="#0c0d0e" strokeWidth=".7" />
            <ellipse cx="-14" cy="0" rx="4.2" ry="8.4" fill="#c8cfd4" stroke="#1d2022" strokeWidth=".7" />
            <path d="M-17,-9 C-27,-19 -42,-22 -50,-15 C-56,-9.6 -52,-3 -44,0 C-52,3 -56,9.6 -50,15 C-42,22 -27,19 -17,9 Z" fill="url(#b4Chrome)" stroke="#0b0c0d" strokeWidth="1.1" strokeLinejoin="round" />
            <path d="M-19,-8 C-28,-16.5 -40,-19 -47,-14 C-50,-11.6 -49.4,-8.6 -46,-6 C-38,-8 -28,-6.6 -22,-4 Z" fill="#fff" opacity=".45" />
            <path d="M-22,6 C-30,8.6 -40,11 -46,8 C-49,6.4 -50,10 -48,13 C-42,19 -29,16 -20,8 Z" fill="#000" opacity=".32" />
          </g>
        </defs>

        <g>
          <use href="#b4BtnL" x="81" y="132" /><use href="#b4BtnL" x="87" y="206" /><use href="#b4BtnL" x="94" y="280" /><use href="#b4BtnL" x="107" y="354" />
        </g>

        <path d="M112,438 L190,438 L198,552 L104,552 Z" fill="url(#b4Board)" />
        <path d="M112,438 L190,438 L191,460 L111,460 Z" fill="#000" opacity=".32" />
        <rect x="109" y="427" width="84" height="12" rx="1.5" fill="#20232a" stroke="#050607" strokeWidth=".8" />
        <rect x="109" y="427" width="84" height="3" fill="#9aa2ab" opacity=".5" />

        <g>
          <path d="M112,432 C104,346 80,238 72,150 L64,120 L200,40 Q214,38 220,52 L230,100 C232,212 204,348 190,432 Z" fill="url(#b4Body)" />
          <g clipPath="url(#b4Clip)">
            <g fill="url(#b4Sheen)">
              <ellipse cx="132" cy="96" rx="86" ry="34" transform="rotate(-26 132 96)" />
              <ellipse cx="112" cy="214" rx="52" ry="88" /><ellipse cx="150" cy="352" rx="60" ry="46" />
            </g>
            <rect x="40" y="20" width="230" height="430" fill="url(#b4Fall)" />
            <g fill="#e8e2d4" opacity=".2">
              <ellipse cx="96" cy="168" rx="1.1" ry=".7" /><ellipse cx="134" cy="122" rx=".8" ry="1.2" />
              <ellipse cx="118" cy="256" rx="1.3" ry=".8" /><ellipse cx="164" cy="196" rx=".9" ry=".9" />
              <ellipse cx="142" cy="318" rx="1" ry=".6" /><ellipse cx="176" cy="288" rx=".7" ry="1.1" />
              <ellipse cx="104" cy="330" rx=".9" ry=".7" /><ellipse cx="188" cy="140" rx="1.2" ry=".7" />
              <ellipse cx="156" cy="244" rx=".7" ry=".8" /><ellipse cx="124" cy="386" rx="1.1" ry=".6" />
            </g>
          </g>
          {/* warm timber edge on the bass side */}
          <path d="M112,432 C104,346 80,238 72,150 L64,120 L200,40" fill="none" stroke="#7a4c28" strokeWidth="3.4" opacity=".9" />
          <path d="M112,432 C104,346 80,238 72,150 L64,120 L200,40" fill="none" stroke="#c58b52" strokeWidth="1.1" opacity=".7" />
          <path d="M112,432 C104,346 80,238 72,150 L64,120 L200,40 Q214,38 220,52 L230,100 C232,212 204,348 190,432 Z" fill="none" stroke="#080807" strokeWidth="1.6" />
        </g>

        <g><use href="#b4Base" x="90" y="132" /><use href="#b4Base" x="106" y="206" /><use href="#b4Base" x="126" y="280" /><use href="#b4Base" x="152" y="354" /></g>

        {/* thick wound bass strings */}
        <g fill="none" strokeLinecap="butt">
          <g stroke="url(#b4Steel)">
            <path d="M113,552 L118,432 L90,162 L90,136" strokeWidth="4.4" /><path d="M138,552 L139,432 L106,236 L106,210" strokeWidth="3.7" />
            <path d="M162,552 L160,432 L126,310 L126,284" strokeWidth="3.1" /><path d="M186,552 L181,432 L152,390 L152,358" strokeWidth="2.5" />
          </g>
          <g stroke="#1c2126" opacity=".62" strokeDasharray=".7 1.5">
            <path d="M113,552 L118,432 L90,162 L90,136" strokeWidth="4.4" /><path d="M138,552 L139,432 L106,236 L106,210" strokeWidth="3.7" />
            <path d="M162,552 L160,432 L126,310 L126,284" strokeWidth="3.1" /><path d="M186,552 L181,432 L152,390 L152,358" strokeWidth="2.5" />
          </g>
          <g stroke="#ffffff" opacity=".55" strokeDasharray=".7 1.5" transform="translate(-1.1,0)">
            <path d="M113,552 L118,432 L90,162 L90,136" strokeWidth="1.1" /><path d="M138,552 L139,432 L106,236 L106,210" strokeWidth=".95" />
            <path d="M162,552 L160,432 L126,310 L126,284" strokeWidth=".8" /><path d="M186,552 L181,432 L152,390 L152,358" strokeWidth=".65" />
          </g>
        </g>

        {/* string retainer bar — painted after the strings so they pass under it */}
        <g>
          <ellipse cx="154" cy="410" rx="34" ry="9" fill="url(#b4Soft)" />
          <path d="M122,398 L184,398 L182,412 L124,412 Z" fill="#1a1d20" stroke="#000" strokeWidth=".8" />
          <path d="M122,398 L184,398 L183.6,402 L122.4,402 Z" fill="#fff" opacity=".18" />
          <circle cx="132" cy="405" r="2.4" fill="#a7aeb3" /><circle cx="174" cy="405" r="2.4" fill="#a7aeb3" />
        </g>

        <g {...peg(0)}><use href="#b4Front" x="90" y="132" /><circle cx="90" cy="132" r="23" fill="none" stroke={h(0).c} strokeWidth="3" opacity={h(0).o} strokeLinecap="round" /></g>
        <g {...peg(1)}><use href="#b4Front" x="106" y="206" /><circle cx="106" cy="206" r="23" fill="none" stroke={h(1).c} strokeWidth="3" opacity={h(1).o} strokeLinecap="round" /></g>
        <g {...peg(2)}><use href="#b4Front" x="126" y="280" /><circle cx="126" cy="280" r="23" fill="none" stroke={h(2).c} strokeWidth="3" opacity={h(2).o} strokeLinecap="round" /></g>
        <g {...peg(3)}><use href="#b4Front" x="152" y="354" /><circle cx="152" cy="354" r="23" fill="none" stroke={h(3).c} strokeWidth="3" opacity={h(3).o} strokeLinecap="round" /></g>

        <g fontFamily="'IBM Plex Mono',monospace" fontSize="13" fontWeight="500" opacity={labelOpacity}>
          <text x="117" y="137" fill="#000" opacity=".6">E</text><text x="116" y="136" fill={h(0).t}>E</text>
          <text x="133" y="211" fill="#000" opacity=".6">A</text><text x="132" y="210" fill={h(1).t}>A</text>
          <text x="153" y="285" fill="#000" opacity=".6">D</text><text x="152" y="284" fill={h(2).t}>D</text>
          <text x="179" y="359" fill="#000" opacity=".6">G</text><text x="178" y="358" fill={h(3).t}>G</text>
        </g>
      </svg>
    );
  }

  if (kind === "bass5") {
    const h = (i) => hl(i, activeIndex);
    return (
      <svg {...common} aria-label="5-string bass headstock">
        <defs>
          <linearGradient id="b5Chrome" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#3a3d40" /><stop offset=".16" stopColor="#e2e7ea" /><stop offset=".38" stopColor="#868c90" /><stop offset=".56" stopColor="#f4f7f9" /><stop offset=".8" stopColor="#565b5e" /><stop offset="1" stopColor="#212426" />
          </linearGradient>
          <linearGradient id="b5ChromeV" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f0f4f6" /><stop offset=".28" stopColor="#9aa2a7" /><stop offset=".5" stopColor="#454a4d" /><stop offset=".74" stopColor="#c4cbd0" /><stop offset="1" stopColor="#2c2f31" />
          </linearGradient>
          <radialGradient id="b5Bush" cx=".32" cy=".26" r=".88">
            <stop offset="0" stopColor="#ffffff" /><stop offset=".3" stopColor="#c9cfd4" /><stop offset=".58" stopColor="#61676b" /><stop offset=".82" stopColor="#b2b9be" /><stop offset="1" stopColor="#2a2d2f" />
          </radialGradient>
          <linearGradient id="b5Post" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#2f3234" /><stop offset=".2" stopColor="#e0e5e9" /><stop offset=".46" stopColor="#7f8488" /><stop offset=".74" stopColor="#f1f5f8" /><stop offset="1" stopColor="#25282a" />
          </linearGradient>
          <linearGradient id="b5Body" x1=".08" y1="0" x2=".92" y2="1">
            <stop offset="0" stopColor="#3d4c60" /><stop offset=".24" stopColor="#283244" /><stop offset=".58" stopColor="#171c26" /><stop offset="1" stopColor="#0b0d12" />
          </linearGradient>
          <linearGradient id="b5Board" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#17110f" /><stop offset=".4" stopColor="#38251d" /><stop offset=".72" stopColor="#221610" /><stop offset="1" stopColor="#100a07" />
          </linearGradient>
          <radialGradient id="b5Sheen" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#cfe0f6" stopOpacity=".22" /><stop offset=".55" stopColor="#cfe0f6" stopOpacity=".08" /><stop offset="1" stopColor="#cfe0f6" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="b5Fall" x1="0" y1="0" x2="1" y2=".3">
            <stop offset="0" stopColor="#000" stopOpacity="0" /><stop offset=".42" stopColor="#000" stopOpacity=".14" /><stop offset="1" stopColor="#000" stopOpacity=".66" />
          </linearGradient>
          <linearGradient id="b5Steel" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#3f4348" /><stop offset=".2" stopColor="#acb4ba" /><stop offset=".38" stopColor="#f0f4f7" /><stop offset=".58" stopColor="#8f979d" /><stop offset=".8" stopColor="#c5ccd2" /><stop offset="1" stopColor="#33373b" />
          </linearGradient>
          <radialGradient id="b5Soft" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#000" stopOpacity=".74" /><stop offset=".55" stopColor="#000" stopOpacity=".35" /><stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <clipPath id="b5Clip">
            <path d="M104,432 L82,300 L70,152 L66,106 L92,78 Q104,68 116,80 Q128,92 142,76 Q156,60 172,72 Q186,84 198,70 Q212,54 226,66 L238,96 L230,154 L214,300 L196,432 Z" />
          </clipPath>

          <path id="b5Helix" fill="none" d="M-5.4,3 Q0,5 5.4,1.9 M-5.4,1.6 Q0,3.6 5.4,0.5 M-5.4,0.2 Q0,2.2 5.4,-0.9 M-5.4,-1.2 Q0,0.8 5.4,-2.3 M-5.4,-2.6 Q0,-0.6 5.4,-3.7 M-5.4,-4 Q0,-2 5.4,-5.1 M-5.4,-5.4 Q0,-3.4 5.4,-6.5 M-5.4,-6.8 Q0,-4.8 5.4,-7.9 M-5.4,-8.2 Q0,-6.2 5.4,-9.3 M-5.4,-9.6 Q0,-7.6 5.4,-10.7 M-5.4,-11 Q0,-9 5.4,-12.1 M-5.4,-12.4 Q0,-10.4 5.4,-13.5 M-5.4,-13.8 Q0,-11.8 5.4,-14.9 M-5.4,-15.2 Q0,-13.2 5.4,-16.3 M-5.4,-16.6 Q0,-14.6 5.4,-17.7 M-5.4,-18 Q0,-16 5.4,-19.1 M-5.4,-19.4 Q0,-17.4 5.4,-20.5" />
          <g id="b5Base">
            <ellipse cx="4" cy="6" rx="26" ry="20" fill="url(#b5Soft)" />
            <path d="M0,-18 L15.6,-9 L15.6,9 L0,18 L-15.6,9 L-15.6,-9 Z" fill="url(#b5Bush)" stroke="#131517" strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M0,-18 L15.6,-9 L10.4,-6 L0,-12 L-10.4,-6 L-15.6,-9 Z" fill="#fff" opacity=".48" />
            <path d="M0,18 L15.6,9 L10.4,6 L0,12 L-10.4,6 L-15.6,9 Z" fill="#000" opacity=".4" />
            <circle r="10.8" fill="url(#b5ChromeV)" stroke="#1b1e20" strokeWidth=".9" />
            <ellipse rx="7.8" ry="3.6" fill="#0f1214" />
          </g>
          <g id="b5Front">
            <path d="M-6.4,4 L-6.4,-22 Q0,-25.4 6.4,-22 L6.4,4 Z" fill="url(#b5Post)" stroke="#191c1e" strokeWidth=".7" />
            <use href="#b5Helix" stroke="#5f666c" strokeWidth="1.6" strokeLinecap="round" />
            <use href="#b5Helix" stroke="#1b1f23" strokeWidth=".5" opacity=".6" transform="translate(0,.65)" />
            <use href="#b5Helix" stroke="#f0f4f7" strokeWidth=".55" opacity=".85" transform="translate(-.4,-.55)" />
            <ellipse cy="-22.6" rx="6.4" ry="3.1" fill="#f0f4f6" stroke="#43484b" strokeWidth=".7" />
            <ellipse cy="-22.6" rx="2.5" ry="1.3" fill="#14171a" />
          </g>
          <g id="b5BtnL">
            <rect x="-13" y="-5" width="21" height="10" rx="4.6" fill="url(#b5Chrome)" stroke="#0c0d0e" strokeWidth=".7" />
            <ellipse cx="-13" cy="0" rx="4" ry="8" fill="#cbd2d7" stroke="#1d2022" strokeWidth=".7" />
            <path d="M-16,-6 C-26,-12 -38,-22 -46,-16 C-51,-12 -47,-4 -41,0 C-47,4 -51,12 -46,16 C-38,22 -26,12 -16,6 Z" fill="url(#b5Chrome)" stroke="#0b0c0d" strokeWidth="1.1" strokeLinejoin="round" />
            <path d="M-18,-5.6 C-27,-11 -37,-18.6 -43,-14.6 C-46,-12.4 -44.6,-8.6 -41.6,-6 C-34,-7 -25,-5 -20,-2.6 Z" fill="#fff" opacity=".46" />
            <path d="M-21,5 C-29,8.6 -38,14 -43,11 C-46,9 -46,13 -44,15 C-38,20 -27,12 -19,6 Z" fill="#000" opacity=".34" />
          </g>
        </defs>

        <g>
          <use href="#b5BtnL" x="78" y="100" /><use href="#b5BtnL" x="80" y="176" /><use href="#b5BtnL" x="85" y="252" /><use href="#b5BtnL" x="96" y="328" />
          <g transform="translate(300,0) scale(-1,1)"><use href="#b5BtnL" x="85" y="214" /></g>
        </g>

        <path d="M104,438 L196,438 L204,552 L96,552 Z" fill="url(#b5Board)" />
        <path d="M104,438 L196,438 L197,460 L103,460 Z" fill="#000" opacity=".34" />
        <rect x="101" y="427" width="98" height="12" rx="1.5" fill="#1c1f26" stroke="#050607" strokeWidth=".8" />
        <rect x="101" y="427" width="98" height="3" fill="#98a0a9" opacity=".5" />

        <g>
          <path d="M104,432 L82,300 L70,152 L66,106 L92,78 Q104,68 116,80 Q128,92 142,76 Q156,60 172,72 Q186,84 198,70 Q212,54 226,66 L238,96 L230,154 L214,300 L196,432 Z" fill="url(#b5Body)" />
          <g clipPath="url(#b5Clip)">
            <g fill="url(#b5Sheen)">
              <ellipse cx="128" cy="104" rx="82" ry="40" /><ellipse cx="104" cy="228" rx="46" ry="96" />
              <ellipse cx="150" cy="360" rx="58" ry="52" /><ellipse cx="190" cy="150" rx="40" ry="70" />
            </g>
            <rect x="40" y="30" width="230" height="420" fill="url(#b5Fall)" />
            <g fill="#dbe7f6" opacity=".16">
              <ellipse cx="98" cy="176" rx="1" ry=".7" /><ellipse cx="140" cy="130" rx=".8" ry="1.1" />
              <ellipse cx="120" cy="266" rx="1.2" ry=".7" /><ellipse cx="172" cy="200" rx=".9" ry=".9" />
              <ellipse cx="150" cy="326" rx="1" ry=".6" /><ellipse cx="186" cy="296" rx=".7" ry="1" />
              <ellipse cx="110" cy="344" rx=".9" ry=".7" /><ellipse cx="204" cy="146" rx="1.1" ry=".7" />
            </g>
          </g>
          <path d="M104,432 L82,300 L70,152 L66,106 L92,78 Q104,68 116,80 Q128,92 142,76 Q156,60 172,72 Q186,84 198,70 Q212,54 226,66 L238,96 L230,154 L214,300 L196,432 Z" fill="none" stroke="#05070a" strokeWidth="1.8" />
          <path d="M104,432 L82,300 L70,152 L66,106 L92,78" fill="none" stroke="#7fa0cf" strokeWidth="1" opacity=".45" />
        </g>

        <g><use href="#b5Base" x="100" y="100" /><use href="#b5Base" x="110" y="176" /><use href="#b5Base" x="122" y="252" /><use href="#b5Base" x="140" y="328" /><use href="#b5Base" x="190" y="214" /></g>

        <g fill="none" strokeLinecap="butt">
          <g stroke="url(#b5Steel)">
            <path d="M109,552 L114,432 L100,130 L100,104" strokeWidth="4.6" /><path d="M132,552 L134,432 L110,206 L110,180" strokeWidth="3.9" />
            <path d="M154,552 L154,432 L122,282 L122,256" strokeWidth="3.2" /><path d="M177,552 L174,432 L140,358 L140,332" strokeWidth="2.7" />
            <path d="M195,552 L190,432 L190,218" strokeWidth="2.2" />
          </g>
          <g stroke="#1c2126" opacity=".62" strokeDasharray=".7 1.5">
            <path d="M109,552 L114,432 L100,130 L100,104" strokeWidth="4.6" /><path d="M132,552 L134,432 L110,206 L110,180" strokeWidth="3.9" />
            <path d="M154,552 L154,432 L122,282 L122,256" strokeWidth="3.2" /><path d="M177,552 L174,432 L140,358 L140,332" strokeWidth="2.7" />
            <path d="M195,552 L190,432 L190,218" strokeWidth="2.2" />
          </g>
          <g stroke="#ffffff" opacity=".55" strokeDasharray=".7 1.5" transform="translate(-1.15,0)">
            <path d="M109,552 L114,432 L100,130 L100,104" strokeWidth="1.15" /><path d="M132,552 L134,432 L110,206 L110,180" strokeWidth="1" />
            <path d="M154,552 L154,432 L122,282 L122,256" strokeWidth=".8" /><path d="M177,552 L174,432 L140,358 L140,332" strokeWidth=".7" />
            <path d="M195,552 L190,432 L190,218" strokeWidth=".55" />
          </g>
        </g>

        {/* string retainer — painted after the strings so they pass under it */}
        <g>
          <ellipse cx="154" cy="410" rx="24" ry="8" fill="url(#b5Soft)" />
          <path d="M136,392 L172,392 Q176,404 168,412 L140,412 Q132,404 136,392 Z" fill="#0d0f13" stroke="#000" strokeWidth=".8" />
          <path d="M136,392 L172,392 L171,397 L136.6,397 Z" fill="#fff" opacity=".16" />
          <circle cx="154" cy="400" r="2.4" fill="#a7aeb3" />
        </g>

        <g {...peg(0)}><use href="#b5Front" x="100" y="100" /><circle cx="100" cy="100" r="22" fill="none" stroke={h(0).c} strokeWidth="3" opacity={h(0).o} strokeLinecap="round" /></g>
        <g {...peg(1)}><use href="#b5Front" x="110" y="176" /><circle cx="110" cy="176" r="22" fill="none" stroke={h(1).c} strokeWidth="3" opacity={h(1).o} strokeLinecap="round" /></g>
        <g {...peg(2)}><use href="#b5Front" x="122" y="252" /><circle cx="122" cy="252" r="22" fill="none" stroke={h(2).c} strokeWidth="3" opacity={h(2).o} strokeLinecap="round" /></g>
        <g {...peg(3)}><use href="#b5Front" x="140" y="328" /><circle cx="140" cy="328" r="22" fill="none" stroke={h(3).c} strokeWidth="3" opacity={h(3).o} strokeLinecap="round" /></g>
        <g {...peg(4)}><use href="#b5Front" x="190" y="214" /><circle cx="190" cy="214" r="22" fill="none" stroke={h(4).c} strokeWidth="3" opacity={h(4).o} strokeLinecap="round" /></g>

        <g fontFamily="'IBM Plex Mono',monospace" fontSize="13" fontWeight="500" opacity={labelOpacity}>
          <text x="127" y="105" fill="#000" opacity=".6">B</text><text x="126" y="104" fill={h(0).t}>B</text>
          <text x="137" y="181" fill="#000" opacity=".6">E</text><text x="136" y="180" fill={h(1).t}>E</text>
          <text x="149" y="257" fill="#000" opacity=".6">A</text><text x="148" y="256" fill={h(2).t}>A</text>
          <text x="167" y="333" fill="#000" opacity=".6">D</text><text x="166" y="332" fill={h(3).t}>D</text>
          <text x="167" y="219" fill="#000" opacity=".6" textAnchor="end">G</text><text x="166" y="218" fill={h(4).t} textAnchor="end">G</text>
        </g>
      </svg>
    );
  }

  /* ---- guitar, 3+3 ----
     Treble posts corrected relative to the design file: G3 now takes the
     top post (y=120) and E4 the bottom one (y=310), so the high E sits
     nearest the nut opposite D3. The three treble strings keep their
     original nut slots (159 / 178 / 197) and board-edge x — see the
     header note for why that is the only non-crossing assignment — and
     each still runs straight up its lane before one short lateral move
     into its post. */
  const h = (i) => hl(i, activeIndex);
  return (
    <svg {...common} aria-label="guitar headstock">
      <defs>
        <linearGradient id="gcChrome" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#4a4d50" /><stop offset=".18" stopColor="#e8ecef" /><stop offset=".4" stopColor="#9aa1a6" /><stop offset=".56" stopColor="#f6f8fa" /><stop offset=".78" stopColor="#6d7276" /><stop offset="1" stopColor="#2f3234" />
        </linearGradient>
        <linearGradient id="gcChromeV" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4f7f9" /><stop offset=".3" stopColor="#aab1b6" /><stop offset=".52" stopColor="#585d61" /><stop offset=".72" stopColor="#cdd3d7" /><stop offset="1" stopColor="#3a3d40" />
        </linearGradient>
        <radialGradient id="gcBush" cx=".34" cy=".28" r=".85">
          <stop offset="0" stopColor="#fdfefe" /><stop offset=".34" stopColor="#c3c9cd" /><stop offset=".64" stopColor="#6e7478" /><stop offset=".86" stopColor="#a9b0b4" /><stop offset="1" stopColor="#33373a" />
        </radialGradient>
        <linearGradient id="gcPost" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3c3f42" /><stop offset=".22" stopColor="#d5dadd" /><stop offset=".5" stopColor="#8b9195" /><stop offset=".76" stopColor="#e3e8eb" /><stop offset="1" stopColor="#2b2e30" />
        </linearGradient>
        <linearGradient id="gcWood" x1=".1" y1="0" x2=".92" y2="1">
          <stop offset="0" stopColor="#9c5a29" /><stop offset=".3" stopColor="#7d411c" /><stop offset=".62" stopColor="#5e2f14" /><stop offset="1" stopColor="#3d1d0d" />
        </linearGradient>
        <linearGradient id="gcBoard" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#241610" /><stop offset=".38" stopColor="#4a2f20" /><stop offset=".7" stopColor="#2e1c13" /><stop offset="1" stopColor="#160d08" />
        </linearGradient>
        <linearGradient id="gcNut" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4ead2" /><stop offset=".5" stopColor="#d9c9a6" /><stop offset="1" stopColor="#9d8a68" />
        </linearGradient>
        <radialGradient id="gcSheen" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#f7c894" stopOpacity=".26" /><stop offset=".6" stopColor="#f0b273" stopOpacity=".1" /><stop offset="1" stopColor="#f0b273" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="gcDark" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#200d04" stopOpacity=".3" /><stop offset="1" stopColor="#200d04" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="gcBronze" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#4a3a24" /><stop offset=".26" stopColor="#d8b478" /><stop offset=".52" stopColor="#8a6f45" /><stop offset=".74" stopColor="#e2c28c" /><stop offset="1" stopColor="#3c2e1c" />
        </linearGradient>
        <radialGradient id="gcSoft" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#000" stopOpacity=".62" /><stop offset=".55" stopColor="#000" stopOpacity=".3" /><stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <clipPath id="gcHeadClip">
          <path d="M97,432 C88,330 70,180 68,84 Q70,66 88,60 L122,50 Q140,45 150,34 Q160,45 178,50 L212,60 Q230,66 232,84 C230,180 212,330 203,432 Z" />
        </clipPath>

        {/* small guitar tuner: base under the string, front (post + wrap) over it */}
        <path id="gcHelix" fill="none" d="M-2.9,1.4 Q0,2.7 2.9,0.7 M-2.9,0.2 Q0,1.5 2.9,-0.5 M-2.9,-1 Q0,.3 2.9,-1.7 M-2.9,-2.2 Q0,-0.9 2.9,-2.9 M-2.9,-3.4 Q0,-2.1 2.9,-4.1 M-2.9,-4.6 Q0,-3.3 2.9,-5.3 M-2.9,-5.8 Q0,-4.5 2.9,-6.5 M-2.9,-7 Q0,-5.7 2.9,-7.7 M-2.9,-8.2 Q0,-6.9 2.9,-8.9 M-2.9,-9.4 Q0,-8.1 2.9,-10.1 M-2.9,-10.6 Q0,-9.3 2.9,-11.3 M-2.9,-11.8 Q0,-10.5 2.9,-12.5" />
        <g id="gcBase">
          <ellipse cx="2.6" cy="4" rx="15" ry="12" fill="url(#gcSoft)" />
          <circle r="10.2" fill="url(#gcBush)" stroke="#1e2123" strokeWidth=".9" />
          <circle r="10.2" fill="none" stroke="#ffffff" strokeWidth=".7" opacity=".45" strokeDasharray="9 22" transform="rotate(-40)" />
          <circle r="6.6" fill="url(#gcChromeV)" stroke="#26292b" strokeWidth=".6" />
          <ellipse rx="4.6" ry="1.9" fill="#14171a" />
        </g>
        <g id="gcFront">
          <path d="M-3.5,2 L-3.5,-14 Q0,-16.6 3.5,-14 L3.5,2 Z" fill="url(#gcPost)" />
          <use href="#gcHelix" stroke="#8a7048" strokeWidth="1" strokeLinecap="round" />
          <use href="#gcHelix" stroke="#2b2114" strokeWidth=".32" opacity=".6" transform="translate(0,.4)" />
          <use href="#gcHelix" stroke="#e8cb99" strokeWidth=".34" opacity=".85" transform="translate(-.25,-.35)" />
          <ellipse cy="-14.4" rx="3.5" ry="1.9" fill="#e6ebee" stroke="#4c5154" strokeWidth=".5" />
          <ellipse cy="-14.4" rx="1.4" ry=".8" fill="#1b1e20" />
        </g>
        {/* back button, extends to the LEFT of origin */}
        <g id="gcBtnL">
          <rect x="-8" y="-3.6" width="14" height="7.2" rx="3.4" fill="url(#gcChrome)" stroke="#0e0f10" strokeWidth=".6" />
          <ellipse cx="-8" cy="0" rx="2.6" ry="5" fill="#cfd5d9" stroke="#26292b" strokeWidth=".6" />
          <path d="M-10,-10.5 L-24,-13.5 L-33,-6 L-33,6 L-24,13.5 L-10,10.5 Z" fill="url(#gcChrome)" stroke="#0d0e0f" strokeWidth=".9" strokeLinejoin="round" />
          <path d="M-11,-9 L-23.5,-11.6 L-30,-5.4 L-19,-3.6 Z" fill="#ffffff" opacity=".42" />
          <path d="M-13,9.4 L-24,11.8 L-31,5.6 L-20,4 Z" fill="#000" opacity=".28" />
        </g>
      </defs>

      {/* back buttons (occluded by the head) */}
      <g>
        <use href="#gcBtnL" x="78" y="120" /><use href="#gcBtnL" x="83" y="215" /><use href="#gcBtnL" x="92" y="310" />
        <g transform="translate(300,0) scale(-1,1)"><use href="#gcBtnL" x="78" y="120" /><use href="#gcBtnL" x="83" y="215" /><use href="#gcBtnL" x="92" y="310" /></g>
      </g>

      {/* fretboard + nut */}
      <path d="M96,438 L204,438 L214,552 L86,552 Z" fill="url(#gcBoard)" />
      <path d="M96,438 L204,438 L206,462 L94,462 Z" fill="#000" opacity=".3" />
      <rect x="93" y="428" width="114" height="12" rx="2" fill="url(#gcNut)" stroke="#6d5c40" strokeWidth=".7" />
      <rect x="93" y="428" width="114" height="3.4" fill="#fffaf0" opacity=".55" />

      {/* headstock body */}
      <g>
        <path d="M97,432 C88,330 70,180 68,84 Q70,66 88,60 L122,50 Q140,45 150,34 Q160,45 178,50 L212,60 Q230,66 232,84 C230,180 212,330 203,432 Z" fill="url(#gcWood)" />
        <g clipPath="url(#gcHeadClip)">
          <g fill="url(#gcSheen)">
            <ellipse cx="140" cy="72" rx="104" ry="17" /><ellipse cx="162" cy="128" rx="96" ry="11" />
            <ellipse cx="132" cy="196" rx="100" ry="14" /><ellipse cx="158" cy="268" rx="92" ry="9" />
            <ellipse cx="142" cy="330" rx="88" ry="15" /><ellipse cx="150" cy="400" rx="80" ry="10" />
          </g>
          <g fill="url(#gcDark)">
            <ellipse cx="150" cy="100" rx="98" ry="9" /><ellipse cx="138" cy="232" rx="94" ry="8" />
            <ellipse cx="160" cy="298" rx="88" ry="11" /><ellipse cx="146" cy="366" rx="84" ry="8" />
          </g>
          <g stroke="#2a1408" fill="none" strokeLinecap="round">
            <path d="M74,30 C72,150 76,300 79,450" strokeWidth=".9" opacity=".38" />
            <path d="M81,30 C79,150 83,300 85,450" strokeWidth=".45" opacity=".2" />
            <path d="M89,30 C88,150 90,300 93,450" strokeWidth=".7" opacity=".3" />
            <path d="M97,30 C97,150 98,300 100,450" strokeWidth="1.1" opacity=".34" />
            <path d="M101,30 C101,150 102,300 104,450" strokeWidth=".4" opacity=".18" />
            <path d="M110,30 C110,150 111,300 112,450" strokeWidth=".8" opacity=".3" />
            <path d="M119,30 C119,150 120,300 121,450" strokeWidth=".5" opacity=".22" />
            <path d="M124,30 C125,150 126,300 126,450" strokeWidth="1" opacity=".28" />
            <path d="M133,30 C134,150 134,300 134,450" strokeWidth=".45" opacity=".2" />
            <path d="M141,30 C142,150 142,300 142,450" strokeWidth=".85" opacity=".3" />
            <path d="M146,30 C147,150 147,300 147,450" strokeWidth=".4" opacity=".16" />
            <path d="M155,30 C156,150 156,300 155,450" strokeWidth=".95" opacity=".3" />
            <path d="M164,30 C165,150 164,300 163,450" strokeWidth=".5" opacity=".22" />
            <path d="M169,30 C170,150 169,300 168,450" strokeWidth=".75" opacity=".26" />
            <path d="M178,30 C179,150 178,300 176,450" strokeWidth="1.05" opacity=".32" />
            <path d="M183,30 C184,150 183,300 181,450" strokeWidth=".4" opacity=".18" />
            <path d="M192,30 C193,150 191,300 189,450" strokeWidth=".8" opacity=".3" />
            <path d="M201,30 C202,150 200,300 197,450" strokeWidth=".55" opacity=".24" />
            <path d="M206,30 C207,150 205,300 202,450" strokeWidth=".95" opacity=".3" />
            <path d="M215,30 C216,150 213,300 210,450" strokeWidth=".45" opacity=".2" />
            <path d="M223,30 C224,150 221,300 217,450" strokeWidth=".85" opacity=".34" />
            <path d="M231,30 C232,150 228,300 224,450" strokeWidth=".6" opacity=".26" />
          </g>
          <g stroke="#d69657" fill="none" opacity=".22" strokeLinecap="round">
            <path d="M86,30 C85,150 87,300 89,450" strokeWidth=".4" />
            <path d="M114,30 C114,150 115,300 116,450" strokeWidth=".35" />
            <path d="M150,30 C151,150 151,300 150,450" strokeWidth=".4" />
            <path d="M187,30 C188,150 186,300 184,450" strokeWidth=".35" />
            <path d="M218,30 C219,150 216,300 212,450" strokeWidth=".4" />
          </g>
          <path d="M97,432 C88,330 70,180 68,84 L94,80 C90,190 106,330 113,432 Z" fill="#fff" opacity=".08" />
          <path d="M203,432 C212,330 230,180 232,84 L210,80 C210,190 196,330 187,432 Z" fill="#000" opacity=".34" />
          <path d="M150,34 C122,120 120,280 124,432 L138,432 C132,280 136,120 154,36 Z" fill="#fff" opacity=".05" />
          <ellipse cx="150" cy="66" rx="118" ry="46" fill="#fff" opacity=".09" />
        </g>
        <path d="M97,432 C88,330 70,180 68,84 Q70,66 88,60 L122,50 Q140,45 150,34 Q160,45 178,50 L212,60 Q230,66 232,84 C230,180 212,330 203,432 Z" fill="none" stroke="#1c0c05" strokeWidth="2.4" />
        <path d="M97,432 C88,330 70,180 68,84 Q70,66 88,60 L122,50 Q140,45 150,34" fill="none" stroke="#e5a768" strokeWidth="1.1" opacity=".5" />
      </g>

      {/* truss rod cover */}
      <path d="M136,352 L164,352 L168,404 Q150,410 132,404 Z" fill="#15100c" stroke="#000" strokeWidth=".8" />
      <path d="M136,352 L164,352 L165,362 L135,362 Z" fill="#fff" opacity=".08" />
      <circle cx="150" cy="360" r="2.6" fill="#8c9297" /><circle cx="140" cy="399" r="2.2" fill="#8c9297" /><circle cx="160" cy="399" r="2.2" fill="#8c9297" />

      <g><use href="#gcBase" x="96" y="120" /><use href="#gcBase" x="106" y="215" /><use href="#gcBase" x="118" y="310" /><use href="#gcBase" x="182" y="120" /><use href="#gcBase" x="194" y="215" /><use href="#gcBase" x="204" y="310" /></g>

      {/* strings: nut -> lane -> post.
          Bass side unchanged. Treble side re-routed for the swapped
          posts: G3 (nut 159) now climbs to the top post at (182,120),
          B3 (nut 178) keeps the middle post, and E4 (nut 197) makes a
          short hop into the bottom post at (204,310). */}
      <g fill="none" strokeLinecap="butt">
        <g stroke="url(#gcBronze)">
          <path d="M103,552 L108,432 L96,152 L96,126" strokeWidth="2.7" /><path d="M122,552 L125,432 L106,247 L106,221" strokeWidth="2.3" />
          <path d="M141,552 L142,432 L118,342 L118,316" strokeWidth="1.95" /><path d="M159,552 L158,432 L182,152 L182,126" strokeWidth="1.6" />
        </g>
        <g stroke="#2b2114" opacity=".5" strokeDasharray=".65 1.3">
          <path d="M103,552 L108,432 L96,152 L96,126" strokeWidth="2.7" /><path d="M122,552 L125,432 L106,247 L106,221" strokeWidth="2.3" />
          <path d="M141,552 L142,432 L118,342 L118,316" strokeWidth="1.95" /><path d="M159,552 L158,432 L182,152 L182,126" strokeWidth="1.6" />
        </g>
        <g stroke="#f6e3bc" opacity=".45" strokeDasharray=".65 1.3" transform="translate(-.6,0)">
          <path d="M103,552 L108,432 L96,152 L96,126" strokeWidth=".7" /><path d="M122,552 L125,432 L106,247 L106,221" strokeWidth=".6" />
          <path d="M141,552 L142,432 L118,342 L118,316" strokeWidth=".5" /><path d="M159,552 L158,432 L182,152 L182,126" strokeWidth=".45" />
        </g>
        <g stroke="url(#gcPost)"><path d="M178,552 L175,432 L194,247 L194,221" strokeWidth="1.15" /><path d="M197,552 L192,432 L204,342 L204,316" strokeWidth=".9" /></g>
        <g stroke="#ffffff" opacity=".5" transform="translate(-.3,0)"><path d="M178,552 L175,432 L194,247 L194,221" strokeWidth=".35" /><path d="M197,552 L192,432 L204,342 L204,316" strokeWidth=".3" /></g>
      </g>

      {/* pegs */}
      <g {...peg(0)}><use href="#gcFront" x="96" y="120" /><circle cx="96" cy="120" r="14.5" fill="none" stroke={h(0).c} strokeWidth="2.6" opacity={h(0).o} strokeLinecap="round" /></g>
      <g {...peg(1)}><use href="#gcFront" x="106" y="215" /><circle cx="106" cy="215" r="14.5" fill="none" stroke={h(1).c} strokeWidth="2.6" opacity={h(1).o} strokeLinecap="round" /></g>
      <g {...peg(2)}><use href="#gcFront" x="118" y="310" /><circle cx="118" cy="310" r="14.5" fill="none" stroke={h(2).c} strokeWidth="2.6" opacity={h(2).o} strokeLinecap="round" /></g>
      <g {...peg(3)}><use href="#gcFront" x="182" y="120" /><circle cx="182" cy="120" r="14.5" fill="none" stroke={h(3).c} strokeWidth="2.6" opacity={h(3).o} strokeLinecap="round" /></g>
      <g {...peg(4)}><use href="#gcFront" x="194" y="215" /><circle cx="194" cy="215" r="14.5" fill="none" stroke={h(4).c} strokeWidth="2.6" opacity={h(4).o} strokeLinecap="round" /></g>
      <g {...peg(5)}><use href="#gcFront" x="204" y="310" /><circle cx="204" cy="310" r="14.5" fill="none" stroke={h(5).c} strokeWidth="2.6" opacity={h(5).o} strokeLinecap="round" /></g>

      {/* note labels, inlaid — each moved with its post */}
      <g fontFamily="'IBM Plex Mono',monospace" fontSize="12.5" fontWeight="500" opacity={labelOpacity}>
        <text x="115" y="125" fill="#000" opacity=".5">E</text><text x="114" y="124" fill={h(0).t}>E</text>
        <text x="125" y="220" fill="#000" opacity=".5">A</text><text x="124" y="219" fill={h(1).t}>A</text>
        <text x="133" y="300" fill="#000" opacity=".5">D</text><text x="132" y="299" fill={h(2).t}>D</text>
        <text x="164" y="125" fill="#000" opacity=".5" textAnchor="end">G</text><text x="163" y="124" fill={h(3).t} textAnchor="end">G</text>
        <text x="176" y="220" fill="#000" opacity=".5" textAnchor="end">B</text><text x="175" y="219" fill={h(4).t} textAnchor="end">B</text>
        <text x="186" y="315" fill="#000" opacity=".5" textAnchor="end">E</text><text x="185" y="314" fill={h(5).t} textAnchor="end">E</text>
      </g>
    </svg>
  );
}
