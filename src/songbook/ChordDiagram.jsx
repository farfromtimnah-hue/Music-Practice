// ============================================================
// CHORD DIAGRAM — a plain fretboard for the general chord popup.
//
// Sibling to CutCapoDiagram, which always draws the partial capo and windows
// the neck around it. This one draws the ordinary case: an optional FULL capo
// barre and nothing else, windowed to the frets the shape actually uses.
//
// Same orientation and visual language as CutCapoDiagram so the two popups
// read as one feature: horizontal neck, low E on top, nut on the left.
//
// `shape` frets are measured from the EFFECTIVE NUT — the full capo when one
// is on, the real nut otherwise. `capo` says how far up the neck that is, so
// fret numbers are printed ABSOLUTELY (what Nicole reads off her own neck)
// while the shape stays in engine coordinates.
//
// TUNING SOURCE — this must come from src/openvoicings/, NOT src/cutcapo/.
// The cut-capo tuning module has the partial capo baked into its geometry: its
// noteAtFret() returns null for any fret at or below fret 2 on the A, D and G
// strings, because in that engine those strings are permanently behind the
// capo. Ask it for the notes of an open A chord (x 0 2 2 2 0) and three of the
// five notes come back null and silently vanish from the diagram. The
// open-voicings tuning is the plain standard-tuning neck this popup needs.
// Both modules are imported, never modified.
// ============================================================
import { STRINGS, NUM_STRINGS, noteAtFret, CHROMA } from "../openvoicings/tuning.js";

const STRING_GAP = 22;
const FRET_GAP = 34;
const MARGIN_TOP = 24;
const MARGIN_LEFT = 30;
const MARGIN_RIGHT = 10;
const MARGIN_BOTTOM = 14;
const SINGLE_INLAYS = [3, 5, 7, 9, 12];

// Window the board around the shape. Frets are ABSOLUTE (real nut = 0). The
// window opens at the capo (or nut) and runs past the highest fingered note,
// with a floor of four frets so a wholly-open chord still looks like a neck.
const windowFor = (shape, capo) => {
  const fretted = shape.filter((f) => f != null && f > 0).map((f) => f + capo);
  const first = Math.max(1, capo + 1 - (capo > 0 ? 1 : 0));
  const need = fretted.length ? Math.max(...fretted) + 1 : first + 3;
  return { first, last: Math.min(Math.max(need, first + 3), 15) };
};

export default function ChordDiagram({ shape, showNotes = true, capo = 0, barre = 0 }) {
  const { first, last } = windowFor(shape, capo);
  const absFret = (f) => f + capo;
  const count = last - first + 1;
  const stringY = (s) => MARGIN_TOP + s * STRING_GAP;
  const nutX = MARGIN_LEFT;
  const fretLineX = (f) => nutX + (f - first + 1) * FRET_GAP;
  const noteX = (f) => (f === 0 ? nutX - 15 : nutX + (f - first + 0.5) * FRET_GAP);
  const boardW = nutX + count * FRET_GAP + MARGIN_RIGHT;
  const boardH = MARGIN_TOP + (NUM_STRINGS - 1) * STRING_GAP + MARGIN_BOTTOM;
  const boardTop = stringY(0) - 10;
  const boardBot = stringY(5) + 10;
  const inlayY = (stringY(2) + stringY(3)) / 2;
  const uid = "cd" + shape.map((f) => (f == null ? "x" : f)).join("") + "c" + capo;

  // A barre finger is drawn only when the shape really has one: the same fret
  // held across the lowest sounding string and at least one more.
  const barreAbs = barre > 0 ? barre + capo : 0;
  const barreStrings = barreAbs
    ? STRINGS.map((_, s) => s).filter((s) => shape[s] === barre)
    : [];
  const showBarre = barreStrings.length >= 2;

  return (
    <svg viewBox={`0 0 ${boardW} ${boardH}`} style={{ width: "100%", maxWidth: boardW, height: "auto" }}
      role="img" aria-label={"Chord shape " + shape.map((f) => (f == null ? "x" : f)).join(" ")}>
      <defs>
        <linearGradient id={"sbW" + uid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a3a22" />
          <stop offset="0.5" stopColor="#3a2416" />
          <stop offset="1" stopColor="#2a1810" />
        </linearGradient>
      </defs>

      {Array.from({ length: count }, (_, i) => first + i).map((f) => (
        <text key={"fn" + f} x={noteX(f)} y={boardTop - 5} textAnchor="middle" fontSize="8"
          fill="#8888aa" fontFamily="Oswald,sans-serif">{f}</text>
      ))}

      <rect x={nutX} y={boardTop} width={fretLineX(last) - nutX} height={boardBot - boardTop}
        rx="3" fill={`url(#sbW${uid})`} stroke="#1c1009" strokeWidth="1.2" />

      {SINGLE_INLAYS.filter((f) => f >= first && f <= last).map((f) => (
        <circle key={"in" + f} cx={noteX(f)} cy={inlayY} r="4" fill="#f0ead6" opacity="0.8" />
      ))}

      {Array.from({ length: count }, (_, i) => first + i).map((f) => (
        <line key={"fr" + f} x1={fretLineX(f)} y1={boardTop} x2={fretLineX(f)} y2={boardBot}
          stroke="#c4c4cc" strokeWidth="2" />
      ))}
      <rect x={nutX - 4} y={boardTop} width="5" height={boardBot - boardTop} rx="1.2" fill="#e8dcc0" />

      {/* full capo — barre across all six strings */}
      {capo > 0 && capo >= first && (() => {
        const cx = noteX(capo);
        const y0 = stringY(0) - 9, y5 = stringY(5) + 9;
        return (
          <g>
            <rect x={cx - 6.5} y={y0} width="13" height={y5 - y0} rx="5"
              fill="#3b2f46" stroke="#0d0f13" strokeWidth="1.2" />
            <circle cx={cx} cy={y0} r="3.6" fill="#141821" stroke="#6a5a7a" strokeWidth="1" />
            <circle cx={cx} cy={y5} r="3.6" fill="#141821" stroke="#6a5a7a" strokeWidth="1" />
          </g>
        );
      })()}

      {STRINGS.map((st, s) => (
        <line key={"str" + s} x1={nutX - 4} y1={stringY(s)} x2={fretLineX(last)} y2={stringY(s)}
          stroke="#cfcfd8" strokeWidth={Math.max(1.1, st.w * 0.72)} strokeLinecap="round" />
      ))}

      {/* the index-finger barre of a movable shape, drawn behind the dots */}
      {showBarre && (() => {
        const cx = noteX(barreAbs);
        const y0 = stringY(Math.min(...barreStrings)) - 8;
        const y1 = stringY(Math.max(...barreStrings)) + 8;
        return <rect x={cx - 7} y={y0} width="14" height={y1 - y0} rx="6"
          fill="#c9a24a" opacity="0.55" stroke="#1a1208" strokeWidth="1" />;
      })()}

      {/* fingered notes */}
      {STRINGS.map((st, s) => {
        const f = shape[s];
        if (f == null || f === 0) return null;
        const n = noteAtFret(s, f);
        if (n == null) return null;
        return (
          <g key={"dot" + s}>
            <circle cx={noteX(absFret(f))} cy={stringY(s)} r="8.5" fill="#f0c040" stroke="#1a1208" strokeWidth="1" />
            {showNotes && (
              <text x={noteX(absFret(f))} y={stringY(s) + 3} textAnchor="middle" fontSize="9"
                fontWeight="700" fontFamily="Oswald,sans-serif" fill="#1a1208">{CHROMA[(n + capo) % 12]}</text>
            )}
          </g>
        );
      })}

      {/* left-of-nut markers: open strings and mutes */}
      {STRINGS.map((st, s) => {
        const f = shape[s];
        const y = stringY(s);
        if (f == null) {
          return <text key={"m" + s} x={noteX(0)} y={y + 4} textAnchor="middle" fontSize="11"
            fontWeight="700" fill="#ef5350">✕</text>;
        }
        if (f === 0) {
          const n = noteAtFret(s, 0);
          return (
            <g key={"m" + s}>
              <circle cx={noteX(0)} cy={y} r="6.5" fill="none" stroke="#81c784" strokeWidth="2" />
              {showNotes && (
                <text x={noteX(0)} y={y + 2.8} textAnchor="middle" fontSize="7"
                  fontFamily="Oswald,sans-serif" fill="#81c784">{CHROMA[(n + capo) % 12]}</text>
              )}
            </g>
          );
        }
        return null;
      })}
    </svg>
  );
}
