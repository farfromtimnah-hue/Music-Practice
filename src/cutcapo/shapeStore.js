// ============================================================================
// CUT CAPO — SAVED-SHAPE STORAGE
// ============================================================================
// Thin storage layer for user-saved chord shapes. Backed by localStorage for
// now. The three functions below are the entire contract — a future Firebase
// (or any async) backend can be dropped in behind them with no UI changes, so
// callers should treat the return values as if they were async-friendly
// (they simply resolve synchronously today).
//
//   getShapes()        -> Shape[]
//   saveShape(shape)   -> Shape   (assigns id + createdAt if new; upserts by id)
//   deleteShape(id)    -> void
//
// A Shape looks like:
//   { id, name, shape: (null|number)[6], notes: string[], createdAt }
// ============================================================================

const KEY = "cutCapoShapes";

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage full / unavailable — fail quietly, nothing to sync yet */
  }
}

/** All saved shapes, newest first. */
export function getShapes() {
  return readAll().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/** Insert or update a shape (matched by id). Returns the stored shape. */
export function saveShape(shape) {
  const list = readAll();
  const record = { ...shape };
  if (!record.id) {
    record.id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    record.createdAt = Date.now();
    list.push(record);
  } else {
    const i = list.findIndex((x) => x.id === record.id);
    if (i >= 0) list[i] = { ...list[i], ...record };
    else {
      record.createdAt = record.createdAt || Date.now();
      list.push(record);
    }
  }
  writeAll(list);
  return record;
}

/** Delete a saved shape by id. */
export function deleteShape(id) {
  writeAll(readAll().filter((x) => x.id !== id));
}
