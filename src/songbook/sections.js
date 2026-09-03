// Section dedup, play order, roadmap tokens and abbreviations. Pure.

const signature = (lines) => JSON.stringify(lines.map((l) => [l.text.trim(), (l.chords || []).map((c) => c.chord).join(" ")]));

// Raw sections (file order) -> unique blocks + play order referencing them.
// Identical lyrics AND identical chords collapse into one block; the same
// name with different content becomes a distinct block ("Chorus (2)").
export const buildBlocks = (sections) => {
  const blocks = [];
  const order = [];
  for (const sec of sections) {
    const name = sec.name;
    if (!sec.lines.length) {
      // Empty body: "(repeat)" style reference to an earlier block of that name.
      const ref = blocks.filter((b) => b.name === name || b.baseName === name).pop();
      if (ref) order.push({ block: ref.id, times: sec.times || 1 });
      else order.push({ block: null, label: name, times: sec.times || 1 });
      continue;
    }
    const sig = signature(sec.lines);
    let found = blocks.find((b) => b.baseName === name && b.sig === sig);
    if (!found) {
      const sameName = blocks.filter((b) => b.baseName === name).length;
      found = { id: blocks.length, name: sameName ? name + " (" + (sameName + 1) + ")" : name, baseName: name, sig, lines: sec.lines };
      blocks.push(found);
    }
    order.push({ block: found.id, times: sec.times || 1 });
  }
  return { blocks: blocks.map(({ sig, ...b }) => b), order };
};

const ROADMAP_TOKENS = {
  v: "Verse", pc: "Pre-Chorus", c: "Chorus", b: "Bridge", i: "Intro", in: "Intro", intro: "Intro",
  inter: "Interlude", inst: "Instrumental", rf: "Refrain", e: "Ending", end: "Ending", outro: "Outro",
  tag: "Tag", turn: "Turnaround", vamp: "Vamp", bd: "Breakdown", ch: "Chorus", pre: "Pre-Chorus",
};

// "Rf×2" / "C x3" -> { name: "Refrain", times: 2 }
export const parseRoadmapToken = (tok) => {
  let s = tok.trim();
  let times = 1;
  const m = /^(.*?)\s*(?:×|x)\s*(\d+)$/i.exec(s);
  if (m) { s = m[1].trim(); times = parseInt(m[2], 10); }
  const mm = /^([A-Za-z-]+)\s*(\d*)$/.exec(s);
  if (!mm) return { raw: tok, name: s, times };
  const base = ROADMAP_TOKENS[mm[1].toLowerCase()] || (mm[1][0].toUpperCase() + mm[1].slice(1).toLowerCase());
  return { raw: tok, name: mm[2] ? base + " " + mm[2] : base, times };
};

// Resolve roadmap tokens against blocks; unresolved tokens are kept as labels.
export const resolveRoadmap = (tokens, blocks) => tokens.map((tok) => {
  const p = parseRoadmapToken(tok);
  let b = blocks.find((x) => x.baseName === p.name);
  if (!b && !/\d/.test(p.name)) b = blocks.find((x) => x.baseName.replace(/\s*\d+$/, "") === p.name);
  if (!b && /\d/.test(p.name)) b = blocks.find((x) => x.baseName === p.name.replace(/\s*\d+$/, ""));
  return { block: b ? b.id : null, label: p.name, times: p.times };
});

const ABBR = { intro: "In", verse: "V", "pre-chorus": "PC", chorus: "C", bridge: "B", refrain: "Rf", interlude: "Int", instrumental: "Inst", ending: "E", outro: "O", tag: "T", turnaround: "Tn", vamp: "Vp", breakdown: "Bd" };

export const abbreviate = (name) => {
  const m = /^(.*?)\s*(\d+)?(?:\s*\((\d+)\))?$/.exec(name.trim());
  const base = (m ? m[1] : name).toLowerCase();
  const num = m && m[2] ? m[2] : "";
  const variant = m && m[3] ? "'" : "";
  const known = ABBR[base];
  const abbr = known || base.split(/[\s-]+/).map((w) => w[0].toUpperCase()).join("");
  return abbr + num + variant;
};

// Condensed letters are only safe when no two distinct names share one.
export const abbreviationsFor = (names) => {
  const map = {};
  const used = {};
  let collision = false;
  for (const n of names) {
    const a = abbreviate(n);
    if (used[a] && used[a] !== n) collision = true;
    used[a] = n;
    map[n] = a;
  }
  return { map, collision };
};
