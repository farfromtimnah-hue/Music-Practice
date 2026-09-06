import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from "react";
import library from "./library.json";
import { buildSearchIndex, search } from "./search.js";
import { matchSetItem, pickChart } from "./match.js";
import { SERVICE_TYPES, STUDENT_SERVICE_IDS, defaultDateFor, readCachedSet, fetchSet, sameSongs } from "./setStore.js";
import { toNashville, keyLegend, capoLabel, keyName, parseKeyName, transposedKeyName, transposeChordToken, pcToName, KEY_LIST } from "./chords.js";
import { abbreviationsFor } from "./sections.js";
import { readOverride, writeOverride, clearOverride, readKeyOverride, writeKeyOverride, clearKeyOverrides, migrateRelativeMinorKey, readChartKeyOverride, basisOf, basisDiffers } from "./overrideStore.js";
import {
  cutCapoAnswerFor, normalizeCapoSetting, cutFretOf, MAX_FULL_CAPO,
  savedShapesFor, saveShapeFor, deleteSavedShape, analyseShape,
} from "./cutcapoAdapter.js";
import { readInserts, addInsert, removeInsert, clearInserts, resolveInsert, isInsertId } from "./insertStore.js";
import { readEndSong, writeEndSongLocal, fetchEndSong, setEndSong as setEndSongRemote, flushEndSongQueue } from "./endsongStore.js";
import BassLineView from "./BassLineView.jsx";
import { bassLinesFor } from "./basslines.js";
import Tuner from "../tuner/Tuner.jsx";
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
/* ---- set overrides: the room's version of the set ---- */
.sb-ov-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0 4px;}
.sb-ov-flag{display:inline-flex;align-items:center;gap:6px;background:rgba(240,192,64,.12);border:1.5px solid var(--gold,#f0c040);color:var(--gold,#f0c040);border-radius:999px;padding:6px 12px;font-size:13px;font-weight:600;}
.sb-ov-flag .dot{width:7px;height:7px;border-radius:50%;background:var(--gold,#f0c040);}
/* Every override control is a full-size touch target: these get used in a
   rush, standing up, holding an instrument. 44px is the floor. */
.sb-ov-btn{min-height:44px;background:#0e0e16;border:1.5px solid #2a2a40;color:#ccc;border-radius:12px;padding:10px 14px;font-size:14px;font-family:inherit;cursor:pointer;}
.sb-ov-btn.on{border-color:var(--gold,#f0c040);color:var(--gold,#f0c040);background:rgba(240,192,64,.08);}
.sb-ov-btn.danger{border-color:#7a2c2a;color:#ff8a80;}
/* PC-changed notice: non-blocking on purpose. It must never stand between her
   and the set during a service — it informs, it does not interrupt. */
.sb-pc-notice{display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:#12161f;border:1.5px solid #35507a;border-radius:12px;padding:10px 12px;margin:8px 0;font-size:13px;color:#cfe0ff;}
.sb-pc-notice b{color:#8fb8ff;}
.sb-row-edit{display:flex;gap:6px;align-items:center;margin-left:auto;}
/* Up/down are the dependable path on an iPad: dragging while holding a guitar
   is unreliable, so the buttons are deliberately large and always present. */
.sb-move{min-width:44px;min-height:44px;background:#141826;border:1.5px solid #2a2a40;color:#dfe4f5;border-radius:10px;font-size:18px;line-height:1;cursor:pointer;touch-action:manipulation;}
.sb-move:disabled{opacity:.3;cursor:default;}
.sb-move.rm{border-color:#7a2c2a;color:#ff8a80;font-size:15px;}
/* The key is tapped in a hurry during rehearsal, so it gets a full 44px
   target like the move buttons rather than sizing to its 1-3 characters. */
.sb-key-btn{min-width:44px;min-height:44px;background:#0e0e16;border:1.5px solid #2a2a40;color:var(--gold,#f0c040);border-radius:10px;padding:5px 8px;font-size:15px;font-family:'Oswald',sans-serif;letter-spacing:1px;cursor:pointer;touch-action:manipulation;}
.sb-key-btn.changed{border-color:var(--gold,#f0c040);background:rgba(240,192,64,.12);}
.sb-item.dragging{opacity:.45;}
.sb-item.dragover{border-color:var(--gold,#f0c040);}
.sb-item-added{font-size:11px;letter-spacing:1px;color:#81c784;border:1px solid #2e5e33;border-radius:6px;padding:2px 6px;margin-left:6px;}
/* WHO IS SINGING IT. On the set list, quiet and secondary to the title. */
.sb-item-leader{font-size:12px;color:#9a9ab8;}
.sb-item-leader::before{content:'♦';font-size:8px;color:#5a5a78;margin-right:5px;vertical-align:middle;}
/* A song Planning Center listed that has no chart here. Greyed, but it keeps
   its real position number: the set is what it is, and a hole in it is a fact
   she needs to see, not a row to renumber around. */
.sb-item.nochart{opacity:.55;cursor:default;border-style:dashed;}
.sb-item.nochart .sb-item-title{color:#c9c9dd;}
.sb-nochart-tag{font-size:11px;letter-spacing:1px;color:#c9a24a;border:1px solid #5a4a20;border-radius:6px;padding:2px 6px;margin-left:auto;white-space:nowrap;}
.sb-chartcount{font-size:12px;color:#8888aa;margin:2px 2px 8px;}
/* THE END SONG — chosen on a phone mid-sermon, picked up here. Deliberately
   unlike a Planning Center row: it is not part of the plan. */
.sb-endsong{border-style:dashed;border-color:#3a3a58;background:#0b0b12;}
.sb-endsong .sb-num{color:#6a6a8a;font-size:13px;letter-spacing:1px;}
.sb-endsong-tag{font-size:11px;letter-spacing:1px;color:#8fb8d8;border:1px solid #2a4a63;border-radius:6px;padding:2px 6px;margin-left:6px;}
.sb-endsong-empty{color:#7a7a99;font-style:italic;}
.sb-endsong-clear{background:none;border:1px solid #2a2a40;border-radius:8px;color:#8888aa;font-family:inherit;font-size:12px;padding:4px 8px;cursor:pointer;}
.sb-add-list{max-height:46vh;overflow-y:auto;display:flex;flex-direction:column;gap:8px;margin-top:10px;}
.sb-pos-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px;font-size:13px;color:#8888aa;}
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
.sb-legend span{font-size:15px;color:#ddd;background:#0e0e16;border:1px solid #2a2a40;border-radius:6px;padding:2px 7px;}
.sb-legend span b{color:var(--gold,#f0c040);font-weight:700;}
.sb-tools{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0;}
/* One tight row: every pixel these take is a pixel the lyrics do not get. */
.sb-bar{display:flex;gap:5px;align-items:center;flex-wrap:nowrap;overflow-x:auto;margin:2px 0 3px;scrollbar-width:none;}
/* The leader, in the key/capo row. A name and a key are different KINDS of
   fact, so this is a bordered chip in a different family and weight, never a
   run-on with the key beside it. Not colour alone — the border and the ♦ carry
   it under stage lighting. Subordinate to the key: smaller and dimmer, because
   the key is what she plays from and the leader is context. Inline in a nowrap
   row, so it takes NO vertical space from the lyrics. */
.sb-bar-leader{flex:0 0 auto;font-size:12px;line-height:1.1;color:#9a9ab8;border:1px solid #33334d;border-radius:8px;padding:3px 8px;white-space:nowrap;}
.sb-bar-leader b{font-weight:600;color:#c2c2da;}
.sb-bar-leader::before{content:'♦';font-size:8px;color:#5a5a78;margin-right:5px;vertical-align:middle;}
.sb-bar::-webkit-scrollbar{display:none;}
.sb-bar .sb-tool{padding:3px 8px;font-size:12px;white-space:nowrap;flex:0 0 auto;}
.sb-bar .sb-key-main{font-size:14px;padding:3px 8px;flex:0 0 auto;}
.sb-bar select{padding:3px 6px;font-size:12px;flex:0 0 auto;}
.sb-bar .sb-capo-lbl{flex:0 0 auto;}
.sb-bar-sp{flex:1 1 auto;}
/* THE LEGEND IS READ AT MUSIC-STAND DISTANCE. It was 11px — the smallest
   thing on a screen whose key button beside it is 14px in this row — while
   being the one element a musician actually looks down at mid-song. 15px sits
   just above that neighbour and roughly a third larger than before.

   IT COSTS THE CHART NOTHING. Both legends live in rows whose height is set by
   something taller: .sb-bar is align-items:center, nowrap, overflow-x:auto, and
   its tallest child (the Tune button, 44px) already dwarfs a legend chip at
   20px. Growing the chip to 21.25px consumes slack that already existed, so the
   bar height — and therefore the chart's height and top — do not move.
   Measured on the same chart with the legend on, before and after: bar 44px and
   chart 486.5px at top 105.5px, both ways.
   If it ever does outgrow the row, the row scrolls sideways (overflow-x) or the
   stacked legend wraps (flex-wrap) rather than getting taller. Lyrics never
   give up space. */
.sb-legend-i{flex:0 0 auto;font-size:15px;line-height:1.15;color:#ddd;background:#0e0e16;border:1px solid #2a2a40;border-radius:6px;padding:1px 6px;white-space:nowrap;}
.sb-legend-i b{color:var(--gold,#f0c040);font-weight:700;}
/* BASS LINE — the neck, the degree strip and its controls. */
/* Wider than a normal sheet: a bass neck is a long thin thing and the frets
   need the room. Two classes deep so it beats the .sb-sheet default that is
   declared after this block. */
/* Wider than a normal sheet: a bass neck is a long thin thing and the frets
   need the room. Capped against the viewport too, so on a narrow iPad in
   portrait the sheet can never end up wider than the screen it is on. Two
   classes deep so it beats the .sb-sheet default declared after this block. */
.sb-sheet.sb-bl-sheet{max-width:min(920px, 96vw);}
.sb-bl-where{font-size:13px;color:#b9b9d4;background:#0b0b12;border:1px solid #2a2a40;border-radius:10px;padding:8px 10px;margin-top:10px;}
.sb-bl-where b{color:#e9e9f6;}
.sb-bl-board{margin:12px 0 6px;cursor:pointer;-webkit-tap-highlight-color:transparent;overflow-x:auto;}
.sb-bl-strip{display:flex;flex-wrap:wrap;gap:5px;margin:6px 0 2px;}
.sb-bl-step{font-family:'Oswald',sans-serif;font-size:15px;color:#9a9ab8;background:#0e0e16;border:1px solid #2a2a40;border-radius:8px;padding:4px 9px;cursor:pointer;min-width:30px;}
.sb-bl-step.slide{letter-spacing:.5px;}
.sb-bl-step.on{color:#1a1208;background:var(--gold,#f0c040);border-color:var(--gold,#f0c040);font-weight:700;}
.sb-bl-controls{display:flex;align-items:center;gap:10px;margin-top:10px;}
.sb-bl-btn{flex:0 0 auto;font-family:inherit;font-size:14px;color:#ccc;background:#0e0e16;border:1px solid #2a2a40;border-radius:10px;padding:8px 14px;cursor:pointer;}
.sb-bl-btn.primary{color:#1a1208;background:var(--gold,#f0c040);border-color:var(--gold,#f0c040);font-weight:700;margin-left:auto;}
.sb-bl-count{font-family:'Oswald',sans-serif;font-size:13px;color:#8888aa;}
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
/* A section borrowed from another song. Marked warm and edged so it can never
   be read as part of the host song at a glance from a music stand. */
.sb-block-ins{border-left-color:#c8892a;background:rgba(200,137,42,.06);border-radius:0 6px 6px 0;}
.sb-ins-tag{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;text-transform:none;letter-spacing:0;}
.sb-ins-from{font-size:.86em;color:#e0a850;font-style:italic;}
.sb-ins-lang{font-size:.78em;letter-spacing:1px;color:#141018;background:#e0a850;border-radius:4px;padding:0 5px;font-weight:700;}
.sb-ins-key{font-size:.8em;color:#8888aa;}
.sb-ins-x{color:#ef5350 !important;}
/* Quick-load: pressed in a hurry, one-handed, so it is a full-width slab. */
.sb-ins-load{display:block;width:100%;min-height:44px;margin:.35em 0 .5em;background:rgba(200,137,42,.14);color:#e0a850;border:1px solid #7a5a22;border-radius:9px;font-family:'Oswald',sans-serif;font-size:.72em;letter-spacing:1.5px;cursor:pointer;}
.sb-ins-load:active{background:rgba(200,137,42,.3);}
.sb-load-whole{display:block;width:100%;min-height:60px;margin-top:12px;background:#f0c040;color:#141018;border:none;border-radius:11px;font-family:'Oswald',sans-serif;font-size:19px;letter-spacing:1.5px;cursor:pointer;}
.sb-load-whole:active{background:#d8a828;}
.sb-ins-hint{font-size:12px;color:#8888aa;line-height:1.5;margin-top:10px;}
.sb-map-item.ins{background:rgba(200,137,42,.16);border-color:#7a5a22;color:#e0a850;}
.sb-map-lang{font-size:.66em;letter-spacing:.5px;margin-left:2px;opacity:.85;}
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
/* The tuner over the chart. It scrolls INSIDE its own sheet so the chart
   underneath never moves — closing has to land on the same page at the same
   scroll position, which is the whole reason this is a modal. */
.sb-tuner-modal{align-items:center;}
.sb-tuner-sheet{background:#0e0e16;border:1.5px solid #2a2a40;border-radius:16px;width:100%;max-width:560px;
  max-height:92vh;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:10px 12px 18px;}
@media (max-width:599px){.sb-tuner-sheet{max-height:100vh;height:100vh;border-radius:0;border:none;}}
/* Pressed in a hurry mid-service, so it gets the 44px touch minimum. */
.sb-tune{min-height:44px;padding-left:14px;padding-right:14px;}
.sb-sheet-top{display:flex;align-items:baseline;gap:10px;margin-bottom:4px;}
.sb-sheet-name{font-family:'Oswald',sans-serif;font-size:24px;font-weight:700;color:var(--gold,#f0c040);letter-spacing:1px;}
.sb-sheet-sub{font-size:13px;color:#8888aa;}
/* The chord popups lead with the SHAPE — what the hands do. It has to carry
   from music-stand distance, so it is larger than the old header and the
   sounding chord sits under it, muted and explicitly labelled. */
.sb-sheet-top-shape{align-items:flex-start;gap:12px;}
.sb-sheet-ident{min-width:0;}
.sb-sheet-top-shape .sb-sheet-name{font-size:34px;line-height:1.1;}
@media (min-width:600px){.sb-sheet-top-shape .sb-sheet-name{font-size:40px;}}
/* "shape" is the unit, not the name — same line, deliberately quieter so the
   chord itself is what the eye lands on. */
.sb-sheet-shapeword{font-size:.5em;font-weight:400;color:#8888aa;letter-spacing:2px;
  text-transform:uppercase;margin-left:7px;}
.sb-sheet-sounds{font-size:13px;color:#8888aa;margin-top:3px;line-height:1.4;}
.sb-sheet-sounds b{color:#c8c8de;font-weight:600;}
.sb-sheet-top-shape .sb-sheet-close{margin-left:auto;flex:0 0 auto;}
.sb-sheet-close{margin-left:auto;background:none;border:1px solid #2a2a40;color:#bbb;border-radius:9px;padding:5px 11px;font-size:14px;cursor:pointer;}
.sb-cc-card{border:1px solid #2a2a40;border-radius:12px;padding:10px 10px 6px;margin-top:12px;background:#0a0a10;}
.sb-cc-card-top{display:flex;justify-content:space-between;gap:8px;font-size:12px;color:#8888aa;margin-bottom:6px;}
.sb-cc-notes{font-family:'Oswald',sans-serif;font-size:14px;color:#e8e8f0;letter-spacing:1px;}
.sb-cc-no{background:rgba(239,83,80,.1);border:1.5px solid #7a2c2a;border-radius:12px;padding:14px;margin-top:12px;}
.sb-cc-no-head{font-family:'Oswald',sans-serif;font-size:19px;color:#ff8a80;letter-spacing:1px;margin-bottom:5px;}
.sb-cc-no-body{font-size:14px;color:#e8c4c2;line-height:1.45;}
.sb-cc-warn{font-size:12px;color:#e0b050;background:rgba(240,192,64,.08);border:1px solid rgba(240,192,64,.3);border-radius:9px;padding:7px 9px;margin-top:10px;line-height:1.4;}
/* Nicole's own pinned shapes — marked so they never read as generated ones. */
.sb-cc-mine{border-color:#3a6a4a;background:rgba(129,199,132,.05);}
.sb-cc-badge{font-family:'Oswald',sans-serif;color:#81c784;letter-spacing:1px;text-transform:uppercase;font-size:11px;}
.sb-cc-editing{border-color:#5a5a2a;background:rgba(240,192,64,.05);}
.sb-cc-added{font-size:12px;color:#81c784;margin-top:6px;line-height:1.4;}
/* A shape straight off the published chart — the answer she already knows. */
.sb-cc-chart{border-color:#3a5a7a;background:rgba(74,109,167,.07);}
.sb-cc-chartname{font-family:'Oswald',sans-serif;font-size:15px;letter-spacing:1px;color:#8fb6e8;}
.sb-cc-chartsrc{font-size:11px;color:#6a7a95;letter-spacing:.5px;margin:-2px 0 6px;}
.sb-cc-chartnote{font-size:12px;color:#e0b050;margin-top:6px;line-height:1.45;}
.sb-cc-name{margin-top:8px;font-size:13px;color:#8888aa;}
.sb-cc-name-main{font-family:'Oswald',sans-serif;font-size:20px;color:#f0c040;letter-spacing:1px;}
.sb-cc-name-sub{font-size:12px;color:#8888aa;}
.sb-cc-name-hint{font-size:12px;color:#8888aa;}
.sb-cc-btns{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;}
.sb-cc-btn{flex:1;min-width:140px;background:#f0c040;color:#141018;border:none;border-radius:9px;padding:9px 12px;font-family:'Oswald',sans-serif;font-size:14px;letter-spacing:1px;cursor:pointer;}
.sb-cc-btn:disabled{opacity:.45;cursor:default;}
.sb-cc-btn.ghost{background:transparent;color:#c8c8dd;border:1px solid #2a2a40;}
.sb-cc-rowbtns{display:flex;gap:6px;}
.sb-cc-mini{background:transparent;color:#8888aa;border:1px solid #2a2a40;border-radius:7px;padding:3px 9px;font-size:11px;cursor:pointer;}
.sb-cc-mini:hover{color:#e8e8f0;border-color:#4a4a66;}
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
// ADD-SECTION PICKER — one search, two outcomes.
//
// Mid-song the team sometimes tags the chorus of a DIFFERENT song onto the end
// of the one they are playing; rarely, someone decides in the moment that the
// whole tagged song is happening after all. Both start from the same search
// and the same song choice, so this is one flow with two exits, not two
// features that happen to look alike.
//
// LANGUAGE. Many songs in this library exist as BOTH a Portuguese and an
// English chart, and those are genuinely different arrangements rather than
// translations — different artist, different tempo, sometimes different
// sections entirely (the EN "Here as In Heaven" has an Intro the PT one does
// not). So when a song has charts in both languages the picker ASKS which one
// the section comes from, and never assumes the host song's language: a
// Portuguese song carrying an English chorus is the actual use case here, not
// an edge case. A song that exists in one language only skips the question.
// ============================================================
function AddSectionPicker({ index, hostChartId, hostKey, positions, onInsert, onLoadWhole, onClose }) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(null);   // the chosen library entry
  const [chartPick, setChartPick] = useState(null); // the chosen chart of it
  const [at, setAt] = useState(-1);             // -1 = the end (the usual tag)

  // One row per SONG, not per chart: the language question comes after, so the
  // same song in two languages must not appear as two separate results.
  const results = useMemo(() => {
    if (query.trim().length < 2) return [];
    const seen = new Set();
    const out = [];
    for (const r of search(index, query, 60)) {
      if (seen.has(r.entry.id)) continue;
      seen.add(r.entry.id);
      out.push(r.entry);
      if (out.length >= 30) break;
    }
    return out;
  }, [index, query]);

  const chartsOf = (e) => (e ? e.charts.map((id) => library.charts[id]).filter(Boolean) : []);
  // The language question is only worth asking when there is a real choice.
  const choose = (e) => {
    const cs = chartsOf(e);
    const langs = [...new Set(cs.map((c) => c.lang))];
    setPicked(e);
    setChartPick(langs.length > 1 ? null : (cs[0] ? cs[0].id : null));
  };

  const srcChart = chartPick ? library.charts[chartPick] : null;
  const back = () => { if (chartPick && chartsOf(picked).length > 1) setChartPick(null); else { setPicked(null); setChartPick(null); } };

  return (
    <div className="sb-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="sb-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sb-sheet-top">
          <span className="sb-sheet-name">{picked ? picked.en || picked.pt : "Add a section"}</span>
          <span className="sb-sheet-sub">
            {!picked ? "from another song, into this one"
              : !srcChart ? "which chart is it from?"
                : "pick a section, or load the whole song"}
          </span>
          <button className="sb-sheet-close" onClick={onClose}>Close</button>
        </div>

        {/* STEP 1 — find the song. */}
        {!picked && (
          <>
            <div style={{ marginTop: 10 }}>
              <input type="search" autoFocus placeholder="Search the library…" value={query}
                onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="sb-add-list">
              {results.length === 0 && (
                <div className="sb-empty">
                  {query.trim().length < 2 ? "Type to search all " + library.songs.length + " songs." : "No song matches “" + query + "”."}
                </div>
              )}
              {results.map((e) => {
                const cs = chartsOf(e);
                const langs = [...new Set(cs.map((c) => c.lang))];
                return (
                  <button className="sb-item" key={e.id} onClick={() => choose(e)}>
                    <div style={{ flex: 1 }}>
                      <div className="sb-item-title">{e.en || e.pt}</div>
                      {e.en && e.pt && <div className="sb-item-sub">{e.en === (e.en || e.pt) ? e.pt : e.en}</div>}
                    </div>
                    <span className="sb-item-lang">{langs.map((l) => l.toUpperCase()).join(" · ")}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* STEP 2 — which arrangement? Only when there really is a choice. */}
        {picked && !srcChart && (
          <>
            <div className="sb-ins-hint">
              These are different arrangements, not translations — the sections
              can differ. Pick the one the section comes from.
            </div>
            <div className="sb-add-list">
              {chartsOf(picked).map((c) => (
                <button className="sb-item" key={c.id} onClick={() => setChartPick(c.id)}>
                  <div style={{ flex: 1 }}>
                    <div className="sb-item-title">{c.names.primary}</div>
                    <div className="sb-item-sub">
                      {c.artist ? c.artist + " · " : ""}{c.blocks.length} sections{c.tempo ? " · " + c.tempo + " bpm" : ""}
                    </div>
                  </div>
                  <span className="sb-item-lang">{c.lang.toUpperCase()}{c.key ? " · " + c.key.tonic : ""}</span>
                </button>
              ))}
            </div>
            <button className="sb-tool" style={{ marginTop: 10 }} onClick={back}>← Back to search</button>
          </>
        )}

        {/* STEP 3 — one section, or the whole song. */}
        {picked && srcChart && (
          <>
            <button className="sb-load-whole" onClick={() => onLoadWhole(picked, srcChart.id)}>
              ▶ Load whole song
            </button>
            <div className="sb-ins-hint">
              …or tag just one section onto this song:
              {srcChart.key && hostKey && srcChart.key.tonicPc !== hostKey.tonicPc && (
                <> its numbers will be counted in {keyName(hostKey)}, the key you are playing.</>
              )}
            </div>
            <div className="sb-pos-row">
              <span>Insert at</span>
              <select value={at} onChange={(e) => setAt(Number(e.target.value))}>
                {positions.map((_, i) => <option key={i} value={i}>position {i + 1}</option>)}
                <option value={-1}>the end</option>
              </select>
            </div>
            <div className="sb-add-list">
              {srcChart.blocks.map((b) => (
                <button className="sb-item" key={b.id}
                  disabled={srcChart.id === hostChartId}
                  onClick={() => onInsert(srcChart.id, b.id, at)}>
                  <div style={{ flex: 1 }}>
                    <div className="sb-item-title">{b.name}</div>
                    <div className="sb-item-sub">{(b.lines[0] && b.lines[0].text) || "—"}</div>
                  </div>
                  <span className="sb-item-lang">{srcChart.lang.toUpperCase()}</span>
                </button>
              ))}
            </div>
            <button className="sb-tool" style={{ marginTop: 10 }} onClick={back}>← Back</button>
          </>
        )}
      </div>
    </div>
  );
}

// Planning Center's plan key, corrected and resolved against a chart — or null
// when PC has nothing to add.
//
// PC labels any song that starts on the 6 as the relative minor: it reports
// "Quem é Como Nosso Deus" as Em when the song is in G major. Em and G share
// every note, so that is a LABEL disagreement, not a transposition — the honest
// answer is the chart's own key, unshifted. Returning null here says exactly
// that: "PC is not asking for a different key." Anything else is a real
// transposition PC made that the chart PDF never followed.
//
// One function, used by both the set list row and the chart view, so the two
// can never disagree about what key a song is in.
export const resolvePlanKey = (planKey, written) => {
  const p = planKey && parseKeyName(planKey);
  if (!p || !written) return null;
  if (p.mode === "minor" && p.tonicPc === (written.tonicPc + 9) % 12) return null;
  return p;
};

// ============================================================
// CHART VIEW
// ============================================================
// Is this plan item actually a SONG she would expect a chart for?
//
// The endpoint already filters to item_type 'song', but Planning Center plans
// carry song-typed items that are not songs anyone plays from a chart: a
// countdown, a video roll, a spoken segment. Those resolve as unmatched for
// the same reason a real missing chart does, and calling them "no chart" would
// cry wolf on every set and make the flag worthless.
//
// Conservative on purpose: an item is treated as NOT a song only when it says
// so in the ways this church's plans actually say it. Anything ambiguous stays
// a song, so a genuinely missing chart is never hidden — the failure this
// guards against is a false alarm, and the failure it must never cause is a
// silent omission.
const NON_SONG_RE = /\b(countdown|pre[\s-]?roll|bumper|walk[\s-]?in|walk[\s-]?out|offering\s+video|announcements?|sermon|message|welcome|greeting|prayer|communion|baptism|benediction|dismissal|video|slide|loop|transition|instrumental\s+bed)\b/i;
const looksLikeSong = (it) => {
  const raw = String((it && it.title) || "");
  // Planning Center's own convention: the descriptor in parentheses.
  // "Intro Worship 2026 (COUNTDOWN)" is a countdown, not a song.
  if (NON_SONG_RE.test(raw)) return false;
  // A matched item is a song by definition — it found a chart.
  if (it && it.match && it.match.entry) return true;
  // Nothing left to go on: treat it as a song, so a real gap is never silent.
  return true;
};

function ChartView({ entry, chartId, fromSet, setNav, planKey, leader, onNavigate, onLoadWhole, index, serviceTypeId, onBack, onSwitchChart, prefs, setPrefs, onKeepAlive, isTeacher, instrument }) {
  const chart = library.charts[chartId];
  const detected = chart.key;
  // TWO SEPARATE FACTS, deliberately kept apart.
  //
  //   chartKeyOverride — "detection read the CHART wrong". Rare, and a property
  //     of the chart data. It changes what the numbers are measured against,
  //     which is exactly what the relative-minor correction below needs.
  //
  //   keyOverride — "we are PLAYING this in a different key today". Common:
  //     the leader calls it in rehearsal. It must never touch the numbers. A
  //     song's Nashville numbers describe its harmonic structure and that
  //     structure does not change with the key; only the letters the numbers
  //     resolve to move. This is the same localStorage key the set-list picker
  //     writes, so a key set from either place stays one fact.
  const [chartKeyOverride, setChartKeyOverride] = useState(() => { migrateRelativeMinorKey(chartId, detected); return lsGet("songbook_chartkey_" + chartId, null); });
  const [keyOverride, setKeyOverride] = useState(() => lsGet("songbook_key_" + chartId, null));
  const [noticeDismissed, setNoticeDismissed] = useState(() => lsGet("songbook_notice_" + chartId, false));
  // Dismissal is keyed to the KEY as well as the chart: if PC transposes this
  // song again, the new key announces itself rather than staying hidden behind
  // a dismissal of the old one.
  const planNoticeKey = "songbook_pcnotice_" + chartId + "_" + (planKey || "");
  const [planNoticeDismissed, setPlanNoticeDismissed] = useState(() => lsGet(planNoticeKey, false));
  const [customOrder, setCustomOrder] = useState(() => lsGet("songbook_order_" + chartId, null));
  const [editing, setEditing] = useState(false);
  const [pickKey, setPickKey] = useState(false);
  const [fixChartKey, setFixChartKey] = useState(false);   // the chart-key control is disclosed, not always on
  // { capo, cut } — a full capo and a cut capo are independent and combine.
  // The cut capo is Nicole's own tool: teacher only, never offered to students.
  const [capo, setCapoState] = useState(() => normalizeCapoSetting(lsGet("songbook_capo_" + chartId, null)));
  const [tapped, setTapped] = useState(null); // chord token whose popup is open
  // Sections borrowed from OTHER songs, living in this chart's block sequence.
  const [inserts, setInserts] = useState(() => readInserts(chartId));
  const [addSecOpen, setAddSecOpen] = useState(false);
  // The tuner rides OVER the chart rather than replacing it: on stage a guitar
  // drifts mid-set, and backing out to the tuner screen loses her place in the
  // song. The chart stays mounted underneath, so closing returns to exactly
  // the same song, page, scroll position, capo and key — nothing reloads.
  const [tunerOpen, setTunerOpen] = useState(false);
  // BASS LINE. Offered only for songs that have one defined, and only to the
  // people it is for: bass students and the teacher. Gated on the STUDENTS
  // instrument field, exactly as the tuner above is.
  const [bassOpen, setBassOpen] = useState(false);
  const bassLines = useMemo(() => bassLinesFor(chartId), [chartId]);
  const canSeeBass = !!bassLines && (isTeacher || instrument === "bass");
  const dragRef = useRef(null);

  useEffect(() => { migrateRelativeMinorKey(chartId, detected); setChartKeyOverride(lsGet("songbook_chartkey_" + chartId, null)); setKeyOverride(lsGet("songbook_key_" + chartId, null)); setNoticeDismissed(lsGet("songbook_notice_" + chartId, false)); setPlanNoticeDismissed(lsGet("songbook_pcnotice_" + chartId + "_" + (planKey || ""), false)); setCustomOrder(lsGet("songbook_order_" + chartId, null)); setCapoState(normalizeCapoSetting(lsGet("songbook_capo_" + chartId, null))); setInserts(readInserts(chartId)); setEditing(false); setPickKey(false); setFixChartKey(false); setTapped(null); setAddSecOpen(false); setTunerOpen(false); }, [chartId, planKey]);
  // Keep the app's inactivity timer from blanking a chart that is open on stage.
  useEffect(() => { if (!onKeepAlive) return; const t = setInterval(onKeepAlive, 60 * 1000); return () => clearInterval(t); }, [onKeepAlive]);

  // The key the CHART IS WRITTEN IN. Everything numeric measures against this
  // and only this, so the numbers are identical at every playing key.
  const writtenKey = useMemo(
    () => (chartKeyOverride && parseKeyName(chartKeyOverride)) || (detected ? { tonic: detected.tonic, tonicPc: detected.tonicPc, mode: detected.mode } : null),
    [chartKeyOverride, detected]
  );
  // The key the BAND IS PLAYING IN. Drives the letters, the header and the
  // capo maths. Defaults to the written key, which is the no-override case.
  // Only the TONIC is taken from a playing-key override. Major-or-minor is a
  // property of the song, not of the key it is called in: "put it in D" moves
  // where 1 sits, it does not turn a major song minor. Taking the mode too
  // would let the header say "Am" over letters that are plainly A major.
  //
  // THREE SOURCES, in strict precedence: her override, then Planning Center's
  // plan key, then the chart's own key. Her override always wins — a key
  // called out in rehearsal is the most recent decision in the room, and PC
  // must never reach in and overwrite it.
  //
  // THE RELATIVE-MINOR CORRECTION APPLIES TO THE PLAN KEY TOO. Planning Center
  // labels any song that starts on the 6 as the relative minor — it reports
  // "Quem é Como Nosso Deus" as Em when the song is in G major. That is the
  // same mislabel `minorSurface` already catches in the chart's own declared
  // key, and it is not a transposition: Em and G share every note. So when PC
  // names the relative minor of the key the chart is in, PC and the chart
  // AGREE, and the honest answer is the chart's key with nothing shifted.
  // Treating it as a real key change would drag the letters down a minor third
  // and put the band in the wrong key on stage.
  const planParsed = useMemo(() => resolvePlanKey(planKey, writtenKey), [planKey, writtenKey]);

  // Where the playing key came from, for the badge on the header.
  const keySource = keyOverride ? "override" : planParsed ? "plan" : "chart";

  const playKey = useMemo(() => {
    const p = (keyOverride && parseKeyName(keyOverride)) || planParsed;
    if (!p || !writtenKey) return writtenKey;
    return { tonic: p.tonic, tonicPc: p.tonicPc, mode: writtenKey.mode };
  }, [keyOverride, planParsed, writtenKey]);
  // Semitones from the page to the room. Zero unless a playing key is forced.
  const playShift = useMemo(
    () => (writtenKey && playKey ? (((playKey.tonicPc - writtenKey.tonicPc) % 12) + 12) % 12 : 0),
    [writtenKey, playKey]
  );
  // `key` is the playing key: it is what the header, the legend, the capo
  // suggestion and the borrowed-section picker are all asking about.
  const key = playKey;
  const charts = entry.charts.map((id) => library.charts[id]);
  const langs = [...new Set(charts.map((c) => c.lang))];
  const sameLang = charts.filter((c) => c.lang === chart.lang);

  // Inserted sections resolved against the library. One that no longer
  // resolves (its source chart re-imported away) is dropped rather than
  // rendered broken, which is also what keeps a stale id out of blockOrder.
  const insertBlocks = useMemo(
    () => inserts.map((ins) => resolveInsert(ins, library)).filter(Boolean),
    [inserts]
  );

  // A block id is either a host block's integer id or an "ins:" synthetic one.
  // Everything downstream — order, reorder, pagination, rendering — works in
  // terms of blockOf(), so an inserted section is a block like any other.
  const blockOf = useCallback((bid) => {
    if (isInsertId(bid)) {
      const ib = insertBlocks.find((x) => x.id === bid);
      return ib ? { ...ib, inserted: true } : null;
    }
    const b = chart.blocks.find((x) => x.id === bid);
    return b ? { ...b, inserted: false } : null;
  }, [chart, insertBlocks]);

  const blockOrder = useMemo(() => {
    const ids = chart.blocks.map((b) => b.id);
    const insIds = insertBlocks.map((b) => b.id);
    const all = [...ids, ...insIds];
    // No custom order yet: host blocks in file order, then anything inserted.
    if (!customOrder) return all;
    // Keep only ids that still exist, then append anything new — a section
    // inserted while a custom order is in force appears at the end until she
    // moves it, rather than silently vanishing because the order predates it.
    const valid = customOrder.filter((id) => all.includes(id));
    all.forEach((id) => { if (!valid.includes(id)) valid.push(id); });
    return valid;
  }, [chart, customOrder, insertBlocks]);
  const saveOrder = (ids) => { setCustomOrder(ids); lsSet("songbook_order_" + chartId, ids); };
  const move = (from, to) => { if (to < 0 || to >= blockOrder.length) return; const ids = blockOrder.slice(); const [x] = ids.splice(from, 1); ids.splice(to, 0, x); saveOrder(ids); };

  /**
   * Insert one section of another song at a position in this chart's order.
   * The order is written explicitly (rather than left to the append rule) so
   * the section lands exactly where she chose, which is normally the end —
   * a tag onto the song they are already playing.
   */
  const insertSection = (srcChartId, srcBlockId, at) => {
    const id = addInsert(chartId, srcChartId, srcBlockId);
    const next = readInserts(chartId);
    setInserts(next);
    const ids = blockOrder.filter((x) => x !== id);
    const pos = at == null || at < 0 || at > ids.length ? ids.length : at;
    ids.splice(pos, 0, id);
    saveOrder(ids);
    setAddSecOpen(false);
  };

  /** Remove an inserted section: it leaves both the order and the store. */
  const dropInsert = (id) => {
    removeInsert(chartId, id);
    setInserts(readInserts(chartId));
    saveOrder(blockOrder.filter((x) => x !== id));
  };

  /** Reset order also clears insertions — one "this chart has been
   *  rearranged" fact, cleared by the one button that already means that. */
  const resetArrangement = () => {
    clearInserts(chartId);
    setInserts([]);
    setCustomOrder(null);
    try { localStorage.removeItem("songbook_order_" + chartId); } catch (e) { /* ignore */ }
  };

  // The roadmap follows the ARRANGEMENT, not the file: a borrowed section is
  // part of what the band plays, so it has to appear in the map they read.
  // Host entries keep the chart's own roadmap (which carries repeat counts and
  // unresolved labels); inserted ones are appended in block-order position.
  const roadmap = useMemo(() => {
    const base = chart.roadmap || chart.order.map((o) => ({ block: o.block, label: o.label, times: o.times }));
    const insIds = blockOrder.filter(isInsertId);
    if (!insIds.length) return base;
    const out = base.slice();
    insIds.forEach((id) => {
      const ib = insertBlocks.find((x) => x.id === id);
      if (!ib) return;
      // Place it in the map where it sits in the order, relative to the host
      // blocks around it, so the map reads the way the song is played.
      const pos = blockOrder.indexOf(id);
      const before = blockOrder.slice(0, pos).filter((x) => !isInsertId(x));
      const lastHost = before.length ? before[before.length - 1] : null;
      const mapIdx = lastHost == null ? 0 : out.findIndex((r) => r.block === lastHost) + 1;
      out.splice(mapIdx > 0 ? mapIdx : out.length, 0, { block: id, label: ib.name, times: 1, inserted: true, lang: ib.srcLang });
    });
    return out;
  }, [chart, blockOrder, insertBlocks]);
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
    // A forced setting is SAID so, because "Key: D" looked identical whether
    // detected or set by hand and a leftover setting could sit there unnoticed
    // for weeks. The two marks are different words because they are different
    // facts: ·set moves the letters, ·chart moves the NUMBERS.
    // ·set = the band is playing it somewhere else today (letters move).
    // ·chart = the chart's own key was corrected (numbers move). When both are
    // on, ·chart names the written key, because the header's own key is the
    // playing one and the two are then different facts on one line.
    // ·PC = this key came from Planning Center, not the chart file. Shown so a
    // key that differs from the printed chart is visible rather than silent —
    // that difference is normal (PC transposed; the PDF never followed), not an
    // error. Her own override still marks ·set and outranks it.
    const mark = (keyOverride ? " ·set" : keySource === "plan" ? " ·PC" : "") + (chartKeyOverride ? (keyOverride ? " ·chart " + keyName(writtenKey) : " ·chart") : "");
    const base = "Key: " + keyName(key) + mark;
    if (!isTeacher) return capoLabel(key) + mark;
    const full = capo.capo > 0 ? "Capo " + capo.capo + " (" + transposedKeyName(key, -capo.capo) + ")" : null;
    const cut = capo.cut ? "cut capo (fret " + cutFret + ")" : null;
    if (full && cut) return base + " - " + full + " + " + cut;
    if (full) return base + " - " + full;
    if (cut) return base + " - Cut capo (fret " + cutFret + ")";
    return base;
  };

  const showNotice = detected && detected.minorSurface && !noticeDismissed && !chartKeyOverride;
  // Say so when the key on screen came from Planning Center and the printed
  // chart says something else. A difference here is EXPECTED — PC transposed
  // the song and the chart PDF never followed — so this states the fact rather
  // than warning about it. Suppressed once her own override is in force,
  // because then the plan key is not what she is looking at.
  const showPlanNotice = keySource === "plan" && !planNoticeDismissed && writtenKey && playKey && playKey.tonicPc !== writtenKey.tonicPc;

  // The letter to print beside a number: the chord as it is actually FINGERED.
  // Two independent moves, in this order — transpose the page into the key the
  // band is playing, then take the capo off it, because with a capo on the
  // chord under the hand is not the chord that sounds.
  const useFlats = /b/.test(key ? key.tonic : "") || (key && key.tonic === "F");
  const fingeredToken = (tok) => {
    const shift = playShift - (isTeacher ? capo.capo : 0);
    return shift % 12 === 0 ? tok : transposeChordToken(tok, shift, useFlats);
  };

  // The key under the fingers: the playing key with the capo taken off.
  const legendKey = useMemo(() => {
    if (!key) return null;
    const drop = isTeacher ? capo.capo : 0;
    if (!drop) return key;
    const pc = (((key.tonicPc - drop) % 12) + 12) % 12;
    return { tonic: pcToName(pc, useFlats), tonicPc: pc, mode: key.mode };
  }, [key, isTeacher, capo.capo, useFlats]);

  // Nashville numbers are measured against the key the CHART IS WRITTEN IN,
  // always. They are independent of the capo and of the playing key: a 1 is a
  // 1 in every key, and a diatonic song can never show a b3 or a b7.
  const chordText = (tok) => {
    if (!writtenKey) return tok;
    const n = toNashville(tok, writtenKey);
    return fromSet ? n : (<>{n} <small>({fingeredToken(tok)})</small></>);
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
  }, [chartId, page, pages, blockOrder, insertBlocks, prefs.gloss, prefs.legend, prefs.roadmapFull, editing, capo.capo, capo.cut, keyOverride, chartKeyOverride, showNotice, showPlanNotice, cutOn]);

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
          {nav && <span className="sb-pos">{(nav.showPos || navIdx + 1) + " / " + (nav.showTotal || nav.list.length)}</span>}
          <span className="sb-title">{displayTitle}</span>
          {altTitle && <span className="sb-alt">{altTitle}</span>}
          <span className="sb-meta">{chart.artist}{chart.tempo ? " · " + chart.tempo + " bpm" : ""}</span>
          {pageCount > 1 && <span className="sb-page">{curPage + 1} / {pageCount}</span>}
        </div>

        {/* One tight row. Everything these controls take, the lyrics lose. */}
        <div className="sb-bar">
          <button className="sb-key-main" onClick={() => setPickKey((v) => !v)} title="Tap to change key">{keyHeader()}</button>
          {/* WHO IS SINGING IT — Planning Center's leader for this item.
              Inline in this row on purpose: the eye already comes here for the
              key, and the row is nowrap/overflow-x, so the chip costs the
              lyrics no vertical space at all. Kept visually distinct from the
              key (own border, own weight, ♦ separator) so a name and a key can
              never read as one string, and kept subordinate to it. */}
          {leader && <span className="sb-bar-leader" title={"Led by " + leader}><b>{leader}</b></span>}
          {pickKey && (
            <>
              <label className="sb-capo-lbl">Play in
                <select value={key ? keyName(key) : ""} onChange={(e) => { const v = e.target.value; setKeyOverride(v); lsSet("songbook_key_" + chartId, v); setPickKey(false); }}>
                  {KEY_LIST.flatMap((k) => [k, k + "m"]).map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </label>
              {/* One tap back to the chart's own key. */}
              {keyOverride && <button className="sb-tool" onClick={() => { setKeyOverride(null); lsSet("songbook_key_" + chartId, null); setPickKey(false); }}>Play in {writtenKey ? keyName(writtenKey) : "?"} (the chart's key)</button>}
              {/* Correcting the CHART, not the performance — a rare fix for
                  detection having read the chart's own key wrong, and the only
                  control here that moves the numbers. Kept behind a second tap
                  so it can never be hit while reaching for the playing key. */}
              {isTeacher && !fixChartKey && !chartKeyOverride && (
                <button className="sb-tool" title="Only if detection read the chart's own key wrong. This changes the numbers." onClick={() => setFixChartKey(true)}>Chart key…</button>
              )}
              {isTeacher && (fixChartKey || chartKeyOverride) && (
                <label className="sb-capo-lbl" title="The key the CHART is written in. Changing it re-numbers the whole song.">Chart written in
                  <select value={writtenKey ? keyName(writtenKey) : ""} onChange={(e) => { const v = e.target.value; setChartKeyOverride(v); lsSet("songbook_chartkey_" + chartId, v); }}>
                    {KEY_LIST.flatMap((k) => [k, k + "m"]).map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </label>
              )}
              {chartKeyOverride && <button className="sb-tool" onClick={() => { setChartKeyOverride(null); lsSet("songbook_chartkey_" + chartId, null); setFixChartKey(false); }}>Chart key: back to {detected ? detected.tonic : "?"}</button>}
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
          {/* Tuning is gated exactly like the standalone tuner route: keys
              students never see it, everyone else (and the teacher) does.
              onClick, not a deferred handler — on iOS the AudioContext only
              resumes inside a real gesture, and mounting the tuner
              synchronously from this tap keeps that chain intact. */}
          {instrument !== "keys" && (
            <button className={"sb-tool sb-tune" + (tunerOpen ? " on" : "")} onClick={() => setTunerOpen(true)}>🎯 Tune</button>
          )}
          {/* Only where a line exists, and only for the bass. */}
          {canSeeBass && (
            <button className={"sb-tool" + (bassOpen ? " on" : "")} onClick={() => setBassOpen(true)}>🎸 Bass Line</button>
          )}
          <button className={"sb-tool" + (editing ? " on" : "")} onClick={() => setEditing((v) => !v)}>{editing ? "Done" : "Reorder"}</button>
          {editing && <button className="sb-tool" onClick={() => setAddSecOpen(true)}>+ Add section</button>}
          {(customOrder || inserts.length > 0) && <button className="sb-tool" onClick={resetArrangement}>Reset order</button>}
          {/* The legend reads the same letters the chart prints beside the
              numbers: the FINGERED key, capo included. */}
          {prefs.legend && legendKey && keyLegend(legendKey).map((l) => <span key={l.degree} className="sb-legend-i"><b>{l.degree}</b>={l.name}</span>)}
          <span className="sb-bar-sp" />
        </div>

        {showPlanNotice && (
          <div className="sb-notice">
            <span>Key <b>{keyName(playKey)}</b> from Planning Center — the chart is written in <b>{keyName(writtenKey)}</b>. The numbers are unchanged; only the letters move.</span>
            <button className="sb-tool" onClick={() => { setPlanNoticeDismissed(true); lsSet(planNoticeKey, true); }}>OK</button>
          </div>
        )}
        {showNotice && (
          <div className="sb-notice">
            <span>Auto-corrected from <b>{detected.relativeMinor}</b> to <b>{detected.tonic} major</b>. This chart leans on the 6- chord (the pattern Planning Center labels as minor) but its cadences land on {detected.tonic}.</span>
            <button className="sb-tool" onClick={() => { setChartKeyOverride(detected.relativeMinor); lsSet("songbook_chartkey_" + chartId, detected.relativeMinor); }}>Use {detected.relativeMinor}</button>
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
              const b = r.block != null ? blockOf(r.block) : null;
              const label = b ? (useFull || r.inserted ? labelOf(b) : (abbr.map[b.name] || labelOf(b))) : r.label;
              return (
                <span key={i} className={"sb-map-item" + (b ? "" : " x") + (r.inserted ? " ins" : "")}>
                  {label}{r.inserted ? <sup className="sb-map-lang">{r.lang.toUpperCase()}</sup> : null}{r.times > 1 ? " ×" + r.times : ""}
                </span>
              );
            })}
          </div>

          {blockOrder.map((bid, idx) => {
            const b = blockOf(bid);
            if (!b) return null;
            return (
              <div className={"sb-block" + (b.inserted ? " sb-block-ins" : "")} key={bid} data-idx={idx} data-block={bid}>
                <div className="sb-block-label">
                  {labelOf(b)}
                  {/* A borrowed section is never allowed to read as part of
                      this song: it carries the source title, its language, and
                      the key it was written in (its numbers are the HOST's). */}
                  {b.inserted && (
                    <span className="sb-ins-tag">
                      <span className="sb-ins-from">from {b.srcTitle}</span>
                      <span className="sb-ins-lang">{b.srcLang.toUpperCase()}</span>
                      {b.srcKey && key && b.srcKey.tonicPc !== key.tonicPc && (
                        <span className="sb-ins-key">written in {b.srcKey.tonic}</span>
                      )}
                    </span>
                  )}
                  {editing && (
                    <span className="sb-handle">
                      <button onClick={() => move(idx, idx - 1)}>↑</button>
                      <button onClick={() => move(idx, idx + 1)}>↓</button>
                      <button onPointerDown={onPointerDown(idx)} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>☰</button>
                      {b.inserted && <button className="sb-ins-x" onClick={() => dropInsert(bid)}>✕</button>}
                    </span>
                  )}
                </div>
                {b.inserted && b.srcEntry && (
                  <button className="sb-ins-load" onClick={() => onLoadWhole(b.srcEntry, b.srcChartId)}>
                    ▶ Load whole song
                  </button>
                )}
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

      {/* "How do I play this?" is asked about the SOUNDING chord in the key
          the band is playing — the popups do the capo maths themselves, so
          they get the transposed token, not the capo-adjusted one. */}
      {tapped && (cutOn
        ? <CutCapoPopup token={playShift ? transposeChordToken(tapped, playShift, useFlats) : tapped} capoSetting={capo} isTeacher={isTeacher} onClose={() => setTapped(null)} />
        : <ChordPopup token={playShift ? transposeChordToken(tapped, playShift, useFlats) : tapped} capoFret={capo.capo} instrument={instrument} onClose={() => setTapped(null)} />)}

      {addSecOpen && (
        <AddSectionPicker index={index} hostChartId={chartId} hostKey={key} positions={blockOrder}
          onInsert={insertSection} onLoadWhole={onLoadWhole} onClose={() => setAddSecOpen(false)} />
      )}

      {/* THE TUNER, over the chart. The chart is NOT unmounted — that is the
          entire point: her place, page, capo and key all survive because
          nothing about the chart re-runs. Unmounting Tuner on close is what
          releases the microphone: its own cleanup stops the MediaStream
          tracks, so no mic is left live through a service. */}
      {tunerOpen && (
        <div className="sb-modal sb-tuner-modal" role="dialog" aria-modal="true">
          <div className="sb-tuner-sheet" onClick={(e) => e.stopPropagation()}>
            <Tuner instrument={instrument === "bass" ? "bass" : "guitar"} isTeacher={isTeacher}
              onBack={() => setTunerOpen(false)} />
          </div>
        </div>
      )}

      {/* BASS LINE. `key` is the resolved PLAYING key — her override, then
          Planning Center, then the chart — the same value the header and the
          legend read, so the degrees can never disagree with what the rest of
          the page says the song is in. */}
      {bassOpen && canSeeBass && (
        <BassLineView line={bassLines[0]} playingKey={key ? keyName(key) : null}
          songTitle={displayTitle} onClose={() => setBassOpen(false)} />
      )}
    </div>
  );
}

// ============================================================
// POPUP HEADER — shared by BOTH chord popups, deliberately.
//
// WHAT GOES BIG IS THE SHAPE. Mid-song the shape is the actionable fact: it
// is what the hands do. The sounding chord is context — she has already read
// it off the chart, which is how she got here.
//
// This was the other way round and it caused a real misread on stage: the
// large gold "Am7" was taken as the chord to play and "play F#m7 shape" in
// small print underneath was missed entirely. With a capo on, the big name
// being the one you must NOT grip is a trap.
//
// WITH NO CAPO the two names are identical, so only one is shown. Printing
// "sounds Am7" under a large "Am7" is noise that teaches the eye to skip the
// second line — exactly the habit that hid the shape in the first place.
//
// One component, used by both popups, so the two can never drift apart.
// ============================================================
function ChordSheetHead({ shapeLabel, soundingLabel, setup, onClose }) {
  // "Transposed" is the only thing that matters here: are the two names
  // actually different? Not whether a capo is on — a cut capo alone raises
  // three strings and shifts no shape, so its names match and it gets the
  // single-name treatment too.
  const differs = !!shapeLabel && !!soundingLabel && shapeLabel !== soundingLabel;
  return (
    <div className="sb-sheet-top sb-sheet-top-shape">
      <div className="sb-sheet-ident">
        <div className="sb-sheet-name">
          {shapeLabel || soundingLabel}
          {differs && <span className="sb-sheet-shapeword"> shape</span>}
        </div>
        {/* Secondary line: muted, smaller, and the sounding chord is
            explicitly LABELLED as sounding so it can never be misread as
            the thing to play. */}
        {(differs || setup) && (
          <div className="sb-sheet-sounds">
            {differs && <>sounds <b>{soundingLabel}</b></>}
            {differs && setup ? " · " : ""}
            {setup}
          </div>
        )}
      </div>
      <button className="sb-sheet-close" onClick={onClose}>Close</button>
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

  // Keys and bass have no shape to grip, so their header keeps naming the
  // chord itself — there the sounding name IS the answer.
  const setup = !fretted
    ? (instrument === "bass" ? "chord tones" : "notes in the chord")
    : guitar.status === "not-a-chord"
      ? ""
      : capo > 0
        ? "capo " + capo
        : "";

  return (
    <div className="sb-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="sb-sheet" onClick={(e) => e.stopPropagation()}>
        <ChordSheetHead
          shapeLabel={fretted ? (guitar.shapeLabel || null) : null}
          soundingLabel={(res && (res.soundingLabel || res.label)) || token}
          setup={setup}
          onClose={onClose}
        />

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
                Capo at fret {capo}. Finger the <b>{guitar.shapeLabel}</b> shape — the chart says
                {" "}<b>{guitar.soundingLabel}</b>, and with the capo on that shape is what sounds it.
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
//
// Nicole's own pinned shapes come FIRST when she has any: she has played this
// capo for years and the generator is the fallback, not the authority. The
// editor below is teacher-only — students get the plain read-only answer.
// ============================================================
function CutCapoPopup({ token, capoSetting, isTeacher, onClose }) {
  const result = useMemo(() => cutCapoAnswerFor(token, capoSetting, 2), [token, capoSetting]);
  const capo = result.capo || 0;
  const setup = (capo > 0 ? "capo " + capo + " + " : "") + "cut capo at fret " + result.cutFret;

  // Pinned shapes for this chord at this capo. `stamp` re-reads after a write.
  const [stamp, setStamp] = useState(0);
  const mine = useMemo(
    () => (result.status === "not-a-chord" ? [] : savedShapesFor(token, capo)),
    [token, capo, stamp, result.status]
  );

  // Editor state: null = closed, otherwise { shape, id } being worked on.
  const [edit, setEdit] = useState(null);
  const canEdit = isTeacher && result.status !== "not-a-chord";
  const reading = useMemo(() => (edit ? analyseShape(edit.shape, capo) : null), [edit, capo]);

  const startEdit = (shape, id) => setEdit({ shape: shape.slice(), id: id || null });
  const commit = () => {
    if (!edit) return;
    saveShapeFor(token, edit.shape, capo, edit.id ? { id: edit.id } : {});
    setEdit(null);
    setStamp((n) => n + 1);
  };
  const remove = (id) => { deleteSavedShape(id); setStamp((n) => n + 1); };

  return (
    <div className="sb-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="sb-sheet" onClick={(e) => e.stopPropagation()}>
        <ChordSheetHead
          shapeLabel={result.shapeLabel || null}
          soundingLabel={result.soundingLabel || token}
          setup={setup}
          onClose={onClose}
        />

        {result.status === "not-a-chord" && (
          <div className="sb-cc-no">
            <div className="sb-cc-no-head">Not a chord</div>
            <div className="sb-cc-no-body">“{token}” is not something the cut capo can be checked against.</div>
          </div>
        )}

        {/* ---- the editor, when open ---- */}
        {edit && (
          <div className="sb-cc-card sb-cc-editing">
            <div className="sb-cc-card-top">
              <span>{edit.id ? "Editing my shape" : "New shape"}</span>
              <span>tap frets · tap ○/✕ to ring or mute</span>
            </div>
            <CutCapoDiagram shape={edit.shape} capo={capo} cut interactive
              onChange={(next) => setEdit((e) => ({ ...e, shape: next }))} />
            <div className="sb-cc-name">
              {reading.sounding < 2
                ? <span className="sb-cc-name-hint">Place a couple of notes to name the shape.</span>
                : reading.best
                  ? <>
                      <span className="sb-cc-name-main">{reading.best.name}</span>
                      {!reading.best.exact && reading.best.missing.length > 0 &&
                        <span className="sb-cc-name-sub"> · {reading.best.missing.join(" & ")} omitted</span>}
                      {reading.alternates.length > 0 &&
                        <span className="sb-cc-name-sub"> · also {reading.alternates.map((n) => n.name).join(" · ")}</span>}
                    </>
                  : <span className="sb-cc-name-hint">No standard name — but these notes are exactly what rings.</span>}
            </div>
            <div className="sb-cc-card-top" style={{ marginTop: 6 }}>
              <span>Notes low→high{capo > 0 ? " (sounding)" : ""}</span>
              <span className="sb-cc-notes">{reading.notes.length ? reading.notes.join(" · ") : "—"}</span>
            </div>
            <div className="sb-cc-btns">
              <button className="sb-cc-btn" onClick={commit} disabled={reading.sounding === 0}>Save for {result.soundingLabel}</button>
              <button className="sb-cc-btn ghost" onClick={() => setEdit(null)}>Cancel</button>
            </div>
          </div>
        )}

        {/* ---- her own shapes, always above anything generated ---- */}
        {!edit && mine.map((s) => (
          <div className="sb-cc-card sb-cc-mine" key={s.id}>
            <div className="sb-cc-card-top">
              <span className="sb-cc-badge">My shape{s.name && s.name !== result.soundingLabel ? " · " + s.name : ""}</span>
              {isTeacher && (
                <span className="sb-cc-rowbtns">
                  <button className="sb-cc-mini" onClick={() => startEdit(s.shape, s.id)}>Edit</button>
                  <button className="sb-cc-mini" onClick={() => remove(s.id)}>Delete</button>
                </span>
              )}
            </div>
            <CutCapoDiagram shape={s.shape} capo={capo} cut />
            <div className="sb-cc-card-top" style={{ marginTop: 6 }}>
              <span>Notes low→high{capo > 0 ? " (sounding)" : ""}</span>
              <span className="sb-cc-notes">{(s.notes || []).join(" · ")}</span>
            </div>
          </div>
        ))}

        {result.status === "unplayable" && !edit && (
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

        {result.status === "ok" && !edit && (
          <>
            {result.reduced && <div className="sb-cc-warn">Shown as the nearest chord the cut-capo engine models; added colour tones are not drawn.</div>}
            {/* A shape the standard chart does not carry is derived by search,
                and may well be one she has never played. Say so, rather than
                letting an unfamiliar diagram look authoritative. */}
            {result.fromChart === false && (
              <div className="sb-cc-warn">Not on the standard chart — best available shape, worked out from the notes.</div>
            )}
            {result.voicings.map((v, i) => (
              <div className={"sb-cc-card" + (v.chartName ? " sb-cc-chart" : "")} key={i}>
                <div className="sb-cc-card-top">
                  <span>
                    {v.chartName
                      ? <><span className="sb-cc-chartname">{v.chartName}</span>{i > 0 ? " · alternate" : ""}</>
                      : (mine.length ? (i === 0 ? "Suggested" : "Alternative") : (i === 0 ? "Best shape" : "Alternative"))}
                  </span>
                  <span>{v.openCount} ringing · {v.frettedCount === 0 ? "no fingers" : v.frettedCount + " fingered"}{v.span > 0 ? " · " + (v.span + 1) + "-fret span" : ""}</span>
                </div>
                {v.chartName && <div className="sb-cc-chartsrc">standard cut capo chart (G7th)</div>}
                <CutCapoDiagram shape={v.shape} capo={capo} cut />
                <div className="sb-cc-card-top" style={{ marginTop: 6 }}>
                  <span>Notes low→high{capo > 0 ? " (sounding)" : ""}</span>
                  <span className="sb-cc-notes">{v.notes.join(" · ")}</span>
                </div>
                {/* The chart's own playing advice — real, and easy to lose. */}
                {v.chartNote && <div className="sb-cc-chartnote">{v.chartNote}</div>}
                {v.alsoReplaces && v.alsoReplaces.length > 0 && (
                  <div className="sb-cc-added">Also the chart's shape for {v.alsoReplaces.join(" and ")}.</div>
                )}
                {v.added && v.added.length > 0 && (
                  <div className="sb-cc-added">Open strings add {v.added.join(" & ")} — the ring a cut capo is for.</div>
                )}
                {isTeacher && (
                  <div className="sb-cc-btns">
                    <button className="sb-cc-btn ghost" onClick={() => startEdit(v.shape, null)}>Use &amp; edit this</button>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {canEdit && !edit && (
          <div className="sb-cc-btns">
            <button className="sb-cc-btn" onClick={() => startEdit(mine.length ? mine[0].shape : [null, null, null, null, null, null], null)}>
              + Pin my own shape for {result.soundingLabel}
            </button>
          </div>
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

  // Planning Center's own running order: the songs of the set that actually
  // have a chart, in the sequence the endpoint returned. Songs with no chart
  // in the library are skipped, since there is nothing to open for them.
  // `planKey` rides along: Planning Center's PLAYING key for that item. The
  // chart PDF is a stale snapshot that never follows a transposition, so PC is
  // the authority on what key the band is actually in.
  const pcSongs = useMemo(() => items
    .map((it) => { const e = it.match.entry; const c = e && pickChart(e, library, serviceId); return c ? { entry: e, chartId: c.id, title: it.match.title, planKey: it.key || null, leader: it.match.leader || null } : null; })
    .filter(Boolean),
    [items, serviceId]);

  // The leader by chartId, so a reordered running order — and a chart opened
  // from it — still knows who is singing. Same shape and reason as
  // planKeyByChart: an override moves songs, it does not change who leads them.
  const leaderByChart = useMemo(() => {
    const m = {};
    pcSongs.forEach((sg) => { if (sg.leader) m[sg.chartId] = sg.leader; });
    return m;
  }, [pcSongs]);

  // ---------------------------------------------------------------------
  // THE PLAN AS PLANNING CENTER GAVE IT — every item, in sequence, each one
  // marked with whether a chart exists for it. This is what the list renders,
  // so a song with no chart keeps its REAL position instead of being dropped
  // and the ones after it renumbered around the hole.
  //
  // The distinction that matters: a plan item that is not a song at all
  // (a header, a media cue, "Intro Worship 2026 (COUNTDOWN)") is not a missing
  // chart — there is nothing to be missing. Only items that look like songs
  // are counted or flagged, so the count answers the question she is actually
  // asking: are my students' songs loaded?
  // ---------------------------------------------------------------------
  const planRows = useMemo(() => items.map((it) => {
    const e = it.match.entry;
    const c = e && pickChart(e, library, serviceId);
    return {
      title: it.match.title,
      leader: it.match.leader || null,
      planKey: it.key || null,
      entry: e || null,
      chartId: c ? c.id : null,
      isSong: looksLikeSong(it),
    };
  }), [items, serviceId]);

  // "5 of 6 songs have charts" — counted over real songs only.
  const chartCount = useMemo(() => {
    const songs = planRows.filter((r) => r.isSong);
    return { have: songs.filter((r) => r.chartId).length, total: songs.length };
  }, [planRows]);

  // Plan key by chartId, so a reordered/overridden running order keeps PC's
  // key: an override moves songs around, it does not change what key PC holds.
  const planKeyByChart = useMemo(() => {
    const m = {};
    pcSongs.forEach((sg) => { if (sg.planKey) m[sg.chartId] = sg.planKey; });
    return m;
  }, [pcSongs]);

  // ---------------------------------------------------------------------
  // OVERRIDE — the room's running order, when rehearsal changed it.
  // Reloaded whenever the service or date changes, so one service's override
  // can never appear under another's.
  // ---------------------------------------------------------------------
  const [override, setOverride] = useState(() => readOverride(serviceId, date));
  const [pcChanged, setPcChanged] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [keyFor, setKeyFor] = useState(null);   // chartId whose key is being set
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [addQuery, setAddQuery] = useState("");
  const [addAt, setAddAt] = useState(0);
  // Bumped whenever a key override is written, so rows re-read localStorage.
  const [keyTick, setKeyTick] = useState(0);

  // ---------------------------------------------------------------------
  // END SONG. The closing song, chosen on a phone during the sermon and
  // picked up here without the iPad being touched. Seeded from localStorage so
  // it renders instantly and offline; refreshed from the server by the poll
  // below. Keyed by service+date, so switching either shows the right one —
  // or none — rather than carrying one service's closer into another.
  // ---------------------------------------------------------------------
  const [endSong, setEndSong] = useState(() => readEndSong(serviceId, date));
  const [endPick, setEndPick] = useState(false);
  const [endQuery, setEndQuery] = useState("");
  // The title of a no-chart row she tapped, so it can explain itself.
  const [noChartNote, setNoChartNote] = useState(null);

  useEffect(() => {
    setOverride(readOverride(serviceId, date));
    // NOTE: pcChanged is deliberately NOT reset here. It is derived below from
    // (override, pcSongs) and owned entirely by that effect. Clearing it here
    // raced the derivation on a cold load — both effects run on mount, this one
    // last — so a page opened fresh with Planning Center already changed showed
    // no notice at all. Found on screen: the override survived, but she was
    // never told PC had moved, which is half the guarantee missing.
    setReordering(false);
    setAddOpen(false);
    setKeyFor(null);
    setAddQuery("");
    setDragIdx(null);
    setDragOver(null);
    // An end song belongs to ONE service on ONE date. Re-seed from that
    // service's own local value — which is null unless one was set for it —
    // so a date change can never show last service's closing song.
    setEndSong(readEndSong(serviceId, date));
    setEndPick(false);
    setEndQuery("");
    setNoChartNote(null);
  }, [serviceId, date]);

  // ---------------------------------------------------------------------
  // THE POLL. This is the whole point of the feature: the iPad is on a stand
  // on stage and she is walking back to it with a guitar. It must already be
  // showing the closing song, so nothing here waits for a tap.
  //
  // Two triggers: coming back to the tab (the common case — the screen was
  // asleep or she was in another app), and a gentle interval while a set is
  // open. The interval is deliberately slack: this is one small row, and a
  // stage device on church wifi should not be chattering.
  //
  // OFFLINE. fetchEndSong resolves undefined on any failure, and undefined
  // means "could not tell" — only an explicit null clears the local value. So
  // with no network the row simply keeps whatever it had and nothing errors.
  // The queue is flushed on the same triggers, so a choice made offline goes
  // out as soon as there is a connection again.
  // ---------------------------------------------------------------------
  const END_POLL_MS = 20000;
  useEffect(() => {
    if (!serviceId || !date) return;
    let dead = false;
    const sync = async () => {
      if (dead) return;
      await flushEndSongQueue();
      if (dead) return;
      const row = await fetchEndSong(serviceId, date);
      if (dead || row === undefined) return;   // offline / unreachable: keep what we have
      setEndSong((prev) => {
        const same = (!prev && !row) || (prev && row && prev.chartId === row.chartId &&
          (prev.key || null) === (row.key || null) && prev.updatedAt === row.updatedAt);
        if (same) return prev;                 // no churn when nothing changed
        writeEndSongLocal(serviceId, date, row);
        return row;
      });
    };
    sync();
    const iv = setInterval(sync, END_POLL_MS);
    const onVis = () => { if (document.visibilityState === "visible") sync(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", sync);
    window.addEventListener("focus", onVis);
    return () => {
      dead = true;
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", sync);
      window.removeEventListener("focus", onVis);
    };
  }, [serviceId, date]);

  // Set or clear it. The local write inside setEndSong lands first, so this
  // device updates immediately whether or not the network is there.
  const chooseEndSong = useCallback((entry, chartId) => {
    const chart = library.charts[chartId];
    if (!chart) return;
    const row = { chartId, entryId: entry.id, title: chart.names.primary, key: null, updatedAt: new Date().toISOString() };
    setEndSong(row);
    setEndPick(false);
    setEndQuery("");
    setEndSongRemote(serviceId, date, row);
  }, [serviceId, date]);

  const clearEndSong = useCallback(() => {
    setEndSong(null);
    setEndSongRemote(serviceId, date, null);
  }, [serviceId, date]);

  // A song the override references, resolved back to a live library entry.
  // Anything that no longer resolves is dropped rather than rendered broken.
  const resolveItem = useCallback((it) => {
    const chart = library.charts[it.chartId];
    if (!chart) return null;
    const entry = library.songs.find((sg) => sg.charts.includes(it.chartId));
    if (!entry) return null;
    return { entry, chartId: it.chartId, title: it.title || chart.names.primary, added: !!it.added, planKey: planKeyByChart[it.chartId] || null };
  }, [planKeyByChart]);

  // THE running order. Everything downstream — the list, the swipe navigation,
  // prev/next — reads this one value, so an override cannot be applied to the
  // display and forgotten by the navigation.
  const setSongs = useMemo(() => {
    if (!override) return pcSongs;
    return override.items.map(resolveItem).filter(Boolean);
  }, [override, pcSongs, resolveItem]);

  // The end song is the last song of the service, so once one is chosen it is
  // part of THE running order like any other: the swipe reaches it and the
  // position indicator counts it. It is appended rather than stored in the
  // override, because it is not a rehearsal decision about the plan — it is a
  // different device's live choice, and the two must not overwrite each other.
  const endSongRow = useMemo(() => {
    if (!endSong || !endSong.chartId) return null;
    const chart = library.charts[endSong.chartId];
    if (!chart) return null;                       // an id this build does not know
    const entry = library.songs.find((sg) => sg.charts.includes(endSong.chartId));
    if (!entry) return null;
    return { entry, chartId: endSong.chartId, title: endSong.title || chart.names.primary, isEnd: true, planKey: null, leader: null };
  }, [endSong]);

  // What the list renders and the swipe walks. One value, so they cannot
  // disagree about what the set is or how long it is.
  const runOrder = useMemo(() => (endSongRow ? [...setSongs, endSongRow] : setSongs), [setSongs, endSongRow]);

  // ---------------------------------------------------------------------
  // THE LIST, WITH ITS HOLES. Rows in the order they are actually played,
  // each carrying the position number it really has.
  //
  // On Planning Center's own order, a song with no chart stays exactly where
  // PC put it and keeps its number: dropping it, or renumbering around it,
  // would tell her the set is complete when it is not. Once she has taken the
  // order over with an override, the running order is hers and a row with
  // nothing to open has no place in it — so the holes appear only while the
  // list is still PC's.
  //
  // Position numbering counts songs only. A countdown is not song 1.
  // ---------------------------------------------------------------------
  const displayRows = useMemo(() => {
    const rows = [];
    let n = 0;
    if (!override) {
      planRows.forEach((r, i) => {
        if (!r.isSong && !r.chartId) return;               // not a song: not part of the count at all
        n += 1;
        if (r.chartId) {
          const sg = setSongs.find((x) => x.chartId === r.chartId && x.entry === r.entry);
          rows.push({ kind: "song", pos: n, sg: sg || { entry: r.entry, chartId: r.chartId, title: r.title, planKey: r.planKey, leader: r.leader }, key: "p" + i });
        } else {
          rows.push({ kind: "nochart", pos: n, title: r.title, leader: r.leader, key: "n" + i });
        }
      });
    } else {
      setSongs.forEach((sg, i) => { n += 1; rows.push({ kind: "song", pos: n, sg, key: "o" + i }); });
    }
    if (endSongRow) rows.push({ kind: "song", pos: n + 1, sg: endSongRow, isEnd: true, key: "end" });
    return rows;
  }, [override, planRows, setSongs, endSongRow]);

  // Did Planning Center change under an active override? Compared against the
  // basis the override was BUILT on, never against the previous render, so a
  // background refetch of an unchanged set stays silent.
  useEffect(() => {
    if (!override || !setData) { setPcChanged(false); return; }
    setPcChanged(basisDiffers(override.basis, basisOf(pcSongs)));
  }, [override, pcSongs, setData]);

  // Write an override built from the CURRENT running order plus one edit.
  // The basis is always what PC says right now, so accepting a PC change and
  // then reordering does not immediately re-flag as changed.
  const commitOrder = useCallback((nextSongs) => {
    const itemsOut = nextSongs.map((sg) => ({ chartId: sg.chartId, entryId: sg.entry.id, title: sg.title, added: !!sg.added }));
    writeOverride(serviceId, date, itemsOut, basisOf(pcSongs));
    setOverride(readOverride(serviceId, date));
  }, [serviceId, date, pcSongs]);

  const moveSong = useCallback((from, to) => {
    if (to < 0 || to >= setSongs.length || from === to) return;
    const next = setSongs.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    commitOrder(next);
  }, [setSongs, commitOrder]);

  const removeSong = useCallback((idx) => {
    const next = setSongs.slice();
    next.splice(idx, 1);
    commitOrder(next);
  }, [setSongs, commitOrder]);

  // Insert a library song at a position. `at` of -1 means append.
  const addSong = useCallback((entry, chartId, at) => {
    const chart = library.charts[chartId];
    if (!chart) return;
    const row = { entry, chartId, title: chart.names.primary, added: true };
    const next = setSongs.slice();
    if (at == null || at < 0 || at > next.length) next.push(row);
    else next.splice(at, 0, row);
    commitOrder(next);
    setAddOpen(false);
  }, [setSongs, commitOrder]);

  // Back to Planning Center: the order, the added and removed songs, and the
  // key overrides for every chart in play. Capo settings are deliberately left
  // alone — a capo is a fact about the guitar, not about the set.
  const resetToPlanningCenter = useCallback(() => {
    const touched = [...new Set([...pcSongs.map((sg) => sg.chartId), ...setSongs.map((sg) => sg.chartId)])];
    clearKeyOverrides(touched);
    clearOverride(serviceId, date);
    setOverride(null);
    setPcChanged(false);
    setReordering(false);
    setKeyTick((t) => t + 1);
  }, [serviceId, date, pcSongs, setSongs]);

  // Adopt whatever Planning Center now says, discarding the override. Only
  // ever called from the notice, by an explicit tap.
  const acceptPlanningCenter = useCallback(() => {
    clearOverride(serviceId, date);
    setOverride(null);
    setPcChanged(false);
  }, [serviceId, date]);

  // Any key override in force on the current running order?
  const anyKeyOverride = useMemo(() => {
    void keyTick;
    return setSongs.some((sg) => !!readKeyOverride(sg.chartId));
  }, [setSongs, keyTick]);

  const addResults = useMemo(() => (addQuery.trim().length >= 2 ? search(index, addQuery).slice(0, 40) : []), [index, addQuery]);
  const endResults = useMemo(() => (endQuery.trim().length >= 2 ? search(index, endQuery).slice(0, 40) : []), [index, endQuery]);

  const setKeyForChart = useCallback((chartId, name) => {
    writeKeyOverride(chartId, name);
    setKeyTick((t) => t + 1);
    setKeyFor(null);
  }, []);

  /**
   * Quick-load: open another song's full chart, replacing the current view.
   *
   * Whether set navigation survives is decided by the SET, not by where the
   * tap came from: a song that is on today's running order opens as part of
   * it and keeps prev/next and the swipe, and one that is not opens
   * standalone — exactly how a song opened from search behaves today. The
   * lookup is by entry, matching how navIndex is derived, so a song opened in
   * its other language still lands in the right slot.
   */
  const loadWholeSong = useCallback((entry, chartId) => {
    const onSet = runOrder.some((s) => s.entry === entry);
    setOpen({ entry, chartId, fromSet: onSet });
  }, [runOrder]);

  if (open) {
    // Position is found by entry, so switching language/version inside a song
    // keeps the same slot in the set.
    // The END SONG is located by chartId, not by entry: it is appended after
    // the plan, so a song that is both in the plan and chosen as the closer
    // would otherwise always resolve to its first slot and the swipe could
    // never reach the last one.
    const navIndex = open.fromSet
      ? (open.isEnd
        ? runOrder.findIndex((s) => s.isEnd && s.chartId === open.chartId)
        : runOrder.findIndex((s) => s.entry === open.entry))
      : -1;
    // The indicator must stay HONEST about the set: navigation skips songs
    // with no chart, but the set is still as long as it is. So the list the
    // swipe walks is the openable songs, while the numbers shown come from the
    // real running order — "2 of 4", not "2 of 3", when song 2 of 4 is open
    // and one of the four cannot be opened.
    const navRow = navIndex >= 0 ? runOrder[navIndex] : null;
    const truePos = navRow ? (displayRows.find((r) => r.kind === "song" && r.sg === navRow) || {}).pos : null;
    const setNav = navIndex >= 0
      ? { list: runOrder, index: navIndex, showPos: truePos || navIndex + 1, showTotal: displayRows.length }
      : null;
    return (
      <><style>{S}</style><div className="sb sb-fixed">
        {/* planKey is looked up by chartId, not by the row that was tapped, so
            swiping through the set and switching charts inside a song both keep
            Planning Center's key. A song opened from SEARCH has no plan context
            and gets null — it keeps using the chart's own key, as before. */}
        <ChartView entry={open.entry} chartId={open.chartId} fromSet={open.fromSet} setNav={setNav} planKey={open.fromSet ? (planKeyByChart[open.chartId] || null) : null} leader={open.fromSet && !open.isEnd ? (leaderByChart[open.chartId] || null) : null} index={index} serviceTypeId={serviceId} prefs={prefs} setPrefs={setPrefs} onKeepAlive={onKeepAlive} isTeacher={isTeacher} instrument={instrument}
          onNavigate={(t) => setOpen({ entry: t.entry, chartId: t.chartId, fromSet: true, isEnd: !!t.isEnd })}
          onLoadWhole={loadWholeSong}
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

      {/* Planning Center moved under an active override. Non-blocking by
          design: it tells her and waits, because discarding a rehearsal
          decision on her behalf mid-service is the failure this guards. */}
      {pcChanged && (
        <div className="sb-pc-notice">
          <span><b>Planning Center changed.</b> Your rehearsal order is still what is showing.</span>
          <button className="sb-ov-btn" onClick={acceptPlanningCenter}>Load from Planning Center</button>
          <button className="sb-ov-btn" onClick={() => setPcChanged(false)}>Keep mine</button>
        </div>
      )}

      {/* Override controls. Teacher only: students read the set, they do not
          rewrite the running order for the room. */}
      {isTeacher && !query.trim() && (
        <div className="sb-ov-bar">
          {(override || anyKeyOverride) && (
            <span className="sb-ov-flag"><span className="dot" />
              {override && anyKeyOverride ? "Custom order · key changed"
                : override ? "Custom order" : "Key changed"}
            </span>
          )}
          <button className={"sb-ov-btn" + (reordering ? " on" : "")} onClick={() => setReordering((v) => !v)}>
            {reordering ? "Done" : "Edit set"}
          </button>
          {reordering && <button className="sb-ov-btn" onClick={() => setAddOpen(true)}>+ Add song</button>}
          {(override || anyKeyOverride) && (
            <button className="sb-ov-btn danger" onClick={resetToPlanningCenter}>Reset to Planning Center</button>
          )}
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
          {/* How many of today's songs she can actually open. The question she
              is really asking before a service: are my students' songs loaded?
              Counted over real songs only, so a countdown never drags it down. */}
          {chartCount.total > 0 && (
            <div className="sb-chartcount">
              {chartCount.have === chartCount.total
                ? chartCount.total + (chartCount.total === 1 ? " song, chart loaded" : " songs, all charts loaded")
                : chartCount.have + " of " + chartCount.total + " songs have charts"}
            </div>
          )}
          {/* THE running order — displayRows, so the list and the swipe
              navigation can never disagree about what order the set is in, and
              a song with no chart keeps the position it really has. */}
          {displayRows.map((row) => {
            // A song Planning Center listed that has no chart here. It stays in
            // set order with its real number — never dropped, never renumbered
            // around — and does nothing when tapped, because there is no chart
            // to open and an empty chart view is worse than an honest one.
            if (row.kind === "nochart") return (
              <div className="sb-item nochart" key={row.key}
                title="Planning Center lists this song, but there is no chart for it in the library yet."
                onClick={() => setNoChartNote(row.title)}>
                <span className="sb-num">{row.pos}</span>
                <div style={{ flex: 1 }}>
                  <div className="sb-item-title">{row.title}</div>
                  {row.leader && <div className="sb-item-sub sb-item-leader">{row.leader}</div>}
                </div>
                <span className="sb-nochart-tag">NO CHART</span>
              </div>
            );
            const sg = row.sg;
            const i = row.pos - 1;
            const chart = library.charts[sg.chartId];
            const ovKey = (void keyTick, readKeyOverride(sg.chartId));
            // With no playing-key override the row shows the chart's own key —
            // corrected, if detection had read the chart itself wrong.
            const ownKey = readChartKeyOverride(sg.chartId) || (chart && chart.key ? chart.key.tonic + (chart.key.mode === "minor" ? "m" : "") : null);
            // Same precedence as the chart view — her override, then Planning
            // Center, then the chart — and the same relative-minor correction:
            // PC naming the 6- of the chart's key is agreeing with the chart,
            // not transposing it, so the row keeps showing the chart's key.
            const rowWritten = parseKeyName(readChartKeyOverride(sg.chartId)) || (chart ? chart.key : null);
            const rowPlan = resolvePlanKey(sg.planKey, rowWritten);
            const shownKey = ovKey || (rowPlan ? keyName({ ...rowPlan, mode: rowWritten ? rowWritten.mode : rowPlan.mode }) : null) || ownKey;
            const alts = [sg.entry.pt, sg.entry.en].filter((n) => n && n !== sg.title).join(" · ");
            // Reorder acts on setSongs, so it uses that list's own index. The
            // two only differ where holes exist, and holes only exist on PC's
            // order — which is exactly when reordering is off.
            const oi = setSongs.indexOf(sg);
            const isEnd = !!row.isEnd;
            return (
              <div key={row.key}
                className={"sb-item" + (isEnd ? " sb-endsong" : "") + (dragIdx === oi ? " dragging" : "") + (dragOver === oi ? " dragover" : "")}
                draggable={reordering && !isEnd}
                onDragStart={reordering && !isEnd ? () => setDragIdx(oi) : undefined}
                onDragOver={reordering && !isEnd ? (ev) => { ev.preventDefault(); setDragOver(oi); } : undefined}
                onDrop={reordering && !isEnd ? (ev) => { ev.preventDefault(); if (dragIdx != null) moveSong(dragIdx, oi); setDragIdx(null); setDragOver(null); } : undefined}
                onDragEnd={reordering && !isEnd ? () => { setDragIdx(null); setDragOver(null); } : undefined}>
                <span className="sb-num">{row.pos}</span>
                <div style={{ flex: 1, cursor: reordering && !isEnd ? "default" : "pointer" }}
                  onClick={() => { if (!reordering || isEnd) setOpen({ entry: sg.entry, chartId: sg.chartId, fromSet: true, isEnd }); }}>
                  <div className="sb-item-title">{sg.title}
                    {sg.added && <span className="sb-item-added">ADDED</span>}
                    {isEnd && <span className="sb-endsong-tag">END SONG</span>}
                  </div>
                  {/* Who is singing it, quietly: secondary to the title, and
                      never mistaken for the song's other-language name. */}
                  {sg.leader
                    ? <div className="sb-item-sub sb-item-leader">{sg.leader}{alts ? " · " + alts : ""}</div>
                    : <div className="sb-item-sub">{alts}</div>}
                </div>

                {/* The key, always visible while running the set, and tappable
                    to change it without opening the song first. */}
                <button className={"sb-key-btn" + (ovKey ? " changed" : "")}
                  title={ovKey ? "Playing in " + ovKey + " today (chart is written in " + (ownKey || "?") + ")" : "Set the key this song is played in"}
                  onClick={(ev) => { ev.stopPropagation(); setKeyFor(keyFor === sg.chartId ? null : sg.chartId); }}>
                  {shownKey || "—"}
                </button>

                {isEnd ? (
                  <button className="sb-endsong-clear" title="Clear the end song"
                    onClick={(ev) => { ev.stopPropagation(); clearEndSong(); }}>Clear</button>
                ) : reordering ? (
                  <span className="sb-row-edit">
                    <button className="sb-move" disabled={oi === 0} title="Move up"
                      onClick={(ev) => { ev.stopPropagation(); moveSong(oi, oi - 1); }}>↑</button>
                    <button className="sb-move" disabled={oi === setSongs.length - 1} title="Move down"
                      onClick={(ev) => { ev.stopPropagation(); moveSong(oi, oi + 1); }}>↓</button>
                    <button className="sb-move rm" title="Remove from today's set"
                      onClick={(ev) => { ev.stopPropagation(); removeSong(oi); }}>✕</button>
                  </span>
                ) : (
                  chart && <span className="sb-item-lang">{chart.lang.toUpperCase()}</span>
                )}
              </div>
            );
          })}

          {/* Songs with no chart are no longer listed down here: they are
              rendered above, in set order, holding their real position number.
              A hole in the middle of the set is the fact she needs to see. */}

          {/* THE END SONG SLOT. Always present while a set is open, so there is
              somewhere obvious for the closing song to land. Dashed and set
              apart, because it is NOT part of the Planning Center plan — it is
              chosen live, often from another device. */}
          {(setData || endSongRow) && !endSongRow && (
            <div className="sb-item sb-endsong" onClick={() => setEndPick(true)}>
              <span className="sb-num">END</span>
              <div style={{ flex: 1 }}>
                <div className="sb-item-title sb-endsong-empty">End song — tap to choose</div>
                <div className="sb-item-sub">Picked here or from a phone; it appears on every device.</div>
              </div>
            </div>
          )}

          {/* Choosing the end song: the same library search as everywhere else. */}
          {endPick && (
            <div className="sb-modal" role="dialog" aria-modal="true" onClick={() => setEndPick(false)}>
              <div className="sb-sheet" onClick={(ev) => ev.stopPropagation()}>
                <div className="sb-sheet-top">
                  <span className="sb-sheet-name">End song</span>
                  <span className="sb-sheet-sub">the closing song for this service</span>
                  <button className="sb-sheet-close" onClick={() => setEndPick(false)}>Close</button>
                </div>
                <div style={{ marginTop: 10 }}>
                  <input type="search" autoFocus placeholder="Search the library…" value={endQuery}
                    onChange={(ev) => setEndQuery(ev.target.value)} />
                </div>
                <div className="sb-add-list">
                  {endResults.length === 0 && <div className="sb-empty">{endQuery.trim().length < 2 ? "Type to search all " + library.songs.length + " songs." : "No chart matches “" + endQuery + "”."}</div>}
                  {endResults.map((r, i) => (
                    <button className="sb-item" key={i} onClick={() => chooseEndSong(r.entry, r.chart.id)}>
                      <div style={{ flex: 1 }}>
                        <div className="sb-item-title">{r.chart.names.primary}</div>
                        <div className="sb-item-sub">{r.chart.artist}</div>
                      </div>
                      <span className="sb-item-lang">{r.chart.lang.toUpperCase()}</span>
                    </button>
                  ))}
                </div>
                <div className="sb-sheet-note" style={{ marginTop: 10 }}>
                  Chosen here or on a phone — it appears on every device showing this service. Works offline too: the choice is kept and sent when there is a connection again.
                </div>
              </div>
            </div>
          )}

          {/* A tapped song with no chart says why, rather than opening an
              empty view or doing nothing at all. */}
          {noChartNote && (
            <div className="sb-modal" role="dialog" aria-modal="true" onClick={() => setNoChartNote(null)}>
              <div className="sb-sheet" onClick={(ev) => ev.stopPropagation()}>
                <div className="sb-sheet-top">
                  <span className="sb-sheet-name">{noChartNote}</span>
                  <span className="sb-sheet-sub">no chart yet</span>
                  <button className="sb-sheet-close" onClick={() => setNoChartNote(null)}>Close</button>
                </div>
                <div className="sb-sheet-note" style={{ marginTop: 10 }}>
                  Planning Center has this song on today's plan, but there is no chart for it in the library yet, so there is nothing to open. It keeps its place in the running order so the set still reads true.
                </div>
              </div>
            </div>
          )}

          {/* Key picker for one row: the key the band PLAYS it in today. Same
              vocabulary as the chart view, writing the SAME
              songbook_key_<chartId>, so a key set here and one set in the
              chart are one fact. It never touches the numbers. */}
          {keyFor && (
            <div className="sb-modal" role="dialog" aria-modal="true" onClick={() => setKeyFor(null)}>
              <div className="sb-sheet" onClick={(ev) => ev.stopPropagation()}>
                <div className="sb-sheet-top">
                  <span className="sb-sheet-name">{(library.charts[keyFor] || {}).names ? library.charts[keyFor].names.primary : "Key"}</span>
                  <span className="sb-sheet-sub">key for today</span>
                  <button className="sb-sheet-close" onClick={() => setKeyFor(null)}>Close</button>
                </div>
                <div className="sb-chips" style={{ marginTop: 10 }}>
                  {KEY_LIST.map((k) => (
                    <button key={k} className={"sb-chip" + (readKeyOverride(keyFor) === k ? " on" : "")}
                      onClick={() => setKeyForChart(keyFor, k)}>{k}</button>
                  ))}
                  {KEY_LIST.map((k) => (
                    <button key={k + "m"} className={"sb-chip" + (readKeyOverride(keyFor) === k + "m" ? " on" : "")}
                      onClick={() => setKeyForChart(keyFor, k + "m")}>{k}m</button>
                  ))}
                </div>
                {readKeyOverride(keyFor) && (
                  <div style={{ marginTop: 12 }}>
                    <button className="sb-ov-btn" onClick={() => setKeyForChart(keyFor, null)}>
                      Reset to the chart's own key{readChartKeyOverride(keyFor) ? " (" + readChartKeyOverride(keyFor) + ")" : library.charts[keyFor] && library.charts[keyFor].key ? " (" + library.charts[keyFor].key.tonic + ")" : ""}
                    </button>
                  </div>
                )}
                <div className="sb-sheet-note" style={{ marginTop: 10 }}>
                  This is the key the band plays it in. The Nashville numbers do not change — a song's numbers are its structure — only the letters they resolve to. The capo setting is separate and is not changed here.
                </div>
              </div>
            </div>
          )}

          {/* Add a library song into the running order, at a chosen position. */}
          {addOpen && (
            <div className="sb-modal" role="dialog" aria-modal="true" onClick={() => setAddOpen(false)}>
              <div className="sb-sheet" onClick={(ev) => ev.stopPropagation()}>
                <div className="sb-sheet-top">
                  <span className="sb-sheet-name">Add a song</span>
                  <span className="sb-sheet-sub">into today's set</span>
                  <button className="sb-sheet-close" onClick={() => setAddOpen(false)}>Close</button>
                </div>
                <div className="sb-pos-row">
                  <span>Insert at</span>
                  <select value={addAt} onChange={(ev) => setAddAt(Number(ev.target.value))}>
                    {setSongs.map((_, i) => <option key={i} value={i}>position {i + 1}</option>)}
                    <option value={-1}>the end</option>
                  </select>
                </div>
                <div style={{ marginTop: 10 }}>
                  <input type="search" autoFocus placeholder="Search the library…" value={addQuery}
                    onChange={(ev) => setAddQuery(ev.target.value)} />
                </div>
                <div className="sb-add-list">
                  {addResults.length === 0 && <div className="sb-empty">{addQuery.trim().length < 2 ? "Type to search all " + library.songs.length + " songs." : "No chart matches “" + addQuery + "”."}</div>}
                  {addResults.map((r, i) => (
                    <button className="sb-item" key={i} onClick={() => addSong(r.entry, r.chart.id, addAt)}>
                      <div style={{ flex: 1 }}>
                        <div className="sb-item-title">{r.chart.names.primary}</div>
                        {r.chart.names.alts.length > 0 && <div className="sb-item-sub">{r.chart.names.alts.join(" / ")}</div>}
                      </div>
                      <span className="sb-item-lang">{r.chart.lang.toUpperCase()}{r.chart.key ? " · " + r.chart.key.tonic : ""}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="sb-muted" style={{ marginTop: 16 }}>{library.songs.length} songs · {Object.keys(library.charts).length} charts on this device</div>
    </div></div></>
  );
}
