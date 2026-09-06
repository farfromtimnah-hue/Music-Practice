// ============================================================
// BASS LINES — a repeating figure taught by SCALE DEGREE, not by tab.
//
// WHY THIS SHAPE. Nicole teaches bass by number. Tab is fret numbers, so it
// breaks the moment Planning Center transposes a song: the same frets in a new
// key are the wrong notes, and a student reading tab has no way to work out the
// right ones. Numbers survive a key change; fret positions move under them.
//
// So a line is stored as (string, fret) IN THE KEY IT WAS WRITTEN IN, and the
// degrees are DERIVED. Storing degrees directly would be the same mistake in
// reverse — the numbers would be right but the frets could never move.
//
// SHAPE. One chart id -> one or more named lines. Adding a line, or a second
// line to a song that already has one, is a data edit; the view reads whatever
// is here and needs no change.
//
//   [chartId]: {
//     lines: [{
//       id, name,
//       writtenKey,            // the key the frets below are correct in
//       strings,               // string names, LOW to HIGH, matching the board
//       appliesTo,             // human sentence: where in the song it is played
//       notes: [               // in playing order
//         { string, fret }                       a plain note
//         { string, fret, slideTo }              a slide, fret -> slideTo
//       ],
//       intro                  // optional: how the intro differs, as prose
//     }]
//   }
//
// `strings` names the physical strings low to high — for a 4-string bass that
// is E A D G, the same order the fretboard in App.jsx draws top to bottom.
// ============================================================

export const BASS_LINES = {
  "phenomena-da-da": {
    lines: [
      {
        id: "main",
        name: "Main line",
        // Written in F#. Verified: F# is the only key in which this line comes
        // out diatonic and musical — 6 6 1 7 6 4 1/3 b3 2 2 1 2 1 2, a single
        // flat. Read in G it gives nine flats, in A five; both are nonsense.
        // The chart's own detected key is F# major, which agrees.
        writtenKey: "F#",
        strings: ["E", "A", "D", "G"],
        appliesTo: "The whole song except the Pre-Chorus.",
        intro: "The intro plays this same loop but opens with FOUR 6s instead of two, then joins the line as written.",
        notes: [
          { string: "A", fret: 6 },              // 6
          { string: "A", fret: 6 },              // 6
          { string: "A", fret: 9 },              // 1
          { string: "A", fret: 8 },              // 7
          { string: "A", fret: 6 },              // 6
          { string: "E", fret: 7 },              // 4
          { string: "E", fret: 2, slideTo: 6 },  // 1 slide up to 3
          { string: "E", fret: 5 },              // b3
          { string: "E", fret: 4 },              // 2
          { string: "E", fret: 4 },              // 2
          { string: "E", fret: 2 },              // 1
          { string: "E", fret: 4 },              // 2
          { string: "E", fret: 2 },              // 1
          { string: "E", fret: 4 },              // 2
        ],
      },
    ],
  },
};

export const bassLinesFor = (chartId) => {
  const entry = BASS_LINES[chartId];
  return entry && entry.lines && entry.lines.length ? entry.lines : null;
};

export const hasBassLine = (chartId) => !!bassLinesFor(chartId);

// ------------------------------------------------------------
// Degree derivation. Pure: no React, no DOM.
// ------------------------------------------------------------
const PC = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };

// Open-string pitch classes for a standard 4-string bass, low to high.
const OPEN_PC = { E: 4, A: 9, D: 2, G: 7 };

// Degree name by semitones above the tonic. These are the names Nicole says
// out loud, so they are the names the view prints.
// The neck the view draws by default. A real bass has more, and the board
// extends itself when a transposed line needs the room (see neckLengthFor), so
// this is a comfortable starting length rather than a hard limit.
export const MAX_FRET = 15;

// How many frets the board must draw to hold a resolved line, rounded up to a
// sensible landmark so the neck does not change length by one fret at a time.
export const neckLengthFor = (resolved) => {
  const hi = Math.max(...resolved.notes.flatMap((n) => (n.slideTo == null ? [n.fret] : [n.fret, n.slideTo])));
  if (hi <= 12) return 12;
  if (hi <= 15) return 15;
  return Math.min(24, hi + 1);
};

const DEGREE_BY_SEMITONE = { 0: "1", 1: "b2", 2: "2", 3: "b3", 4: "3", 5: "4", 6: "b5", 7: "5", 8: "b6", 9: "6", 10: "b7", 11: "7" };

export const pitchClassOf = (name) => {
  const k = String(name || "").trim().replace(/m$/, "");
  return Object.prototype.hasOwnProperty.call(PC, k) ? PC[k] : null;
};

// The scale degree of one (string, fret) against a tonic pitch class.
export const degreeAt = (stringName, fret, tonicPc) => {
  const open = OPEN_PC[stringName];
  if (open == null || tonicPc == null) return null;
  return DEGREE_BY_SEMITONE[(open + fret - tonicPc + 12 * 4) % 12];
};

/**
 * Resolve a stored line into what the view draws, for a GIVEN playing key.
 *
 * The degrees come out identical whatever the key — that is the whole point —
 * while every fret shifts by the interval between the written key and the
 * playing key. A line written in F# and played in G is the same numbers one
 * fret up.
 *
 * Shifts are chosen to keep the line on the neck: the raw interval is taken
 * modulo an octave, then dropped an octave if that would push the line past
 * fret 12, so it never runs off the end of the board.
 */
export const resolveLine = (line, playingKeyName) => {
  const writtenPc = pitchClassOf(line.writtenKey);
  const playPc = pitchClassOf(playingKeyName);
  if (writtenPc == null) return null;
  const tonicPc = playPc == null ? writtenPc : playPc;

  // Every fret the line touches, slide destinations included — a slide that
  // runs off the end of the neck is just as unplayable as a note that does.
  const allFrets = line.notes.flatMap((n) => (n.slideTo == null ? [n.fret] : [n.fret, n.slideTo]));
  const loF = Math.min(...allFrets), hiF = Math.max(...allFrets);

  // Pick the octave that sits best on the neck. Every candidate gives IDENTICAL
  // degrees — an octave is the same note — so this chooses only WHERE the shape
  // sits, never what it teaches.
  //
  // The constraint that actually binds is the nut: nothing can go below fret 0.
  // Among the octaves that clear it, take the lowest position, which keeps the
  // line in easy playing range and the neck short.
  const base = ((tonicPc - writtenPc) % 12 + 12) % 12;
  const shift = [base - 12, base, base + 12]
    .filter((sh) => loF + sh >= 0)
    .sort((a, b) => a - b)[0];

  const notes = line.notes.map((n) => {
    const fret = n.fret + shift;
    const out = {
      string: n.string,
      fret,
      degree: degreeAt(n.string, fret, tonicPc),
    };
    if (n.slideTo != null) {
      out.slideTo = n.slideTo + shift;
      out.slideToDegree = degreeAt(n.string, out.slideTo, tonicPc);
    }
    return out;
  });

  return { ...line, tonicPc, playingKey: playingKeyName || line.writtenKey, shift, notes };
};

// The degree strip: one label per step, a slide rendered as "1→3".
export const degreeStrip = (resolved) =>
  resolved.notes.map((n) => (n.slideTo != null ? n.degree + "→" + n.slideToDegree : n.degree));
