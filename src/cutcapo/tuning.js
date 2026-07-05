// ============================================================================
// CUT CAPO — TUNING / PITCH ENGINE
// ============================================================================
// The guitar is in STANDARD tuning with a PARTIAL ("cut") capo clamped at
// fret 2 covering ONLY the A, D and G strings. The low-E, B and high-E
// strings are left open (uncapoed).
//
// Displayed orientation: horizontal neck, LOW E ON TOP, high E on the bottom,
// nut on the left.
//
// Strings, top -> bottom (this is the display order and the index used
// everywhere in the cut-capo code):
//
//   idx  string       capoed?     open/ringing pitch
//   ---  -----------  ----------  ------------------
//    0   6 - low E    no          E
//    1   5 - A        yes (fr 2)  B   (A + 2 semitones)
//    2   4 - D        yes (fr 2)  E   (D + 2 semitones)
//    3   3 - G        yes (fr 2)  A   (G + 2 semitones)
//    4   2 - B        no          B
//    5   1 - high E   no          E
//
// Strummed fully open this sounds  E  B  E  A  B  E.
//
// NOTE-AT-FRET MATH (the important part):
//   A guitar fret is ALWAYS one semitone. Fretting a string at PHYSICAL fret n
//   raises its pitch by exactly n semitones from the nut, capo or no capo. The
//   partial capo only (a) sets the new "open" ringing pitch on the capoed
//   strings to their fret-2 note, and (b) makes physical frets 1 and 2
//   unreachable on those strings (the capo mutes anything behind it).
//
//   So the sounding pitch class of any position is simply:
//       pitchClass = physicalOpenPc(string) + physicalFret        (mod 12)
//   where the "open/ringing" position of a capoed string is physical fret 2.
//
//   (The prose rule in the project brief — "each semitone above a string's
//   open pitch adds 1" — is exactly this. Two cells of the brief's example
//   table were hand-computed two semitones high on the D and G rows; the code
//   below follows the physically correct rule so the app matches a real
//   guitar. e.g. D string, fret 4 sounds F#, not G#.)
// ============================================================================

export const CHROMA = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** Normalise any integer to a pitch class 0..11. */
export const pc = (n) => ((n % 12) + 12) % 12;

/** Pitch-class index -> sharp note name. */
export const noteName = (n) => CHROMA[pc(n)];

export const CAPO_FRET = 2; // partial capo sits on fret 2 (A, D, G strings)
export const MAX_FRET = 12; // we render / search frets 0..12

// Per-string data, top (low E) -> bottom (high E).
//   physicalOpen : the actual nut pitch class of the string (capo ignored)
//   baseMidi     : MIDI number of the open (nut) string, used to compare
//                  absolute pitch so we can find the true lowest-sounding note
//   w            : rendered string thickness (low strings are thicker)
export const STRINGS = [
  { idx: 0, num: 6, label: "6 · low E",  short: "E", physicalOpen: 4,  baseMidi: 40, capoed: false, w: 4.6 },
  { idx: 1, num: 5, label: "5 · A",      short: "A", physicalOpen: 9,  baseMidi: 45, capoed: true,  w: 3.9 },
  { idx: 2, num: 4, label: "4 · D",      short: "D", physicalOpen: 2,  baseMidi: 50, capoed: true,  w: 3.2 },
  { idx: 3, num: 3, label: "3 · G",      short: "G", physicalOpen: 7,  baseMidi: 55, capoed: true,  w: 2.6 },
  { idx: 4, num: 2, label: "2 · B",      short: "B", physicalOpen: 11, baseMidi: 59, capoed: false, w: 2.0 },
  { idx: 5, num: 1, label: "1 · high E", short: "E", physicalOpen: 4,  baseMidi: 64, capoed: false, w: 1.5 },
];

export const NUM_STRINGS = STRINGS.length;

/** Is this string under the partial capo (A, D or G)? */
export const isCapoed = (s) => STRINGS[s].capoed;

/**
 * The open / ringing pitch class of a string.
 * For uncapoed strings that is the nut pitch; for capoed strings it is the
 * fret-2 (capo) pitch.
 */
export const openPc = (s) => pc(STRINGS[s].physicalOpen + (isCapoed(s) ? CAPO_FRET : 0));

/**
 * Sounding pitch class at a PHYSICAL fret on a string.
 *   fret === 0            -> the open / ringing (nut or capo) note
 *   capoed & fret 1..2    -> null  (behind the capo, muted / unreachable)
 *   otherwise             -> physicalOpen + fret
 * Returns a pitch-class index 0..11, or null if the position is unavailable.
 */
export function noteAtFret(s, fret) {
  if (fret === 0) return openPc(s);
  if (isCapoed(s) && fret <= CAPO_FRET) return null; // behind the capo
  if (fret < 0 || fret > MAX_FRET) return null;
  return pc(STRINGS[s].physicalOpen + fret);
}

/**
 * Absolute pitch (MIDI number) at a physical fret, so callers can compare
 * pitch height and find the true lowest-sounding string. 0 = open/capo.
 */
export function midiAtFret(s, fret) {
  if (fret === 0) return STRINGS[s].baseMidi + (isCapoed(s) ? CAPO_FRET : 0);
  return STRINGS[s].baseMidi + fret;
}

/**
 * The physical fret positions that can actually be played on a string.
 * 0 always means "open / ringing" (nut for uncapoed, capo for capoed).
 * Capoed strings skip frets 1..CAPO_FRET.
 */
export function availableFrets(s) {
  const out = [0];
  const first = isCapoed(s) ? CAPO_FRET + 1 : 1;
  for (let f = first; f <= MAX_FRET; f++) out.push(f);
  return out;
}

/** True if a physical fret is a real fretted (fingered) position, not open. */
export const isFretted = (fret) => fret != null && fret > 0;
