// ============================================================
// CUT CAPO DIAGRAM — songbook rendering only.
//
// A compact read-only fretboard for the chord popup, drawn the same way
// CutCapoStudio draws its board (horizontal neck, low E on top, nut on the
// left) but windowed to the frets a single shape actually uses, so it stays
// legible on a phone propped on a music stand.
//
// `shape` frets are measured from the EFFECTIVE NUT — the full capo when one
// is on, the real nut otherwise. `capo` says how far up the neck that is, so
// fret numbers can be printed absolutely (what Nicole reads off her own neck)
// while the shape itself stays in the engine's coordinates. The full capo is
// drawn as a barre across all six strings; the cut capo as a partial barre two
// frets above it, on the A, D and G strings only.
//
// src/cutcapo/ is imported, never modified.
// ============================================================
import { STRINGS, NUM_STRINGS, CAPO_FRET, noteAtFret, CHROMA, isCapoed } from "../cutcapo/tuning.js";

const STRING_GAP = 22;
const FRET_GAP = 34;
const MARGIN_TOP = 20;
const MARGIN_LEFT = 30;
const MARGIN_RIGHT = 10;
const MARGIN_BOTTOM = 10;
const SINGLE_INLAYS = [3, 5, 7, 9, 12];

// Window the board so the shape fits. Frets here are ABSOLUTE (nut = 0). The
// window starts at the full capo (or the nut) and runs far enough to cover the
// cut capo and the highest fingered note.
const windowFor = (shape, capo, cut, minFrets) => {
  const fretted = shape.filter((f) => f != null && f > 0).map((f) => f + capo);
  const need = Math.max(
    capo + CAPO_FRET + 1,
    cut ? capo + CAPO_FRET + 1 : 0,
    fretted.length ? Math.max(...fretted) + 1 : 0
  );
  const first = Math.max(1, capo + 1 - (capo > 0 ? 1 : 0));
  // Editing needs somewhere to put a finger, so the board stays wide even when
  // the current shape is all open.
  const span = Math.max(3, (minFrets || 0) - 1);
  return { first, last: Math.min(Math.max(need, first + span), 14) };
};

/**
 * `interactive` turns the board into the shape editor: tapping a fret cell
 * toggles that string to it, and the markers left of the nut cycle a string
 * between ringing open and muted. Frets behind the cut capo are not offered on
 * the capoed strings — the capo mutes them on a real guitar, so they are not
 * hers to choose. Teacher-only; the read-only board is unchanged without it.
 */
export default function CutCapoDiagram({
  shape, showNotes = true, capo = 0, cut = true,
  interactive = false, onChange,
}) {
  const { first, last } = windowFor(shape, capo, cut, interactive ? 7 : 0);
  const cutAbs = capo + CAPO_FRET;   // where the cut capo physically sits
  const absFret = (f) => f + capo;   // engine fret -> absolute fret
  const count = last - first + 1;
  const stringY = (s) => MARGIN_TOP + s * STRING_GAP;
  const nutX = MARGIN_LEFT;
  const fretLineX = (f) => nutX + (f - first + 1) * FRET_GAP;
  // x for an ABSOLUTE fret; 0 means the open/ringing marker left of the nut
  const noteX = (f) => (f === 0 ? nutX - 15 : nutX + (f - first + 0.5) * FRET_GAP);
  const boardW = nutX + count * FRET_GAP + MARGIN_RIGHT;
  const boardH = MARGIN_TOP + (NUM_STRINGS - 1) * STRING_GAP + MARGIN_BOTTOM;
  const boardTop = stringY(0) - 10;
  const boardBot = stringY(5) + 10;
  const inlayY = (stringY(2) + stringY(3)) / 2;
  const uid = shape.map((f) => (f == null ? "x" : f)).join("");

  return (
    <svg viewBox={`0 0 ${boardW} ${boardH}`}
      style={{ width: "100%", maxWidth: boardW, height: "auto", touchAction: "manipulation" }}
      role={interactive ? "group" : "img"}
      aria-label={interactive ? "Edit cut capo shape" : "Cut capo shape " + uid}>
      <defs>
        <linearGradient id={"sbWood" + uid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a3a22" />
          <stop offset="0.5" stopColor="#3a2416" />
          <stop offset="1" stopColor="#2a1810" />
        </linearGradient>
      </defs>

      {/* fret numbers */}
      {Array.from({ length: count }, (_, i) => first + i).map((f) => (
        <text key={"fn" + f} x={noteX(f)} y={boardTop - 5} textAnchor="middle" fontSize="8"
          fill="#8888aa" fontFamily="Oswald,sans-serif">{f}</text>
      ))}

      <rect x={nutX} y={boardTop} width={fretLineX(last) - nutX} height={boardBot - boardTop}
        rx="3" fill={`url(#sbWood${uid})`} stroke="#1c1009" strokeWidth="1.2" />

      {SINGLE_INLAYS.filter((f) => f >= first && f <= last).map((f) => (
        <circle key={"in" + f} cx={noteX(f)} cy={inlayY} r="4" fill="#f0ead6" opacity="0.8" />
      ))}

      {Array.from({ length: count }, (_, i) => first + i).map((f) => (
        <line key={"fr" + f} x1={fretLineX(f)} y1={boardTop} x2={fretLineX(f)} y2={boardBot}
          stroke="#c4c4cc" strokeWidth="2" />
      ))}
      <rect x={nutX - 4} y={boardTop} width="5" height={boardBot - boardTop} rx="1.2" fill="#e8dcc0" />

      {/* full capo — barre across ALL six strings at its fret */}
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

      {/* cut capo — partial barre two frets above, A, D and G rows only */}
      {cut && (() => {
        const cy1 = stringY(1) - 9, cy3 = stringY(3) + 9, cx = noteX(cutAbs);
        return (
          <g>
            <rect x={cx - 6} y={cy1} width="12" height={cy3 - cy1} rx="5"
              fill="#20242c" stroke="#0d0f13" strokeWidth="1.2" />
            <circle cx={cx} cy={cy1} r="3.6" fill="#141821" stroke="#3a4150" strokeWidth="1" />
            <circle cx={cx} cy={cy3} r="3.6" fill="#141821" stroke="#3a4150" strokeWidth="1" />
          </g>
        );
      })()}

      {STRINGS.map((st, s) => (
        <line key={"str" + s} x1={nutX - 4} y1={stringY(s)} x2={fretLineX(last)} y2={stringY(s)}
          stroke="#cfcfd8" strokeWidth={Math.max(1.1, st.w * 0.72)} strokeLinecap="round" />
      ))}

      {/* tap targets — one cell per playable position, drawn under the dots so
          the dots stay crisp. A cell that is already fingered clears itself. */}
      {interactive && STRINGS.map((st, s) =>
        Array.from({ length: count }, (_, i) => first + i).map((abs) => {
          const f = abs - capo;                       // absolute -> engine fret
          if (f <= 0) return null;                    // open is the nut marker
          if (isCapoed(s) && f <= CAPO_FRET) return null; // behind the cut capo
          if (noteAtFret(s, f) == null) return null;
          return (
            <rect key={"tap" + s + "-" + abs}
              x={noteX(abs) - FRET_GAP / 2} y={stringY(s) - STRING_GAP / 2}
              width={FRET_GAP} height={STRING_GAP}
              fill="transparent" style={{ cursor: "pointer" }}
              onClick={(e) => {
                e.stopPropagation();
                onChange(shape.map((cur, i) => (i === s ? (cur === f ? null : f) : cur)));
              }}>
              <title>{`String ${st.short}, fret ${abs}`}</title>
            </rect>
          );
        })
      )}

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
                fontWeight="700" fontFamily="Oswald,sans-serif" fill="#1a1208">{CHROMA[n]}</text>
            )}
          </g>
        );
      })}

      {/* left-of-nut markers: ringing open strings (the point of a cut capo) and mutes */}
      {STRINGS.map((st, s) => {
        const f = shape[s];
        const y = stringY(s);
        // In the editor this marker toggles the string between ringing and muted.
        const toggle = interactive
          ? (e) => {
              e.stopPropagation();
              onChange(shape.map((cur, i) => (i === s ? (cur === 0 ? null : 0) : cur)));
            }
          : undefined;
        const hit = interactive && (
          <rect x={noteX(0) - 11} y={y - STRING_GAP / 2} width="22" height={STRING_GAP}
            fill="transparent" style={{ cursor: "pointer" }} onClick={toggle}>
            <title>{`String ${st.short}: ringing or muted`}</title>
          </rect>
        );
        if (f == null) {
          return (
            <g key={"m" + s}>
              <text x={noteX(0)} y={y + 4} textAnchor="middle" fontSize="11"
                fontWeight="700" fill="#ef5350">✕</text>
              {hit}
            </g>
          );
        }
        if (f === 0) {
          const n = noteAtFret(s, 0);
          return (
            <g key={"m" + s}>
              <circle cx={noteX(0)} cy={y} r="6.5" fill="none" stroke="#81c784" strokeWidth="2" />
              {showNotes && (
                <text x={noteX(0)} y={y + 2.8} textAnchor="middle" fontSize="7"
                  fontFamily="Oswald,sans-serif" fill="#81c784">{CHROMA[n]}</text>
              )}
              {hit}
            </g>
          );
        }
        return hit ? <g key={"m" + s}>{hit}</g> : null;
      })}
    </svg>
  );
}
