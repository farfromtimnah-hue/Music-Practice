import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import library from "./library.json";
import { buildSearchIndex, search } from "./search.js";
import { matchSetItem, pickChart } from "./match.js";
import { SERVICE_TYPES, STUDENT_SERVICE_IDS, defaultDateFor, readCachedSet, fetchSet, sameSongs } from "./setStore.js";
import { toNashville, keyLegend, capoLabel, keyName, parseKeyName, transposedKeyName, KEY_LIST } from "./chords.js";
import { abbreviationsFor } from "./sections.js";
import { cutCapoVoicingsFor, normalizeCapoSetting, DEFAULT_CAPO } from "./cutcapoAdapter.js";
import CutCapoDiagram from "./CutCapoDiagram.jsx";

// ============================================================
// STORAGE — songbook_ keys only. Never touches c5Log.
// ============================================================
const lsGet = (k, fallback) => { try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } };
const PREFS_KEY = "songbook_prefs";

const S = `
.sb{background:#000;color:#fff;min-height:100vh;font-family:'Source Sans 3',sans-serif;padding-bottom:40px;}
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
.sb-chart-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:6px;}
.sb-title{font-family:'Oswald',sans-serif;font-size:22px;color:#fff;line-height:1.15;}
.sb-alt{font-size:14px;color:#8888aa;margin-top:2px;}
.sb-meta{font-size:12px;color:#8888aa;margin-top:4px;}
.sb-key{text-align:right;white-space:nowrap;}
.sb-key-main{font-family:'Oswald',sans-serif;font-size:18px;color:var(--gold,#f0c040);background:none;border:1px solid #2a2a40;border-radius:10px;padding:6px 10px;cursor:pointer;}
.sb-legend{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end;margin-top:6px;}
.sb-legend span{font-size:12px;color:#ccc;background:#0e0e16;border:1px solid #2a2a40;border-radius:6px;padding:2px 6px;}
.sb-legend span b{color:var(--gold,#f0c040);}
.sb-tools{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0;}
.sb-tool{border:1px solid #2a2a40;background:#0e0e16;color:#aaa;border-radius:8px;padding:6px 10px;font-size:13px;cursor:pointer;font-family:inherit;}
.sb-tool.on{color:var(--gold,#f0c040);border-color:var(--gold,#f0c040);}
.sb-notice{background:#0b1a2e;border:1px solid #1e3a5f;color:#cfe3ff;border-radius:10px;padding:10px 12px;font-size:13px;margin:8px 0;display:flex;gap:10px;align-items:center;flex-wrap:wrap;}
.sb-notice .sb-tool{color:#cfe3ff;border-color:#1e3a5f;}
.sb-map{display:flex;flex-wrap:wrap;gap:4px 6px;align-items:center;margin:8px 0 14px;font-size:14px;color:#8fa3c7;}
.sb-map .sb-map-item{background:#0b1226;border:1px solid #1c2a4a;border-radius:6px;padding:2px 8px;white-space:nowrap;}
.sb-map .sb-map-item.x{color:#5d6f95;border-style:dashed;}
.sb-block{margin:0 0 18px;border-left:3px solid #14213d;padding-left:10px;position:relative;}
.sb-block.drag{opacity:.5;}
.sb-block-label{font-family:'Oswald',sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#4a6da7;margin-bottom:6px;display:flex;align-items:center;gap:8px;}
.sb-handle{margin-left:auto;display:flex;gap:4px;}
.sb-handle button{border:1px solid #2a2a40;background:#0e0e16;color:#aaa;border-radius:6px;padding:2px 8px;font-size:14px;cursor:pointer;touch-action:none;}
.sb-line{display:flex;flex-wrap:wrap;align-items:flex-end;margin:0 0 2px;line-height:1.25;}
.sb-seg{display:inline-flex;flex-direction:column;white-space:pre;}
.sb-chord{font-family:'Oswald',sans-serif;font-weight:700;font-size:20px;color:var(--gold,#f0c040);min-height:24px;padding-right:8px;}
.sb-chord small{font-size:12px;color:#c9b06a;font-weight:400;}
.sb-txt{font-size:18px;color:#fff;min-height:22px;}
.sb-gloss{font-size:12px;color:#7a7a99;letter-spacing:.5px;margin:0 0 8px;text-transform:uppercase;}
.sb-empty{color:#8888aa;font-size:14px;padding:20px 0;text-align:center;}
/* capo control + cut-capo chord popup (teacher only) */
.sb-capo{display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:flex-end;margin-top:6px;}
.sb-capo select{padding:5px 8px;font-size:13px;}
.sb-chord.tappable{cursor:pointer;}
.sb-chord.tappable:hover{text-decoration:underline;}
.sb-cc-hint{font-size:12px;color:#8888aa;margin:-4px 0 10px;}
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
@media (max-width:480px){.sb-chord{font-size:18px;}.sb-txt{font-size:16px;}.sb-title{font-size:19px;}}
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
// CHART VIEW
// ============================================================
function ChartView({ entry, chartId, fromSet, serviceTypeId, onBack, onSwitchChart, prefs, setPrefs, onKeepAlive, isTeacher }) {
  const chart = library.charts[chartId];
  const detected = chart.key;
  const [keyOverride, setKeyOverride] = useState(() => lsGet("songbook_key_" + chartId, null));
  const [noticeDismissed, setNoticeDismissed] = useState(() => lsGet("songbook_notice_" + chartId, false));
  const [customOrder, setCustomOrder] = useState(() => lsGet("songbook_order_" + chartId, null));
  const [editing, setEditing] = useState(false);
  const [pickKey, setPickKey] = useState(false);
  // Cut capo is Nicole's own tool: teacher only, never offered to students.
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

  const setCapo = (next) => { const v = normalizeCapoSetting(next); setCapoState(v); lsSet("songbook_capo_" + chartId, v); if (v.mode !== "cut") setTapped(null); };
  // Students never get cut capo, so a stale saved setting cannot leak into their view.
  const cutCapoMode = isTeacher && capo.mode === "cut";

  // Header key label. A full capo shows the fingering key in parentheses; a cut
  // capo deliberately does not, because it raises only three strings and does
  // not transpose the instrument, so no single fingering key would be true.
  const keyHeader = () => {
    if (!key) return "Key: ?";
    if (cutCapoMode) return "Key: " + keyName(key) + " - Cut capo";
    if (isTeacher && capo.mode === "full") {
      return capo.fret > 0
        ? "Key: " + keyName(key) + " - Capo " + capo.fret + " (" + transposedKeyName(key, -capo.fret) + ")"
        : "Key: " + keyName(key) + " - No capo";
    }
    if (isTeacher && capo.mode === "none") return "Key: " + keyName(key) + " - No capo";
    return capoLabel(key);
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

  return (
    <div className="sb-wrap">
      <div className="sb-top">
        <button className="sb-back" onClick={onBack}>← Back</button>
        <h1>{fromSet ? "This Week" : "Library"}</h1>
      </div>
      <div className="sb-chart-head">
        <div>
          <div className="sb-title">{chart.lang === "pt" ? (chart.ptName || chart.names.primary) : (chart.enName || chart.names.primary)}</div>
          {(chart.lang === "pt" ? chart.enName : chart.ptName) && <div className="sb-alt">{chart.lang === "pt" ? chart.enName : chart.ptName}</div>}
          <div className="sb-meta">{chart.artist}{chart.tempo ? " · " + chart.tempo + " bpm" : ""}{chart.time ? " · " + chart.time : ""}</div>
        </div>
        <div className="sb-key">
          <button className="sb-key-main" onClick={() => setPickKey((v) => !v)} title="Tap to change key">{keyHeader()}</button>
          {pickKey && (
            <div className="sb-legend" style={{ justifyContent: "flex-end" }}>
              <select value={key ? keyName(key) : ""} onChange={(e) => { const v = e.target.value; setKeyOverride(v); lsSet("songbook_key_" + chartId, v); setPickKey(false); }}>
                {KEY_LIST.flatMap((k) => [k, k + "m"]).map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              {keyOverride && <button className="sb-tool" onClick={() => { setKeyOverride(null); lsSet("songbook_key_" + chartId, null); setPickKey(false); }}>Reset to {detected ? detected.tonic : "?"}</button>}
            </div>
          )}
          {prefs.legend && key && <div className="sb-legend">{keyLegend(key).map((l) => <span key={l.degree}><b>{l.degree}</b> = {l.name}</span>)}</div>}
          {keyOverride && !pickKey && <div className="sb-muted" style={{ marginTop: 4 }}>key set manually</div>}
          {isTeacher && (
            <div className="sb-capo">
              <select value={capo.mode} onChange={(e) => setCapo({ mode: e.target.value, fret: e.target.value === "cut" ? 2 : capo.fret })} title="Capo mode">
                <option value="none">No capo</option>
                <option value="full">Full capo</option>
                <option value="cut">Cut capo</option>
              </select>
              {capo.mode === "full" && (
                <select value={capo.fret} onChange={(e) => setCapo({ mode: "full", fret: Number(e.target.value) })} title="Capo fret">
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((f) => <option key={f} value={f}>{f === 0 ? "fret 0" : "fret " + f}</option>)}
                </select>
              )}
            </div>
          )}
        </div>
      </div>

      {showNotice && (
        <div className="sb-notice">
          <span>Auto-corrected from <b>{detected.relativeMinor}</b> to <b>{detected.tonic} major</b>. This chart leans on the 6- chord (the pattern Planning Center labels as minor) but its cadences land on {detected.tonic}.</span>
          <button className="sb-tool" onClick={() => { setKeyOverride(detected.relativeMinor); lsSet("songbook_key_" + chartId, detected.relativeMinor); }}>Use {detected.relativeMinor}</button>
          <button className="sb-tool" onClick={() => { setNoticeDismissed(true); lsSet("songbook_notice_" + chartId, true); }}>OK</button>
        </div>
      )}

      <div className="sb-tools">
        {langs.length > 1 && langs.map((l) => (
          <button key={l} className={"sb-tool" + (chart.lang === l ? " on" : "")} onClick={() => { const c = charts.find((x) => x.lang === l); if (c) onSwitchChart(c.id); }}>{l.toUpperCase()}</button>
        ))}
        {sameLang.length > 1 && sameLang.map((c, i) => (
          <button key={c.id} className={"sb-tool" + (c.id === chartId ? " on" : "")} onClick={() => onSwitchChart(c.id)}>Version {i + 1}{c.key ? " · " + c.key.tonic : ""}</button>
        ))}
        <button className={"sb-tool" + (prefs.legend ? " on" : "")} onClick={() => setPrefs({ ...prefs, legend: !prefs.legend })}>Legend</button>
        {chart.glossCount > 0 && <button className={"sb-tool" + (prefs.gloss !== false ? " on" : "")} onClick={() => setPrefs({ ...prefs, gloss: prefs.gloss === false })}>Gloss</button>}
        {!chart.abbrevCollision && <button className={"sb-tool" + (prefs.roadmapFull ? " on" : "")} onClick={() => setPrefs({ ...prefs, roadmapFull: !prefs.roadmapFull })}>{prefs.roadmapFull ? "Full labels" : "Letters"}</button>}
        <button className={"sb-tool" + (editing ? " on" : "")} onClick={() => setEditing((v) => !v)}>{editing ? "Done" : "Reorder"}</button>
        {customOrder && <button className="sb-tool" onClick={() => { saveOrder(null); setCustomOrder(null); try { localStorage.removeItem("songbook_order_" + chartId); } catch (e) { /* ignore */ } }}>Reset order</button>}
      </div>

      <div className="sb-map">
        {roadmap.map((r, i) => {
          const b = r.block != null ? chart.blocks.find((x) => x.id === r.block) : null;
          const label = b ? (useFull ? labelOf(b) : abbr.map[b.name]) : r.label;
          return <span key={i} className={"sb-map-item" + (b ? "" : " x")}>{label}{r.times > 1 ? " ×" + r.times : ""}</span>;
        })}
      </div>

      {cutCapoMode && <div className="sb-cc-hint">Cut capo at fret 2 (A, D and G strings). Tap any chord to see whether it survives the capo.</div>}

      {blockOrder.map((bid, idx) => {
        const b = chart.blocks.find((x) => x.id === bid);
        return (
          <div className="sb-block" key={bid} data-idx={idx}>
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
                      {sg.chord && cutCapoMode
                        ? <span className="sb-chord tappable" role="button" tabIndex={0}
                            onClick={() => setTapped(sg.chord)}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setTapped(sg.chord); } }}
                            title={"Can " + sg.chord + " be played with the cut capo?"}>{chordText(sg.chord)}</span>
                        : <span className="sb-chord">{sg.chord ? chordText(sg.chord) : ""}</span>}
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

      {cutCapoMode && tapped && <CutCapoPopup token={tapped} onClose={() => setTapped(null)} />}
    </div>
  );
}

// ============================================================
// CUT CAPO POPUP — the question this feature exists to answer:
// does this chord survive the cut capo, yes or no?
// ============================================================
function CutCapoPopup({ token, onClose }) {
  const result = useMemo(() => cutCapoVoicingsFor(token, 2), [token]);
  return (
    <div className="sb-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="sb-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sb-sheet-top">
          <span className="sb-sheet-name">{result.label || token}</span>
          <span className="sb-sheet-sub">cut capo · fret 2 · A D G</span>
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
                <> The closest shape drops {result.missing.join(" and ")}, so it is not really {result.label}.</>
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
                <CutCapoDiagram shape={v.shape} />
                <div className="sb-cc-card-top" style={{ marginTop: 6 }}>
                  <span>Notes low→high</span>
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
export default function Songbook({ isTeacher, onBack, onKeepAlive }) {
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

  if (open) {
    return (
      <><style>{S}</style><div className="sb">
        <ChartView entry={open.entry} chartId={open.chartId} fromSet={open.fromSet} serviceTypeId={serviceId} prefs={prefs} setPrefs={setPrefs} onKeepAlive={onKeepAlive} isTeacher={isTeacher}
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
