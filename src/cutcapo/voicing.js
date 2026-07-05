// ============================================================================
// CUT CAPO — VOICING GENERATOR & RANKING
// ============================================================================
// A "voicing" is an array of length 6 (one entry per string, top->bottom):
//     null  -> muted
//     0     -> open / ringing (nut or capo)
//     n>0   -> fingered at physical fret n
// ============================================================================
import {
  STRINGS, NUM_STRINGS, MAX_FRET, isCapoed, noteAtFret, midiAtFret, availableFrets,
} from "./tuning.js";
import { chordPcs, requiredPcs, ROOTS } from "./chords.js";
import { pc, CHROMA } from "./tuning.js";

const MAX_SPAN = 3;        // fretted notes must fit within a 4-fret window
const MIN_SOUNDING = 3;    // at least 3 strings must ring
const SEARCH_MAX_FRET = 9; // only search low, playable positions

/** Positions on a string whose sounding pitch class is in `pcAllowed`, + mute. */
function candidatesForString(s, pcAllowed) {
  const cands = [null]; // mute is always an option
  for (const f of availableFrets(s)) {
    if (f > SEARCH_MAX_FRET) break;
    const n = noteAtFret(s, f);
    if (n != null && pcAllowed.includes(n)) cands.push(f);
  }
  return cands;
}

/** Cartesian product of per-string candidate lists, yielding full voicings. */
function* product(lists) {
  const idx = new Array(lists.length).fill(0);
  const total = lists.reduce((a, l) => a * l.length, 1);
  if (total === 0) return;
  for (let count = 0; count < total; count++) {
    yield lists.map((l, i) => l[idx[i]]);
    for (let i = lists.length - 1; i >= 0; i--) {
      idx[i]++;
      if (idx[i] < lists[i].length) break;
      idx[i] = 0;
    }
  }
}

/** Facts about a candidate voicing used for filtering & ranking. */
export function analyzeVoicing(shape) {
  const sounding = []; // {s, fret, pc, midi}
  const frettedFrets = [];
  let openCount = 0;
  for (let s = 0; s < NUM_STRINGS; s++) {
    const f = shape[s];
    if (f == null) continue;
    const n = noteAtFret(s, f);
    if (n == null) continue;
    sounding.push({ s, fret: f, pc: n, midi: midiAtFret(s, f) });
    if (f > 0) frettedFrets.push(f);
    else openCount++;
  }
  sounding.sort((a, b) => a.midi - b.midi);
  const span = frettedFrets.length ? Math.max(...frettedFrets) - Math.min(...frettedFrets) : 0;
  const bass = sounding.length ? sounding[0] : null;
  const pcSet = [...new Set(sounding.map((x) => x.pc))];
  return {
    sounding,
    pcSet,
    openCount,
    frettedCount: frettedFrets.length,
    span,
    bass,
    frettedFrets,
  };
}

/** Does one fret carry a big barre (>=4 fretted strings on the same fret)? */
function hasBigBarre(frettedFrets) {
  const counts = {};
  let max = 0;
  for (const f of frettedFrets) {
    counts[f] = (counts[f] || 0) + 1;
    max = Math.max(max, counts[f]);
  }
  return max >= 4;
}

/**
 * Generate & rank playable voicings for a chord.
 *   root   : name or index
 *   typeId : chord type id
 *   opts   : { bass: pitch-class name for slash chords | null }
 *
 * Returns { voicings:[{shape, analysis, score, bassNote, missing}], partial:bool }.
 * When nothing fully-playable exists, `partial` is true and the results contain
 * the closest shapes with their missing chord tones listed honestly.
 */
export function generateVoicings(root, typeId, opts = {}) {
  const rootIdx = typeof root === "string" ? ROOTS.indexOf(root) : root;
  const bassName = opts.bass || null;
  const bassPc = bassName ? ROOTS.indexOf(bassName) : null;

  const all = chordPcs(rootIdx, typeId);
  const required = requiredPcs(rootIdx, typeId);

  const lists = STRINGS.map((_, s) => candidatesForString(s, all));

  const full = [];
  for (const shape of product(lists)) {
    const a = analyzeVoicing(shape);
    if (a.sounding.length < MIN_SOUNDING) continue;
    if (a.span > MAX_SPAN) continue;
    if (hasBigBarre(a.frettedFrets)) continue;
    // required tones all present?
    if (!required.every((n) => a.pcSet.includes(n))) continue;
    // bass constraint
    if (bassPc != null && (!a.bass || a.bass.pc !== bassPc)) continue;
    full.push({ shape, analysis: a });
  }

  let partial = false;
  let pool = full;
  if (full.length === 0) {
    // Relax: keep the root, allow chord tones to be missing, and report them.
    partial = true;
    for (const shape of product(lists)) {
      const a = analyzeVoicing(shape);
      if (a.sounding.length < MIN_SOUNDING) continue;
      if (a.span > MAX_SPAN) continue;
      if (hasBigBarre(a.frettedFrets)) continue;
      if (!a.pcSet.includes(pc(rootIdx))) continue; // at least the root
      if (bassPc != null && (!a.bass || a.bass.pc !== bassPc)) continue;
      pool.push({ shape, analysis: a });
    }
  }

  const scored = pool.map((v) => {
    const a = v.analysis;
    const missing = all.filter((n) => !a.pcSet.includes(n)).map((n) => CHROMA[n]);
    let score = 0;
    // 1. bass quality
    if (bassPc != null) score += 400; // already filtered to correct bass
    else if (a.bass && a.bass.pc === pc(rootIdx)) score += 300; // root in bass
    else if (a.bass) score += 60;
    // 2. more ringing (open/capo) strings — the whole point of the capo
    score += a.openCount * 40;
    // 3. fewer fretted strings
    score += (NUM_STRINGS - a.frettedCount) * 12;
    // 4. smaller span
    score += (MAX_SPAN - a.span) * 6;
    // completeness — prefer full chords, dock omissions
    score -= missing.length * 25;
    // more sounding strings is generally fuller
    score += a.sounding.length * 3;
    return { ...v, score, missing, bassNote: a.bass ? CHROMA[a.bass.pc] : null };
  });

  scored.sort((x, y) => y.score - x.score);

  // de-dupe identical shapes
  const seen = new Set();
  const out = [];
  for (const v of scored) {
    const key = v.shape.map((f) => (f == null ? "x" : f)).join("-");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }

  return { voicings: out, partial };
}

/** Convenience: sounding notes of a shape, low -> high, as note names. */
export function soundingNoteNames(shape) {
  return analyzeVoicing(shape).sounding.map((x) => CHROMA[x.pc]);
}
