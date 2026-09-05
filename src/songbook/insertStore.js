// ============================================================
// SECTION INSERTIONS — one song's block sequence carrying a section
// borrowed from ANOTHER song.
//
// WHY THIS EXISTS. Mid-song the team sometimes tags the chorus of a different
// song onto the end of the one they are playing. That has to be prepared on
// ONE continuous screen: nobody switches songs mid-performance, so the
// borrowed section has to live inside the host chart's own block sequence and
// behave like every other block once it is there.
//
// SCOPE. An insertion belongs to ONE chart. It rides alongside the existing
// block order under the same songbook_ prefix and is cleared by the same
// reset, so there is one "this chart has been rearranged" fact rather than
// two that can disagree.
//
// SHAPE (localStorage, songbook_inserts_<chartId>):
//   [ { id, srcChartId, srcBlockId } ]
// where `id` is the synthetic block id used in the host's block order.
//
// Deliberately thin: only the POINTER is stored, never a copy of the lyrics
// or chords. If a chart is later re-imported with corrected chords, every
// insertion of it corrects with it. The cost is that an insertion whose
// source no longer exists must be dropped, which `resolveInsert` does rather
// than rendering a broken block.
//
// LANGUAGE is a property of the source CHART, not of the insertion: a chart
// is either the Portuguese arrangement or the English one, and those are
// genuinely different arrangements rather than translations. Storing
// srcChartId is therefore all that is needed to remember which language was
// chosen — there is no separate language field to fall out of sync.
//
// Pure JS: no React, no DOM beyond localStorage. Ports with the rest of
// src/songbook/.
// ============================================================

const insertKey = (chartId) => "songbook_inserts_" + chartId;

const read = (k, fallback) => {
  try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
};
const write = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ }
};
const drop = (k) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } };

/** Synthetic block id for an inserted section. Namespaced so it can never
 *  collide with a host block id, which is a small integer. */
export const insertIdFor = (srcChartId, srcBlockId) => "ins:" + srcChartId + ":" + srcBlockId;

/** True when a block id in a host's order refers to an inserted section. */
export const isInsertId = (id) => typeof id === "string" && id.startsWith("ins:");

/**
 * The insertions stored for a chart. Anything malformed reads as an empty
 * list rather than throwing: a corrupt key must not take the songbook down in
 * the middle of a service.
 */
export const readInserts = (chartId) => {
  const raw = read(insertKey(chartId), null);
  if (!Array.isArray(raw)) return [];
  return raw.filter((it) =>
    it && typeof it.id === "string" && typeof it.srcChartId === "string" && it.srcBlockId != null);
};

export const writeInserts = (chartId, list) => {
  if (!list || !list.length) drop(insertKey(chartId));
  else write(insertKey(chartId), list);
};

export const clearInserts = (chartId) => drop(insertKey(chartId));

/**
 * Add one section of another song to a chart's insertions. Returns the
 * synthetic block id, so the caller can splice it into the block order at the
 * position she chose.
 *
 * The same section inserted twice is idempotent — the id is derived from the
 * source, so a second insert of the same section reuses the existing record
 * rather than creating a duplicate that would render identically and be
 * impossible to tell apart when removing one.
 */
export const addInsert = (chartId, srcChartId, srcBlockId) => {
  const id = insertIdFor(srcChartId, srcBlockId);
  const list = readInserts(chartId);
  if (!list.some((it) => it.id === id)) {
    list.push({ id, srcChartId, srcBlockId });
    writeInserts(chartId, list);
  }
  return id;
};

/** Remove one inserted section from a chart. */
export const removeInsert = (chartId, id) => {
  const list = readInserts(chartId).filter((it) => it.id !== id);
  writeInserts(chartId, list);
};

/**
 * Resolve an insertion against the library into everything the host chart
 * needs to render and label it, or null when the source no longer exists.
 *
 * `srcKey` is carried through so the block can be labelled with the key it
 * was WRITTEN in. The numbers shown on it are computed against the HOST key
 * by the caller — the band is playing the host song, so a "1" has to mean one
 * chord on the screen, not two.
 */
export const resolveInsert = (ins, library) => {
  if (!ins) return null;
  const srcChart = library.charts[ins.srcChartId];
  if (!srcChart) return null;
  const block = srcChart.blocks.find((b) => String(b.id) === String(ins.srcBlockId));
  if (!block) return null;
  const entry = library.songs.find((sg) => sg.charts.includes(ins.srcChartId));
  return {
    id: ins.id,
    srcChartId: ins.srcChartId,
    srcEntry: entry || null,
    srcTitle: srcChart.names ? srcChart.names.primary : srcChart.title,
    srcLang: srcChart.lang,
    srcKey: srcChart.key || null,
    name: block.name,
    lines: block.lines,
  };
};
