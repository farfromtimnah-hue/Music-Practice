// ============================================================
// END SONG — the one piece of songbook state that crosses devices.
//
// WHY THIS EXISTS. During the sermon the worship leader picks the closing song
// from the message and posts it to WhatsApp. Nicole's iPad is on a stand on
// stage and is awkward to reach: getting to it means taking the guitar off,
// putting it down and climbing off stage. So she picks the song on her PHONE
// from her seat, and it has to be ON THE IPAD when she walks back up, without
// her touching the iPad at all.
//
// Everything else in the songbook is localStorage, which is per-device by
// definition. This one row is therefore the only thing that talks to a server:
// POST from whichever device chose it, GET (polled) on every device showing
// that service. It belongs to ONE service on ONE date — an end song is a fact
// about a single service, so a date change shows nothing rather than last
// week's closer.
//
// OFFLINE IS NOT NEGOTIABLE. This is a stage app. With no network the whole
// songbook must behave exactly as it does without this feature: the cached set
// renders, nothing blocks, nothing throws, nothing is lost. So:
//   - every network call is wrapped and resolves to null on failure,
//   - the local value is authoritative for display and written FIRST,
//   - a write made offline is queued and flushed when connectivity returns.
// A failed fetch is a normal state here, not an error to report.
//
// SHAPE (localStorage, songbook_endsong_<serviceId>_<date>):
//   { chartId, entryId, title, key, updatedAt } | null
// ============================================================

import { API_BASE } from "./setStore.js";

// Shared secret for the WRITE only. Reads are open — the payload is a song
// title and a key, nothing personal — but an open write endpoint on a public
// Worker is not acceptable. Same style as ltc-api's confirm-page key.
export const ENDSONG_KEY = "sbEndSong7Qm2xVrTp4Lw9KdNcHbGfJyA";

const key = (serviceId, date) => "songbook_endsong_" + serviceId + "_" + date;
const QUEUE_KEY = "songbook_endsong_queue";

const read = (k, fallback) => {
  try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
};
const write = (k, v) => {
  try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ }
};

export const readEndSong = (serviceId, date) => read(key(serviceId, date), null);
export const writeEndSongLocal = (serviceId, date, row) => write(key(serviceId, date), row);

// A row as the wire carries it -> the row we store. Null and "cleared" are the
// same thing to every caller, so an empty chart_id collapses to null here once
// rather than being re-checked at each use.
const fromWire = (body) => {
  if (!body || !body.found || !body.end_song || !body.end_song.chart_id) return null;
  const e = body.end_song;
  return { chartId: e.chart_id, entryId: e.entry_id || null, title: e.title || "", key: e.key || null, updatedAt: e.updated_at || null };
};

// ------------------------------------------------------------
// NETWORK. Both calls swallow every failure and resolve — never reject —
// because the caller is a stage app that must not care whether the network
// exists. `undefined` means "could not tell"; `null` means "the server says
// there is none", and only the latter may clear a local value.
// ------------------------------------------------------------
export const fetchEndSong = async (serviceId, date) => {
  try {
    const res = await fetch(API_BASE + "/songbook/endsong?service_type_id=" + encodeURIComponent(serviceId) +
      "&service_date=" + encodeURIComponent(date), { cache: "no-store" });
    if (!res.ok) return undefined;
    const body = await res.json();
    if (body && body.error) return undefined;
    return fromWire(body);
  } catch (e) {
    return undefined;   // offline, DNS, CORS, a 502 — all the same to the stage
  }
};

const postEndSong = async (serviceId, date, row) => {
  const res = await fetch(API_BASE + "/songbook/endsong", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + ENDSONG_KEY },
    body: JSON.stringify({
      service_type_id: String(serviceId),
      service_date: date,
      chart_id: row ? row.chartId : null,
      entry_id: row ? row.entryId || null : null,
      title: row ? row.title || "" : "",
      key: row ? row.key || null : null,
    }),
  });
  return res.ok;
};

// ------------------------------------------------------------
// QUEUE. One pending write per service+date — the last choice wins, so a
// queue that grows without bound is impossible however long she is offline.
// ------------------------------------------------------------
const readQueue = () => { const q = read(QUEUE_KEY, []); return Array.isArray(q) ? q : []; };

const enqueue = (serviceId, date, row) => {
  const q = readQueue().filter((it) => !(it.serviceId === String(serviceId) && it.date === date));
  q.push({ serviceId: String(serviceId), date, row, at: new Date().toISOString() });
  write(QUEUE_KEY, q);
};

// Send everything queued. Anything that fails stays queued for the next
// attempt; nothing here throws, so it is safe to call on any event.
export const flushEndSongQueue = async () => {
  const q = readQueue();
  if (!q.length) return false;
  const left = [];
  let sent = false;
  for (const it of q) {
    try {
      if (await postEndSong(it.serviceId, it.date, it.row)) sent = true;
      else left.push(it);
    } catch (e) {
      left.push(it);
    }
  }
  write(QUEUE_KEY, left);
  return sent;
};

// Set or clear the end song. The LOCAL write happens first and unconditionally:
// the device that made the choice shows it immediately, network or not.
export const setEndSong = async (serviceId, date, row) => {
  writeEndSongLocal(serviceId, date, row ? { ...row, updatedAt: new Date().toISOString() } : null);
  try {
    if (await postEndSong(serviceId, date, row)) return true;
    enqueue(serviceId, date, row);
    return false;
  } catch (e) {
    enqueue(serviceId, date, row);
    return false;
  }
};
