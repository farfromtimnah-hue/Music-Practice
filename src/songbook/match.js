// Planning Center set item title -> library entry. Pure.
import { normalize, stripLeader, leaderOf, parseTitle, tokens } from "./text.js";

const STOP = new Set(["a", "o", "e", "de", "do", "da", "the", "of", "in", "as", "em", "no", "na", "que", "is", "and"]);
const significant = (s) => tokens(s).filter((t) => !STOP.has(t));

export const cleanSetTitle = (raw) => stripLeader(raw);

export const matchSetItem = (rawTitle, library) => {
  const cleaned = cleanSetTitle(rawTitle);
  // Planning Center already told us who is singing it. The strip above is
  // unchanged — this only KEEPS what it was throwing away.
  const leader = leaderOf(rawTitle);
  const parsed = parseTitle(cleaned);
  const candidates = [parsed.primary, ...parsed.alts].map(normalize).filter(Boolean);
  const entries = library.songs;
  // 1. exact normalized match against either language name / any alias
  for (const c of candidates) {
    const e = entries.find((s) => s.aliases.includes(c));
    if (e) return { title: cleaned, entry: e, leader, method: "exact" };
  }
  // 2. all significant tokens of one contained in the other
  for (const c of candidates) {
    const ct = significant(c);
    if (!ct.length) continue;
    const e = entries.find((s) => s.aliases.some((a) => {
      const at = significant(a);
      if (!at.length) return false;
      const contains = (x, y) => x.every((t) => y.includes(t));
      return contains(ct, at) || contains(at, ct);
    }));
    if (e) return { title: cleaned, entry: e, leader, method: "tokens" };
  }
  return { title: cleaned, entry: null, leader, method: "none" };
};

// Which chart of an entry to open for a given service: EN services prefer the
// English chart, everything else prefers Portuguese. Never offers a missing one.
export const EN_SERVICE_IDS = ["1707498", "1213946"];
export const pickChart = (entry, library, serviceTypeId, preferredLang) => {
  const charts = entry.charts.map((id) => library.charts[id]);
  const want = preferredLang || (EN_SERVICE_IDS.includes(String(serviceTypeId)) ? "en" : "pt");
  return charts.find((c) => c.lang === want) || charts[0];
};
