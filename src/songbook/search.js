// One-box search across titles (both languages) and lyrics (real lines and
// English gloss). Accent- and case-insensitive. Pure.
import { normalize } from "./text.js";

export const buildSearchIndex = (library) => {
  const docs = [];
  for (const entry of library.songs) {
    for (const chartId of entry.charts) {
      const chart = library.charts[chartId];
      const lines = [];
      chart.blocks.forEach((b) => b.lines.forEach((l) => {
        if (l.text && /\S/.test(l.text)) lines.push({ kind: "lyric", text: l.text, norm: normalize(l.text), block: b.name });
        if (l.gloss) lines.push({ kind: "gloss", text: l.gloss, norm: normalize(l.gloss), block: b.name });
      }));
      docs.push({ entry, chart, names: [chart.names.primary, ...chart.names.alts].map((n) => ({ text: n, norm: normalize(n) })), lines });
    }
  }
  return docs;
};

export const search = (index, query, limit = 40) => {
  const q = normalize(query);
  if (!q || q.length < 2) return [];
  const results = [];
  for (const d of index) {
    const name = d.names.find((n) => n.norm.includes(q));
    if (name) { results.push({ entry: d.entry, chart: d.chart, kind: "title", text: name.text, score: 100 + (name.norm === q ? 20 : 0) }); continue; }
    const lyric = d.lines.find((l) => l.kind === "lyric" && l.norm.includes(q));
    if (lyric) { results.push({ entry: d.entry, chart: d.chart, kind: "lyric", text: lyric.text, block: lyric.block, score: 60 }); continue; }
    const gloss = d.lines.find((l) => l.kind === "gloss" && l.norm.includes(q));
    if (gloss) results.push({ entry: d.entry, chart: d.chart, kind: "gloss", text: gloss.text, block: gloss.block, score: 40 });
  }
  results.sort((a, b) => b.score - a.score || a.chart.title.localeCompare(b.chart.title));
  return results.slice(0, limit);
};
