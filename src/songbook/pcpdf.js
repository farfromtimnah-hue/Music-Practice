// Planning Center chord-chart PDF parser. Input is the text layer as produced
// by `pdftotext -layout`. Pure function.
import { isChordToken } from "./chords.js";

const undot = (s) => s.replace(/\./g, " ");

const isHeaderLine = (line) => {
  const t = undot(line).trim();
  if (!t) return false;
  const toks = t.split(/\s+/);
  if (!/^[A-Z][A-Z]+$/.test(toks[0])) return false;
  let i = 1;
  while (i < toks.length && (/^[A-Z][A-Z]+$/.test(toks[i]) || /^\d+$/.test(toks[i]))) i++;
  const name = toks.slice(0, i).join(" ");
  const rest = toks.slice(i);
  if (rest.length && !rest.every(isChordToken)) return false;
  return { name: name.split(" ").map((w) => /^\d+$/.test(w) ? w : w[0] + w.slice(1).toLowerCase()).join(" ").replace(/^Pre Chorus/, "Pre-Chorus"), chordTokens: rest, chordLine: rest.length ? undot(line).slice(undot(line).indexOf(rest[0])) : null };
};

const isChordLine = (line) => {
  const t = undot(line).trim();
  if (!t) return false;
  return t.split(/\s+/).every(isChordToken);
};

// Chord line + lyric line -> { text, chords:[{pos,chord}] } using column index.
export const attachByColumn = (chordLine, lyricLine) => {
  const c = undot(chordLine);
  const text = lyricLine == null ? "" : undot(lyricLine).replace(/\s+$/, "");
  const chords = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(c))) chords.push({ pos: Math.min(m.index, text.length), chord: m[0] });
  return { text, chords };
};

export const parsePcPdfText = (raw) => {
  const chart = { title: "", altTitles: [], performer: "", writers: "", key: null, tempo: null, time: null, roadmap: null, sections: [], glossCount: 0 };
  const lines = raw.replace(/\r/g, "").replace(/\f/g, "\n").split("\n");
  // Header lines are indented by two spaces; content starts at column 0.
  const meta = [];
  const content = [];
  for (const l of lines) {
    if (/^\s+\S/.test(l)) meta.push(l.trim());
    else content.push(l);
  }
  const head = meta.filter((m) => m && !/^\d+$/.test(m) && !/^©/.test(m));
  const first = head[0] || "";
  const t = /^(.*?)\s*\[([^\]]*)\]\s*$/.exec(first);
  let titleText = first;
  if (t) {
    titleText = t[1].trim();
    t[2].split(",").map((x) => x.trim()).forEach((part, i) => {
      if (i === 0) chart.key = part;
      else if (/bpm/i.test(part)) chart.tempo = parseFloat(part) || null;
      else if (/\d\/\d/.test(part)) chart.time = part;
    });
  }
  const paren = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(titleText);
  chart.title = paren ? paren[1].trim() : titleText;
  if (paren) chart.altTitles.push(paren[2].trim());
  const second = head[1] || "";
  const perf = /^\[([^\]]*)\]\s*(?:by\s+(.*))?$/.exec(second);
  if (perf) { chart.performer = perf[1]; chart.writers = perf[2] || ""; }
  // The performer in parentheses is not an alternate title.
  chart.altTitles = chart.altTitles.filter((a) => !(chart.performer && chart.performer.toLowerCase().includes(a.toLowerCase())));
  // Line 3 (may wrap): the arrangement roadmap, comma separated, until a blank line.
  const roadmapLines = [];
  for (let i = 2; i < meta.length; i++) {
    if (!meta[i]) break;
    if (/^\d+$/.test(meta[i]) || /^©/.test(meta[i])) break;
    roadmapLines.push(meta[i]);
    if (!/,\s*$/.test(meta[i])) break;
  }
  if (roadmapLines.length) chart.roadmap = roadmapLines.join(" ").split(",").map((x) => x.trim()).filter(Boolean);

  let cur = null;
  let pending = null;
  const flushPending = () => {
    if (pending && cur) cur.lines.push(attachByColumn(pending, null));
    pending = null;
  };
  for (const line of content) {
    if (!line.trim()) { flushPending(); continue; }
    const h = isHeaderLine(line);
    if (h) {
      flushPending();
      cur = { name: h.name, times: 1, repeat: false, lines: [] };
      chart.sections.push(cur);
      if (h.chordLine) cur.lines.push(attachByColumn(h.chordLine, null));
      continue;
    }
    if (!cur) { cur = { name: "Verse", times: 1, repeat: false, lines: [] }; chart.sections.push(cur); }
    if (isChordLine(line)) { flushPending(); pending = line; continue; }
    if (pending) { cur.lines.push(attachByColumn(pending, line)); pending = null; }
    else cur.lines.push({ text: undot(line).replace(/\s+$/, ""), chords: [] });
  }
  flushPending();
  return chart;
};
