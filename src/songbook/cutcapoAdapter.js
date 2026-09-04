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
import { parseChord as ccParseChord, chordLabel, getType, ROOTS } from "../cutcapo/chords.js";
import { generateVoicings } from "../cutcapo/voicing.js";
import { CHROMA, CAPO_FRET } from "../cutcapo/tuning.js";

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
  const { voicings, partial } = generateVoicings(c.root, c.typeId, { bass: c.bass });
  const complete = partial ? [] : voicings.filter((v) => !v.missing || v.missing.length === 0);
  if (!complete.length) {
    const closest = voicings[0];
    return {
      status: "unplayable",
      label: c.label,
      missing: closest && closest.missing ? closest.missing : [],
    };
  }
  // The engine already ranks by ringing strings then span; re-sort defensively
  // so the practical reason for a cut capo (open strings, small stretch) wins.
  const ranked = complete.slice().sort((a, b) =>
    b.analysis.openCount - a.analysis.openCount ||
    a.analysis.span - b.analysis.span ||
    a.analysis.frettedCount - b.analysis.frettedCount ||
    b.score - a.score);
  return {
    status: "ok",
    label: c.label,
    reduced: c.reduced,
    voicings: ranked.slice(0, limit).map((v) => ({
      shape: v.shape,
      openCount: v.analysis.openCount,
      span: v.analysis.span,
      frettedCount: v.analysis.frettedCount,
      notes: v.analysis.sounding.map((x) => CHROMA[x.pc]),
      bassNote: v.bassNote,
      missing: v.missing || [],
    })),
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

  const { voicings, partial } = generateVoicings(shape.root, shape.typeId, { bass: shape.bass });
  const complete = partial ? [] : voicings.filter((v) => !v.missing || v.missing.length === 0);
  const base = {
    soundingLabel: sounding.label,
    shapeLabel: shape.label,
    capo,
    cutFret,
    transposed: capo > 0,
  };
  if (!complete.length) {
    const closest = voicings[0];
    return { ...base, status: "unplayable", missing: closest && closest.missing ? closest.missing : [] };
  }
  const ranked = complete.slice().sort((a, b) =>
    b.analysis.openCount - a.analysis.openCount ||
    a.analysis.span - b.analysis.span ||
    a.analysis.frettedCount - b.analysis.frettedCount ||
    b.score - a.score);
  return {
    ...base,
    status: "ok",
    reduced: shape.reduced,
    voicings: ranked.slice(0, limit).map((v) => ({
      shape: v.shape,
      openCount: v.analysis.openCount,
      span: v.analysis.span,
      frettedCount: v.analysis.frettedCount,
      // The engine works in SHAPE space (as if the full capo were the nut), so
      // its pitch classes are the shape's, not what the guitar actually sounds.
      // Transpose up by the capo fret to report the real sounding notes.
      notes: v.analysis.sounding.map((x) => CHROMA[(x.pc + capo) % 12]),
      bassNote: v.bassNote ? CHROMA[(ROOTS.indexOf(v.bassNote) + capo) % 12] : null,
      missing: v.missing || [],
    })),
  };
};
