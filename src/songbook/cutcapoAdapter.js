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
import { parseChord as ccParseChord, chordLabel, getType } from "../cutcapo/chords.js";
import { generateVoicings } from "../cutcapo/voicing.js";
import { CHROMA } from "../cutcapo/tuning.js";

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
// CAPO SETTING — persisted per chart as { mode, fret }.
// Older builds stored a bare number meaning "full capo at that fret"; that
// shape is migrated on read so nothing breaks.
// ---------------------------------------------------------------------------
export const DEFAULT_CAPO = { mode: "none", fret: 0 };

export const normalizeCapoSetting = (raw) => {
  if (raw == null) return { ...DEFAULT_CAPO };
  if (typeof raw === "number") return { mode: raw > 0 ? "full" : "none", fret: raw };
  if (typeof raw === "object") {
    const mode = raw.mode === "full" || raw.mode === "cut" ? raw.mode : "none";
    const fret = mode === "cut" ? 2 : Math.max(0, Math.min(7, Number(raw.fret) || 0));
    return { mode, fret };
  }
  return { ...DEFAULT_CAPO };
};
