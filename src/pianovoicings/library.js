// ============================================================================
// RICH VOICINGS PIANO STUDIO — voicing library + pitch/transposition engine
// ----------------------------------------------------------------------------
// Voicings are hand-authored in the key of C (the heart of the app) so the
// smooth voice-leading is preserved, then transposed to the chosen key by a
// pure semitone shift. We NEVER algorithmically stack intervals — the exact
// curated voicings below are the source of truth.
//
// Notes use scientific pitch notation (e.g. C2, E4, G#4). LH = left hand
// (blue), RH = right hand (yellow). The library is built to expand: add more
// entries to FOUNDATIONS / POP_GOSPEL and everything else follows.
// ============================================================================

// ---- Pitch helpers ---------------------------------------------------------
// MIDI convention: C4 = 60, so midi = (octave + 1) * 12 + pitchClass.
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NAMES  = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

export function spnToMidi(spn) {
  const m = /^([A-G])(#|b)?(-?\d+)$/.exec(spn);
  if (!m) return null;
  let pc = LETTER_PC[m[1]];
  if (m[2] === "#") pc += 1;
  if (m[2] === "b") pc -= 1;
  const octave = parseInt(m[3], 10);
  return (octave + 1) * 12 + ((pc % 12) + 12) % 12;
}

export function pcOf(midi) { return ((midi % 12) + 12) % 12; }

// Enharmonic-appropriate note-name label for a pitch class in a key context.
// Flat keys spell with flats, sharp keys with sharps; default to sharps.
export function spellPc(pc, acc) {
  const p = ((pc % 12) + 12) % 12;
  return acc === "flat" ? FLAT_NAMES[p] : SHARP_NAMES[p];
}

// ---- Keys ------------------------------------------------------------------
// All 12, with the enharmonic spelling worship players actually read, and each
// key's accidental preference for on-key note labels.
export const KEYS = [
  { name: "C",  pc: 0,  acc: "sharp" },
  { name: "Db", pc: 1,  acc: "flat"  },
  { name: "D",  pc: 2,  acc: "sharp" },
  { name: "Eb", pc: 3,  acc: "flat"  },
  { name: "E",  pc: 4,  acc: "sharp" },
  { name: "F",  pc: 5,  acc: "flat"  },
  { name: "F#", pc: 6,  acc: "sharp" },
  { name: "G",  pc: 7,  acc: "sharp" },
  { name: "Ab", pc: 8,  acc: "flat"  },
  { name: "A",  pc: 9,  acc: "sharp" },
  { name: "Bb", pc: 10, acc: "flat"  },
  { name: "B",  pc: 11, acc: "sharp" },
];

// Worship-friendly keys get extra weight in "Surprise me".
const WORSHIP_KEYS = new Set(["C", "G", "D", "A", "E", "F", "Bb"]);

export function keyByName(name) { return KEYS.find((k) => k.name === name) || KEYS[0]; }

// Semitone shift to move a C-authored voicing into the target key.
// If the shift would be > 6, transpose DOWN instead so voicings stay in a
// comfortable worship register (e.g. G: +7 -> -5).
export function offsetForKey(key) {
  let o = key.pc; // C = 0
  if (o > 6) o -= 12;
  return o;
}

// Weighted-random key pick, favouring worship keys.
export function surpriseKey() {
  const bag = [];
  for (const k of KEYS) {
    const weight = WORSHIP_KEYS.has(k.name) ? 3 : 1;
    for (let i = 0; i < weight; i++) bag.push(k);
  }
  return bag[Math.floor(Math.random() * bag.length)];
}

// ---- Chord-symbol transposition -------------------------------------------
// Split "Cmaj7", "G7sus4", "C/E" into root / quality / optional slash bass,
// shift the root (and bass) by the offset, and respell in the key's accidental.
export function transposeSymbol(symbol, offset, acc) {
  const m = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(symbol);
  if (!m) return symbol;
  const rootPc = pcOf(spnToMidi(m[1] + "4"));
  const quality = m[2] || "";
  let out = spellPc(rootPc + offset, acc) + quality;
  if (m[3]) {
    const bassPc = pcOf(spnToMidi(m[3] + "4"));
    out += "/" + spellPc(bassPc + offset, acc);
  }
  return out;
}

// Transpose a single authored chord into the target key. Returns lit-key data
// ({midi,label}) for each hand plus the transposed display symbol.
export function transposeChord(chord, offset, acc) {
  const conv = (spn) => {
    const midi = spnToMidi(spn) + offset;
    return { midi, label: spellPc(pcOf(midi), acc) };
  };
  return {
    symbol: transposeSymbol(chord.symbol, offset, acc),
    num: chord.num,
    lh: chord.lh.map(conv),
    rh: chord.rh.map(conv),
  };
}

// ============================================================================
// THE LIBRARY — authored in C
// ============================================================================
// Foundations — clean 7ths and add9. No slash chords, no secondary dominants.
export const FOUNDATIONS = [
  {
    level: "foundations", name: "1 – 6m – 4 – 5", numbers: "1 · 6m · 4 · 5",
    chords: [
      { symbol: "Cmaj7", num: "1",  lh: ["C2"], rh: ["E4", "G4", "B4"] },
      { symbol: "Am7",   num: "6m", lh: ["A2"], rh: ["E4", "G4", "C5"] },
      { symbol: "Fmaj7", num: "4",  lh: ["F2"], rh: ["E4", "A4", "C5"] },
      { symbol: "G7",    num: "5",  lh: ["G2"], rh: ["F4", "G4", "B4"] },
    ],
  },
  {
    level: "foundations", name: "1 – 4 – 5 – 1", numbers: "1 · 4 · 5 · 1",
    chords: [
      { symbol: "Cadd9", num: "1", lh: ["C2"], rh: ["E4", "G4", "D5"] },
      { symbol: "Fmaj7", num: "4", lh: ["F2"], rh: ["E4", "A4", "C5"] },
      { symbol: "G7",    num: "5", lh: ["G2"], rh: ["F4", "G4", "B4"] },
      { symbol: "Cmaj7", num: "1", lh: ["C2"], rh: ["E4", "G4", "B4"] },
    ],
  },
  {
    level: "foundations", name: "2m – 5 – 1", numbers: "2m · 5 · 1",
    chords: [
      { symbol: "Dm7",   num: "2m", lh: ["D2"], rh: ["F4", "A4", "C5"] },
      { symbol: "G7",    num: "5",  lh: ["G2"], rh: ["F4", "G4", "B4"] },
      { symbol: "Cmaj7", num: "1",  lh: ["C2"], rh: ["E4", "G4", "B4"] },
    ],
  },
];

// Pop Gospel — 7ths + add9/sus + slash-bass movement + one secondary-dom lift.
export const POP_GOSPEL = [
  {
    level: "popgospel", name: "1 – 5 – 6m – 4", numbers: "1 · 5 · 6m · 4",
    chords: [
      { symbol: "Cadd9",  num: "1",  lh: ["C2"], rh: ["E4", "G4", "D5"] },
      { symbol: "G7sus4", num: "5",  lh: ["G2"], rh: ["F4", "G4", "C5"] },
      { symbol: "Am7",    num: "6m", lh: ["A2"], rh: ["E4", "G4", "C5"] },
      { symbol: "Fmaj7",  num: "4",  lh: ["F2"], rh: ["E4", "A4", "C5"] },
    ],
  },
  {
    level: "popgospel", name: "4 – 1/3 – 2m – 5sus", numbers: "4 · 1/3 · 2m · 5sus",
    chords: [
      { symbol: "Fmaj7",  num: "4",    lh: ["F2"], rh: ["E4", "A4", "C5"] },
      { symbol: "C/E",    num: "1/3",  lh: ["E2"], rh: ["E4", "G4", "C5"] },
      { symbol: "Dm7",    num: "2m",   lh: ["D2"], rh: ["F4", "A4", "C5"] },
      { symbol: "G7sus4", num: "5sus", lh: ["G2"], rh: ["F4", "G4", "C5"] },
    ],
  },
  {
    level: "popgospel", name: "6m – 4 – 1 – 5sus", numbers: "6m · 4 · 1 · 5sus",
    chords: [
      { symbol: "Am7",    num: "6m",   lh: ["A2"], rh: ["E4", "G4", "C5"] },
      { symbol: "Fmaj7",  num: "4",    lh: ["F2"], rh: ["E4", "A4", "C5"] },
      { symbol: "Cadd9",  num: "1",    lh: ["C2"], rh: ["E4", "G4", "D5"] },
      { symbol: "G7sus4", num: "5sus", lh: ["G2"], rh: ["F4", "G4", "C5"] },
    ],
  },
  {
    level: "popgospel", name: "1 – 3(7) – 6m – 4", numbers: "1 · 3(7) · 6m · 4",
    chords: [
      { symbol: "Cadd9", num: "1",    lh: ["C2"], rh: ["E4", "G4", "D5"] },
      { symbol: "E7",    num: "3(7)", lh: ["E2"], rh: ["G#4", "B4", "D5"] },
      { symbol: "Am7",   num: "6m",   lh: ["A2"], rh: ["E4", "G4", "C5"] },
      { symbol: "Fmaj7", num: "4",    lh: ["F2"], rh: ["E4", "A4", "C5"] },
    ],
  },
];

export const LEVELS = {
  foundations: { id: "foundations", label: "Foundations", progressions: FOUNDATIONS,
    blurb: "Clean 7ths and add9. The on-ramp — no slash chords, no secondary dominants." },
  popgospel:   { id: "popgospel", label: "Pop Gospel", progressions: POP_GOSPEL,
    blurb: "7ths + add9/sus + slash-bass movement + a secondary-dominant lift. The richer pocket." },
};

// Keyboard range used by the studio (comfortably covers every authored note
// once transposed): C2 .. C6.
export const KEYBOARD_LOW = spnToMidi("C2");   // 36
export const KEYBOARD_HIGH = spnToMidi("C6");  // 84
