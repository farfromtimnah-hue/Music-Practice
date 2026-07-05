// ============================================================================
// OPEN VOICINGS — GENERATOR & "OPEN SOUND" FILTER
// ============================================================================
// A "voicing" is an array of length 6 (one entry per string, top->bottom):
//     null  -> muted
//     0     -> open string (ringing)
//     n>0   -> fingered at fret n
//
// This is NOT a normal chord finder. It ONLY returns "open voicings": shapes
// where one or more OPEN strings ring against fretted notes — the shimmery,
// non-traditional sound you get playing two or three fingers high up the neck
// while open strings drone underneath. Barres and dense grips are rejected
// outright. If a chord has no clean open voicing (F major is the classic case),
// we return nothing and the UI says so honestly — we never fall back to a barre.
// ============================================================================
import {
  STRINGS, NUM_STRINGS, MAX_FRET, noteAtFret, midiAtFret, availableFrets, pc, CHROMA,
} from "./tuning.js";
import { chordPcs, requiredPcs, ROOTS } from "./chords.js";

// ---- HARD RULES (a voicing must pass ALL of these) -------------------------
const MIN_OPEN = 1;        // at least one open string must ring (the whole point)
const MAX_FRETTED = 3;     // <= 3 fretted strings (<= 3 fingers)
const MAX_SPAN = 4;        // fretted notes span <= 4 frets
const MIN_SOUNDING = 3;    // at least 3 strings ring in total
const SEARCH_MAX_FRET = 12; // search the whole neck — discovery shapes live high up

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
  let highestFret = 0;
  for (let s = 0; s < NUM_STRINGS; s++) {
    const f = shape[s];
    if (f == null) continue;
    const n = noteAtFret(s, f);
    if (n == null) continue;
    sounding.push({ s, fret: f, pc: n, midi: midiAtFret(s, f) });
    if (f > 0) { frettedFrets.push(f); highestFret = Math.max(highestFret, f); }
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
    highestFret,
  };
}

/**
 * The no-barre test. A barre is when a single finger would cover several
 * strings at the same fret, so reject any voicing where 2+ FRETTED strings
 * share the same fret. (Open strings never count toward a barre.)
 */
function hasBarre(frettedFrets) {
  const counts = {};
  for (const f of frettedFrets) {
    counts[f] = (counts[f] || 0) + 1;
    if (counts[f] >= 2) return true;
  }
  return false;
}

/** Does a candidate pass every hard rule of the open filter? */
function passesOpenFilter(a) {
  if (a.openCount < MIN_OPEN) return false;          // must ring at least one open string
  if (a.sounding.length < MIN_SOUNDING) return false; // >= 3 sounding strings
  if (a.frettedCount > MAX_FRETTED) return false;     // <= 3 fingers
  if (a.span > MAX_SPAN) return false;                // playable span
  if (hasBarre(a.frettedFrets)) return false;         // no barres
  return true;
}

/**
 * Generate & rank OPEN voicings for a chord.
 *   root   : name or index
 *   typeId : chord type id
 *   opts   : { bass: pitch-class name for slash chords | null }
 *
 * Returns { voicings:[{shape, analysis, score, bassNote}] }.
 * The list is EMPTY when the chord has no clean open voicing — the caller shows
 * the honest "needs a barre" message rather than any fallback shape.
 */
export function generateVoicings(root, typeId, opts = {}) {
  const rootIdx = typeof root === "string" ? ROOTS.indexOf(root) : root;
  const bassName = opts.bass || null;
  const bassPc = bassName ? ROOTS.indexOf(bassName) : null;

  const all = chordPcs(rootIdx, typeId);       // every allowed pitch class (no wrong notes)
  const required = requiredPcs(rootIdx, typeId); // tones that must be present

  // Candidate frets per string already contain ONLY chord tones, so "no pitch
  // classes outside the chord" is guaranteed by construction.
  const lists = STRINGS.map((_, s) => candidatesForString(s, all));

  const keep = [];
  for (const shape of product(lists)) {
    const a = analyzeVoicing(shape);
    if (!passesOpenFilter(a)) continue;
    // all required chord tones present (optional tones may be dropped):
    if (!required.every((n) => a.pcSet.includes(n))) continue;
    // slash-bass constraint: lowest sounding string must be that pitch class:
    if (bassPc != null && (!a.bass || a.bass.pc !== bassPc)) continue;
    keep.push({ shape, analysis: a });
  }

  const scored = keep.map((v) => {
    const a = v.analysis;
    let score = 0;
    // 1. bass note correctness
    if (bassPc != null) score += 1000;                       // already filtered to correct bass
    else if (a.bass && a.bass.pc === pc(rootIdx)) score += 500; // root in the bass
    else if (a.bass) score += 100;                            // some other chord tone
    // 2. MOST open / ringing strings — this is the whole point
    score += a.openCount * 50;
    // 3. fewest fretted fingers
    score += (MAX_FRETTED - a.frettedCount) * 14;
    // 4. smaller fret span
    score += (MAX_SPAN - a.span) * 5;
    // 5. mild bonus for shapes that sit higher up the neck while still ringing
    //    (these are the "discovery" voicings the app is really about)
    score += Math.min(a.highestFret, 9) * 2;
    // fuller chords read slightly better as a tie-breaker
    score += a.sounding.length;
    const bassNote = a.bass ? CHROMA[a.bass.pc] : null;
    return { ...v, score, bassNote };
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

  return { voicings: out };
}

/** Convenience: sounding notes of a shape, low -> high, as note names. */
export function soundingNoteNames(shape) {
  return analyzeVoicing(shape).sounding.map((x) => CHROMA[x.pc]);
}
