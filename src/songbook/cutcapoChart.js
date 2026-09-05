// ============================================================
// THE STANDARD CUT CAPO CHORD CHART — the twelve canonical shapes.
//
// WHY THIS FILE EXISTS. The app used to DERIVE cut-capo fingerings by
// searching for voicings whose pitches matched the chord. That search is
// sound in theory and wrong in practice: it produced shapes Nicole did not
// recognise, because "a valid voicing of A" and "the A everyone plays with a
// cut capo" are not the same question. There is one canonical chart, every
// guitarist with this capo already knows it, and the app must simply use it.
//
// SOURCE: G7th, The Capo Company — "3-string partial capo chord chart for
// Worship Guitarists", for a 3-string partial capo at the 2nd fret covering
// A-D-G. Strummed open it is Esus4, which is exactly this app's cut capo.
//   https://www.g7th.com/Images/uploaded/Blog/Partial%20chord%20chart%20Esus.pdf
//
// The shapes below were read off the published diagrams themselves (rendered
// at 400dpi and measured against each box's own string/fret lattice), not
// transcribed from anyone's prose. Every one was then run through the
// engine's soundingNoteNames() and its pitches confirmed against its name —
// see the note on each entry. A shape whose computed pitches contradict its
// label is a misreading, not a variant.
//
// COORDINATES. `shape` is the app's own 6-slot array, low E first:
//   [low E, A, D, G, B, high E], null = muted, 0 = ringing (nut or capo),
//   n = fingered at physical fret n. The chart is written for the capo at the
//   2nd fret from the nut, so these frets are absolute in that frame — which
//   is precisely the frame src/cutcapo/ works in.
//
// KEY. The chart is written for the key of E with the partial capo at the
// nut. Under a full capo the SHAPE is unchanged — the hand does the same
// thing relative to the capo — and only the name of the resulting chord
// moves. So the lookup is transposed, never the shape; `shapeTokenFor` in
// cutcapoAdapter.js already computes exactly that transposition and is
// reused rather than duplicated here.
//
// Pure data + pure functions. No React, no DOM. src/cutcapo/ is imported
// for naming only, never modified.
// ============================================================
import { ROOTS } from "../cutcapo/chords.js";

/**
 * The twelve chords of the chart, in the chart's own order and naming.
 *
 *   name     : the chart's formal name for the shape
 *   shape    : the fingering, as read from the diagram
 *   notes    : the sounding pitches, low->high, as computed by the engine
 *              (recorded here so a future edit that breaks one is obvious)
 *   replaces : the chart tokens this shape is the answer for. This is the
 *              key point of the whole file — a chart asking for "A" wants
 *              Aadd9, and asking for "F#m" or "F#m7" wants F#m11.
 *   note     : the chart's own playing advice, shown on the popup.
 */
export const CHART = [
  {
    name: "E5", qualifier: "no 3rd", shape: [0, 0, 0, 4, 0, 0],
    notes: ["E", "B", "E", "B", "B", "E"],
    replaces: ["E"],
  },
  {
    name: "E5/G#", shape: [4, 0, 0, 4, 0, 0],
    notes: ["G#", "B", "E", "B", "B", "E"],
    // The chart says this one often stands in for G#m as well.
    replaces: ["E/G#", "G#m"],
    note: "The chart says this often replaces G#m too.",
  },
  {
    name: "E5/B", shape: [null, 0, 0, 4, 0, 0],
    notes: ["B", "E", "B", "B", "E"],
    replaces: ["E/B"],
  },
  {
    name: "F#m11", shape: [2, 4, 4, 0, 0, 0],
    notes: ["F#", "C#", "F#", "A", "B", "E"],
    replaces: ["F#m", "F#m7"],
    // Real playing advice from the chart, and audibly true: the low E at
    // fret 2 sits behind the partial capo's own fret.
    note: "You have to reach over your partial capo, or mute the low E string.",
  },
  {
    name: "Aadd9", shape: [5, 4, 0, 0, 0, 0],
    notes: ["A", "C#", "E", "A", "B", "E"],
    replaces: ["A"],
  },
  {
    name: "Aadd9/C#", shape: [null, 4, 0, 0, 0, 0],
    notes: ["C#", "E", "A", "B", "E"],
    replaces: ["A/C#"],
  },
  {
    name: "Aadd9/E", shape: [0, 4, 0, 0, 0, 0],
    notes: ["E", "C#", "E", "A", "B", "E"],
    replaces: ["A/E"],
  },
  {
    name: "Bsus4", shape: [null, 0, 4, 4, 0, 0],
    notes: ["B", "F#", "B", "B", "E"],
    replaces: ["B"],
  },
  {
    name: "Badd11/D#", shape: [null, 6, 4, 4, 0, 0],
    notes: ["D#", "F#", "B", "B", "E"],
    replaces: ["B/D#"],
  },
  {
    name: "C#m7", shape: [null, 4, 6, 6, 0, 0],
    notes: ["C#", "G#", "B", "C#", "E"],
    replaces: ["C#m"],
  },
  {
    name: "C#m7", qualifier: "no 5th", shape: [null, 4, 0, 4, 0, 0],
    notes: ["C#", "E", "B", "B", "E"],
    // The chart offers this as an ALTERNATE for C#m, so it is not a primary
    // answer for anything; it is surfaced as the second option.
    replaces: [], alternateFor: ["C#m"],
    note: "The chart's alternate replacement for C#m.",
  },
  {
    name: "G#m b13", shape: [4, 6, 6, 4, 0, 0],
    notes: ["G#", "D#", "G#", "B", "B", "E"],
    replaces: ["G#m"],
  },
];

// ---------------------------------------------------------------------------
// LOOKUP
//
// Keyed by the chord a chart actually ASKS for, not by the shape's formal
// name — that is the whole point. "A" resolves to Aadd9; "F#m" and "F#m7"
// both resolve to F#m11.
//
// Tokens are normalised through the same root spelling the engine uses
// (flats folded to sharps) so a chart writing "Db" finds the C# entry.
// ---------------------------------------------------------------------------
const FLAT_TO_SHARP = { Cb: "B", Db: "C#", Eb: "D#", Fb: "E", Gb: "F#", Ab: "G#", Bb: "A#" };

/** "Bbm7" -> "A#m7". Root spelling only; the quality is left alone. */
const normToken = (root, quality, bass) => {
  const fix = (n) => (n && FLAT_TO_SHARP[n]) || n;
  return fix(root) + (quality || "") + (bass ? "/" + fix(bass) : "");
};

/** Split "A/C#" or "F#m7" into its parts, or null if it is not a chord. */
const splitToken = (tok) => {
  const m = /^([A-G])(#|b)?(.*?)(?:\/([A-G])(#|b)?)?$/.exec(String(tok || "").trim());
  if (!m) return null;
  return {
    root: m[1] + (m[2] || ""),
    quality: m[3] || "",
    bass: m[4] ? m[4] + (m[5] || "") : null,
  };
};

// index: normalised token -> { entry, alternate? }
const buildIndex = () => {
  const primary = new Map();
  const alternates = new Map();
  for (const e of CHART) {
    // A chart may also ask for the shape's OWN name — "Aadd9" is a chord
    // charts write. Registered first so an explicit `replaces` entry always
    // wins, and only when the name is unambiguous (the "(no 5th)" C#m7 shares
    // its name with the primary C#m7 and must not displace it).
    if (!e.qualifier) {
      const self = splitToken(e.name);
      if (self) {
        const k = normToken(self.root, self.quality, self.bass);
        if (!primary.has(k)) primary.set(k, e);
      }
    }
    for (const tok of e.replaces || []) {
      const p = splitToken(tok);
      if (p) primary.set(normToken(p.root, p.quality, p.bass), e);
    }
    for (const tok of e.alternateFor || []) {
      const p = splitToken(tok);
      if (!p) continue;
      const k = normToken(p.root, p.quality, p.bass);
      if (!alternates.has(k)) alternates.set(k, []);
      alternates.get(k).push(e);
    }
  }
  return { primary, alternates };
};
const INDEX = buildIndex();

/**
 * Transpose a chart token by `semitones`, keeping its quality and bass.
 * Used to move a LOOKUP into the chart's own key of E — never to move a
 * shape, which stays exactly as the chart draws it.
 */
const transposeToken = (tok, semitones) => {
  const p = splitToken(tok);
  if (!p) return null;
  const shift = (name) => {
    if (!name) return null;
    const fixed = FLAT_TO_SHARP[name] || name;
    const i = ROOTS.indexOf(fixed);
    if (i < 0) return null;
    return ROOTS[(((i + semitones) % 12) + 12) % 12];
  };
  const root = shift(p.root);
  if (!root) return null;
  const bass = p.bass ? shift(p.bass) : null;
  if (p.bass && !bass) return null;
  return normToken(root, p.quality, bass);
};

/**
 * The chart's answer for a chord token, or null when the chord is not on the
 * chart at all.
 *
 * `capo` is the full-capo fret. The chart is written with the partial capo at
 * the nut, so a chord sounding under a full capo at fret n is FINGERED as the
 * chord n semitones lower — the same transposition shapeTokenFor performs.
 * Pass the already-transposed shape token and leave capo at 0, or pass the
 * sounding token and let this do it; both are supported so callers can use
 * whichever they already have.
 *
 * Returns { entry, alternates } where entry is the primary shape.
 */
export const chartShapeFor = (token, capo = 0) => {
  const p = splitToken(token);
  if (!p) return null;
  let key = normToken(p.root, p.quality, p.bass);
  if (capo) {
    const moved = transposeToken(key, -capo);
    if (!moved) return null;
    key = moved;
  }
  const entry = INDEX.primary.get(key) || null;
  const alternates = INDEX.alternates.get(key) || [];
  if (!entry && !alternates.length) return null;
  return {
    entry: entry || alternates[0],
    alternates: entry ? alternates : alternates.slice(1),
  };
};

/** Display label for a chart entry, e.g. "C#m7 (no 5th)". */
export const chartLabel = (e) => e.name + (e.qualifier ? " (" + e.qualifier + ")" : "");

/**
 * Every chord token this entry is the standard answer for, as a readable
 * phrase — so the popup can say a shape covers more than one chord.
 */
export const chartReplaces = (e) => [...(e.replaces || []), ...(e.alternateFor || [])];
