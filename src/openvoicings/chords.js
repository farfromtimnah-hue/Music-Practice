// ============================================================================
// OPEN VOICINGS — CHORD DEFINITIONS, PARSING & NAMING
// ============================================================================
// Chord theory is tuning-independent, so this is a thin re-export of the Cut
// Capo Studio's chord engine (same formula table, same search parsing). Kept as
// its own module so all open-voicings code imports from a single local path and
// nothing in this app reaches across into cutcapo internals directly.
// ============================================================================
export {
  ROOTS,
  CHORD_TYPES,
  COMMON_TYPE_IDS,
  getType,
  chordLabel,
  chordPcs,
  requiredPcs,
  parseChord,
  nameChord,
} from "../cutcapo/chords.js";
