// ============================================================
// CHORD SHAPES — the "how do I play this?" answer for the chart popup.
//
// WHY THIS IS NOT src/openvoicings/.
// The open-voicings engine answers a DIFFERENT question: "what unusual
// shimmering shapes exist for this chord where open strings ring against
// fretted notes high up the neck?" It deliberately rejects barres and
// deliberately returns nothing for chords like F. Its own top-ranked C major
// is 8-x-x-0-x-0 — a real and beautiful voicing, and completely wrong as the
// answer to a player glancing at a chart mid-song, who wants the C chord
// everybody means by "C".
//
// So this module holds the ORDINARY shapes: the first-position chords a player
// already has in their hands, plus movable barre forms for everything else.
// src/openvoicings/ and src/cutcapo/ are imported by other code, never
// modified, and never asked this question.
//
// Shape format matches the rest of the app: an array of 6 frets, top->bottom,
// low E first. null = muted, 0 = open, n = fingered at fret n. Frets are
// measured from the EFFECTIVE NUT so CutCapoDiagram can render them directly.
//
// Pure JS: no React, no DOM. Ports with the rest of src/songbook/.
// ============================================================
import { chartChordToCutCapo } from "./cutcapoAdapter.js";

const CHROMA = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const pcOf = (name) => CHROMA.indexOf(name);

// ---------------------------------------------------------------------------
// OPEN-POSITION SHAPES. Keyed by "<root pc>:<typeId>". These are the shapes a
// guitarist actually plays in first position; they always win when they exist
// because they are what the chart symbol means to the hands.
// ---------------------------------------------------------------------------
const OPEN = {
  // majors
  "0:maj":  [null, 3, 2, 0, 1, 0],      // C
  "2:maj":  [null, null, 0, 2, 3, 2],   // D
  "4:maj":  [0, 2, 2, 1, 0, 0],         // E
  "5:maj":  [1, 3, 3, 2, 1, 1],         // F (barre — no honest open form)
  "7:maj":  [3, 2, 0, 0, 0, 3],         // G
  "9:maj":  [null, 0, 2, 2, 2, 0],      // A
  // minors
  "2:min":  [null, null, 0, 2, 3, 1],   // Dm
  "4:min":  [0, 2, 2, 0, 0, 0],         // Em
  "9:min":  [null, 0, 2, 2, 1, 0],      // Am
  // dominant 7
  "0:7":    [null, 3, 2, 3, 1, 0],      // C7
  "2:7":    [null, null, 0, 2, 1, 2],   // D7
  "4:7":    [0, 2, 0, 1, 0, 0],         // E7
  "7:7":    [3, 2, 0, 0, 0, 1],         // G7
  "9:7":    [null, 0, 2, 0, 2, 0],      // A7
  "11:7":   [null, 2, 1, 2, 0, 2],      // B7
  // minor 7
  "2:m7":   [null, null, 0, 2, 1, 1],   // Dm7
  "4:m7":   [0, 2, 0, 0, 0, 0],         // Em7
  "9:m7":   [null, 0, 2, 0, 1, 0],      // Am7
  // major 7
  "0:maj7": [null, 3, 2, 0, 0, 0],      // Cmaj7
  "2:maj7": [null, null, 0, 2, 2, 2],   // Dmaj7
  "5:maj7": [null, null, 3, 2, 1, 0],   // Fmaj7
  "9:maj7": [null, 0, 2, 1, 2, 0],      // Amaj7
  // sus
  "2:sus4": [null, null, 0, 2, 3, 3],   // Dsus4
  "2:sus2": [null, null, 0, 2, 3, 0],   // Dsus2
  "4:sus4": [0, 2, 2, 2, 0, 0],         // Esus4
  "9:sus4": [null, 0, 2, 2, 3, 0],      // Asus4
  "9:sus2": [null, 0, 2, 2, 0, 0],      // Asus2
  "0:sus2": [null, 3, 0, 0, 1, 3],      // Csus2
  "7:sus4": [3, 3, 0, 0, 1, 3],         // Gsus4
  // sixths & add9
  "0:6":    [null, 3, 2, 2, 1, 0],      // C6
  "7:6":    [3, 2, 0, 0, 0, 0],         // G6
  "9:6":    [null, 0, 2, 2, 2, 2],      // A6
  "4:min6": [0, 2, 2, 0, 2, 0],         // Em6
  "0:add9": [null, 3, 2, 0, 3, 0],      // Cadd9
  "7:add9": [3, 0, 0, 0, 0, 3],         // Gadd9
};

// ---------------------------------------------------------------------------
// MOVABLE BARRE FORMS. Offsets are relative to the root's fret on the carrying
// string, so any root is reachable. Two families: E-shape (root on the low E
// string, index 0) and A-shape (root on the A string, index 1). A-shape is
// preferred above fret 4 so the hand is not stretched down at the nut.
//
// Each entry: frets relative to the barre, null = muted.
// ---------------------------------------------------------------------------
const E_FORMS = {
  maj:  [0, 2, 2, 1, 0, 0],
  min:  [0, 2, 2, 0, 0, 0],
  7:    [0, 2, 0, 1, 0, 0],
  m7:   [0, 2, 0, 0, 0, 0],
  maj7: [0, 2, 1, 1, 0, 0],
  6:    [0, 2, 2, 1, 2, 0],
  min6: [0, 2, 2, 0, 2, 0],
  sus4: [0, 2, 2, 2, 0, 0],
  sus2: [0, 2, 4, 4, 0, 0],
  m9:   [0, 2, 0, 0, 0, 2],
  9:    [0, 2, 0, 1, 0, 2],
  add9: [0, 2, 4, 1, 0, 0],
  maj9: [0, 2, 1, 1, 0, 2],
  aug:  [0, 3, 2, 1, 1, 0],
  dim:  [0, 1, 2, 0, null, null],
  dim7: [0, 1, 2, 0, 2, null],
  m7b5: [0, 1, 0, 0, null, null],
};
const A_FORMS = {
  maj:  [null, 0, 2, 2, 2, 0],
  min:  [null, 0, 2, 2, 1, 0],
  7:    [null, 0, 2, 0, 2, 0],
  m7:   [null, 0, 2, 0, 1, 0],
  maj7: [null, 0, 2, 1, 2, 0],
  6:    [null, 0, 2, 2, 2, 2],
  min6: [null, 0, 2, 2, 1, 2],
  sus4: [null, 0, 2, 2, 3, 0],
  sus2: [null, 0, 2, 2, 0, 0],
  m9:   [null, 0, 2, 4, 1, 0],
  9:    [null, 0, 2, 4, 2, 3],
  add9: [null, 0, 2, 4, 2, 0],
  maj9: [null, 0, 2, 1, 0, 0],
  aug:  [null, 0, 3, 2, 2, null],
  dim:  [null, 0, 1, 2, 1, null],
  dim7: [null, 0, 1, 2, 1, null],
  m7b5: [null, 0, 1, 0, 1, null],
};

// Open-string pitch classes, low E -> high E, matching STRINGS order.
const OPEN_PC = [4, 9, 2, 7, 11, 4];

const shift = (form, barre) =>
  form.map((f) => (f == null ? null : f + barre));

/**
 * The ordinary guitar shape for a chord, as frets from the effective nut.
 * Returns { shape, form, barre } or null when the chord cannot be voiced.
 *   form  : "open" | "E" | "A"
 *   barre : fret of the barre finger, 0 when the shape is open
 */
export const guitarShapeFor = (root, typeId) => {
  const rootPc = typeof root === "string" ? pcOf(root) : root;
  if (rootPc == null || rootPc < 0) return null;

  const open = OPEN[rootPc + ":" + typeId];
  if (open) return { shape: open.slice(), form: "open", barre: 0 };

  // Barre fret so the carrying string's note is the root. Prefer whichever
  // form sits lower on the neck, but never at fret 0 (that would be an open
  // shape, and if a real one existed it would have matched above).
  const eFret = ((rootPc - OPEN_PC[0]) % 12 + 12) % 12 || 12;
  const aFret = ((rootPc - OPEN_PC[1]) % 12 + 12) % 12 || 12;
  const eForm = E_FORMS[typeId];
  const aForm = A_FORMS[typeId];

  const options = [];
  if (eForm) options.push({ shape: shift(eForm, eFret), form: "E", barre: eFret });
  if (aForm) options.push({ shape: shift(aForm, aFret), form: "A", barre: aFret });
  if (!options.length) return null;

  // Lowest playable position wins; a shape running past fret 12 is rejected in
  // favour of the alternative rather than drawn off the end of the neck.
  const ok = options.filter((o) => Math.max(...o.shape.filter((f) => f != null)) <= 12);
  const pool = ok.length ? ok : options;
  pool.sort((a, b) => a.barre - b.barre);
  return pool[0];
};

/**
 * Chart token + full capo -> everything the popup needs for a guitar diagram.
 * With a capo at fret n the fingered shape is the sounding chord transposed
 * DOWN by n, so the shape returned is in EFFECTIVE-NUT coordinates and `capo`
 * says where that nut physically is.
 *
 * Returns { status:"not-a-chord" } | { status:"none", soundingLabel, ... }
 *       | { status:"ok", shape, form, barre, capo, soundingLabel, shapeLabel,
 *           transposed, reduced, notes }
 */
export const guitarAnswerFor = (token, capoFret = 0) => {
  const capo = Math.max(0, Math.round(Number(capoFret) || 0));
  const sounding = chartChordToCutCapo(token);
  if (!sounding) return { status: "not-a-chord", token, capo };

  // Transpose DOWN by the capo to get the shape actually under the fingers.
  const n = ((-capo % 12) + 12) % 12;
  const shapePc = (pcOf(sounding.root) + n) % 12;
  const shapeRoot = CHROMA[shapePc];
  const found = guitarShapeFor(shapePc, sounding.typeId);
  const shapeLabel = shapeRoot + labelSuffix(sounding.typeId);

  const base = {
    soundingLabel: sounding.label,
    shapeLabel,
    capo,
    transposed: capo > 0,
    reduced: sounding.reduced,
  };
  if (!found) return { ...base, status: "none" };

  // Sounding note names: the shape's pitches raised back up by the capo.
  const notes = [];
  found.shape.forEach((f, s) => {
    if (f == null) return;
    notes.push({ pc: (OPEN_PC[s] + f + capo) % 12, midi: [40, 45, 50, 55, 59, 64][s] + f + capo });
  });
  notes.sort((a, b) => a.midi - b.midi);

  return {
    ...base,
    status: "ok",
    shape: found.shape,
    form: found.form,
    barre: found.barre,
    notes: notes.map((x) => CHROMA[x.pc]),
  };
};

// The engine's type ids are internal; these are what a player reads.
const SUFFIX_LABEL = {
  maj: "", min: "m", 7: "7", m7: "m7", maj7: "maj7", 6: "6", min6: "m6", m6: "m6",
  sus4: "sus4", sus2: "sus2", add9: "add9", 9: "9", m9: "m9", maj9: "maj9",
  dim: "dim", dim7: "dim7", m7b5: "m7b5", aug: "aug",
};
const labelSuffix = (typeId) => (SUFFIX_LABEL[typeId] != null ? SUFFIX_LABEL[typeId] : typeId);

/**
 * The notes of a chord, low -> high, for keys and bass. Keyboard voicing is
 * two-handed and variable and bass is a single line, so neither gets a
 * fingering: they get the material to build one from.
 *
 * Capo is irrelevant here — it is a guitar device and does not change what the
 * chord sounds like, which is exactly what these two instruments need.
 *
 * Returns { status:"not-a-chord" } | { status:"ok", label, root, bass, notes, intervals }
 */
export const chordNotesFor = (token) => {
  const c = chartChordToCutCapo(token);
  if (!c) return { status: "not-a-chord", token };
  const rootPc = pcOf(c.root);
  const ivs = INTERVALS[c.typeId] || [0, 4, 7];
  return {
    status: "ok",
    label: c.label,
    root: c.root,
    bass: c.bass || c.root,
    reduced: c.reduced,
    notes: ivs.map((i) => CHROMA[(rootPc + i) % 12]),
    intervals: ivs.map((i) => DEGREE[i] || String(i)),
  };
};

// Semitones above the root for each modelled type.
const INTERVALS = {
  maj: [0, 4, 7], min: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11], 6: [0, 4, 7, 9], min6: [0, 3, 7, 9], m6: [0, 3, 7, 9],
  sus4: [0, 5, 7], sus2: [0, 2, 7], add9: [0, 4, 7, 14 % 12],
  9: [0, 4, 7, 10, 2], m9: [0, 3, 7, 10, 2], maj9: [0, 4, 7, 11, 2],
  dim: [0, 3, 6], dim7: [0, 3, 6, 9], m7b5: [0, 3, 6, 10], aug: [0, 4, 8],
};
const DEGREE = { 0: "1", 2: "9", 3: "b3", 4: "3", 5: "4", 6: "b5", 7: "5", 8: "#5", 9: "6", 10: "b7", 11: "7" };
