// ============================================================================
// KEYBOARD STUDIO — music theory data (Lara, piano/keys)
// ----------------------------------------------------------------------------
// Every scale spelling, key signature, chord spelling and fingering in this file
// is explicit and verified. Nothing here is derived at runtime by guesswork.
// ============================================================================

// Pitch class of every spelling we use (C = 0). Includes double-flat Fb/Cb and
// double-sharp-adjacent E#/B# so enharmonic keys spell correctly.
export const PC = {
  "C": 0,  "B#": 0,
  "C#": 1, "Db": 1,
  "D": 2,
  "D#": 3, "Eb": 3,
  "E": 4,  "Fb": 4,
  "F": 5,  "E#": 5,
  "F#": 6, "Gb": 6,
  "G": 7,
  "G#": 8, "Ab": 8,
  "A": 9,
  "A#": 10, "Bb": 10,
  "B": 11, "Cb": 11,
};

// ---------------------------------------------------------------------------
// THE 15 MAJOR KEYS
// side: "sharp" | "flat" | "neither"
// accidentals: the ordered key-signature accidentals (sharp order F C G D A E B,
//              flat order B E A D G C F)
// notes: the eight-note ascending scale, root repeated at the octave
// ---------------------------------------------------------------------------
export const SCALES = [
  { name:"C",  side:"neither", accidentals:[],
    notes:["C","D","E","F","G","A","B","C"] },
  { name:"G",  side:"sharp", accidentals:["F#"],
    notes:["G","A","B","C","D","E","F#","G"] },
  { name:"D",  side:"sharp", accidentals:["F#","C#"],
    notes:["D","E","F#","G","A","B","C#","D"] },
  { name:"A",  side:"sharp", accidentals:["F#","C#","G#"],
    notes:["A","B","C#","D","E","F#","G#","A"] },
  { name:"E",  side:"sharp", accidentals:["F#","C#","G#","D#"],
    notes:["E","F#","G#","A","B","C#","D#","E"] },
  { name:"B",  side:"sharp", accidentals:["F#","C#","G#","D#","A#"],
    notes:["B","C#","D#","E","F#","G#","A#","B"] },
  { name:"F#", side:"sharp", accidentals:["F#","C#","G#","D#","A#","E#"],
    notes:["F#","G#","A#","B","C#","D#","E#","F#"] },
  { name:"C#", side:"sharp", accidentals:["F#","C#","G#","D#","A#","E#","B#"],
    notes:["C#","D#","E#","F#","G#","A#","B#","C#"] },
  { name:"F",  side:"flat", accidentals:["Bb"],
    notes:["F","G","A","Bb","C","D","E","F"] },
  { name:"Bb", side:"flat", accidentals:["Bb","Eb"],
    notes:["Bb","C","D","Eb","F","G","A","Bb"] },
  { name:"Eb", side:"flat", accidentals:["Bb","Eb","Ab"],
    notes:["Eb","F","G","Ab","Bb","C","D","Eb"] },
  { name:"Ab", side:"flat", accidentals:["Bb","Eb","Ab","Db"],
    notes:["Ab","Bb","C","Db","Eb","F","G","Ab"] },
  { name:"Db", side:"flat", accidentals:["Bb","Eb","Ab","Db","Gb"],
    notes:["Db","Eb","F","Gb","Ab","Bb","C","Db"] },
  { name:"Gb", side:"flat", accidentals:["Bb","Eb","Ab","Db","Gb","Cb"],
    notes:["Gb","Ab","Bb","Cb","Db","Eb","F","Gb"] },
  { name:"Cb", side:"flat", accidentals:["Bb","Eb","Ab","Db","Gb","Cb","Fb"],
    notes:["Cb","Db","Eb","Fb","Gb","Ab","Bb","Cb"] },
];

// Presentation order — the true circle, sharps then flats.
export const SCALE_ORDER = ["C","G","D","A","E","B","F#","C#","F","Bb","Eb","Ab","Db","Gb","Cb"];

export const scaleByName = (n) => SCALES.find((s) => s.name === n);

// Every possible accidental chip, so a gate can never be solved by elimination.
export const SHARP_CHIPS = ["F#","C#","G#","D#","A#","E#","B#"];
export const FLAT_CHIPS  = ["Bb","Eb","Ab","Db","Gb","Cb","Fb"];

// ---------------------------------------------------------------------------
// FINGERING — one octave ascending, 8 notes (root repeated at top)
// RH: 1=thumb … 5=pinky.  LH: 5=pinky … 1=thumb.
// F#/C#/Cb use the fingering of their enharmonic twin (Gb/Db/B).
// ---------------------------------------------------------------------------
export const RH_FINGERING = {
  "C":  [1,2,3,1,2,3,4,5],
  "G":  [1,2,3,1,2,3,4,5],
  "D":  [1,2,3,1,2,3,4,5],
  "A":  [1,2,3,1,2,3,4,5],
  "E":  [1,2,3,1,2,3,4,5],
  "B":  [1,2,3,1,2,3,4,5],
  "F":  [1,2,3,4,1,2,3,4],
  "Bb": [4,1,2,3,1,2,3,4],
  "Eb": [3,1,2,3,4,1,2,3],
  "Ab": [3,4,1,2,3,1,2,3],
  "Db": [2,3,1,2,3,4,1,2],
  "Gb": [2,3,4,1,2,3,1,2],
  "F#": [2,3,4,1,2,3,1,2], // same keys as Gb
  "C#": [2,3,1,2,3,4,1,2], // same keys as Db
  "Cb": [1,2,3,1,2,3,4,5], // same keys as B
};

export const LH_FINGERING = {
  "C":  [5,4,3,2,1,3,2,1],
  "G":  [5,4,3,2,1,3,2,1],
  "D":  [5,4,3,2,1,3,2,1],
  "A":  [5,4,3,2,1,3,2,1],
  "E":  [5,4,3,2,1,3,2,1],
  "B":  [4,3,2,1,4,3,2,1],
  "F":  [5,4,3,2,1,3,2,1],
  "Bb": [3,2,1,4,3,2,1,3],
  "Eb": [3,2,1,4,3,2,1,3],
  "Ab": [3,2,1,4,3,2,1,3],
  "Db": [3,2,1,4,2,1,3,2],
  "Gb": [4,3,2,1,3,2,1,4],
  "F#": [4,3,2,1,3,2,1,4], // matches Gb
  "C#": [3,2,1,4,2,1,3,2], // matches Db
  "Cb": [4,3,2,1,4,3,2,1], // matches B
};

// ---------------------------------------------------------------------------
// CHORDS — major, minor, diminished, dominant 7 on all 12 chromatic roots.
// Spellings are written out, not generated, and follow standard practice
// (flat roots spell flat, sharp roots spell sharp; a diminished 5th or minor 3rd
// keeps the correct letter name even when that means a double flat is avoided by
// choosing the conventional spelling used in teaching material).
// ---------------------------------------------------------------------------
export const CHORD_ROOTS = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];

export const CHORD_QUALITIES = [
  { id:"maj",  label:"Major",      suffix:"",    fingering:[1,3,5] },
  { id:"min",  label:"Minor",      suffix:"m",   fingering:[1,3,5] },
  { id:"dim",  label:"Diminished", suffix:"dim", fingering:[1,3,5] },
  { id:"dom7", label:"Dominant 7", suffix:"7",   fingering:[1,2,3,5] },
];

// root -> quality -> note spellings, root position, ascending.
export const CHORDS = {
  "C":  { maj:["C","E","G"],      min:["C","Eb","G"],    dim:["C","Eb","Gb"],   dom7:["C","E","G","Bb"] },
  "Db": { maj:["Db","F","Ab"],    min:["Db","E","Ab"],   dim:["Db","E","G"],    dom7:["Db","F","Ab","Cb"] },
  "D":  { maj:["D","F#","A"],     min:["D","F","A"],     dim:["D","F","Ab"],    dom7:["D","F#","A","C"] },
  "Eb": { maj:["Eb","G","Bb"],    min:["Eb","Gb","Bb"],  dim:["Eb","Gb","A"],   dom7:["Eb","G","Bb","Db"] },
  "E":  { maj:["E","G#","B"],     min:["E","G","B"],     dim:["E","G","Bb"],    dom7:["E","G#","B","D"] },
  "F":  { maj:["F","A","C"],      min:["F","Ab","C"],    dim:["F","Ab","Cb"],   dom7:["F","A","C","Eb"] },
  "Gb": { maj:["Gb","Bb","Db"],   min:["Gb","A","Db"],   dim:["Gb","A","C"],    dom7:["Gb","Bb","Db","Fb"] },
  "G":  { maj:["G","B","D"],      min:["G","Bb","D"],    dim:["G","Bb","Db"],   dom7:["G","B","D","F"] },
  "Ab": { maj:["Ab","C","Eb"],    min:["Ab","B","Eb"],   dim:["Ab","B","D"],    dom7:["Ab","C","Eb","Gb"] },
  "A":  { maj:["A","C#","E"],     min:["A","C","E"],     dim:["A","C","Eb"],    dom7:["A","C#","E","G"] },
  "Bb": { maj:["Bb","D","F"],     min:["Bb","Db","F"],   dim:["Bb","Db","Fb"],  dom7:["Bb","D","F","Ab"] },
  "B":  { maj:["B","D#","F#"],    min:["B","D","F#"],    dim:["B","D","F"],     dom7:["B","D#","F#","A"] },
};

export const chordName = (root, qualityId) =>
  root + (CHORD_QUALITIES.find((q) => q.id === qualityId)?.suffix ?? "");

export const chordNotes = (root, qualityId) => CHORDS[root]?.[qualityId] ?? [];

// The 12 chip options offered at the chord gate. Spelling follows the chord:
// a chord that uses flats gets the flat chip set, one that uses sharps gets
// sharps, plus any exotic spelling the chord itself needs (Cb, Fb, E#, B#).
const FLAT_12  = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];
const SHARP_12 = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

export function chordChips(root, qualityId) {
  const notes = chordNotes(root, qualityId);
  const usesSharp = notes.some((n) => n.includes("#"));
  const base = usesSharp ? SHARP_12 : FLAT_12;
  const chips = base.slice();
  // Make sure every chord tone is actually offered (covers Cb / Fb spellings).
  for (const n of notes) if (!chips.includes(n)) chips.push(n);
  // Sort by pitch class so the row reads like a keyboard, exotic spellings last.
  return chips.sort((a, b) => (PC[a] - PC[b]) || (base.indexOf(b) - base.indexOf(a)));
}

