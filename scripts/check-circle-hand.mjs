// Checks the finger method and the scale data for all 15 keys.
// Run: node scripts/check-circle-hand.mjs
import { SCALES, PC } from "../src/keyboard/theory.js";
import { SHARP_KEYS, FLAT_KEYS, PATH_FLAT, LETTERS, fingerLetters, handAnswer, prevKey } from "../src/circlefill/circleLogic.js";

const fingers = (start, n) => fingerLetters(start, n === 5 ? "sharp" : "flat");
let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log("FAIL:", msg); } };

console.log("SHARP SIDE (thumb start, 5 fingers, pinky answer)");
for (let i = 0; i < SHARP_KEYS.length - 1; i++) {
  const from = SHARP_KEYS[i], to = SHARP_KEYS[i + 1];
  const f = fingers(from[0], 5);
  console.log(`  ${from.padEnd(2)} -> ${f.join(" ")} -> answer ${f[4]}, next key ${to}`);
  ok(f[4] === to[0] && handAnswer(from[0], "sharp") === to[0] && prevKey(to) === from, `sharp ${from} -> ${to}`);
  // the next key is a perfect fifth (7 semitones) above
  ok((PC[to] - PC[from] + 12) % 12 === 7, `sharp ${from} -> ${to} is a fifth`);
}
console.log("FLAT SIDE (pointer start, 4 fingers, pinky answer)");
for (let i = 0; i < PATH_FLAT.length - 1; i++) {
  const from = PATH_FLAT[i], to = PATH_FLAT[i + 1];
  const f = fingers(from[0], 4);
  console.log(`  ${from.padEnd(2)} -> ${f.join(" ")} -> answer ${f[3]}, next key ${to}`);
  ok(f[3] === to[0] && handAnswer(from[0], "flat") === to[0] && prevKey(to) === from, `flat ${from} -> ${to}`);
  // the next key is a fifth below (5 semitones above)
  ok((PC[to] - PC[from] + 12) % 12 === 5, `flat ${from} -> ${to} is a fifth below`);
}
console.log("SCALES (spelling, letters, steps 2 2 1 2 2 2 1)");
const STEPS = [2, 2, 1, 2, 2, 2, 1];
ok(SCALES.length === 15, "15 scales");
for (const s of SCALES) {
  // family line is built straight from SCALES notes, so compare to the source and to letter order
  const line = s.notes.join(" ");
  ok(s.notes.length === 8 && s.notes[0] === s.notes[7] && s.notes[0] === s.name, `${s.name} root and octave`);
  for (let i = 0; i < 7; i++) {
    ok(s.notes[i][0] === LETTERS[(LETTERS.indexOf(s.name[0]) + i) % 7], `${s.name} letter ${i}`);
    const step = (PC[s.notes[i + 1]] - PC[s.notes[i]] + 12) % 12;
    ok(step === STEPS[i], `${s.name} step ${i}: got ${step}`);
  }
  // accidentals in the key signature are exactly the accidental notes in the scale
  const acc = [...new Set(s.notes.filter((n) => n.length > 1))].sort().join();
  ok(acc === s.accidentals.slice().sort().join(), `${s.name} accidentals`);
  const steps = s.notes.slice(0, 7).map((n, i) => (PC[s.notes[i + 1]] - PC[n] + 12) % 12).join(",");
  console.log(`  ${s.name.padEnd(2)} ${line.padEnd(22)} steps ${steps}`);
}
console.log(`\n${checks} checks, ${fails} failed`);
process.exit(fails ? 1 : 0);
