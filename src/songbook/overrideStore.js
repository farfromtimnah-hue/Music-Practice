// ============================================================
// SET OVERRIDES — the room's version of the set, not Planning Center's.
//
// WHY THIS EXISTS. In rehearsal minutes before a service the worship leader
// changes the running order or a song's key out loud. Everyone is standing
// there holding an instrument; nobody walks back to a laptop to update
// Planning Center. The app has to follow a spoken change in seconds or it is
// useless in exactly the moment it matters most.
//
// SCOPE. An override belongs to ONE service on ONE date. Next week starts
// clean — a key is never shared across dates, so an override can never leak
// forward into a service it was not called for.
//
// SHAPE (localStorage, songbook_setorder_<serviceId>_<date>):
//   {
//     active: true,              // an override exists at all
//     items: [                   // the running order, in order
//       { chartId, entryId, title, added? }
//     ],
//     basis: [chartId, ...],     // what Planning Center said when this was
//                                // built — used ONLY to notice PC changed
//     at: <iso>
//   }
//
// `basis` is the whole defence against a background refetch silently wiping
// a rehearsal decision: we compare what PC says NOW against what it said when
// she built the override, and if they differ we TELL her rather than acting.
//
// Pure JS: no React, no DOM beyond localStorage. Ports with the rest of
// src/songbook/.
// ============================================================

const orderKey = (serviceId, date) => "songbook_setorder_" + serviceId + "_" + date;

const read = (k, fallback) => {
  try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
};
const write = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ }
};
const drop = (k) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } };

/**
 * The stored override for a service+date, or null. Anything malformed reads as
 * null rather than throwing: a corrupt key must not take the songbook down in
 * the middle of a service.
 */
export const readOverride = (serviceId, date) => {
  const raw = read(orderKey(serviceId, date), null);
  if (!raw || raw.active !== true || !Array.isArray(raw.items)) return null;
  const items = raw.items.filter((it) => it && typeof it.chartId === "string");
  if (!items.length) return null;
  return {
    active: true,
    items,
    basis: Array.isArray(raw.basis) ? raw.basis : [],
    at: raw.at || null,
  };
};

export const writeOverride = (serviceId, date, items, basis) => {
  write(orderKey(serviceId, date), {
    active: true,
    items,
    basis: basis || [],
    at: new Date().toISOString(),
  });
};

export const clearOverride = (serviceId, date) => drop(orderKey(serviceId, date));

// ---------------------------------------------------------------------------
// KEY OVERRIDES.
//
// songbook_key_<chartId> is THE KEY THE BAND IS PLAYING IN. The chart view and
// the set list both write it, so a key set from either place is one fact, not
// two that can disagree. It changes the letters and the capo maths and nothing
// else — the Nashville numbers are measured against the key the chart is
// WRITTEN in, which is a different fact stored separately under
// songbook_chartkey_<chartId> and changed only when detection read the chart
// itself wrong (the relative-minor case).
// ---------------------------------------------------------------------------
export const keyKeyFor = (chartId) => "songbook_key_" + chartId;
export const chartKeyKeyFor = (chartId) => "songbook_chartkey_" + chartId;
export const readChartKeyOverride = (chartId) => read(chartKeyKeyFor(chartId), null);

/**
 * ONE-TIME MIGRATION. Before the split, "Use Em" on the relative-minor notice
 * wrote songbook_key_, the same slot the set-list key picker uses — so after
 * the split that stored value would read as "play this in Em today" and drag
 * the letters with it. A saved key that is the RELATIVE MINOR of the chart's
 * detected key was a chart correction, never a performance key, so it moves to
 * the chart-key slot. Anything else is left exactly where it is: a real key
 * change called in rehearsal keeps working.
 */
export const migrateRelativeMinorKey = (chartId, detected) => {
  if (!detected || detected.mode !== "major") return;
  const saved = read(keyKeyFor(chartId), null);
  if (!saved || read(chartKeyKeyFor(chartId), null)) return;
  const m = /^([A-G](?:#|b)?)(m|min|-)$/.exec(String(saved).trim());
  if (!m) return;                       // a major key: a performance key, leave it
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let pc = NOTE[m[1][0]];
  if (pc == null) return;
  for (const ch of m[1].slice(1)) { if (ch === "#") pc += 1; else if (ch === "b") pc -= 1; }
  pc = ((pc % 12) + 12) % 12;
  if (pc !== (detected.tonicPc + 9) % 12) return;   // not the relative minor
  write(chartKeyKeyFor(chartId), saved);
  drop(keyKeyFor(chartId));
};

export const readKeyOverride = (chartId) => read(keyKeyFor(chartId), null);
export const writeKeyOverride = (chartId, keyName) => {
  if (keyName) write(keyKeyFor(chartId), keyName);
  else drop(keyKeyFor(chartId));
};

/**
 * Clear key overrides for a list of charts. Used by "Reset to Planning
 * Center". Capo settings live under songbook_capo_<chartId> and are NOT
 * touched here: a capo is a physical fact about the guitar, independent of
 * what key the chart is written in.
 */
export const clearKeyOverrides = (chartIds) => {
  (chartIds || []).forEach((id) => drop(keyKeyFor(id)));
};

// ---------------------------------------------------------------------------
// PLANNING CENTER DRIFT.
//
// Only asks whether the SET ITSELF changed — the ordered list of charts PC
// resolves to. It deliberately ignores order-only differences in the raw
// titles, because reordering is exactly what the override is for and PC
// reporting the same songs is not a change worth interrupting anyone about.
// ---------------------------------------------------------------------------
export const basisOf = (setSongsFromPc) => (setSongsFromPc || []).map((s) => s.chartId);

/** True when PC now resolves to a different SET of songs than the basis. */
export const basisDiffers = (basis, current) => {
  const a = [...(basis || [])].sort();
  const b = [...(current || [])].sort();
  if (a.length !== b.length) return true;
  return a.some((x, i) => x !== b[i]);
};
