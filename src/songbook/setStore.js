// Week's set: fetch from the ltc-api Worker, cache per service+date in
// localStorage under songbook_ keys only. Pure JS, no React.

export const API_BASE = "https://ltc-api.farfromtimnah.workers.dev";

// `day` is the weekday the service MEETS, as JS getDay(): 0=Sun .. 6=Sat.
// Every value here was verified against the live Planning Center endpoint by
// querying all seven days of 2026-09-07..2026-09-13 for each service: each one
// returns a plan on exactly one weekday, and that is the day recorded below.
// (English Service has no plan that particular week; it is confirmed Saturday
// from 2026-09-05 and 2026-09-26.)
export const SERVICE_TYPES = [
  { id: "1707498", name: "English Service", day: 6 },   // Saturday
  { id: "1162648", name: "Sunday 10AM", day: 0 },       // Sunday
  { id: "1242401", name: "Rocket", day: 6 },            // Saturday
  { id: "1635885", name: "Link", day: 0 },              // Sunday
  // These three do NOT meet at the weekend. They were all flagged Sunday, so
  // the picker defaulted to a date with no plan and loaded an empty set —
  // which reads as a missing set rather than a wrong date.
  { id: "1401015", name: "Legacy", day: 5 },            // Friday    (2026-09-11, 09-18)
  { id: "1213946", name: "Sunday 6:30PM EN", day: 0 },  // Sunday
  { id: "1162055", name: "Culto Fe", day: 3 },          // Wednesday (2026-09-09, 09-16)
  { id: "1259513", name: "Culto Hope", day: 2 },        // Tuesday   (2026-09-08, 09-15)
];
// NOTE: there is deliberately no shared student service list here any more.
// Which services a student sees is a fact about that student, so it lives on
// their entry in STUDENTS (src/App.jsx) as `services` and is threaded into the
// songbook the same way `instrument` is. A module-level list here was wrong for
// every student at once — none of them played the two services it named — and
// keeping it alongside the per-student field would leave two competing sources
// of truth for the same question.

const pad = (n) => String(n).padStart(2, "0");
export const isoDate = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());

// Next upcoming Saturday / Sunday (today counts if it is that day).
export const nextWeekend = (now = new Date()) => {
  const dow = now.getDay();
  const sat = new Date(now); sat.setDate(now.getDate() + ((6 - dow + 7) % 7));
  const sun = new Date(now); sun.setDate(now.getDate() + ((7 - dow) % 7));
  return { saturday: isoDate(sat), sunday: isoDate(sun) };
};
// The next occurrence of a given weekday (0=Sun .. 6=Sat), today included when
// today IS that day — the set for tonight's service must still be reachable on
// the day itself.
export const nextWeekday = (day, now = new Date()) => {
  const d = new Date(now);
  d.setDate(now.getDate() + ((day - now.getDay() + 7) % 7));
  return isoDate(d);
};

// The date a service defaults to: the next time it actually MEETS.
//
// This used to ask only "is it day 6?" and send everything else to Sunday,
// which could not express Friday, Wednesday or Tuesday — so Legacy, Culto Fé
// and Culto Hope all defaulted to a day with no plan and loaded an empty set.
// It now follows whatever weekday the service is flagged with, so the four
// weekend services land exactly where they did before and the three midweek
// ones land on their own day.
//
// An unknown id keeps the old fallback of the coming Sunday rather than
// throwing: a service we cannot identify is no reason to break the picker.
export const defaultDateFor = (serviceTypeId, now = new Date()) => {
  const st = SERVICE_TYPES.find((s) => s.id === String(serviceTypeId));
  if (!st || typeof st.day !== "number") return nextWeekday(0, now);
  return nextWeekday(st.day, now);
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
