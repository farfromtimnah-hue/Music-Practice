// ============================================================================
// CUT CAPO — CHORD DEFINITIONS, PARSING & NAMING
// ============================================================================
import { pc, CHROMA } from "./tuning.js";

export const ROOTS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Chord types as semitone intervals from the root.
//   intervals : all chord tones (14 = the 9th = pitch class of interval 2)
//   optional  : intervals that MAY be dropped to make a shape playable
//   prio      : lower = simpler / more common (used to break naming ties)
export const CHORD_TYPES = [
  { id: "maj",   label: "maj",   sym: "",      intervals: [0, 4, 7],        optional: [7],  prio: 0 },
  { id: "min",   label: "min",   sym: "m",     intervals: [0, 3, 7],        optional: [7],  prio: 1 },
  { id: "7",     label: "7",     sym: "7",     intervals: [0, 4, 7, 10],    optional: [7],  prio: 2 },
  { id: "m7",    label: "m7",    sym: "m7",    intervals: [0, 3, 7, 10],    optional: [7],  prio: 3 },
  { id: "maj7",  label: "maj7",  sym: "maj7",  intervals: [0, 4, 7, 11],    optional: [7],  prio: 4 },
  { id: "sus2",  label: "sus2",  sym: "sus2",  intervals: [0, 2, 7],        optional: [],   prio: 5 },
  { id: "sus4",  label: "sus4",  sym: "sus4",  intervals: [0, 5, 7],        optional: [],   prio: 6 },
  { id: "add9",  label: "add9",  sym: "add9",  intervals: [0, 4, 7, 14],    optional: [7],  prio: 7 },
  { id: "6",     label: "6",     sym: "6",     intervals: [0, 4, 7, 9],     optional: [7],  prio: 8 },
  { id: "m6",    label: "m6",    sym: "m6",    intervals: [0, 3, 7, 9],     optional: [7],  prio: 9 },
  { id: "dim",   label: "dim",   sym: "dim",   intervals: [0, 3, 6],        optional: [],   prio: 10 },
  { id: "aug",   label: "aug",   sym: "aug",   intervals: [0, 4, 8],        optional: [],   prio: 11 },
  { id: "m7b5",  label: "m7b5",  sym: "m7b5",  intervals: [0, 3, 6, 10],    optional: [],   prio: 12 },
  { id: "dim7",  label: "dim7",  sym: "dim7",  intervals: [0, 3, 6, 9],     optional: [],   prio: 13 },
  { id: "9",     label: "9",     sym: "9",     intervals: [0, 4, 7, 10, 14], optional: [7], prio: 14 },
  { id: "maj9",  label: "maj9",  sym: "maj9",  intervals: [0, 4, 7, 11, 14], optional: [7], prio: 15 },
  { id: "m9",    label: "m9",    sym: "m9",    intervals: [0, 3, 7, 10, 14], optional: [7], prio: 16 },
];

export const getType = (id) => CHORD_TYPES.find((t) => t.id === id);

// The common set surfaced first in Discover mode.
export const COMMON_TYPE_IDS = ["maj", "min", "7", "m7", "maj7", "sus2", "sus4", "add9"];

/** Pretty chord label, e.g. ("A","7") -> "A7", ("G","min") -> "Gm". */
export function chordLabel(rootName, typeId, bassName) {
  const t = getType(typeId);
  const base = rootName + (t ? t.sym : "");
  return bassName ? `${base}/${bassName}` : base;
}

/** All pitch classes of a chord (root name or index + type id). */
export function chordPcs(root, typeId) {
  const r = typeof root === "string" ? ROOTS.indexOf(root) : root;
  const t = getType(typeId);
  return unique(t.intervals.map((i) => pc(r + i)));
}

/** Required (non-droppable) pitch classes of a chord. */
export function requiredPcs(root, typeId) {
  const r = typeof root === "string" ? ROOTS.indexOf(root) : root;
  const t = getType(typeId);
  return unique(t.intervals.filter((i) => !t.optional.includes(i)).map((i) => pc(r + i)));
}

// ---------------------------------------------------------------------------
// SEARCH-BOX PARSING  ("Gm", "A7", "E/G#", "Cmaj7", "F#m7b5", "Bb", ...)
// ---------------------------------------------------------------------------
const FLAT_TO_SHARP = { Cb: "B", Db: "C#", Eb: "D#", Fb: "E", Gb: "F#", Ab: "G#", Bb: "A#" };

function normRoot(letter, accidental) {
  let name = letter.toUpperCase() + (accidental || "");
  if (accidental === "b") name = FLAT_TO_SHARP[name] || name;
  if (accidental === "##") name = CHROMA[pc(ROOTS.indexOf(letter.toUpperCase() + "#") + 1)];
  return ROOTS.includes(name) ? name : null;
}

// Map a written quality suffix -> chord type id. Longest matches first.
const SUFFIX_MAP = [
  ["maj7", "maj7"], ["maj9", "maj9"], ["M7", "maj7"],
  ["m7b5", "m7b5"], ["ø", "m7b5"],
  ["dim7", "dim7"], ["°7", "dim7"], ["dim", "dim"], ["°", "dim"],
  ["m9", "m9"], ["m7", "m7"], ["m6", "m6"],
  ["add9", "add9"], ["sus2", "sus2"], ["sus4", "sus4"], ["sus", "sus4"],
  ["aug", "aug"], ["+", "aug"],
  ["min", "min"], ["m", "min"], ["-", "min"],
  ["maj", "maj"], ["M", "maj"],
  ["9", "9"], ["7", "7"], ["6", "6"],
  ["", "maj"],
];

/**
 * Parse a chord string into { root, typeId, bass } (names / id) or null.
 */
export function parseChord(input) {
  if (!input) return null;
  let s = input.trim();
  if (!s) return null;

  // split slash bass
  let bass = null;
  const slash = s.split("/");
  if (slash.length === 2 && slash[1].trim()) {
    const bm = slash[1].trim().match(/^([A-Ga-g])(#|##|b)?$/);
    if (bm) bass = normRoot(bm[1], bm[2]);
    s = slash[0].trim();
  }

  const m = s.match(/^([A-Ga-g])(#|##|b)?(.*)$/);
  if (!m) return null;
  const root = normRoot(m[1], m[2]);
  if (!root) return null;

  let rest = (m[3] || "").trim();
  let typeId = null;
  for (const [suffix, id] of SUFFIX_MAP) {
    if (rest.toLowerCase() === suffix.toLowerCase() || (suffix && rest === suffix)) {
      typeId = id;
      break;
    }
  }
  if (!typeId) return null;
  return { root, typeId, bass };
}

// ---------------------------------------------------------------------------
// AUTO-NAMING  (Builder mode reverse lookup)
// ---------------------------------------------------------------------------
/**
 * Given a set of sounding pitch classes and the bass pitch class, return the
 * chord name(s) that match. A type matches when the sounding set contains all
 * required tones, contains no notes outside the chord, and includes the root.
 * When more than one name fits, all are returned ranked best-first.
 *
 * Returns { names: [{name, exact, missing:[noteNames]}], notes:[noteNames] }.
 * names is empty when nothing standard matches.
 */
export function nameChord(pcSet, bassPc) {
  const set = unique(pcSet).sort((a, b) => a - b);
  const has = (x) => set.includes(x);
  const results = [];

  for (let root = 0; root < 12; root++) {
    if (!has(root)) continue; // the root must sound
    for (const t of CHORD_TYPES) {
      const full = unique(t.intervals.map((i) => pc(root + i)));
      const req = unique(t.intervals.filter((i) => !t.optional.includes(i)).map((i) => pc(root + i)));
      // no wrong notes:
      if (!set.every((n) => full.includes(n))) continue;
      // all required tones present:
      if (!req.every((n) => set.includes(n))) continue;
      const missing = full.filter((n) => !set.includes(n)); // only optional can be missing
      const exact = missing.length === 0 && set.length === full.length;
      const isSlash = bassPc != null && bassPc !== root && has(bassPc);
      const name = ROOTS[root] + t.sym + (isSlash ? "/" + CHROMA[bassPc] : "");
      results.push({
        name,
        exact,
        rootPos: bassPc == null || bassPc === root,
        prio: t.prio,
        missing: missing.map((n) => CHROMA[n]),
        _root: root,
        _cover: full.length, // richer chords first when otherwise tied
      });
    }
  }

  results.sort((a, b) => {
    if (a.exact !== b.exact) return a.exact ? -1 : 1;
    if (a.rootPos !== b.rootPos) return a.rootPos ? -1 : 1;
    if (a.missing.length !== b.missing.length) return a.missing.length - b.missing.length;
    if (a._cover !== b._cover) return b._cover - a._cover;
    return a.prio - b.prio;
  });

  // de-dupe by display name, keep best
  const seen = new Set();
  const names = [];
  for (const r of results) {
    if (seen.has(r.name)) continue;
    seen.add(r.name);
    names.push({ name: r.name, exact: r.exact, missing: r.missing });
  }

  return { names, notes: set.map((n) => CHROMA[n]) };
}

function unique(arr) {
  return [...new Set(arr)];
}
