// Week's set: fetch from the ltc-api Worker, cache per service+date in
// localStorage under songbook_ keys only. Pure JS, no React.

export const API_BASE = "https://ltc-api.farfromtimnah.workers.dev";

export const SERVICE_TYPES = [
  { id: "1707498", name: "English Service", day: 6 },
  { id: "1162648", name: "Sunday 10AM", day: 0 },
  // Rocket meets SATURDAY. It was flagged day 0, so the picker defaulted to a
  // Sunday date and loaded an empty set — which reads as a missing set rather
  // than a wrong date. Verified against Planning Center: every Rocket plan from
  // 2026-09-05 to 2026-11-07 falls on a Saturday.
  { id: "1242401", name: "Rocket", day: 6 },
  // Link is SUNDAY, verified the same way (every plan 2026-09-06 .. 2026-11-08
  // is a Sunday), so day 0 is already correct and is deliberately left alone.
  { id: "1635885", name: "Link", day: 0 },
  { id: "1401015", name: "Legacy", day: 0 },
  { id: "1213946", name: "Sunday 6:30PM EN", day: 0 },
  { id: "1162055", name: "Culto Fe", day: 0 },
  { id: "1259513", name: "Culto Hope", day: 0 },
];
export const STUDENT_SERVICE_IDS = ["1707498", "1162648"];

const pad = (n) => String(n).padStart(2, "0");
export const isoDate = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());

// Next upcoming Saturday / Sunday (today counts if it is that day).
export const nextWeekend = (now = new Date()) => {
  const dow = now.getDay();
  const sat = new Date(now); sat.setDate(now.getDate() + ((6 - dow + 7) % 7));
  const sun = new Date(now); sun.setDate(now.getDate() + ((7 - dow) % 7));
  return { saturday: isoDate(sat), sunday: isoDate(sun) };
};
export const defaultDateFor = (serviceTypeId, now = new Date()) => {
  const st = SERVICE_TYPES.find((s) => s.id === String(serviceTypeId));
  const w = nextWeekend(now);
  return st && st.day === 6 ? w.saturday : w.sunday;
};

const cacheKey = (id, date) => "songbook_set_" + id + "_" + date;

export const readCachedSet = (id, date) => {
  try { const raw = localStorage.getItem(cacheKey(id, date)); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
};
const writeCachedSet = (id, date, data) => {
  try { localStorage.setItem(cacheKey(id, date), JSON.stringify(data)); } catch (e) { /* storage full or blocked */ }
};

export const fetchSet = async (id, date) => {
  const res = await fetch(API_BASE + "/songbook/set?service_type_id=" + encodeURIComponent(id) + "&service_date=" + encodeURIComponent(date), { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const body = await res.json();
  if (body.error) throw new Error(body.error);
  // songs carry { title, sequence, key, key_minor } — `key` is Planning
  // Center's PLAYING key for that item, which the chart PDF never follows.
  const data = { found: !!body.found, songs: body.songs || [], syncedAt: new Date().toISOString() };
  writeCachedSet(id, date, data);
  return data;
};

export const sameSongs = (a, b) => JSON.stringify((a && a.songs) || []) === JSON.stringify((b && b.songs) || []);
