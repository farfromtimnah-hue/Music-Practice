// ============================================================
// Pure logic: key lists, counting path, the finger method. No React, no imports,
// so node can run it in scripts/check-circle-hand.mjs.
// ============================================================

export const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"];
export const FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"];
export const SHARP_KEYS = ["C", "G", "D", "A", "E", "B", "F#", "C#"];
export const FLAT_KEYS = ["F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"];
// same 15 positions, clockwise, as the main circle
export const CIRCLE_ORDER = ["C", "G", "D", "A", "E", "B", "F#", "C#", "Cb", "Gb", "Db", "Ab", "Eb", "Bb", "F"];
export const LETTERS = ["A", "B", "C", "D", "E", "F", "G"];

export const sideOf = (k) => (k === "C" ? "neither" : SHARP_KEYS.includes(k) ? "sharp" : "flat");
export const pretty = (k) => k.replace("#", "♯").replace(/(?<=.)b/, "♭");
export const letterOf = (k) => k[0];

// The counting path. Sharp side runs C to C#. Flat side runs C to Cb.
export const PATH_SHARP = SHARP_KEYS;                 // C G D A E B F# C#
export const PATH_FLAT = ["C", ...FLAT_KEYS];         // C F Bb Eb Ab Db Gb Cb
// The key that comes before k on its counting path.
export function prevKey(k) {
  const s = sideOf(k);
  if (s === "sharp") return PATH_SHARP[PATH_SHARP.indexOf(k) - 1];
  if (s === "flat") return PATH_FLAT[PATH_FLAT.indexOf(k) - 1];
  return null;
}

// ---------------- the finger method ----------------
// Sharp side: five fingers, thumb first. Flat side: four fingers, pointer first.
export function fingerLetters(startLetter, side) {
  const n = side === "sharp" ? 5 : 4;
  const s = LETTERS.indexOf(startLetter);
  return Array.from({ length: n }, (_, i) => LETTERS[(s + i) % 7]);
}
export const handAnswer = (startLetter, side) => {
  const f = fingerLetters(startLetter, side);
  return f[f.length - 1];
};
export const FINGER_NAMES = ["Thumb", "Pointer", "Middle", "Ring", "Pinky"];


// Order the stickers are shown in: the true circle, sharps then flats.
export const SCALE_ORDER_KEYS = ["C", "G", "D", "A", "E", "B", "F#", "C#", "F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"];
