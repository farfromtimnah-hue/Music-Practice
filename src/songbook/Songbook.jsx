import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from "react";
import library from "./library.json";
import { buildSearchIndex, search } from "./search.js";
import { matchSetItem, pickChart } from "./match.js";
import { SERVICE_TYPES, STUDENT_SERVICE_IDS, defaultDateFor, readCachedSet, fetchSet, sameSongs } from "./setStore.js";
import { toNashville, keyLegend, capoLabel, keyName, parseKeyName, transposedKeyName, KEY_LIST } from "./chords.js";
import { abbreviationsFor } from "./sections.js";
import { cutCapoAnswerFor, normalizeCapoSetting, cutFretOf, MAX_FULL_CAPO } from "./cutcapoAdapter.js";
import { guitarAnswerFor, chordNotesFor } from "./chordshapes.js";
import CutCapoDiagram from "./CutCapoDiagram.jsx";
import ChordDiagram from "./ChordDiagram.jsx";

// ============================================================
// STORAGE — songbook_ keys only. Never touches c5Log.
// ============================================================
const lsGet = (k, fallback) => { try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } };
const PREFS_KEY = "songbook_prefs";

const S = `
.sb{background:#000;color:#fff;min-height:100vh;font-family:'Source Sans 3',sans-serif;padding-bottom:40px;}
/* Chart view is a fixed pane, never a scrolling page: the whole song is on
   screen at once, because both of Nicole's hands are on the guitar. dvh, not
   vh — iOS Safari's collapsing toolbars make vh taller than what you can see. */
.sb.sb-fixed{min-height:0;height:100dvh;padding-bottom:0;overflow:hidden;}
.sb *{box-sizing:border-box;}
.sb-wrap{max-width:900px;margin:0 auto;padding:12px 14px;}
.sb-top{display:flex;align-items:center;gap:10px;padding:6px 0 10px;}
.sb-top h1{font-family:'Oswald',sans-serif;font-size:20px;letter-spacing:2px;color:var(--gold,#f0c040);margin:0;flex:1;text-transform:uppercase;}
.sb-back{background:none;border:1px solid #2a2a40;color:#bbb;border-radius:10px;padding:6px 12px;font-size:14px;cursor:pointer;}
.sb-chips{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 10px;}
.sb-chip{border:1.5px solid #2a2a40;background:#0e0e16;color:#aaa;border-radius:999px;padding:8px 14px;font-size:14px;cursor:pointer;}
.sb-chip.on{border-color:var(--gold,#f0c040);color:var(--gold,#f0c040);background:rgba(240,192,64,.08);}
.sb-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:6px 0 10px;}
.sb select,.sb input[type=date],.sb input[type=search]{background:#0e0e16;color:#fff;border:1.5px solid #2a2a40;border-radius:10px;padding:10px 12px;font-size:16px;font-family:inherit;}
.sb input[type=search]{width:100%;}
.sb-banner{background:#2a1f05;color:#f0c040;border:1px solid #5a4410;border-radius:10px;padding:8px 12px;font-size:13px;margin:6px 0 10px;}
.sb-muted{color:#8888aa;font-size:13px;}
.sb-list{display:flex;flex-direction:column;gap:8px;margin-top:8px;}
.sb-item{display:flex;gap:12px;align-items:center;width:100%;text-align:left;background:#0e0e16;border:1.5px solid #2a2a40;border-radius:14px;padding:12px 14px;color:#fff;cursor:pointer;font-family:inherit;}
.sb-item:disabled{opacity:.6;cursor:default;}
.sb-num{font-family:'Oswald',sans-serif;color:#8888aa;font-size:18px;min-width:22px;}
.sb-item-title{font-size:17px;font-weight:600;}
.sb-item-sub{font-size:13px;color:#8888aa;margin-top:2px;}
.sb-item-lang{margin-left:auto;font-size:11px;letter-spacing:1px;color:#8888aa;border:1px solid #2a2a40;border-radius:6px;padding:2px 6px;}
.sb-hit{font-size:13px;color:#ccc;margin-top:3px;font-style:italic;}
.sb-hit b{color:var(--gold,#f0c040);font-style:normal;}
/* chart */
/* Chart pane: header rows are fixed height, the chart body takes the rest and
   the auto-fit measures THAT box, not the viewport. min-height:0 is what lets
   a flex child actually shrink instead of pushing the pane taller. */
/* No max-width on the chart pane: width is what the auto-fit converts into
   font size, so throwing any of it away costs readability directly. */
.sb-pane{height:100dvh;display:flex;flex-direction:column;margin:0 auto;padding:5px 12px 4px;overflow:hidden;}
.sb-pane-head{flex:0 0 auto;}
.sb-body{flex:1 1 auto;min-height:0;overflow:hidden;position:relative;display:flex;flex-direction:column;justify-content:center;}
/* The measured content. Everything inside sizes off --sbfs, so one variable
   scales chords, lyrics, glosses and section labels together, proportionally. */
/* Chord charts are tall and narrow, so on any screen wider than a phone most
   of the width is wasted and the fit has to shrink the type to compensate.
   Columns turn that wasted width back into font size: the same song at twice
   the point size. Blocks never break across a column, for the same reason
   they never break across a page. */
.sb-fit{--sbfs:18px;--sbcols:1;font-size:var(--sbfs);column-count:var(--sbcols);column-gap:1.6em;column-fill:auto;}
.sb-fit>*{break-inside:avoid;-webkit-column-break-inside:avoid;}
/* A song that does not fill the height sits in the middle of the space rather
   than clinging to the top — done by the flex box above, so there is no state
   to keep in sync with the measurement. */
.sb-fit{width:100%;flex:0 0 auto;}
.sb-chart-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:6px;}
.sb-title{font-family:'Oswald',sans-serif;font-size:19px;color:#fff;line-height:1.15;}
.sb-alt{font-size:13px;color:#8888aa;}
.sb-meta{font-size:11px;color:#8888aa;}
.sb-key{text-align:right;white-space:nowrap;}
.sb-key-main{font-family:'Oswald',sans-serif;font-size:18px;color:var(--gold,#f0c040);background:none;border:1px solid #2a2a40;border-radius:10px;padding:6px 10px;cursor:pointer;}
.sb-legend{display:flex;flex-wrap:wrap;gap:5px;justify-content:flex-end;margin-top:3px;}
.sb-legend span{font-size:11px;color:#ccc;background:#0e0e16;border:1px solid #2a2a40;border-radius:6px;padding:2px 6px;}
.sb-legend span b{color:var(--gold,#f0c040);}
.sb-tools{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0;}
/* One tight row: every pixel these take is a pixel the lyrics do not get. */
.sb-bar{display:flex;gap:5px;align-items:center;flex-wrap:nowrap;overflow-x:auto;margin:2px 0 3px;scrollbar-width:none;}
.sb-bar::-webkit-scrollbar{display:none;}
.sb-bar .sb-tool{padding:3px 8px;font-size:12px;white-space:nowrap;flex:0 0 auto;}
.sb-bar .sb-key-main{font-size:14px;padding:3px 8px;flex:0 0 auto;}
.sb-bar select{padding:3px 6px;font-size:12px;flex:0 0 auto;}
.sb-bar .sb-capo-lbl{flex:0 0 auto;}
.sb-bar-sp{flex:1 1 auto;}
.sb-legend-i{flex:0 0 auto;font-size:11px;color:#ccc;background:#0e0e16;border:1px solid #2a2a40;border-radius:6px;padding:1px 5px;white-space:nowrap;}
.sb-legend-i b{color:var(--gold,#f0c040);}
.sb-tool{border:1px solid #2a2a40;background:#0e0e16;color:#aaa;border-radius:8px;padding:6px 10px;font-size:13px;cursor:pointer;font-family:inherit;}
.sb-tool.on{color:var(--gold,#f0c040);border-color:var(--gold,#f0c040);}
.sb-notice{background:#0b1a2e;border:1px solid #1e3a5f;color:#cfe3ff;border-radius:10px;padding:5px 9px;font-size:12px;margin:3px 0;display:flex;gap:10px;align-items:center;flex-wrap:wrap;}
.sb-notice .sb-tool{color:#cfe3ff;border-color:#1e3a5f;}
.sb-map{display:flex;flex-wrap:wrap;gap:4px 6px;align-items:center;margin:0 0 .5em;font-size:.78em;color:#8fa3c7;}
.sb-map .sb-map-item{background:#0b1226;border:1px solid #1c2a4a;border-radius:6px;padding:2px 8px;white-space:nowrap;}
.sb-map .sb-map-item.x{color:#5d6f95;border-style:dashed;}
.sb-block{margin:0 0 .85em;border-left:3px solid #14213d;padding-left:.55em;position:relative;}
.sb-block.drag{opacity:.5;}
.sb-block-label{font-family:'Oswald',sans-serif;font-size:.66em;letter-spacing:2px;text-transform:uppercase;color:#4a6da7;margin-bottom:.25em;display:flex;align-items:center;gap:8px;}
.sb-handle{margin-left:auto;display:flex;gap:4px;}
.sb-handle button{border:1px solid #2a2a40;background:#0e0e16;color:#aaa;border-radius:6px;padding:2px 8px;font-size:14px;cursor:pointer;touch-action:none;}
.sb-line{display:flex;flex-wrap:wrap;align-items:flex-end;margin:0;line-height:1.2;}
.sb-seg{display:inline-flex;flex-direction:column;white-space:pre;}
.sb-chord{font-family:'Oswald',sans-serif;font-weight:700;font-size:1.05em;color:var(--gold,#f0c040);min-height:1.2em;padding-right:.4em;line-height:1.15;}
.sb-chord small{font-size:.62em;color:#c9b06a;font-weight:400;}
.sb-txt{font-size:1em;color:#fff;min-height:1.15em;line-height:1.2;}
.sb-gloss{font-size:.72em;color:#9a9ac0;letter-spacing:.5px;margin:0 0 .28em;text-transform:uppercase;line-height:1.15;}
.sb-empty{color:#8888aa;font-size:14px;padding:20px 0;text-align:center;}
/* capo control + cut-capo chord popup (teacher only) */
.sb-capo{display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:flex-end;margin-top:6px;}
.sb-capo select{padding:5px 8px;font-size:13px;}
.sb-capo-lbl{display:flex;align-items:center;gap:5px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#8888aa;}
.sb-chord.tappable{cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation;position:relative;display:inline-block;}
/* A chord token is small type and a fingertip is not precise, so the tap
   area is grown past the glyph with a pseudo-element rather than padding —
   padding would move the chord off the syllable it sits above, and sitting
   over the right syllable is the whole point of a chord chart.
   It grows DOWNWARD most: the space under a chord is its own lyric line and
   is not a tap target, while the space above belongs to the line before.
   Horizontal growth stays inside the .4em gutter so neighbouring chords do
   not steal each other's taps. */
.sb-chord.tappable::after{content:'';position:absolute;left:-.3em;right:-.1em;top:-.5em;bottom:-.9em;}
.sb-chord.tappable:hover{text-decoration:underline;}
.sb-chord.tappable:active{color:#fff;}
.sb-notes-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;}
.sb-note-chip{display:flex;flex-direction:column;align-items:center;gap:1px;border:1.5px solid #2a2a40;background:#0a0a10;border-radius:10px;padding:8px 12px;min-width:52px;}
.sb-note-chip b{font-family:'Oswald',sans-serif;font-size:20px;color:var(--gold,#f0c040);font-weight:700;letter-spacing:1px;}
.sb-note-chip span{font-size:11px;color:#8888aa;}
.sb-note-chip.root{border-color:var(--gold,#f0c040);background:rgba(240,192,64,.08);}
.sb-note-chip.bass{border-color:#81c784;}
.sb-note-chip.bass b{color:#81c784;}
.sb-sheet-note{font-size:13px;color:#aaa;line-height:1.45;margin-top:10px;}
.sb-cc-hint{font-size:12px;color:#8888aa;margin:0 0 4px;}
.sb-modal{position:fixed;inset:0;background:rgba(0,0,0,.82);display:flex;align-items:flex-end;justify-content:center;z-index:500;}
.sb-sheet{background:#0e0e16;border:1.5px solid #2a2a40;border-radius:16px 16px 0 0;width:100%;max-width:560px;max-height:86vh;overflow-y:auto;padding:16px 16px 26px;}
@media (min-width:600px){.sb-modal{align-items:center;}.sb-sheet{border-radius:16px;}}
.sb-sheet-top{display:flex;align-items:baseline;gap:10px;margin-bottom:4px;}
.sb-sheet-name{font-family:'Oswald',sans-serif;font-size:24px;font-weight:700;color:var(--gold,#f0c040);letter-spacing:1px;}
.sb-sheet-sub{font-size:13px;color:#8888aa;}
.sb-sheet-close{margin-left:auto;background:none;border:1px solid #2a2a40;color:#bbb;border-radius:9px;padding:5px 11px;font-size:14px;cursor:pointer;}
.sb-cc-card{border:1px solid #2a2a40;border-radius:12px;padding:10px 10px 6px;margin-top:12px;background:#0a0a10;}
.sb-cc-card-top{display:flex;justify-content:space-between;gap:8px;font-size:12px;color:#8888aa;margin-bottom:6px;}
.sb-cc-notes{font-family:'Oswald',sans-serif;font-size:14px;color:#e8e8f0;letter-spacing:1px;}
.sb-cc-no{background:rgba(239,83,80,.1);border:1.5px solid #7a2c2a;border-radius:12px;padding:14px;margin-top:12px;}
.sb-cc-no-head{font-family:'Oswald',sans-serif;font-size:19px;color:#ff8a80;letter-spacing:1px;margin-bottom:5px;}
.sb-cc-no-body{font-size:14px;color:#e8c4c2;line-height:1.45;}
.sb-cc-warn{font-size:12px;color:#e0b050;background:rgba(240,192,64,.08);border:1px solid rgba(240,192,64,.3);border-radius:9px;padding:7px 9px;margin-top:10px;line-height:1.4;}
/* set navigation — one gesture to the next song, on stage, mid-song */
/* Nothing here scrolls, so the browser has no pan of its own to protect and
   every gesture is ours to read. */
.sb-swipe{touch-action:none;}
.sb-pos{display:inline-block;font-family:'Oswald',sans-serif;font-size:12px;letter-spacing:1px;color:#8888aa;border:1px solid #2a2a40;border-radius:8px;padding:1px 7px;margin-right:8px;vertical-align:middle;}
.sb-page{display:inline-block;font-family:'Oswald',sans-serif;font-size:12px;letter-spacing:1px;color:var(--gold,#f0c040);border:1px solid #5a4410;background:rgba(240,192,64,.08);border-radius:8px;padding:1px 7px;margin-left:8px;vertical-align:middle;}
.sb-headline{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;}
.sb-nav{flex:0 0 auto;display:flex;gap:8px;align-items:stretch;margin:3px 0 0;}
.sb-nav button{flex:1;min-height:44px;border:1.5px solid #2a2a40;background:#0e0e16;color:var(--gold,#f0c040);border-radius:12px;font-family:'Oswald',sans-serif;font-size:15px;letter-spacing:1px;text-transform:uppercase;cursor:pointer;padding:5px 12px;display:flex;flex-direction:column;justify-content:center;gap:1px;}
.sb-nav button:disabled{opacity:.3;color:#8888aa;cursor:default;}
.sb-nav-next{align-items:flex-end;text-align:right;}
.sb-nav-prev{align-items:flex-start;text-align:left;}
.sb-nav-song{font-family:'Source Sans 3',sans-serif;font-size:12px;letter-spacing:0;text-transform:none;color:#8888aa;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
/* No per-breakpoint chart type any more: the auto-fit is the responsive rule. */
@media (max-width:480px){.sb-title{font-size:19px;}}
`;

const fmtTime = (iso) => { try { const d = new Date(iso); return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };
const weekdayLabel = (iso) => { try { return new Date(iso + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); } catch (e) { return iso; } };

// Split a line into chord/text segments using the chord positions.
const segmentsOf = (line) => {
  const chords = (line.chords || []).slice().sort((a, b) => a.pos - b.pos);
  const text = line.text || "";
  const segs = [];
  if (!chords.length) return [{ chord: null, text }];
  if (chords[0].pos > 0) segs.push({ chord: null, text: text.slice(0, chords[0].pos) });
  chords.forEach((c, i) => {
    const end = i + 1 < chords.length ? chords[i + 1].pos : text.length;
    segs.push({ chord: c.chord, text: text.slice(c.pos, Math.max(c.pos, end)) });
  });
  return segs;
};

// ============================================================
// FIT TO SCREEN
// The third-party app this replaces puts the whole song on one screen and
// Nicole never scrolls. Everything below exists to reproduce that: measure
// the rendered chart against the box it has to live in, and shrink the type
// until it fits. Only when the minimum readable size still overflows do we
// break the song into pages — at section boundaries, never mid-verse.
// ============================================================
const FIT_MIN = 8;    // px — below this it stops being readable on stage
const FIT_MAX = 28;   // px — above this the type just looks broken
const FIT_EPS = 0.25; // px — stop the binary search once this close

// Binary-search the largest font size at which `el` fits inside the box.
// With columns the element is pinned to the box height and the content flows
// sideways, so "does it fit" becomes "did it stay inside the last column".
const fitFontSize = (el, availH, availW, cols) => {
  el.style.setProperty("--sbcols", cols);
  el.style.height = cols > 1 ? availH + "px" : "";
  const fits = (px) => {
    el.style.setProperty("--sbfs", px + "px");
    // Reading a layout property forces the reflow we are about to measure.
    return el.scrollHeight <= (cols > 1 ? el.clientHeight : availH) + 0.5 && el.scrollWidth <= availW + 1;
  };
  if (fits(FIT_MAX)) return { size: FIT_MAX, overflow: false };
  if (!fits(FIT_MIN)) return { size: FIT_MIN, overflow: true };
  let lo = FIT_MIN, hi = FIT_MAX;
  while (hi - lo > FIT_EPS) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid; else hi = mid;
  }
  el.style.setProperty("--sbfs", lo + "px");
  return { size: lo, overflow: false };
};

// How many columns the box can carry. A column narrower than this is not a
// chord chart any more, it is a word list with the chords wrapped off their
// syllables, so the count is capped by width, not by ambition.
const MIN_COL_W = 260;
const maxColsFor = (availW) => Math.max(1, Math.min(3, Math.floor(availW / MIN_COL_W)));

// Try every column count and keep whichever gives the largest readable type.
// One column always wins on a phone; two or three win on a laptop or a
// landscape iPad, where a single column wastes most of the screen.
//
// When NOTHING fits — the song is too long for this box even at the minimum
// size — the widest layout wins instead, because that is the one the caller
// is about to paginate against. Leaving a losing single column applied here
// is what makes a paginated song render clipped: the page budget assumes the
// columns that the element was never actually given.
const bestFit = (el, availH, availW) => {
  const maxCols = maxColsFor(availW);
  let best = null;
  for (let c = 1; c <= maxCols; c++) {
    const r = fitFontSize(el, availH, availW, c);
    if (!best || (!r.overflow && (best.overflow || r.size > best.size + 0.5))) best = { ...r, cols: c };
    if (best && !best.overflow && best.size >= FIT_MAX) break;
  }
  const cols = best.overflow ? maxCols : best.cols;
  // Re-apply the winner: the loop left the element on the last count tried.
  return { ...fitFontSize(el, availH, availW, cols), cols };
};

// Split the block list into the fewest pages that each fit, balanced so the
// last page is not a lonely orphan. Blocks are atomic: a verse or a chorus is
// never cut in half, which is the whole point — a break inside a chorus is
// worse than no break at all.
const paginateBlocks = (host, ids, availH, cols) => {
  // Measure at the minimum size in ONE column: a block's own height does not
  // depend on how many columns it will later be laid into, and the page
  // budget is the column height multiplied by the column count.
  host.style.setProperty("--sbcols", 1);
  host.style.height = "";
  host.style.setProperty("--sbfs", FIT_MIN + "px");
  const els = ids.map((id) => host.querySelector('[data-block="' + id + '"]'));
  if (els.some((el) => !el)) return [ids];
  const heights = els.map((el) => {
    const st = window.getComputedStyle(el);
    return el.offsetHeight + parseFloat(st.marginTop || 0) + parseFloat(st.marginBottom || 0);
  });

  // Greedily pack into `budget` px per page; returns null if any single
  // block is taller than the budget, which no split can fix.
  const pack = (budget) => {
    const pages = [];
    let cur = [], h = 0;
    for (let i = 0; i < ids.length; i++) {
      if (heights[i] > budget && !cur.length) { pages.push([ids[i]]); continue; }
      if (cur.length && h + heights[i] > budget) { pages.push(cur); cur = []; h = 0; }
      cur.push(ids[i]); h += heights[i];
    }
    if (cur.length) pages.push(cur);
    return pages;
  };

  // Columns never pack perfectly — a block that will not fit in the space left
  // at the foot of a column gets pushed whole to the next one — so the usable
  // budget is a little under the raw column area. Aiming slightly low here is
  // what stops a page being declared to fit and then rendering clipped.
  const budget = availH * cols * (cols > 1 ? 0.88 : 1);
  const minPages = pack(budget).length;
  if (minPages <= 1) return [ids];
  // Spread the song evenly over that page count instead of cramming the early
  // pages full and leaving the last one nearly empty — every page then has
  // room to scale its type up, which is the reason to paginate at all.
  const total = heights.reduce((a, b) => a + b, 0);
  for (let slack = 1.0; slack <= 1.5; slack += 0.05) {
    const even = pack((total / minPages) * slack);
    if (even.length === minPages) return even;
  }
  return pack(budget);
};

// ============================================================
// CHART VIEW
// ============================================================
function ChartView({ entry, chartId, fromSet, setNav, onNavigate, serviceTypeId, onBack, onSwitchChart, prefs, setPrefs, onKeepAlive, isTeacher, instrument }) {
  const chart = library.charts[chartId];
  const detected = chart.key;
  const [keyOverride, setKeyOverride] = useState(() => lsGet("songbook_key_" + chartId, null));
  const [noticeDismissed, setNoticeDismissed] = useState(() => lsGet("songbook_notice_" + chartId, false));
  const [customOrder, setCustomOrder] = useState(() => lsGet("songbook_order_" + chartId, null));
  const [editing, setEditing] = useState(false);
  const [pickKey, setPickKey] = useState(false);
  // { capo, cut } — a full capo and a cut capo are independent and combine.
  // The cut capo is Nicole's own tool: teacher only, never offered to students.
  const [capo, setCapoState] = useState(() => normalizeCapoSetting(lsGet("songbook_capo_" + chartId, null)));
  const [tapped, setTapped] = useState(null); // chord token whose popup is open
  const dragRef = useRef(null);

  useEffect(() => { setKeyOverride(lsGet("songbook_key_" + chartId, null)); setNoticeDismissed(lsGet("songbook_notice_" + chartId, false)); setCustomOrder(lsGet("songbook_order_" + chartId, null)); setCapoState(normalizeCapoSetting(lsGet("songbook_capo_" + chartId, null))); setEditing(false); setPickKey(false); setTapped(null); }, [chartId]);
  // Keep the app's inactivity timer from blanking a chart that is open on stage.
  useEffect(() => { if (!onKeepAlive) return; const t = setInterval(onKeepAlive, 60 * 1000); return () => clearInterval(t); }, [onKeepAlive]);

  const key = useMemo(() => (keyOverride && parseKeyName(keyOverride)) || (detected ? { tonic: detected.tonic, tonicPc: detected.tonicPc, mode: detected.mode } : null), [keyOverride, detected]);
  const charts = entry.charts.map((id) => library.charts[id]);
  const langs = [...new Set(charts.map((c) => c.lang))];
  const sameLang = charts.filter((c) => c.lang === chart.lang);

  const blockOrder = useMemo(() => {
    const ids = chart.blocks.map((b) => b.id);
    if (!customOrder) return ids;
    const valid = customOrder.filter((id) => ids.includes(id));
    ids.forEach((id) => { if (!valid.includes(id)) valid.push(id); });
    return valid;
  }, [chart, customOrder]);
  const saveOrder = (ids) => { setCustomOrder(ids); lsSet("songbook_order_" + chartId, ids); };
  const move = (from, to) => { if (to < 0 || to >= blockOrder.length) return; const ids = blockOrder.slice(); const [x] = ids.splice(from, 1); ids.splice(to, 0, x); saveOrder(ids); };

  const roadmap = chart.roadmap || chart.order.map((o) => ({ block: o.block, label: o.label, times: o.times }));
  const abbr = useMemo(() => abbreviationsFor(chart.blocks.map((b) => b.name)), [chart]);
  const useFull = prefs.roadmapFull || chart.abbrevCollision;
  const labelOf = (b) => b.name;

  const setCapo = (next) => { const v = normalizeCapoSetting(next); setCapoState(v); lsSet("songbook_capo_" + chartId, v); if (!v.cut) setTapped(null); };
  // A stale saved cut setting can never leak into a student's view.
  const cutOn = isTeacher && capo.cut;
  const cutFret = cutFretOf(capo);

  // Header. The full capo shows its fingering key, because that transposition
  // is real. The cut capo never does: it raises only three strings, so no
  // single key describes it — it shows its derived fret instead.
  const keyHeader = () => {
    if (!key) return "Key: ?";
    const base = "Key: " + keyName(key);
    if (!isTeacher) return capoLabel(key);
    const full = capo.capo > 0 ? "Capo " + capo.capo + " (" + transposedKeyName(key, -capo.capo) + ")" : null;
    const cut = capo.cut ? "cut capo (fret " + cutFret + ")" : null;
    if (full && cut) return base + " - " + full + " + " + cut;
    if (full) return base + " - " + full;
    if (cut) return base + " - Cut capo (fret " + cutFret + ")";
    return base;
  };

  const showNotice = detected && detected.minorSurface && !noticeDismissed && !keyOverride;
  // Nashville numbers are independent of the capo: a 1 is a 1 in every mode.
  const chordText = (tok) => {
    if (!key) return tok;
    const n = toNashville(tok, key);
    return fromSet ? n : (<>{n} <small>({tok})</small></>);
  };

  // Pointer-drag reorder (works with touch); arrows are the fallback.
  const onPointerDown = (idx) => (e) => { dragRef.current = { idx, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); };
  const onPointerMove = (e) => {
    const d = dragRef.current; if (!d) return;
    const els = Array.from(document.querySelectorAll(".sb-block[data-idx]"));
    const overIdx = els.findIndex((el) => { const r = el.getBoundingClientRect(); return e.clientY >= r.top && e.clientY <= r.bottom; });
    if (overIdx >= 0 && overIdx !== d.idx) { move(d.idx, overIdx); d.idx = overIdx; }
  };
  const onPointerUp = () => { dragRef.current = null; };

  // ----------------------------------------------------------
  // SET NAVIGATION — on stage, both hands on the guitar. One
  // gesture to the next song; buttons and arrow keys as backup.
  // Only inside a set: from search there is no next song.
  // ----------------------------------------------------------
  const nav = fromSet && setNav && setNav.list.length > 1 ? setNav : null;
  const navIdx = nav ? nav.index : -1;
  const prevSong = nav && navIdx > 0 ? nav.list[navIdx - 1] : null;
  const nextSong = nav && navIdx >= 0 && navIdx < nav.list.length - 1 ? nav.list[navIdx + 1] : null;

  // No wrap: at the ends these are simply no-ops, never a jump to the
  // other end of the set, which is disorienting mid-service.
  const go = useCallback((dir) => {
    if (!nav || editing) return;
    const target = dir > 0 ? nav.list[navIdx + 1] : nav.list[navIdx - 1];
    if (!target) return;
    setTapped(null);
    setPickKey(false);
    // Instant, like turning a page: chart data is already local, and the
    // per-chart capo / key / block order are keyed by chartId, so they come
    // back with the song rather than being reset by the move.
    onNavigate(target);
  }, [nav, navIdx, editing, onNavigate]);

  // ----------------------------------------------------------
  // FIT / PAGES — measure after every render that can change the
  // content height, then scale the type until the song fits its box.
  // Every block stays in the DOM at all times; the ones that belong to
  // another page are hidden by the measurer. That is what lets the fit
  // re-test the WHOLE song on every resize and collapse back to one
  // page as soon as it can, which is always the better answer.
  // ----------------------------------------------------------
  const bodyRef = useRef(null);
  const fitRef = useRef(null);
  const [pages, setPages] = useState(null);   // null = the song is on one page
  const [page, setPage] = useState(0);

  const pageCount = pages ? pages.length : 1;
  const curPage = Math.min(page, pageCount - 1);
  // The measurer reads these through refs. They must NOT be effect deps: the
  // measurer is what writes them, and a write that re-triggers the measurer
  // is an infinite layout loop, not a re-fit.
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const pageRef = useRef(curPage);
  pageRef.current = curPage;

  // Vertical paging never wraps and never leaves the song, the same way
  // horizontal never wraps out of the set.
  const turnPage = useCallback((dir) => {
    if (editing) return;
    setPage((p) => Math.max(0, Math.min(pageCount - 1, p + dir)));
  }, [editing, pageCount]);

  // A new song always starts whole, on its first page. This runs in the
  // layout phase, before the measurer below, so the measurer never sees the
  // previous song's page split — two effects disagreeing about `pages` is
  // how this loops forever.
  const lastChart = useRef(chartId);
  if (lastChart.current !== chartId) {
    lastChart.current = chartId;
    if (pages) setPages(null);
    if (page !== 0) setPage(0);
  }

  // useLayoutEffect, not useEffect: the fit must be decided before the frame
  // is painted, or the chart flashes at the wrong size on every song change.
  // For the same reason nothing here waits on requestAnimationFrame — a
  // backgrounded tab never fires one, and the chart would stay unfitted.
  useLayoutEffect(() => {
    const host = fitRef.current, box = bodyRef.current;
    if (!host || !box) return;
    let timer = 0, dead = false;
    // The measurer writes styles inside the box it is observing, so the
    // ResizeObserver hears its own echo. Remember the box we last fitted for
    // and ignore any callback that is not actually a new size — otherwise
    // every fit schedules another fit and the tab spins forever.
    let lastH = -1, lastW = -1;

    const blockEls = () => Array.from(host.querySelectorAll("[data-block]"));
    const showAll = () => blockEls().forEach((el) => { el.style.display = ""; });
    const showOnly = (ids) => blockEls().forEach((el) => {
      el.style.display = ids.includes(Number(el.dataset.block)) ? "" : "none";
    });

    // `passes` bounds the settle loop below. Two passes is always enough in
    // practice; the cap only exists so a pathological layout cannot spin.
    const measure = (force, passes) => {
      if (dead) return;
      const availH = box.clientHeight, availW = box.clientWidth;
      if (availH <= 0 || availW <= 0) return;
      if (!force && availH === lastH && availW === lastW) return;
      lastH = availH; lastW = availW;
      // Always ask the whole song first. If it fits, there are no pages.
      const had = pagesRef.current;
      showAll();
      const whole = bestFit(host, availH, availW);
      if (!whole.overflow) {
        if (had) setPages(null);
        settle(availH, availW, passes);
        return;
      }

      // It does not fit even at the minimum readable size, so it needs pages.
      const split = paginateBlocks(host, blockOrder, availH, maxColsFor(availW));

      let use = split;
      let shown = use[Math.min(pageRef.current, use.length - 1)] || blockOrder;
      showOnly(shown);
      // Last line of defence: if the page we picked still overflows, split
      // harder rather than render a clipped chart. Clipped lyrics on stage are
      // the one outcome this whole feature exists to prevent.
      for (let tighten = 0; tighten < 3 && bestFit(host, availH, availW).overflow; tighten++) {
        const tighter = paginateBlocks(host, blockOrder, availH * (0.8 - tighten * 0.15), maxColsFor(availW));
        if (tighter.length <= use.length) break;
        use = tighter;
        shown = use[Math.min(pageRef.current, use.length - 1)] || blockOrder;
        showOnly(shown);
      }
      const settled = use === split ? split : use;
      const sameFinal = had && had.length === settled.length &&
        had.every((pg, i) => pg.length === settled[i].length && pg.every((id, j) => id === settled[i][j]));
      if (!sameFinal) setPages(settled);
      settle(availH, availW, passes);
    };

    // Hiding blocks and pinning the column height both change layout, so the
    // box can be a different size by the time the fit finishes than it was
    // when the fit started. When that happens, fit again against the size it
    // actually ended up at — otherwise the chart keeps the previous screen's
    // type size after a resize or an orientation change.
    const settle = (usedH, usedW, passes) => {
      if (dead || (passes || 0) >= 2) return;
      const h = box.clientHeight, w = box.clientWidth;
      if (h === usedH && w === usedW) return;
      lastH = -1; lastW = -1;
      measure(true, (passes || 0) + 1);
    };

    // Debounced so a resize drag or an observer storm does not thrash layout.
    const schedule = () => { clearTimeout(timer); timer = setTimeout(() => measure(false, 0), 60); };

    // The first pass is forced: the deps changed, so the content changed even
    // when the box did not.
    measure(true, 0);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    if (ro) ro.observe(box);
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    return () => {
      dead = true;
      clearTimeout(timer);
      if (ro) ro.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
    };
    // Everything the fitted height depends on: song, page, order, and every
    // toggle that adds or removes a line.
    // `pages` is a dep so the page indicator and the block visibility settle
    // in the same render the split changes in. Both writes are idempotent —
    // setPages to an equal value is skipped above, and React drops a set to
    // the identical null — so this converges instead of spinning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartId, page, pages, blockOrder, prefs.gloss, prefs.legend, prefs.roadmapFull, editing, capo.capo, capo.cut, keyOverride, showNotice, cutOn]);

  // Pointer events, not touch events: the same code path serves the
  // iPad on stage and a mouse on the laptop while testing.
  const swipeRef = useRef(null);
  const SWIPE_MIN = 60;      // px of horizontal travel before it counts
  const SWIPE_RATIO = 1.5;   // must be this much more horizontal than vertical

  // A gesture that starts in one of these is that control's own gesture.
  const inExempt = (el) => !!(el && el.closest && el.closest(".sb-modal, .sb-handle, input, textarea, select, button, [role=button]"));

  const onSwipeDown = (e) => {
    if (editing || inExempt(e.target)) { swipeRef.current = null; return; }
    swipeRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  // Nothing scrolls here, so there is no native pan to preserve and no
  // preventDefault to fight with; touch-action:none already gave us the axis.
  const onSwipeMove = () => {};
  const onSwipeEnd = (e) => {
    const s = swipeRef.current;
    swipeRef.current = null;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    // The two axes stay strictly separate: horizontal changes song,
    // vertical turns the page of the song you are already on.
    if (Math.abs(dx) >= SWIPE_MIN && Math.abs(dx) >= SWIPE_RATIO * Math.abs(dy)) {
      go(dx < 0 ? 1 : -1);                                    // drag left = forward
      return;
    }
    if (pageCount > 1 && Math.abs(dy) >= SWIPE_MIN && Math.abs(dy) >= SWIPE_RATIO * Math.abs(dx)) {
      turnPage(dy < 0 ? 1 : -1);                              // drag up = next page
    }
  };
  const onSwipeCancel = () => { swipeRef.current = null; };

  // CHORD TAP. Pointer events, so one path serves an iPad fingertip and a
  // laptop mouse — iOS Safari only synthesises `click` on some elements, and a
  // plain <span> is not reliably one of them.
  //
  // A tap is a pointerup that did not travel: the chart is also a swipe
  // surface, so a drag that happens to END on a chord must stay a swipe and
  // change the song rather than opening a popup. Only a still finger counts,
  // and only then is the event kept from the swipe handler underneath.
  const tapRef = useRef(null);
  const TAP_SLOP = 10; // px of travel still counted as a tap, not a drag
  const onChordDown = (e) => { tapRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId }; };
  const onChordUp = (chord) => (e) => {
    const t = tapRef.current;
    tapRef.current = null;
    if (!t || t.id !== e.pointerId) return;
    if (Math.abs(e.clientX - t.x) > TAP_SLOP || Math.abs(e.clientY - t.y) > TAP_SLOP) return; // a drag: let the swipe have it
    e.stopPropagation();
    setTapped(chord);
  };

  useEffect(() => {
    const onKey = (e) => {
      const horizontal = e.key === "ArrowLeft" || e.key === "ArrowRight";
      const vertical = e.key === "ArrowUp" || e.key === "ArrowDown";
      if (!horizontal && !vertical) return;
      const t = e.target;
      const tag = t && t.tagName ? t.tagName.toLowerCase() : "";
      if (tag === "input" || tag === "textarea" || tag === "select" || (t && t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (horizontal) {
        if (!nav) return;
        e.preventDefault();
        go(e.key === "ArrowRight" ? 1 : -1);
      } else {
        if (pageCount <= 1) return;
        e.preventDefault();
        turnPage(e.key === "ArrowDown" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nav, go, pageCount, turnPage]);

  const navButtons = nav ? (
    <div className="sb-nav">
      <button className="sb-nav-prev" disabled={!prevSong} onClick={() => go(-1)} aria-label="Previous song in the set">
        <span>← Prev</span>
        <span className="sb-nav-song">{prevSong ? prevSong.title : "First song"}</span>
      </button>
      <button className="sb-nav-next" disabled={!nextSong} onClick={() => go(1)} aria-label="Next song in the set">
        <span>Next →</span>
        <span className="sb-nav-song">{nextSong ? nextSong.title : "Last song"}</span>
      </button>
    </div>
  ) : null;

  const displayTitle = chart.lang === "pt" ? (chart.ptName || chart.names.primary) : (chart.enName || chart.names.primary);
  const altTitle = chart.lang === "pt" ? chart.enName : chart.ptName;

  return (
    <div className="sb-pane sb-swipe"
      onPointerDown={onSwipeDown} onPointerMove={onSwipeMove}
      onPointerUp={onSwipeEnd} onPointerCancel={onSwipeCancel}>

      <div className="sb-pane-head">
        <div className="sb-headline">
          <button className="sb-back" onClick={onBack}>←</button>
          {nav && <span className="sb-pos">{navIdx + 1} / {nav.list.length}</span>}
          <span className="sb-title">{displayTitle}</span>
          {altTitle && <span className="sb-alt">{altTitle}</span>}
          <span className="sb-meta">{chart.artist}{chart.tempo ? " · " + chart.tempo + " bpm" : ""}</span>
          {pageCount > 1 && <span className="sb-page">{curPage + 1} / {pageCount}</span>}
        </div>

        {/* One tight row. Everything these controls take, the lyrics lose. */}
        <div className="sb-bar">
          <button className="sb-key-main" onClick={() => setPickKey((v) => !v)} title="Tap to change key">{keyHeader()}</button>
          {pickKey && (
            <>
              <select value={key ? keyName(key) : ""} onChange={(e) => { const v = e.target.value; setKeyOverride(v); lsSet("songbook_key_" + chartId, v); setPickKey(false); }}>
                {KEY_LIST.flatMap((k) => [k, k + "m"]).map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              {keyOverride && <button className="sb-tool" onClick={() => { setKeyOverride(null); lsSet("songbook_key_" + chartId, null); setPickKey(false); }}>Reset to {detected ? detected.tonic : "?"}</button>}
            </>
          )}
          {isTeacher && (
            <>
              <label className="sb-capo-lbl">Capo
                <select value={capo.capo} onChange={(e) => setCapo({ ...capo, capo: Number(e.target.value) })} title="Full capo fret">
                  {Array.from({ length: MAX_FULL_CAPO + 1 }, (_, f) => f).map((f) => (
                    <option key={f} value={f}>{f === 0 ? "none" : "fret " + f}</option>
                  ))}
                </select>
              </label>
              <button className={"sb-tool" + (capo.cut ? " on" : "")} onClick={() => setCapo({ ...capo, cut: !capo.cut })}
                title="Partial capo on the A, D and G strings, always two frets above the full capo">
                Cut{capo.cut ? " · " + cutFret : ""}
              </button>
            </>
          )}
          {langs.length > 1 && langs.map((l) => (
            <button key={l} className={"sb-tool" + (chart.lang === l ? " on" : "")} onClick={() => { const c = charts.find((x) => x.lang === l); if (c) onSwitchChart(c.id); }}>{l.toUpperCase()}</button>
          ))}
          {sameLang.length > 1 && sameLang.map((c, i) => (
            <button key={c.id} className={"sb-tool" + (c.id === chartId ? " on" : "")} onClick={() => onSwitchChart(c.id)}>V{i + 1}</button>
          ))}
          <button className={"sb-tool" + (prefs.legend ? " on" : "")} onClick={() => setPrefs({ ...prefs, legend: !prefs.legend })}>Legend</button>
          {chart.glossCount > 0 && <button className={"sb-tool" + (prefs.gloss !== false ? " on" : "")} onClick={() => setPrefs({ ...prefs, gloss: prefs.gloss === false })}>Gloss</button>}
          {!chart.abbrevCollision && <button className={"sb-tool" + (prefs.roadmapFull ? " on" : "")} onClick={() => setPrefs({ ...prefs, roadmapFull: !prefs.roadmapFull })}>{prefs.roadmapFull ? "Full" : "Letters"}</button>}
          <button className={"sb-tool" + (editing ? " on" : "")} onClick={() => setEditing((v) => !v)}>{editing ? "Done" : "Reorder"}</button>
          {customOrder && <button className="sb-tool" onClick={() => { saveOrder(null); setCustomOrder(null); try { localStorage.removeItem("songbook_order_" + chartId); } catch (e) { /* ignore */ } }}>Reset order</button>}
          {prefs.legend && key && keyLegend(key).map((l) => <span key={l.degree} className="sb-legend-i"><b>{l.degree}</b>={l.name}</span>)}
          <span className="sb-bar-sp" />
        </div>

        {showNotice && (
          <div className="sb-notice">
            <span>Auto-corrected from <b>{detected.relativeMinor}</b> to <b>{detected.tonic} major</b>. This chart leans on the 6- chord (the pattern Planning Center labels as minor) but its cadences land on {detected.tonic}.</span>
            <button className="sb-tool" onClick={() => { setKeyOverride(detected.relativeMinor); lsSet("songbook_key_" + chartId, detected.relativeMinor); }}>Use {detected.relativeMinor}</button>
            <button className="sb-tool" onClick={() => { setNoticeDismissed(true); lsSet("songbook_notice_" + chartId, true); }}>OK</button>
          </div>
        )}
        {cutOn && <div className="sb-cc-hint">Cut capo at fret {cutFret} (A, D and G strings{capo.capo > 0 ? ", two frets above the capo at " + capo.capo : ""}). Tap any chord to see whether it survives the capo.</div>}
        {!cutOn && <div className="sb-cc-hint">Tap any chord to see how to play it{capo.capo > 0 ? " with the capo at " + capo.capo : ""}.</div>}
      </div>

      {/* The box the fit measures against: whatever the header left over. */}
      <div className="sb-body" ref={bodyRef}>
        <div className="sb-fit" ref={fitRef}>
          <div className="sb-map">
            {roadmap.map((r, i) => {
              const b = r.block != null ? chart.blocks.find((x) => x.id === r.block) : null;
              const label = b ? (useFull ? labelOf(b) : abbr.map[b.name]) : r.label;
              return <span key={i} className={"sb-map-item" + (b ? "" : " x")}>{label}{r.times > 1 ? " ×" + r.times : ""}</span>;
            })}
          </div>

          {blockOrder.map((bid, idx) => {
            const b = chart.blocks.find((x) => x.id === bid);
            return (
              <div className="sb-block" key={bid} data-idx={idx} data-block={bid}>
                <div className="sb-block-label">
                  {labelOf(b)}
                  {editing && (
                    <span className="sb-handle">
                      <button onClick={() => move(idx, idx - 1)}>↑</button>
                      <button onClick={() => move(idx, idx + 1)}>↓</button>
                      <button onPointerDown={onPointerDown(idx)} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>☰</button>
                    </span>
                  )}
                </div>
                {b.lines.map((ln, li) => (
                  <div key={li}>
                    <div className="sb-line">
                      {segmentsOf(ln).map((sg, si) => (
                        <span className="sb-seg" key={si}>
                          {sg.chord
                            ? <span className="sb-chord tappable" role="button" tabIndex={0}
                                onPointerDown={onChordDown} onPointerUp={onChordUp(sg.chord)}
                                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setTapped(sg.chord); } }}
                                title={cutOn ? "Can " + sg.chord + " be played with the cut capo?" : "How do I play " + sg.chord + "?"}>{chordText(sg.chord)}</span>
                            : <span className="sb-chord" />}
                          <span className="sb-txt">{sg.text}</span>
                        </span>
                      ))}
                    </div>
                    {ln.gloss && prefs.gloss !== false && <div className="sb-gloss">{ln.gloss}</div>}
                  </div>
                ))}
              </div>
            );
          })}
          {chart.notes.length > 0 && <div className="sb-muted">{chart.notes.join(" ")}</div>}
        </div>
      </div>

      {navButtons}

      {tapped && (cutOn
        ? <CutCapoPopup token={tapped} capoSetting={capo} onClose={() => setTapped(null)} />
        : <ChordPopup token={tapped} capoFret={capo.capo} instrument={instrument} onClose={() => setTapped(null)} />)}
    </div>
  );
}

// ============================================================
// CHORD POPUP — "how do I play this?", for every capo state that is not the
// cut capo. The cut capo keeps its own popup below, because its question is a
// different one (does this chord survive the capo at all?).
//
// Instrument decides the ANSWER SHAPE, not just the styling:
//   guitar / teacher : a fretboard diagram — there is one shape the hands want
//   keys             : the notes; keyboard voicing is two-handed and variable,
//                      so there is no single correct fingering to draw
//   bass             : the root and the available notes, for the same reason —
//                      a bass line is built, not gripped
// ============================================================
function ChordPopup({ token, capoFret = 0, instrument, onClose }) {
  const fretted = instrument !== "keys" && instrument !== "bass";
  const guitar = useMemo(() => (fretted ? guitarAnswerFor(token, capoFret) : null), [fretted, token, capoFret]);
  const notes = useMemo(() => (fretted ? null : chordNotesFor(token)), [fretted, token]);
  const res = fretted ? guitar : notes;
  const capo = fretted ? guitar.capo : 0;

  // With a capo the chord under the fingers is not the chord on the page, and
  // both matter: she reads the sounding name off the chart and plays the shape.
  const sub = !fretted
    ? (instrument === "bass" ? "chord tones" : "notes in the chord")
    : guitar.status === "not-a-chord"
      ? ""
      : capo > 0
        ? "sounding · play " + guitar.shapeLabel + " shape · capo " + capo
        : "no capo";

  return (
    <div className="sb-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="sb-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sb-sheet-top">
          <span className="sb-sheet-name">{(res && (res.soundingLabel || res.label)) || token}</span>
          <span className="sb-sheet-sub">{sub}</span>
          <button className="sb-sheet-close" onClick={onClose}>Close</button>
        </div>

        {res.status === "not-a-chord" && (
          <div className="sb-cc-no">
            <div className="sb-cc-no-head">Not a chord</div>
            <div className="sb-cc-no-body">“{token}” is not a chord symbol.</div>
          </div>
        )}

        {res.status === "none" && (
          <div className="sb-cc-no">
            <div className="sb-cc-no-head">No shape for this chord</div>
            <div className="sb-cc-no-body">
              {guitar.shapeLabel} is not one the shape library covers. Play the notes that are in it, or simplify the chord.
            </div>
          </div>
        )}

        {res.status === "ok" && fretted && (
          <>
            {guitar.reduced && <div className="sb-cc-warn">Shown as the nearest chord this library models; added colour tones are not drawn.</div>}
            <div className="sb-cc-card">
              <div className="sb-cc-card-top">
                <span>{guitar.barre > 0 ? "Barre at fret " + (guitar.barre + capo) : "Open position"}</span>
                <span>{capo > 0 ? "fret numbers are absolute" : ""}</span>
              </div>
              <ChordDiagram shape={guitar.shape} capo={capo} barre={guitar.barre} />
              <div className="sb-cc-card-top" style={{ marginTop: 6 }}>
                <span>Notes low→high{capo > 0 ? " (sounding)" : ""}</span>
                <span className="sb-cc-notes">{guitar.notes.join(" · ")}</span>
              </div>
            </div>
            {capo > 0 && (
              <div className="sb-sheet-note">
                Capo at fret {capo}. The chart says <b>{guitar.soundingLabel}</b>; with the capo on you finger a
                {" "}<b>{guitar.shapeLabel}</b> shape and it sounds as {guitar.soundingLabel}.
              </div>
            )}
          </>
        )}

        {res.status === "ok" && !fretted && (
          <>
            {notes.reduced && <div className="sb-cc-warn">Shown as the nearest chord this library models; added colour tones are not listed.</div>}
            <div className="sb-cc-card">
              <div className="sb-cc-card-top">
                <span>{instrument === "bass" ? "Root and chord tones" : "Notes in the chord"}</span>
                <span>{notes.bass !== notes.root ? "over " + notes.bass : ""}</span>
              </div>
              <div className="sb-notes-row">
                {notes.bass !== notes.root && (
                  <span className="sb-note-chip bass"><b>{notes.bass}</b><span>bass</span></span>
                )}
                {notes.notes.map((n, i) => (
                  <span key={i} className={"sb-note-chip" + (i === 0 ? " root" : "")}>
                    <b>{n}</b><span>{notes.intervals[i]}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="sb-sheet-note">
              {instrument === "bass"
                ? <>Start from <b>{notes.bass}</b>. The other tones are what the line can pass through without fighting the chord.</>
                : <>Voice these with both hands as the arrangement needs — there is no one fingering for a keyboard chord.</>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// CUT CAPO POPUP — the question this feature exists to answer:
// does this chord survive the cut capo, yes or no?
// ============================================================
function CutCapoPopup({ token, capoSetting, onClose }) {
  const result = useMemo(() => cutCapoAnswerFor(token, capoSetting, 2), [token, capoSetting]);
  const capo = result.capo || 0;
  const setup = (capo > 0 ? "capo " + capo + " + " : "") + "cut capo at fret " + result.cutFret;
  return (
    <div className="sb-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="sb-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sb-sheet-top">
          <span className="sb-sheet-name">{result.soundingLabel || token}</span>
          <span className="sb-sheet-sub">
            {result.transposed
              ? "sounding · play " + result.shapeLabel + " shape · " + setup
              : setup}
          </span>
          <button className="sb-sheet-close" onClick={onClose}>Close</button>
        </div>

        {result.status === "not-a-chord" && (
          <div className="sb-cc-no">
            <div className="sb-cc-no-head">Not a chord</div>
            <div className="sb-cc-no-body">“{token}” is not something the cut capo can be checked against.</div>
          </div>
        )}

        {result.status === "unplayable" && (
          <div className="sb-cc-no">
            <div className="sb-cc-no-head">Not playable with the cut capo</div>
            <div className="sb-cc-no-body">
              Remove the capo for this song.
              {result.missing && result.missing.length > 0 && (
                <> The closest shape drops {result.missing.join(" and ")}, so it is not really {result.shapeLabel}.</>
              )}
            </div>
          </div>
        )}

        {result.status === "ok" && (
          <>
            {result.reduced && <div className="sb-cc-warn">Shown as the nearest chord the cut-capo engine models; added colour tones are not drawn.</div>}
            {result.voicings.map((v, i) => (
              <div className="sb-cc-card" key={i}>
                <div className="sb-cc-card-top">
                  <span>{i === 0 ? "Best shape" : "Alternative"}</span>
                  <span>{v.openCount} ringing · {v.frettedCount === 0 ? "no fingers" : v.frettedCount + " fingered"}{v.span > 0 ? " · " + (v.span + 1) + "-fret span" : ""}</span>
                </div>
                <CutCapoDiagram shape={v.shape} capo={capo} cut />
                <div className="sb-cc-card-top" style={{ marginTop: 6 }}>
                  <span>Notes low→high{capo > 0 ? " (sounding)" : ""}</span>
                  <span className="sb-cc-notes">{v.notes.join(" · ")}</span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// SONGBOOK — set list + search
// ============================================================
export default function Songbook({ isTeacher, onBack, onKeepAlive, instrument }) {
  const [serviceId, setServiceId] = useState(() => {
    const w = defaultDateFor("1707498"); // Saturday
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return new Date(w + "T12:00:00") >= today ? "1707498" : "1162648";
  });
  const [date, setDate] = useState(() => defaultDateFor("1707498"));
  const [setData, setSetData] = useState(null);
  const [offline, setOffline] = useState(typeof navigator !== "undefined" && navigator.onLine === false);
  const [syncError, setSyncError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(null); // { entry, chartId, fromSet }
  const [prefs, setPrefsState] = useState(() => lsGet(PREFS_KEY, { legend: false, gloss: true, roadmapFull: false }));
  const setPrefs = (p) => { setPrefsState(p); lsSet(PREFS_KEY, p); };
  const index = useMemo(() => buildSearchIndex(library), []);

  const pickService = useCallback((id) => { setServiceId(id); setDate(defaultDateFor(id)); }, []);

  // Cache first, then revalidate in the background. Never blocks reading.
  useEffect(() => {
    let cancelled = false;
    const cached = readCachedSet(serviceId, date);
    setSetData(cached);
    setSyncError(null);
    setLoading(!cached);
    fetchSet(serviceId, date).then((fresh) => {
      if (cancelled) return;
      setOffline(false);
      setLoading(false);
      setSetData((prev) => (prev && sameSongs(prev, fresh) ? { ...prev, syncedAt: fresh.syncedAt } : fresh));
    }).catch((e) => {
      if (cancelled) return;
      setLoading(false);
      setSyncError(e.message || "fetch failed");
      if (typeof navigator !== "undefined" && navigator.onLine === false) setOffline(true);
    });
    return () => { cancelled = true; };
  }, [serviceId, date]);

  useEffect(() => {
    const on = () => { setOffline(false); setDate((d) => d); pickService(serviceId); };
    const off = () => setOffline(true);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [serviceId, pickService]);

  const items = useMemo(() => (setData ? setData.songs.map((s) => ({ ...s, match: matchSetItem(s.title, library) })) : []), [setData]);
  const results = useMemo(() => search(index, query), [index, query]);
  const service = SERVICE_TYPES.find((s) => s.id === serviceId);

  // The songs of the set that actually have a chart, in the sequence order
  // the endpoint returned. This is what prev/next walks; songs with no chart
  // in the library are skipped, since there is nothing to open for them.
  const setSongs = useMemo(() => items
    .map((it) => { const e = it.match.entry; const c = e && pickChart(e, library, serviceId); return c ? { entry: e, chartId: c.id, title: it.match.title } : null; })
    .filter(Boolean),
    [items, serviceId]);

  if (open) {
    // Position is found by entry, so switching language/version inside a song
    // keeps the same slot in the set.
    const navIndex = open.fromSet ? setSongs.findIndex((s) => s.entry === open.entry) : -1;
    const setNav = navIndex >= 0 ? { list: setSongs, index: navIndex } : null;
    return (
      <><style>{S}</style><div className="sb sb-fixed">
        <ChartView entry={open.entry} chartId={open.chartId} fromSet={open.fromSet} setNav={setNav} serviceTypeId={serviceId} prefs={prefs} setPrefs={setPrefs} onKeepAlive={onKeepAlive} isTeacher={isTeacher} instrument={instrument}
          onNavigate={(t) => setOpen({ entry: t.entry, chartId: t.chartId, fromSet: true })}
          onBack={() => setOpen(null)} onSwitchChart={(id) => setOpen({ ...open, chartId: id })} />
      </div></>
    );
  }

  const disconnected = offline || !!syncError;
  return (
    <><style>{S}</style><div className="sb"><div className="sb-wrap">
      <div className="sb-top">
        <button className="sb-back" onClick={onBack}>← Back</button>
        <h1>Songbook</h1>
      </div>

      {isTeacher ? (
        <div className="sb-row">
          <select value={serviceId} onChange={(e) => pickService(e.target.value)}>
            {SERVICE_TYPES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </div>
      ) : (
        <div className="sb-chips">
          {STUDENT_SERVICE_IDS.map((id) => { const s = SERVICE_TYPES.find((x) => x.id === id); return (
            <button key={id} className={"sb-chip" + (serviceId === id ? " on" : "")} onClick={() => pickService(id)}>{weekdayLabel(defaultDateFor(id))} · {s.name}</button>
          ); })}
        </div>
      )}
      <div className="sb-muted">{service ? service.name : ""} · {weekdayLabel(date)}</div>

      {disconnected && (
        <div className="sb-banner">
          {offline ? "Offline" : "Could not reach Planning Center"}
          {setData && setData.syncedAt ? " · showing set last synced " + fmtTime(setData.syncedAt) : " · this set has not been loaded on this device yet"}
        </div>
      )}

      <div style={{ margin: "10px 0" }}>
        <input type="search" placeholder="Search title or lyrics (EN or PT)…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {query.trim().length >= 2 ? (
        <div className="sb-list">
          {results.length === 0 && <div className="sb-empty">No chart matches “{query}”.</div>}
          {results.map((r, i) => (
            <button className="sb-item" key={i} onClick={() => setOpen({ entry: r.entry, chartId: r.chart.id, fromSet: false })}>
              <div style={{ flex: 1 }}>
                <div className="sb-item-title">{r.chart.names.primary}</div>
                {r.chart.names.alts.length > 0 && <div className="sb-item-sub">{r.chart.names.alts.join(" / ")}</div>}
                {r.kind !== "title" && <div className="sb-hit"><b>{r.kind === "gloss" ? "gloss" : "lyric"}{r.block ? " · " + r.block : ""}:</b> {r.text}</div>}
              </div>
              <span className="sb-item-lang">{r.chart.lang.toUpperCase()}{r.chart.key ? " · " + r.chart.key.tonic : ""}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="sb-list">
          {loading && !setData && <div className="sb-empty">Loading this week's set…</div>}
          {!loading && setData && !setData.found && <div className="sb-empty">No plan in Planning Center for this service on {weekdayLabel(date)}.</div>}
          {!loading && !setData && disconnected && <div className="sb-empty">Nothing cached for this service yet. Search still works across the whole library.</div>}
          {items.map((it, i) => {
            const e = it.match.entry;
            const chart = e ? pickChart(e, library, serviceId) : null;
            return (
              <button className="sb-item" key={i} disabled={!e} onClick={() => e && setOpen({ entry: e, chartId: chart.id, fromSet: true })}>
                <span className="sb-num">{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div className="sb-item-title">{it.match.title}</div>
                  {e ? <div className="sb-item-sub">{[e.pt, e.en].filter((n) => n && n !== it.match.title).join(" · ")}{chart && chart.key ? " · " + chart.key.tonic : ""}</div>
                     : <div className="sb-item-sub" style={{ color: "#c9a24a" }}>chart not in library</div>}
                </div>
                {chart && <span className="sb-item-lang">{chart.lang.toUpperCase()}</span>}
              </button>
            );
          })}
        </div>
      )}
      <div className="sb-muted" style={{ marginTop: 16 }}>{library.songs.length} songs · {Object.keys(library.charts).length} charts on this device</div>
    </div></div></>
  );
}
