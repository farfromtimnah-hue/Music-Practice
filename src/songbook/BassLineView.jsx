// ============================================================
// BASS LINE — one repeating figure, taught by SCALE DEGREE.
//
// WHY IT LOOKS LIKE THIS.
//
// Numbers, never frets. Nicole teaches by number, and a number survives a
// transposition where a fret does not. So the marker on the neck carries the
// DEGREE, and the fret number is never printed anywhere in this view — not on
// the marker, not above the board. Printing it would quietly invite the student
// to memorise the fret and be wrong the next time the song moves.
//
// Tap to advance, one note at a time. The source tab carries pitch and order
// but no rhythm, so there is nothing here to animate in time with. A guessed
// tempo would teach the wrong feel, which is worse than teaching no feel at
// all, so the view says plainly that it does not know the rhythm.
//
// The board matches the bass fretboard in App.jsx exactly — string order E A D
// G top to bottom (low to high, as a bassist sees it looking down), nut at the
// left, frets vertical, inlays at 3/5/7/9 with a double dot at 12. Orientation
// errors have been caught here before, so this is deliberately a copy of the
// established convention rather than a fresh guess.
// ============================================================

import { useState, useMemo, useEffect } from "react";
import { resolveLine, degreeStrip, neckLengthFor } from "./basslines.js";

// Matches BASS_STRINGS in App.jsx: index 0 is the LOW E at the top of the
// board, index 3 the high G at the bottom, with the same relative thicknesses.
const STRINGS = [
  { name: "E", w: 4.8 },
  { name: "A", w: 3.5 },
  { name: "D", w: 2.5 },
  { name: "G", w: 1.6 },
];
const SINGLE_DOTS = [3, 5, 7, 9, 15, 17, 19, 21];
const DOUBLE_DOTS = [12, 24];

// marginTop leaves room for the marker circle AND the "slide" label above the
// top (E) string, both of which sit outside the board itself.
const G = { stringGap: 40, fretGap: 52, marginTop: 46, marginLeft: 46, marginRight: 16, marginBottom: 22 };

export default function BassLineView({ line, playingKey, songTitle, onClose }) {
  const resolved = useMemo(() => resolveLine(line, playingKey), [line, playingKey]);
  const [i, setI] = useState(0);

  // A key change re-lays the line on the neck. Start again from the top rather
  // than leaving the cursor pointing at a position that just moved.
  useEffect(() => { setI(0); }, [playingKey, line]);

  if (!resolved) return null;

  const notes = resolved.notes;
  const strip = degreeStrip(resolved);
  const cur = notes[i];
  const FRETS = neckLengthFor(resolved);

  const stringY = (s) => G.marginTop + s * G.stringGap;
  const nutX = G.marginLeft;
  const fretLineX = (f) => nutX + f * G.fretGap;
  // A fretted note sits between its fret wire and the one before it; fret 0 is
  // the open string, drawn to the left of the nut.
  const noteX = (f) => (f === 0 ? nutX - 26 : nutX + (f - 0.5) * G.fretGap);
  const W = nutX + FRETS * G.fretGap + G.marginRight;
  const H = G.marginTop + 3 * G.stringGap + G.marginBottom;
  const boardTop = stringY(0) - 16, boardBot = stringY(3) + 16;

  const sIdx = STRINGS.findIndex((s) => s.name === cur.string);
  const y = stringY(sIdx);
  const advance = () => setI((n) => (n + 1) % notes.length);

  return (
    <div className="sb-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="sb-sheet sb-bl-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sb-sheet-top">
          <span className="sb-sheet-name">{line.name}</span>
          <span className="sb-sheet-sub">{songTitle} · playing in {resolved.playingKey}</span>
          <button className="sb-sheet-close" onClick={onClose}>Close</button>
        </div>

        {/* Where in the song this line belongs, and how the intro differs. */}
        <div className="sb-bl-where">
          <b>{line.appliesTo}</b>
          {line.intro && <span> {line.intro}</span>}
        </div>

        {/* THE NECK. Tapping anywhere on it advances one note. */}
        <div className="sb-bl-board" onClick={advance}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W, height: "auto", touchAction: "manipulation" }}
            role="img" aria-label={`Bass neck showing degree ${cur.degree} on the ${cur.string} string`}>
            <defs>
              <linearGradient id="blWood" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#5a3a22" />
                <stop offset="0.5" stopColor="#3a2416" />
                <stop offset="1" stopColor="#2a1810" />
              </linearGradient>
            </defs>

            <rect x={nutX} y={boardTop} width={fretLineX(FRETS) - nutX} height={boardBot - boardTop}
              rx="4" fill="url(#blWood)" stroke="#1c1009" strokeWidth="1.5" />

            {/* Inlays — single dots, and the double dot at 12 that marks the
                octave. NO fret numbers: the landmark is the dot, not a digit. */}
            {SINGLE_DOTS.filter((f) => f <= FRETS).map((f) => (
              <circle key={`d${f}`} cx={noteX(f)} cy={(stringY(1) + stringY(2)) / 2} r="6" fill="#f0ead6" opacity="0.85" />
            ))}
            {/* The octave marker is a PAIR of dots, straddling the centre line
                the single dots sit on — the standard way a neck says "12". */}
            {DOUBLE_DOTS.filter((f) => f <= FRETS).map((f) => {
              const mid = (stringY(1) + stringY(2)) / 2;
              return (
                <g key={`dd${f}`}>
                  <circle cx={noteX(f)} cy={mid - G.stringGap * 0.62} r="6" fill="#f0ead6" opacity="0.85" />
                  <circle cx={noteX(f)} cy={mid + G.stringGap * 0.62} r="6" fill="#f0ead6" opacity="0.85" />
                </g>
              );
            })}

            {Array.from({ length: FRETS }, (_, k) => k + 1).map((f) => (
              <line key={`f${f}`} x1={fretLineX(f)} y1={boardTop} x2={fretLineX(f)} y2={boardBot}
                stroke="#c4c4cc" strokeWidth="3" />
            ))}
            <rect x={nutX - 5} y={boardTop} width="6" height={boardBot - boardTop} rx="1.5" fill="#e8dcc0" />

            {STRINGS.map((st, s) => (
              <line key={`s${s}`} x1={nutX - 5} y1={stringY(s)} x2={fretLineX(FRETS)} y2={stringY(s)}
                stroke={s === sIdx ? "#f0c040" : "#cfcfd8"} strokeWidth={st.w} strokeLinecap="round"
                opacity={s === sIdx ? 1 : 0.55} />
            ))}
            {/* String names at the nut, so the board reads as a real neck. */}
            {STRINGS.map((st, s) => (
              <text key={`sn${s}`} x={nutX - 34} y={stringY(s) + 4} textAnchor="middle" fontSize="12"
                fontFamily="Oswald,sans-serif" fill={s === sIdx ? "#f0c040" : "#8888aa"}>{st.name}</text>
            ))}

            {/* A SLIDE is one gesture, drawn as one: a bar from the starting
                fret to the destination with both degrees named, never two
                separate taps that would read as two separate notes. */}
            {cur.slideTo != null ? (
              <g>
                <line x1={noteX(cur.fret)} y1={y} x2={noteX(cur.slideTo)} y2={y}
                  stroke="#f0c040" strokeWidth="7" strokeLinecap="round" opacity="0.55" />
                <polygon points={`${noteX(cur.slideTo) - 13},${y - 7} ${noteX(cur.slideTo) - 13},${y + 7} ${noteX(cur.slideTo) - 3},${y}`}
                  fill="#f0c040" opacity="0.9" />
                {[[cur.fret, cur.degree], [cur.slideTo, cur.slideToDegree]].map(([f, deg], n) => (
                  <g key={n}>
                    <circle cx={noteX(f)} cy={y} r="17" fill="#f0c040" stroke="#fff3cf" strokeWidth="2" />
                    <text x={noteX(f)} y={y + 6} textAnchor="middle" fontSize="17" fontWeight="700"
                      fontFamily="Oswald,sans-serif" fill="#1a1208">{deg}</text>
                  </g>
                ))}
                <text x={(noteX(cur.fret) + noteX(cur.slideTo)) / 2} y={y - 24} textAnchor="middle"
                  fontSize="12" fontFamily="Oswald,sans-serif" fill="#f0c040">slide</text>
              </g>
            ) : (
              <g>
                <circle cx={noteX(cur.fret)} cy={y} r="19" fill="#f0c040" stroke="#fff3cf" strokeWidth="2" />
                <text x={noteX(cur.fret)} y={y + 7} textAnchor="middle" fontSize="19" fontWeight="700"
                  fontFamily="Oswald,sans-serif" fill="#1a1208">{cur.degree}</text>
              </g>
            )}
          </svg>
        </div>

        {/* THE WHOLE LINE, so the shape is visible and he can see where he is. */}
        <div className="sb-bl-strip">
          {strip.map((d, n) => (
            <button key={n} className={"sb-bl-step" + (n === i ? " on" : "") + (d.includes("→") ? " slide" : "")}
              onClick={() => setI(n)}>{d}</button>
          ))}
        </div>

        <div className="sb-bl-controls">
          <button className="sb-bl-btn" onClick={() => setI((n) => (n - 1 + notes.length) % notes.length)}>← Back</button>
          <span className="sb-bl-count">{i + 1} of {notes.length}</span>
          <button className="sb-bl-btn primary" onClick={advance}>Next note →</button>
        </div>

        <div className="sb-sheet-note">
          Tap the neck for the next note. The circle shows the <b>number</b>, not the fret —
          the numbers stay the same when the song changes key and the shape simply moves along
          the neck. There is no rhythm here on purpose: the tab this came from records the notes
          and their order, not their timing, so play it to the song rather than to the app.
        </div>
      </div>
    </div>
  );
}
