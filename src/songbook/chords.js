// Pure chord / key / Nashville logic. No React, no DOM. Ports as-is.

const NOTE_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const DIATONIC_QUALITY = { 0: "maj", 2: "min", 4: "min", 5: "maj", 7: "maj", 9: "min", 11: "dim" };
const DEGREE_LABEL = { 0: "1", 1: "b2", 2: "2", 3: "b3", 4: "3", 5: "4", 6: "b5", 7: "5", 8: "b6", 9: "6", 10: "b7", 11: "7" };

// Root, then a suffix built only from real chord vocabulary (so "Bad", "Deus",
// "Ele" never parse as chords), then an optional slash bass.
const CHORD_RE = /^([A-G](?:#|b)?)((?:maj|min|dim|aug|sus|add|m|M|°|º|ø|\+|-|\d+|#|b|\(|\))*)(?:\/([A-G](?:#|b)?))?$/;

export const noteToPc = (name) => {
  if (!name) return null;
  const base = NOTE_PC[name[0]];
  if (base == null) return null;
  let pc = base;
  for (const ch of name.slice(1)) {
    if (ch === "#") pc += 1;
    else if (ch === "b") pc -= 1;
  }
  return ((pc % 12) + 12) % 12;
};

export const isChordToken = (tok) => CHORD_RE.test(tok);

export const parseChord = (tok) => {
  const m = CHORD_RE.exec(tok);
  if (!m) return null;
  const [, root, suffix = "", bass] = m;
  let quality = "maj";
  if (/dim|°|º|ø/.test(suffix)) quality = "dim";
  else if (/aug|\+/.test(suffix)) quality = "aug";
  else if (/^(min|m(?!aj)|-)/.test(suffix)) quality = "min";
  return { token: tok, root, rootPc: noteToPc(root), quality, suffix, bass: bass || null, bassPc: bass ? noteToPc(bass) : null };
};

// Chord suffix -> Nashville suffix. Minor is a dash, dominant 7 is a bare 7,
// maj7 is always written out, sus/add extensions are kept but normalized.
const nashvilleSuffix = (chord) => {
  let s = chord.suffix;
  let out = "";
  if (chord.quality === "min") { out += "-"; s = s.replace(/^(min|m|-)/, ""); }
  else if (chord.quality === "dim") { out += "°"; s = s.replace(/dim|°|º|ø/, ""); }
  else if (chord.quality === "aug") { out += "+"; s = s.replace(/aug|\+/, ""); }
  s = s.replace(/maj7|M7|7M|Maj7/, "maj7");
  s = s.replace(/^sus4$|^4$|^sus$/, "sus");
  s = s.replace(/^\(4\)$/, "sus");
  s = s.replace(/^sus2$/, "sus2");
  s = s.replace(/^add9$|^9$|^\(9\)$|^\(add9\)$/, "(add9)");
  s = s.replace(/^2$|^add2$|^\(2\)$/, "(2)");
  return out + s;
};

export const KEY_LIST = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

export const parseKeyName = (name) => {
  if (!name) return null;
  const m = /^([A-G](?:#|b)?)(m|min|-)?$/.exec(String(name).trim());
  if (!m) return null;
  return { tonic: m[1], tonicPc: noteToPc(m[1]), mode: m[2] ? "minor" : "major" };
};

export const keyName = (key) => key.tonic + (key.mode === "minor" ? "m" : "");

export const relativeMinorOf = (key, useFlats) => {
  const pc = (key.tonicPc + 9) % 12;
  return { tonic: (useFlats ? FLAT_NAMES : SHARP_NAMES)[pc], tonicPc: pc, mode: "minor" };
};
export const relativeMajorOf = (key, useFlats) => {
  const pc = (key.tonicPc + 3) % 12;
  return { tonic: pcToName(pc, useFlats), tonicPc: pc, mode: "major" };
};

export const pcToName = (pc, useFlats) => {
  // Conventional key spellings: Db Eb Ab Bb flat, F# sharp, unless the chart
  // itself leans the other way.
  if (useFlats === true) return FLAT_NAMES[pc];
  if (useFlats === false) return SHARP_NAMES[pc];
  return pc === 6 ? "F#" : FLAT_NAMES[pc];
};

export const degreeLabel = (pc, key) => DEGREE_LABEL[((pc - key.tonicPc) % 12 + 12) % 12];

export const toNashville = (token, key) => {
  const chord = parseChord(token);
  if (!chord || !key) return token;
  let out = degreeLabel(chord.rootPc, key) + nashvilleSuffix(chord);
  if (chord.bass) out += "/" + degreeLabel(chord.bassPc, key);
  return out;
};

// Legend rows: degree -> letter name for the given key (1 = C, 2 = D, ...).
export const keyLegend = (key) => {
  const useFlats = /b/.test(key.tonic) || key.tonic === "F";
  return MAJOR_SCALE.map((iv, i) => {
    const pc = (key.tonicPc + iv) % 12;
    const q = DIATONIC_QUALITY[iv];
    return { degree: String(i + 1) + (q === "min" ? "-" : q === "dim" ? "°" : ""), name: pcToName(pc, useFlats) + (q === "min" ? "m" : q === "dim" ? "°" : "") };
  });
};

// Guitar capo suggestion. Sounding key -> smallest capo that lands on an
// open-chord shape. A-shapes only count with a capo on (so A itself reads as
// "Capo 2 (G)", the way the team plays it).
export const capoFor = (key) => {
  if (!key) return null;
  const shapes = key.mode === "minor"
    ? [{ name: "Em", pc: 4 }, { name: "Am", pc: 9 }, { name: "Dm", pc: 2 }]
    : [{ name: "G", pc: 7 }, { name: "C", pc: 0 }, { name: "D", pc: 2 }, { name: "E", pc: 4 }, { name: "A", pc: 9, minFret: 1 }];
  let best = null;
  for (const s of shapes) {
    const fret = ((key.tonicPc - s.pc) % 12 + 12) % 12;
    if (fret > 7) continue;
    if (s.minFret && fret < s.minFret) continue;
    if (!best || fret < best.fret) best = { fret, shape: s.name };
  }
  return best;
};

// Key name transposed by `semitones` (negative = down), keeping the mode.
// Used for the full-capo fingering key: capo 2 in A means playing G shapes.
export const transposedKeyName = (key, semitones) => {
  const pcOut = ((key.tonicPc + semitones) % 12 + 12) % 12;
  const useFlats = /b/.test(key.tonic) || key.tonic === "F";
  return pcToName(pcOut, useFlats) + (key.mode === "minor" ? "m" : "");
};

export const capoLabel = (key) => {
  const c = capoFor(key);
  if (!c || c.fret === 0) return "Key: " + keyName(key);
  return "Key: " + keyName(key) + " - Capo " + c.fret + " (" + c.shape + ")";
};

// ---------------------------------------------------------------------------
// Key detection. Input: blocks -> lines -> chords (tokens). Output: the major
// key best supported by the chart, weighting what the song lands on at cadence
// points (end of each block, end of song) far more than the first chord.
// Worship music is overwhelmingly major, so the result is always a major key;
// `minorSurface` flags charts that lean on the 6- chord (the pattern Planning
// Center mislabels as the relative minor) so the UI can show the notice.
// ---------------------------------------------------------------------------
export const detectKey = (blocks, declared) => {
  const occurrences = [];   // { chord, blockIdx, isBlockLast, isFirst }
  let sharps = 0, flats = 0;
  blocks.forEach((b, bi) => {
    const chordsInBlock = [];
    (b.lines || []).forEach((ln) => (ln.chords || []).forEach((c) => {
      const p = parseChord(c.chord);
      if (p) chordsInBlock.push(p);
    }));
    chordsInBlock.forEach((p, i) => {
      if (/#/.test(p.root)) sharps++; else if (/b/.test(p.root) && p.root.length > 1) flats++;
      occurrences.push({ chord: p, blockIdx: bi, isBlockLast: i === chordsInBlock.length - 1, isBlockFirst: i === 0 });
    });
  });
  if (!occurrences.length) {
    const d = parseKeyName(declared);
    return d ? { ...d, declared: declared || null, minorSurface: false, confidence: 0 } : null;
  }
  const useFlats = flats > sharps ? true : sharps > flats ? false : undefined;
  const scores = [];
  const isSusLike = (c) => /sus|add|\d/.test(c.suffix) && c.quality === "maj";
  for (let pc = 0; pc < 12; pc++) {
    let score = 0;
    occurrences.forEach((o, idx) => {
      const d = ((o.chord.rootPc - pc) % 12 + 12) % 12;
      const inScale = MAJOR_SCALE.includes(d);
      if (!inScale) score -= 2;
      else if (DIATONIC_QUALITY[d] === o.chord.quality) score += 1;
      else if (isSusLike(o.chord)) score += 0.7;
      else score -= 1;
      if (o.isBlockLast) { if (d === 0) score += 1.5; else if (d === 7) score += 0.5; }
      if (o.isBlockFirst && d === 0) score += 1;
      if (idx === occurrences.length - 1 && d === 0) score += 2;
      if (idx === 0 && d === 0) score += 1;
    });
    scores.push({ pc, score });
  }
  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  const declaredKey = parseKeyName(declared);
  let tonicPc = best.pc;
  // A declared major key that the chart supports nearly as well wins outright.
  if (declaredKey && declaredKey.mode === "major") {
    const ds = scores.find((s) => s.pc === declaredKey.tonicPc);
    if (ds && ds.score >= best.score - 2) tonicPc = declaredKey.tonicPc;
  }
  const key = { tonic: declaredKey && declaredKey.mode === "major" && declaredKey.tonicPc === tonicPc ? declaredKey.tonic : pcToName(tonicPc, useFlats), tonicPc, mode: "major" };
  const relMinorPc = (tonicPc + 9) % 12;
  const minorTonicCount = occurrences.filter((o) => o.chord.rootPc === relMinorPc && o.chord.quality === "min").length;
  const majorTonicCount = occurrences.filter((o) => o.chord.rootPc === tonicPc && o.chord.quality === "maj").length;
  const rootPositionMajorTonic = occurrences.filter((o) => o.chord.rootPc === tonicPc && o.chord.quality === "maj" && (!o.chord.bass || o.chord.bassPc === tonicPc)).length;
  const startsOnMinor = occurrences[0].chord.rootPc === relMinorPc && occurrences[0].chord.quality === "min";
  const declaredMinor = !!(declaredKey && declaredKey.mode === "minor" && declaredKey.tonicPc === relMinorPc);
  // The pattern Planning Center mislabels: the song opens on the 6- chord, or the
  // major tonic never appears in root position (only as an inversion like G/B)
  // while the 6- chord does the work on the surface.
  const minorSurface = declaredMinor || startsOnMinor || (rootPositionMajorTonic === 0 && minorTonicCount > 0 && minorTonicCount >= majorTonicCount);
  return {
    ...key,
    declared: declared || null,
    correctedFrom: declaredMinor ? declared : (minorSurface ? pcToName(relMinorPc, useFlats) + "m" : null),
    minorSurface,
    relativeMinor: pcToName(relMinorPc, useFlats) + "m",
    confidence: scores.length > 1 ? Math.round((best.score - scores[1].score) * 10) / 10 : 0,
    useFlats: useFlats === undefined ? null : useFlats,
  };
};
