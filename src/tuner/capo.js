/* ------------------------------------------------------------------
   capo.js — capo-aware tuning targets.

   WHY THIS EXISTS. A capo presses the strings down onto a fret, which
   pulls them slightly sharp. A guitar tuned perfectly open can still be
   out once the capo goes on, so Nicole had to take her capos off to
   tune and then put them back and hope. Tuning OPEN is still the
   accurate baseline — that is what the strings are actually set to —
   but she needs to VERIFY in the position she is going to play in.

   THE MODEL is the songbook's, not a second invention. A full capo sits
   at fret `capo` (0 = none) and clamps ALL strings. A cut capo is a
   partial capo over the A, D and G strings only, and it always sits
   exactly two frets above whatever is below it:

       cutFret = capo + CAPO_FRET        (CAPO_FRET = 2)

   The two are independent, and BOTH AT ONCE is Nicole's normal setup,
   not an edge case.

   THE TRANSPOSE IS PER STRING, NEVER GLOBAL. This is the whole
   correctness question. With both capos on, the six strings do NOT
   share an offset: the three under the cut capo go up capo+2 while the
   other three go up capo. A single global offset would put three
   strings on wrong targets and quietly send her to the wrong peg —
   worse than having no capo support at all. So every string carries its
   own semitone count and is transposed independently.

   TUNINGS itself is never modified; these functions return a new array,
   so the open-tuning path cannot regress.
   ------------------------------------------------------------------ */
import { CAPO_FRET } from "../cutcapo/tuning.js";
import { MAX_FREQ } from "./pitch.js";

/* Same ceiling the songbook allows. */
export const MAX_FULL_CAPO = 7;

/* Which string indices a cut capo covers: A, D and G, low-to-high.
   Only meaningful for a 6-string guitar; a bass has no cut capo. */
export const CUT_STRINGS = [1, 2, 3];

export const DEFAULT_CAPO = { capo: 0, cut: false };

const clamp = (n) => {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(MAX_FULL_CAPO, v));
};

/** Normalise a capo setting. Never throws; anything odd reads as "off". */
export const normalizeCapo = (raw) => {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_CAPO };
  return { capo: clamp(raw.capo), cut: raw.cut === true };
};

/** Where a cut capo physically sits. Derived, never stored. */
export const cutFretOf = (setting) => clamp(setting && setting.capo) + CAPO_FRET;

/** True when this setting changes nothing. */
export const isCapoOff = (setting) => {
  const s = normalizeCapo(setting);
  return s.capo === 0 && !s.cut;
};

/**
 * How many semitones string `i` is raised by a capo setting.
 *
 * `cuttable` says whether a cut capo applies to this instrument at all —
 * false for basses, which have no such capo.
 */
export const semitonesForString = (i, setting, cuttable) => {
  const s = normalizeCapo(setting);
  const cut = cuttable && s.cut && CUT_STRINGS.includes(i);
  return s.capo + (cut ? CAPO_FRET : 0);
};

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Note name + octave raised by n semitones, e.g. ("A",2,3) -> {note:"C",octave:3}. */
const transposeNote = (note, octave, n) => {
  const base = NOTE_INDEX[note[0]] + (note.includes("#") ? 1 : 0) + (note.includes("b") ? -1 : 0);
  const abs = base + octave * 12 + n;
  return { note: NOTES[((abs % 12) + 12) % 12], octave: Math.floor(abs / 12) };
};

/**
 * A tuning's strings with capo targets applied.
 *
 * Each returned string keeps the shape the tuner already consumes
 * (note/octave/label/freq) so nothing downstream has to know about
 * capos, and gains:
 *   openLabel / openFreq : what it is when open, for the display
 *   semitones            : its OWN offset — the per-string transpose
 *   capoed               : whether anything moved it
 *
 * `freq` is the value everything else uses: the reference tone, the
 * cents comparison and the nearest-string match all read it, so they
 * follow the capo automatically without special-casing.
 */
export const capoStrings = (tuning, setting, cuttable = true) => {
  const base = tuning.strings;
  const s = normalizeCapo(setting);
  if (s.capo === 0 && !s.cut) {
    // Untouched objects on the open path: identical to TUNINGS, so the
    // no-capo behaviour cannot drift from what it was.
    return base.map((st) => ({
      ...st,
      openLabel: st.label,
      openFreq: st.freq,
      semitones: 0,
      capoed: false,
    }));
  }
  return base.map((st, i) => {
    const n = semitonesForString(i, s, cuttable);
    if (n === 0) {
      return { ...st, openLabel: st.label, openFreq: st.freq, semitones: 0, capoed: false };
    }
    const t = transposeNote(st.note, st.octave, n);
    return {
      note: t.note,
      octave: t.octave,
      label: t.note + t.octave,
      // Equal temperament from the string's OWN open frequency and its
      // OWN semitone count. Never a shared multiplier.
      freq: st.freq * Math.pow(2, n / 12),
      openLabel: st.label,
      openFreq: st.freq,
      semitones: n,
      capoed: true,
    };
  });
};

/**
 * The detection ceiling for a set of targets.
 *
 * MAX_FREQ is 360 Hz, which is fine open (high E is 329.63) but not
 * with a full capo: high E is 370 Hz at capo 2, 392 at 3, 440 at 5, so
 * from capo 2 up that string sits OUTSIDE the search range and can
 * never be detected however nicely it is displayed. The ceiling is
 * therefore derived from the highest target actually in play rather
 * than being a second hardcoded constant that can fall out of step.
 *
 * A cut capo alone needs nothing: it does not touch the high E, and its
 * highest target is the G string at 220 Hz.
 *
 * The margin matches MAX_FREQ's own headroom over open high E
 * (360/329.63 ~ 1.09) so a string can still read sharp and be seen.
 */
export const ceilingFor = (strings) => {
  let top = 0;
  for (const st of strings) if (st.freq > top) top = st.freq;
  return Math.max(MAX_FREQ, Math.ceil(top * 1.09));
};

/** Short human description of a setting, e.g. "capo 3 + cut". */
export const capoLabel = (setting, cuttable = true) => {
  const s = normalizeCapo(setting);
  const cut = cuttable && s.cut;
  if (!s.capo && !cut) return "open";
  if (s.capo && cut) return "capo " + s.capo + " + cut";
  if (s.capo) return "capo " + s.capo;
  return "cut capo";
};
