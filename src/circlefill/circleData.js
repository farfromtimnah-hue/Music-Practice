// ============================================================
// Shared data and helpers for Fill in the Circle, the hand method,
// the stickers, and the two circle games. No React in this file.
// ============================================================
import { SCALES, scaleByName, PC } from "../keyboard/theory.js";
import { placeAscending } from "../keyboard/KeyboardStudio.jsx";
export * from "./circleLogic.js";

// ---------------- scales and pitch ----------------
// Absolute keyboard index of each of the 8 notes. Index 0 is the lowest C on the
// keyboard drawn in KeyboardStudio. We call it C4 (261.63 Hz), so C major starts
// on C4. Other keys use the same layout, so the sound matches the lit keys.
export const C4 = 261.63;
export const scaleMidis = (keyName) => placeAscending(scaleByName(keyName).notes);
export const freqOfIndex = (i) => C4 * Math.pow(2, i / 12);
export const scaleFreqs = (keyName) => scaleMidis(keyName).map(freqOfIndex);
export { SCALES, scaleByName, PC };

// ---------------- stickers ----------------
export const STICKERS = {
  C: "🌈", G: "🎸", D: "🥁", A: "🎹", E: "🎺",
  B: "🎻", "F#": "🦄", "C#": "🐬", F: "🐻", Bb: "🦊",
  Eb: "🐢", Ab: "🦋", Db: "🐙", Gb: "🦁", Cb: "🐼",
};
export const STICKER_WORDS = {
  C: "rainbow", G: "guitar", D: "drum", A: "piano keys", E: "trumpet", B: "violin", "F#": "unicorn", "C#": "dolphin",
  F: "bear", Bb: "fox", Eb: "turtle", Ab: "butterfly", Db: "octopus", Gb: "lion", Cb: "panda",
};
const stickerKey = (name) => "circleStickers_" + (name || "teacher");
export function readStickers(name) {
  try {
    const raw = localStorage.getItem(stickerKey(name));
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === "object" ? obj : {};
  } catch (e) { return {}; }
}
// Returns true if this was a new sticker.
export function earnSticker(name, keyName) {
  const cur = readStickers(name);
  if (cur[keyName]) return false;
  try { localStorage.setItem(stickerKey(name), JSON.stringify({ ...cur, [keyName]: true })); } catch (e) { /* storage blocked */ }
  return true;
}
