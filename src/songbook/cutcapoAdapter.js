// ============================================================
// CUT CAPO ADAPTER — songbook side only.
//
// Bridges chart chord tokens (ChordPro / Planning Center spellings) to the
// existing cut-capo engine in src/cutcapo/, which is NOT modified by this
// module. Pure JS: no React, no DOM — ports to native with the rest of
// src/songbook/.
//
// Two things have to be handled here rather than in the engine:
//
// 1. Chart spellings the engine's parser does not accept. Charts write "E4"
//    and "D4" for sus4, "C2" for sus2, and "D7M"/"A7M"/"F7M" for maj7. They
//    also carry decorations the engine has no concept of ("N.C.", "(x2)").
//
// 2. A REAL correctness trap: the engine's SUFFIX_MAP compares
//    case-insensitively and tries ["M7","maj7"] before ["m7","m7"], so a bare
//    "Bm7" parses as B MAJOR 7. Left alone the songbook would draw a major-7
//    shape for every minor-7 chord in the library. Minor qualities are
//    therefore resolved here, before the engine sees the token.
// ============================================================
import {
  parseChord as ccParseChord, chordLabel, getType, ROOTS, chordPcs, nameChord,
} from "../cutcapo/chords.js";
import { generateVoicings, analyzeVoicing } from "../cutcapo/voicing.js";
import { CHROMA, CAPO_FRET } from "../cutcapo/tuning.js";
import { getShapes, saveShape } from "../cutcapo/shapeStore.js";

// Chart suffix -> the engine's own suffix vocabulary. Order matters: longest
// and most specific first, and every minor form is pinned explicitly so it can
// never fall through to the maj7 branch described above.
const SUFFIX_REWRITES = [
  [/^m7b5$/i, "m7b5"], [/^ø$/, "m7b5"],
  [/^(m|min|-)(maj7|M7|7M)$/, "m7"],      // mMaj7 is not modelled; m7 is the closest honest shape
  [/^(m|min|-)9$/, "m9"],
  [/^(m|min|-)7$/, "m7"],
  [/^(m|min|-)6$/, "m6"],
  [/^(m|min|-)$/, "min"],
  [/^(maj7|M7|7M)$/, "maj7"],
  [/^(maj9|M9|9M)$/, "maj9"],
  [/^(sus4|sus|4)$/, "sus4"],
  [/^(sus2|2)$/, "sus2"],
  [/^(add9|add2)$/, "add9"],
  [/^9$/, "9"], [/^7$/, "7"], [/^6$/, "6"],
  [/^(dim7|°7|º7)$/, "dim7"], [/^(dim|°|º)$/, "dim"],
  [/^(aug|\+)$/, "aug"],
  [/^$/, "maj"],
];

// Extension digits the engine has no type for: keep the chord, drop the colour.
// 11ths/13ths reduce to the 7th, 9-flavoured majors reduce to add9.
const REDUCTIONS = [
  [/^(11|13)$/, "7"],
  [/^m(11|13)$/, "m7"],
  [/^(maj11|maj13|M11|M13)$/, "maj7"],
  [/^add11$/, "maj"],
  [/^7sus4$|^7sus$/, "sus4"],
  [/^9sus4$|^9sus$/, "sus4"],
  [/^(6\/9|69)$/, "6"],
  [/^7b9$|^7#9$|^7#5$|^7b5$/, "7"],
];

const ROOT_RE = /^([A-G])(#|b|♯|♭)?(.*)$/;

/**
 * Chart token -> { root, typeId, bass, label, reduced } for the cut-capo
 * engine, or null when the token is not a chord at all (N.C., a lyric, a
 * repeat marker). `reduced` is true when colour tones were dropped to reach a
 * type the engine models, so the UI can say so instead of pretending.
 */
export const chartChordToCutCapo = (token) => {
  if (!token) return null;
  let s = String(token).trim().replace(/[♯]/g, "#").replace(/[♭]/g, "b");
  if (!s || /^(n\.?c\.?|tacet)$/i.test(s)) return null;
  s = s.replace(/\((?:x\s*\d+|\d+x)\)/gi, "").trim();     // "(x2)" style repeat marks
  s = s.replace(/\s+/g, "");

  let bass = null;
  const slash = s.split("/");
  if (slash.length === 2) {
    const bm = ROOT_RE.exec(slash[1]);
    if (!bm || bm[3]) return null;
    bass = bm[1] + (bm[2] || "");
    s = slash[0];
  } else if (slash.length > 2) return null;

  const m = ROOT_RE.exec(s);
  if (!m) return null;
  const root = m[1] + (m[2] || "");
  let rest = (m[3] || "").replace(/[()]/g, "");

  let reduced = false;
  for (const [re, to] of REDUCTIONS) {
    if (re.test(rest)) { rest = to; reduced = true; break; }
  }
  let suffix = null;
  for (const [re, to] of SUFFIX_REWRITES) {
    if (re.test(rest)) { suffix = to; break; }
  }
  if (suffix == null) return null;

  // Resolve root and bass spelling through the engine (it folds flats to
  // sharps), but pass the TYPE ID we just derived rather than re-parsing the
  // token: re-parsing would hit the engine's case-insensitive "M7 before m7"
  // rule and silently turn every m7 chord into a maj7 chord.
  const rootOnly = ccParseChord(root);
  const bassOnly = bass ? ccParseChord(bass) : null;
  if (!rootOnly || (bass && !bassOnly)) return null;
  if (!getType(suffix)) return null;
  const bassName = bassOnly ? bassOnly.root : null;
  return {
    root: rootOnly.root,
    typeId: suffix,
    bass: bassName,
    label: chordLabel(rootOnly.root, suffix, bassName),
    reduced,
  };
};

// ---------------------------------------------------------------------------
// VOICING RANKING — the difference between "technically contains the right
// notes" and "what a guitarist actually plays".
//
// The engine hands back every shape whose pitch classes belong to the chord,
// ranked with open strings weighted heavily. That is right for the Studio,
// where Nicole is exploring the instrument, and wrong for a chart, where she
// needs THE fingering. Maximising open strings finds shapes that merely
// CONTAIN the chord's notes while putting the wrong one in the bass — for A it
// returns [0,x,0,0,2,0], which sounds E E A C#: an E chord with an A in it,
// not an A chord. Pushed to the limit it returns the all-open [0,0,0,0,0,0]
// and calls it Asus2, i.e. "play nothing".
//
// So the ranking here is filters first, preferences second.
//
// THE COLOUR-TONE PROBLEM. The standard cut-capo A is
//
//     low E 5th fret, A string 4th fret, everything else open
//
// which sounds A C# E A B E — the chord plus the open B ringing a 9th on top.
// That ringing 9th is the entire reason the capo is on the neck. But the
// engine only ever offers positions whose pitch class is strictly inside the
// chord, so a plain "A maj" search can never produce that shape: the B is not
// an A-major tone. The shape only appears in the "Aadd9" search.
//
// Rather than modify the engine, the pool is widened here: a chord is also
// searched as its COLOUR EXTENSION (the same chord plus the 9th), and the
// results are then filtered back down to shapes that still contain every tone
// of the chord the chart actually asked for. An added 9th survives; a shape
// that lost the third does not.
// ---------------------------------------------------------------------------

// chart type -> the extension whose search pool also contains the plain chord
// voicings PLUS the ones coloured by a ringing 9th. Only the 9th is admitted:
// a 6th or a b7 would change the chord's quality, not decorate it.
const COLOUR_EXTENSION = {
  maj: "add9",
  min: "m9",
  sus2: "add9",
  7: "9",
  m7: "m9",
  maj7: "maj9",
};

// The all-open cut-capo ring, E B E A B E. Returning this for a named chord is
// only honest when the chord asked for IS this sound (the engine names it
// Esus4, or Asus2/E). For anything else it means "play nothing", which is
// never a useful answer to "how do I finger this?".
const OPEN_RING = [0, 0, 0, 0, 0, 0];

/** Does an all-open strum genuinely spell this chord, root in the bass? */
const openRingIs = (rootPc, corePcs) => {
  const a = analyzeVoicing(OPEN_RING);
  if (!a.bass || a.bass.pc !== rootPc) return false;
  return corePcs.every((n) => a.pcSet.includes(n));
};

/**
 * Every voicing worth offering for a chord, best first.
 *
 * HARD FILTERS (a shape failing any of these is a different chord, not a
 * worse one, so it is dropped rather than ranked down):
 *   - the root must be the LOWEST sounding note; for a slash chord, the
 *     specified bass note must be lowest instead
 *   - no all-open shape unless the open ring really is this chord
 *   - every tone of the chart's chord must be present
 *
 * PREFERENCES, in order:
 *   - no muted string trapped inside the voicing (awkward to strum cleanly)
 *   - more strings ringing
 *   - fewer fingers, then no reach-over an open string, then a smaller span
 *   - open-string count LAST, purely as a tiebreaker
 */
function rankedVoicings(rootName, typeId, bassName) {
  const rootIdx = ROOTS.indexOf(rootName);
  if (rootIdx < 0) return [];
  const rootPc = rootIdx % 12;
  const corePcs = chordPcs(rootIdx, typeId);
  // A slash chord's bass is specified, so it — not the root — must be lowest.
  const bassPc = bassName ? ROOTS.indexOf(bassName) % 12 : rootPc;

  // Widen the pool with the colour extension, then filter back to this chord.
  const ext = COLOUR_EXTENSION[typeId];
  const pool = [];
  if (ext && getType(ext)) {
    pool.push(...generateVoicings(rootName, ext, { bass: bassName || null }).voicings);
  }
  pool.push(...generateVoicings(rootName, typeId, { bass: bassName || null }).voicings);

  const ringIsChord = openRingIs(rootPc, corePcs);
  const seen = new Set();
  const kept = [];

  for (const v of pool) {
    const a = v.analysis;
    const key = v.shape.map((f) => (f == null ? "x" : f)).join("-");
    if (seen.has(key)) continue;
    seen.add(key);

    // --- hard filters -----------------------------------------------------
    if (!a.bass || a.bass.pc !== bassPc) continue;          // wrong note in the bass
    if (a.frettedCount === 0 && !ringIsChord) continue;      // "play nothing"
    if (!corePcs.every((n) => a.pcSet.includes(n))) continue; // a tone is missing

    // --- shape qualities used for preference ------------------------------
    const strings = a.sounding.map((x) => x.s);
    const lo = Math.min(...strings), hi = Math.max(...strings);
    // A muted string below the bass is just a string you skip; a muted string
    // BETWEEN two sounding ones has to be damped mid-strum.
    let innerMutes = 0;
    for (let s = lo; s <= hi; s++) if (!strings.includes(s)) innerMutes++;
    // An open string sandwiched between two fretted ones means reaching over
    // it — real, but harder to read and to play than a compact grip.
    const fretted = a.sounding.filter((x) => x.fret > 0).map((x) => x.s);
    let reachOver = 0;
    if (fretted.length > 1) {
      const f0 = Math.min(...fretted), f1 = Math.max(...fretted);
      for (let s = f0; s <= f1; s++) if (!fretted.includes(s)) reachOver++;
    }
    // Colour tones that are not part of the chart's chord (the ringing 9th).
    const added = a.pcSet.filter((n) => !corePcs.includes(n)).map((n) => CHROMA[n]);

    // How far up the neck the grip sits. Between two shapes that are otherwise
    // equally good, the hand goes to the lower one.
    const position = fretted.length ? Math.max(...a.sounding.filter((x) => x.fret > 0).map((x) => x.fret)) : 0;

    kept.push({ v, a, innerMutes, reachOver, added, position, ring: a.sounding.length });
  }

  kept.sort((x, y) =>
    x.innerMutes - y.innerMutes ||
    y.ring - x.ring ||
    x.a.frettedCount - y.a.frettedCount ||
    x.a.span - y.a.span ||
    x.position - y.position ||
    x.reachOver - y.reachOver ||
    y.a.openCount - x.a.openCount);

  return kept;
}

/** Shared shape of one voicing as the songbook UI consumes it. */
const describe = (k, capo = 0) => ({
  shape: k.v.shape,
  openCount: k.a.openCount,
  span: k.a.span,
  frettedCount: k.a.frettedCount,
  notes: k.a.sounding.map((x) => CHROMA[(x.pc + capo) % 12]),
  bassNote: k.a.bass ? CHROMA[(k.a.bass.pc + capo) % 12] : null,
  // Colour the shape adds over the chart's chord, e.g. the open B ringing a
  // 9th over A. Reported so the popup can say so rather than look wrong.
  added: k.added.map((n) => CHROMA[(ROOTS.indexOf(n) + capo) % 12]),
  missing: [],
});

/**
 * Can this chart chord be played with the cut capo, and how?
 *
 * The engine never returns an empty list — when nothing complete exists it
 * flips `partial` and hands back shapes with chord tones missing. For the
 * songbook that IS the negative answer, so it is reported as playable:false
 * rather than shown as a shape that is not really the chord.
 *
 * Returns:
 *   { status: "not-a-chord" }
 *   { status: "unplayable", label, missing }   -> remove the capo for this song
 *   { status: "ok", label, reduced, voicings: [{shape, openCount, span, notes, bassNote, missing}] }
 */
export const cutCapoVoicingsFor = (token, limit = 2) => {
  const c = chartChordToCutCapo(token);
  if (!c) return { status: "not-a-chord" };
  const ranked = rankedVoicings(c.root, c.typeId, c.bass);
  if (!ranked.length) return { status: "unplayable", label: c.label, missing: missingFor(c) };
  return {
    status: "ok",
    label: c.label,
    reduced: c.reduced,
    voicings: ranked.slice(0, limit).map((k) => describe(k)),
  };
};

/**
 * Which chord tones the closest near-miss drops, for the "not playable"
 * message. Only ever called once nothing survived the filters, so it asks the
 * engine for its best effort purely to name what is unreachable.
 */
function missingFor(c) {
  const { voicings } = generateVoicings(c.root, c.typeId, { bass: c.bass });
  const closest = voicings[0];
  return closest && closest.missing ? closest.missing : [];
}


// ---------------------------------------------------------------------------
// NICOLE'S OWN SHAPES
//
// She already has a cut-capo vocabulary. The generator is a fallback, not a
// teacher — when she has pinned a fingering for a chord, that is THE answer
// and it shows first.
//
// Storage is the existing src/cutcapo/shapeStore.js, unmodified: the same
// records the Studio's Builder writes. A songbook-pinned shape simply carries
// one extra field, `chordKey`, so it can be found again by chord rather than
// only by browsing "My Shapes". Records without it are Studio shapes and are
// ignored here — the two features share a drawer without colliding.
//
// The key is the chord's RESOLVED root + type, not the chart's spelling, so a
// shape saved for "A" is offered for "A" everywhere in the library, and one
// saved against "Bbm7" is found again from a chart that writes "A#m7".
// ---------------------------------------------------------------------------

/** Stable per-chord key: resolved root + type + bass, independent of spelling. */
export const chordKeyFor = (token) => {
  const c = chartChordToCutCapo(token);
  if (!c) return null;
  return c.root + "|" + c.typeId + (c.bass ? "|/" + c.bass : "");
};

/**
 * Shapes Nicole has pinned for this chord, newest first.
 * `capo` is the full-capo fret the popup is displaying at: a shape is only
 * offered back for the capo position it was saved at, because the same grip
 * against a different effective nut is a different chord.
 */
export const savedShapesFor = (token, capo = 0) => {
  const key = chordKeyFor(token);
  if (!key) return [];
  try {
    return getShapes().filter((s) =>
      s && s.chordKey === key && (s.capo || 0) === (capo || 0) && Array.isArray(s.shape));
  } catch (e) {
    return [];
  }
};

/**
 * Pin a shape for a chord. Returns the stored record, or null if the token is
 * not a chord. Passing an existing record's `id` edits it in place.
 */
export const saveShapeFor = (token, shape, capo = 0, extra = {}) => {
  const key = chordKeyFor(token);
  if (!key || !Array.isArray(shape)) return null;
  const c = chartChordToCutCapo(token);
  const a = analyzeVoicing(shape);
  return saveShape({
    ...extra,
    chordKey: key,
    capo: capo || 0,
    // Name it with the engine's own reverse lookup so an added 9th shows up in
    // the name — that is how she confirms the colour landed where she meant.
    name: extra.name || describeShapeName(shape, c.label),
    shape,
    notes: a.sounding.map((x) => CHROMA[(x.pc + (capo || 0)) % 12]),
  });
};

export { deleteShape as deleteSavedShape } from "../cutcapo/shapeStore.js";

/**
 * What the engine calls a shape, for confirming an edit did what she intended.
 * Falls back to the chart's own label when the notes spell nothing standard —
 * the shape is still hers to keep, it just has no textbook name.
 */
export const describeShapeName = (shape, fallback = "") => {
  const a = analyzeVoicing(shape);
  if (!a.sounding.length) return fallback;
  const { names } = nameChord(a.pcSet, a.bass ? a.bass.pc : null);
  return names.length ? names[0].name : fallback;
};

/**
 * Full naming readout for the shape editor: the best name, close alternates,
 * and the sounding notes. `capo` transposes the reported notes into what the
 * guitar actually sounds when a full capo is on.
 */
export const analyseShape = (shape, capo = 0) => {
  const a = analyzeVoicing(shape);
  const { names } = nameChord(a.pcSet, a.bass ? a.bass.pc : null);
  return {
    notes: a.sounding.map((x) => CHROMA[(x.pc + (capo || 0)) % 12]),
    best: names[0] || null,
    alternates: names.slice(1, 4),
    frettedCount: a.frettedCount,
    openCount: a.openCount,
    span: a.span,
    sounding: a.sounding.length,
  };
};

// ---------------------------------------------------------------------------
// CAPO SETTING — persisted per chart as { capo, cut }.
//
// PHYSICAL MODEL. A full capo clamps all six strings at `capo` (0 = none, up
// to 7). A cut capo is a partial capo over the A, D and G strings only, and it
// always sits exactly two frets above whatever is below it: two above the nut
// with no full capo, two above the full capo when one is on. It therefore has
// no fret number of its own — it is a boolean, and its position is DERIVED:
//
//     cutFret = capo + 2
//
// The two are independent. capo 2 with cut on is a real and common setup.
//
// Older builds stored one of several shapes; all of them are migrated on read
// and the new shape is written going forward. Never throws.
// ---------------------------------------------------------------------------
export const MAX_FULL_CAPO = 7;
export const DEFAULT_CAPO = { capo: 0, cut: false };

const clampCapo = (n) => {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(MAX_FULL_CAPO, v));
};

export const normalizeCapoSetting = (raw) => {
  try {
    if (raw == null) return { ...DEFAULT_CAPO };
    // legacy: a bare number meant "full capo at that fret"
    if (typeof raw === "number") return { capo: clampCapo(raw), cut: false };
    if (typeof raw === "string") {
      const n = Number(raw);
      return Number.isFinite(n) ? { capo: clampCapo(n), cut: false } : { ...DEFAULT_CAPO };
    }
    if (typeof raw === "object") {
      // current shape
      if ("cut" in raw || "capo" in raw) {
        return { capo: clampCapo(raw.capo), cut: raw.cut === true };
      }
      // legacy: { mode: "none" | "full" | "cut", fret }
      if (raw.mode === "cut") return { capo: 0, cut: true };
      if (raw.mode === "full") return { capo: clampCapo(raw.fret), cut: false };
      return { ...DEFAULT_CAPO };
    }
  } catch (e) { /* fall through */ }
  return { ...DEFAULT_CAPO };
};

/** Where the cut capo physically sits. Always derived, never stored. */
export const cutFretOf = (setting) => clampCapo(setting && setting.capo) + CAPO_FRET;

/**
 * Sounding chord + full capo -> the chord shape actually being fingered.
 * With a capo at fret n, a shape n semitones lower sounds as the written
 * chord, so the fingered shape is the chord transposed DOWN by n.
 * Returns a chord token spelled the way the cut-capo engine expects.
 */
export const shapeTokenFor = (token, capoFret) => {
  const c = chartChordToCutCapo(token);
  if (!c) return null;
  const n = ((-(capoFret || 0)) % 12 + 12) % 12;
  const shiftName = (name) => (name ? CHROMA[(ROOTS.indexOf(name) + n) % 12] : null);
  const root = shiftName(c.root);
  const bass = shiftName(c.bass);
  if (!root) return null;
  return { root, typeId: c.typeId, bass, label: chordLabel(root, c.typeId, bass), reduced: c.reduced };
};

/**
 * The full answer for one chord under a { capo, cut } setting.
 *
 * The engine models the cut capo at CAPO_FRET measured from the nut with the
 * outer strings open. A full capo just moves that whole system up: it becomes
 * the effective nut. So the shape is computed by transposing the sounding
 * chord DOWN by the full capo fret, running the existing engine unchanged, and
 * reporting the capo offset so the diagram can number its frets absolutely.
 *
 * Returns:
 *   { status: "not-a-chord" }
 *   { status: "unplayable", soundingLabel, shapeLabel, capo, cutFret, missing }
 *   { status: "ok", soundingLabel, shapeLabel, capo, cutFret, reduced, voicings }
 * where each voicing's `shape` holds frets measured from the FULL CAPO (the
 * effective nut), and `capo` says how far up the neck that sits.
 */
export const cutCapoAnswerFor = (token, setting, limit = 2) => {
  const s = normalizeCapoSetting(setting);
  const capo = s.capo;
  const cutFret = cutFretOf(s);
  const sounding = chartChordToCutCapo(token);
  if (!sounding) return { status: "not-a-chord", token, capo, cutFret };

  const shape = shapeTokenFor(token, capo);
  if (!shape) return { status: "not-a-chord", token, capo, cutFret };

  const base = {
    soundingLabel: sounding.label,
    shapeLabel: shape.label,
    capo,
    cutFret,
    transposed: capo > 0,
  };
  const ranked = rankedVoicings(shape.root, shape.typeId, shape.bass);
  if (!ranked.length) return { ...base, status: "unplayable", missing: missingFor(shape) };
  return {
    ...base,
    status: "ok",
    reduced: shape.reduced,
    // The engine works in SHAPE space (as if the full capo were the nut), so
    // its pitch classes are the shape's, not what the guitar actually sounds.
    // `describe` transposes them up by the capo fret to report real pitches.
    voicings: ranked.slice(0, limit).map((k) => describe(k, capo)),
  };
};
