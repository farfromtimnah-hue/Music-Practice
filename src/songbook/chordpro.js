// ChordPro parser. Pure function: text in, chart object out.
import { isAllCaps } from "./text.js";

const titleCase = (s) => s.split(/\s+/).map((w) => w ? w[0].toUpperCase() + w.slice(1) : w).join(" ").replace(/Pre-chorus/i, "Pre-Chorus");

// "Chorus (repeat, x2)" / "Chorus x2 (repeat)" / "Chorus} (x2)" -> base name + times + repeat flag.
export const parseSectionLabel = (raw) => {
  let s = raw.trim();
  let times = 1;
  let repeat = false;
  const paren = /^(.*?)\s*\((.*)\)\s*$/.exec(s);
  if (paren) {
    s = paren[1].trim();
    const inner = paren[2];
    if (/repeat/i.test(inner)) repeat = true;
    const x = /x\s*(\d+)/i.exec(inner);
    if (x) times = parseInt(x[1], 10);
  }
  const x2 = /\s*x\s*(\d+)$/i.exec(s);
  if (x2) { times = parseInt(x2[1], 10); s = s.slice(0, x2.index).trim(); }
  return { name: titleCase(s.toLowerCase()), times, repeat };
};

// "[C]We worship the [G]God" -> { text, chords:[{pos,chord}] }
export const parseLyricLine = (line) => {
  const chords = [];
  let text = "";
  const re = /\[([^\]]*)\]/g;
  let last = 0, m;
  while ((m = re.exec(line))) {
    text += line.slice(last, m.index);
    if (m[1].trim()) chords.push({ pos: text.length, chord: m[1].trim() });
    last = m.index + m[0].length;
  }
  text += line.slice(last);
  return { text: text.replace(/\s+$/, ""), chords };
};

export const parseChordPro = (src) => {
  const chart = { title: "", artist: "", tempo: null, time: null, keyDirective: null, comments: [], roadmap: null, notes: [], sections: [], glossCount: 0 };
  let cur = null;
  let structureRef = false;
  const lines = src.replace(/\r/g, "").split("\n");
  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");
    const dir = /^\{\s*([a-zA-Z_]+)\s*:\s*(.*?)\s*\}(.*)$/.exec(line);
    if (dir) {
      const [, name, value, trailing] = dir;
      const n = name.toLowerCase();
      if (n === "title" || n === "t") chart.title = value;
      else if (n === "artist" || n === "st" || n === "subtitle") chart.artist = value;
      else if (n === "tempo") chart.tempo = parseFloat(value) || null;
      else if (n === "time") chart.time = value;
      else if (n === "key") chart.keyDirective = value;
      else if (n === "comment") {
        chart.comments.push(value);
        const flow = /^(?:flow|structure(?: per source)?)\s*:\s*(.*)$/i.exec(value);
        if (flow && !chart.roadmap) chart.roadmap = flow[1].split(",").map((t) => t.trim()).filter(Boolean);
      } else if (n === "c" || n === "comment_italic" || n === "ci") {
        if (/^structure reference$/i.test(value)) { structureRef = true; cur = null; continue; }
        structureRef = false;
        const lab = parseSectionLabel(value + (trailing || ""));
        cur = { name: lab.name, times: lab.times, repeat: lab.repeat, lines: [] };
        chart.sections.push(cur);
      }
      continue;
    }
    if (structureRef) {
      if (!line.trim()) continue;
      if (!chart.roadmap && /,/.test(line) && !/^\(/.test(line)) chart.roadmap = line.split(",").map((t) => t.trim()).filter(Boolean);
      else chart.notes.push(line.replace(/^\(|\)$/g, ""));
      continue;
    }
    if (!line.trim()) continue;
    if (!cur) { cur = { name: "Verse", times: 1, repeat: false, lines: [] }; chart.sections.push(cur); }
    const hasChord = /\[[^\]]+\]/.test(line);
    const prev = cur.lines[cur.lines.length - 1];
    if (!hasChord && isAllCaps(line) && prev && !prev.gloss && /\p{L}/u.test(prev.text)) {
      prev.gloss = line.trim();
      chart.glossCount++;
      continue;
    }
    cur.lines.push(parseLyricLine(line));
  }
  return chart;
};
