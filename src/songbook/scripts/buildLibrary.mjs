// Build-time compiler: songsources/ -> library.json. Run with:
//   node src/songbook/scripts/buildLibrary.mjs
// PDFs are read through `pdftotext -layout` (poppler). The app never parses a
// source file at runtime.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseChordPro } from "../chordpro.js";
import { parsePcPdfText } from "../pcpdf.js";
import { buildBlocks, resolveRoadmap, abbreviationsFor } from "../sections.js";
import { detectKey, capoFor } from "../chords.js";
import { normalize, parseTitle, langOfText, fold } from "../text.js";
import keyOverrides from "../keyOverrides.json" with { type: "json" };

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, "..", "songsources");
const outFile = join(here, "..", "library.json");

const slug = (s) => normalize(s).replace(/\s+/g, "-");

const charts = [];
const usedIds = new Set();
const uniqueId = (base) => { let id = base, n = 2; while (usedIds.has(id)) id = base + "-" + n++; usedIds.add(id); return id; };
const files = readdirSync(srcDir).filter((f) => !f.startsWith(".")).sort();
for (const file of files) {
  const ext = extname(file).toLowerCase();
  let parsed, format, lang, names, declaredKey = null, artist = "";
  if (ext === ".chordpro") {
    format = "chordpro";
    parsed = parseChordPro(readFileSync(join(srcDir, file), "utf8"));
    // Language from CONTENT: Portuguese charts carry ALL-CAPS English gloss lines.
    lang = parsed.glossCount >= 3 ? "pt" : "en";
    const t = parseTitle(parsed.title);
    names = { primary: t.primary, alts: t.alts };
    declaredKey = parsed.keyDirective;
    artist = parsed.artist;
  } else if (ext === ".pdf") {
    format = "pdf";
    const text = execFileSync("pdftotext", ["-layout", join(srcDir, file), "-"], { encoding: "utf8" });
    parsed = parsePcPdfText(text);
    const lyricText = parsed.sections.flatMap((s) => s.lines.map((l) => l.text)).join("\n");
    lang = langOfText(lyricText) || "pt";
    names = { primary: parsed.title, alts: parsed.altTitles };
    declaredKey = parsed.key;
    artist = parsed.performer + (parsed.writers ? " / " + parsed.writers : "");
  } else continue;

  const { blocks, order } = buildBlocks(parsed.sections);
  // keyOverrides.json wins over both the file's own directive and detection.
  const key = detectKey(blocks, keyOverrides[file] || declaredKey);
  const roadmap = parsed.roadmap ? resolveRoadmap(parsed.roadmap, blocks) : null;
  const abbr = abbreviationsFor(blocks.map((b) => b.name));
  // Which name is which language: per-name heuristic, falling back to the chart's own language.
  const nameLangs = [names.primary, ...names.alts].map((n) => langOfText(n));
  const primaryLang = nameLangs[0] || (nameLangs[1] ? (nameLangs[1] === "pt" ? "en" : "pt") : lang);
  const enName = primaryLang === "en" ? names.primary : (names.alts.find((a, i) => nameLangs[i + 1] === "en") || names.alts[0] || null);
  const ptName = primaryLang === "pt" ? names.primary : (names.alts.find((a, i) => nameLangs[i + 1] === "pt") || names.alts[0] || null);
  charts.push({
    id: uniqueId(slug(file.replace(/\.[^.]+$/, ""))),
    file, format, lang, title: parsed.title || names.primary,
    names, enName, ptName, artist,
    tempo: parsed.tempo || null, time: parsed.time || null,
    key, capo: key ? capoFor(key) : null,
    blocks, order, roadmap, roadmapRaw: parsed.roadmap || null,
    abbrev: abbr.map, abbrevCollision: abbr.collision,
    notes: parsed.notes || [], glossCount: parsed.glossCount,
    audio: null, // seam for a future Play button; nothing here today
  });
}

// Group charts into songs by shared (normalized) name, union-find style.
const parent = charts.map((_, i) => i);
const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
const byAlias = {};
charts.forEach((c, i) => {
  [c.names.primary, ...c.names.alts].map(normalize).filter(Boolean).forEach((a) => {
    if (byAlias[a] != null) parent[find(i)] = find(byAlias[a]); else byAlias[a] = i;
  });
});
const groups = {};
charts.forEach((c, i) => { const r = find(i); (groups[r] = groups[r] || []).push(c); });
const songs = Object.values(groups).map((list) => {
  list.sort((a, b) => (a.lang === b.lang ? a.file.localeCompare(b.file) : a.lang === "pt" ? -1 : 1));
  const en = list.map((c) => c.enName).find(Boolean) || null;
  const pt = list.map((c) => c.ptName).find(Boolean) || null;
  const aliases = [...new Set(list.flatMap((c) => [c.names.primary, ...c.names.alts]).map(normalize).filter(Boolean))];
  return { id: slug(pt || en || list[0].title), en, pt, aliases, charts: list.map((c) => c.id), langs: [...new Set(list.map((c) => c.lang))] };
}).sort((a, b) => fold(a.pt || a.en).localeCompare(fold(b.pt || b.en)));

const chartMap = {};
charts.forEach((c) => { chartMap[c.id] = c; });
const library = { generatedAt: new Date().toISOString(), sourceCount: files.length, songs, charts: chartMap };
writeFileSync(outFile, JSON.stringify(library));

// Human-readable summary for verification.
console.log("files:", files.length, "charts:", charts.length, "songs:", songs.length, "bytes:", JSON.stringify(library).length);
for (const c of charts) console.log([c.lang.toUpperCase(), c.format, (c.key ? c.key.tonic + (c.key.minorSurface ? " (reads " + c.key.relativeMinor + ")" : "") : "?").padEnd(16), String(c.blocks.length).padStart(2) + " blk", c.roadmap ? "map" : "   ", c.file].join("  "));
console.log("--- songs with more than one chart:");
for (const s of songs.filter((x) => x.charts.length > 1)) console.log(" ", s.id, "->", s.charts.join(", "));
