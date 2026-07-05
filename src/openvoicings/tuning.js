// ============================================================================
// OPEN VOICINGS — TUNING / PITCH ENGINE
// ============================================================================
// The guitar is in STANDARD tuning with NO capo. This is a sibling engine to
// the Cut Capo Studio (src/cutcapo/tuning.js) but simpler: every string is a
// plain open string and frets 0..12 are all reachable.
//
// Displayed orientation: horizontal neck, LOW E ON TOP, high E on the bottom,
// nut on the left.
//
// Strings, top -> bottom (this is the display order and the index used
// everywhere in the open-voicings code):
//
//   idx  string       open pitch   midi
//   ---  -----------  -----------  ----
//    0   6 - low E    E             40
//    1   5 - A        A             45
//    2   4 - D        D             50
//    3   3 - G        G             55
//    4   2 - B        B             59
//    5   1 - high E   E             64
//
// Strummed fully open this sounds  E  A  D  G  B  E.
//
// NOTE-AT-FRET MATH:
//   A guitar fret is always one semitone. The sounding pitch class of any
//   position is simply:
//       pitchClass = openPc(string) + fret        (mod 12)
// ============================================================================

export const CHROMA = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** Normalise any integer to a pitch class 0..11. */
export const pc = (n) => ((n % 12) + 12) % 12;

/** Pitch-class index -> sharp note name. */
export const noteName = (n) => CHROMA[pc(n)];

export const MAX_FRET = 12; // we render / search frets 0..12

// Per-string data, top (low E) -> bottom (high E).
//   openPitch : the open (nut) pitch class of the string
//   baseMidi  : MIDI number of the open string, used to compare absolute
//               pitch so we can find the true lowest-sounding note
//   w         : rendered string thickness (low strings are thicker)
export const STRINGS = [
  { idx: 0, num: 6, label: "6 · low E",  short: "E", openPitch: 4,  baseMidi: 40, w: 4.6 },
  { idx: 1, num: 5, label: "5 · A",      short: "A", openPitch: 9,  baseMidi: 45, w: 3.9 },
  { idx: 2, num: 4, label: "4 · D",      short: "D", openPitch: 2,  baseMidi: 50, w: 3.2 },
  { idx: 3, num: 3, label: "3 · G",      short: "G", openPitch: 7,  baseMidi: 55, w: 2.6 },
  { idx: 4, num: 2, label: "2 · B",      short: "B", openPitch: 11, baseMidi: 59, w: 2.0 },
  { idx: 5, num: 1, label: "1 · high E", short: "E", openPitch: 4,  baseMidi: 64, w: 1.5 },
];

export const NUM_STRINGS = STRINGS.length;

/** The open (nut) pitch class of a string. */
export const openPc = (s) => pc(STRINGS[s].openPitch);

/**
 * Sounding pitch class at a fret on a string.
 *   fret === 0        -> the open (nut) note
 *   0 < fret <= 12    -> openPitch + fret
 * Returns a pitch-class index 0..11, or null if the position is unavailable.
 */
export function noteAtFret(s, fret) {
  if (fret < 0 || fret > MAX_FRET) return null;
  return pc(STRINGS[s].openPitch + fret);
}

/**
 * Absolute pitch (MIDI number) at a fret, so callers can compare pitch height
 * and find the true lowest-sounding string. 0 = open.
 */
export function midiAtFret(s, fret) {
  return STRINGS[s].baseMidi + fret;
}

/** The fret positions that can be played on a string (0 = open, 1..12). */
export function availableFrets(s) {
  const out = [];
  for (let f = 0; f <= MAX_FRET; f++) out.push(f);
  return out;
}

/** True if a fret is a real fretted (fingered) position, not open. */
export const isFretted = (fret) => fret != null && fret > 0;
