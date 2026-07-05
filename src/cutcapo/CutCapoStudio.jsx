// ============================================================================
// CUT CAPO STUDIO  —  teacher-only section
// Three modes: Chord Library · Discover · Builder
// Partial capo at fret 2 on the A, D & G strings (see tuning.js).
// ============================================================================
import { useState, useMemo, useEffect } from "react";
import {
  STRINGS, NUM_STRINGS, MAX_FRET, CAPO_FRET, isCapoed, noteAtFret, availableFrets, CHROMA,
} from "./tuning.js";
import {
  ROOTS, CHORD_TYPES, COMMON_TYPE_IDS, getType, chordLabel, parseChord, nameChord,
} from "./chords.js";
import { generateVoicings, analyzeVoicing } from "./voicing.js";
import { getShapes, saveShape, deleteShape } from "./shapeStore.js";

// ---------------------------------------------------------------------------
// Fretboard geometry (horizontal · low E on top · nut on the left)
// ---------------------------------------------------------------------------
const G = {
  stringGap: 26,
  fretGap: 38,
  marginTop: 26,
  marginLeft: 54,
  marginRight: 16,
  marginBottom: 24,
};
const FRETS = MAX_FRET; // 0..12
const stringY = (s) => G.marginTop + s * G.stringGap;
const nutX = G.marginLeft;
const fretLineX = (i) => nutX + i * G.fretGap;
const noteX = (f) => nutX + (f - 0.5) * G.fretGap; // centre of fret f's space
const boardW = nutX + FRETS * G.fretGap + G.marginRight;
const boardH = G.marginTop + (NUM_STRINGS - 1) * G.stringGap + G.marginBottom;
const SINGLE_INLAYS = [3, 5, 7, 9];
const openMarkerX = nutX - 20;

// ---------------------------------------------------------------------------
// Fretboard SVG
//   shape         : array6 of null(mute) | 0(open/capo) | fret
//   showNoteNames : print the note at every available fret position
//   interactive   : enable tapping fret cells + open/mute toggles (Builder)
//   onTapFret / onSetOpen / onSetMute : Builder callbacks
//   thumb         : small read-only rendering for Discover grid
// ---------------------------------------------------------------------------
function CapoFretboard({
  shape = [null, null, null, null, null, null],
  showNoteNames = false,
  interactive = false,
  onTapFret,
  onSetOpen,
  onSetMute,
  thumb = false,
}) {
  const boardTop = stringY(0) - 12;
  const boardBot = stringY(5) + 12;
  const inlayY = (stringY(2) + stringY(3)) / 2;

  return (
    <svg viewBox={`0 0 ${boardW} ${boardH}`}
      style={{ width: "100%", maxWidth: boardW, height: "auto", touchAction: "manipulation" }}
      role="img" aria-label="Cut-capo fretboard">
      <defs>
        <linearGradient id="ccWood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a3a22" />
          <stop offset="0.5" stopColor="#3a2416" />
          <stop offset="1" stopColor="#2a1810" />
        </linearGradient>
      </defs>

      {/* fret numbers */}
      {!thumb && Array.from({ length: FRETS }, (_, i) => i + 1).map((f) => (
        <text key={`fn${f}`} x={noteX(f)} y={boardTop - 6} textAnchor="middle" fontSize="9"
          fill="#8888aa" fontFamily="Oswald,sans-serif">{f}</text>
      ))}

      {/* wood */}
      <rect x={nutX} y={boardTop} width={fretLineX(FRETS) - nutX} height={boardBot - boardTop}
        rx="4" fill="url(#ccWood)" stroke="#1c1009" strokeWidth="1.5" />

      {/* inlays */}
      {SINGLE_INLAYS.map((f) => (
        <circle key={`in${f}`} cx={noteX(f)} cy={inlayY} r="5" fill="#f0ead6" opacity="0.85" />
      ))}
      <circle cx={noteX(12)} cy={stringY(1)} r="5" fill="#f0ead6" opacity="0.85" />
      <circle cx={noteX(12)} cy={stringY(4)} r="5" fill="#f0ead6" opacity="0.85" />

      {/* fret wires */}
      {Array.from({ length: FRETS }, (_, i) => i + 1).map((i) => (
        <line key={`fr${i}`} x1={fretLineX(i)} y1={boardTop} x2={fretLineX(i)} y2={boardBot}
          stroke="#c4c4cc" strokeWidth="2.5" />
      ))}
      {/* nut */}
      <rect x={nutX - 5} y={boardTop} width="6" height={boardBot - boardTop} rx="1.5" fill="#e8dcc0" />

      {/* partial capo — clamps A, D & G rows only, at fret 2 */}
      {(() => {
        const cy1 = stringY(1) - 10, cy3 = stringY(3) + 10;
        const cx = noteX(CAPO_FRET);
        return (
          <g>
            <rect x={cx - 7} y={cy1} width="14" height={cy3 - cy1} rx="6"
              fill="#20242c" stroke="#0d0f13" strokeWidth="1.4" />
            <rect x={cx - 3} y={cy1 + 2} width="3" height={cy3 - cy1 - 4} rx="1.5" fill="#3a4150" />
            <circle cx={cx} cy={cy1} r="4.5" fill="#141821" stroke="#3a4150" strokeWidth="1" />
            <circle cx={cx} cy={cy3} r="4.5" fill="#141821" stroke="#3a4150" strokeWidth="1" />
          </g>
        );
      })()}

      {/* strings */}
      {STRINGS.map((st, s) => {
        const y = stringY(s);
        return (
          <line key={`str${s}`} x1={nutX - 5} y1={y} x2={fretLineX(FRETS)} y2={y}
            stroke="#cfcfd8" strokeWidth={thumb ? Math.max(1, st.w * 0.6) : st.w} strokeLinecap="round" />
        );
      })}

      {/* faint note names at every available fret (Builder) */}
      {showNoteNames && STRINGS.map((st, s) =>
        availableFrets(s).filter((f) => f > 0).map((f) => {
          const n = noteAtFret(s, f);
          if (n == null) return null;
          const placed = shape[s] === f;
          return (
            <text key={`lbl${s}-${f}`} x={noteX(f)} y={stringY(s) + 3} textAnchor="middle"
              fontSize="9" fontFamily="Oswald,sans-serif"
              fill={placed ? "transparent" : "rgba(240,234,214,0.34)"}>{CHROMA[n]}</text>
          );
        })
      )}

      {/* placed finger dots */}
      {STRINGS.map((st, s) => {
        const f = shape[s];
        if (f == null || f === 0) return null;
        const n = noteAtFret(s, f);
        if (n == null) return null;
        return (
          <g key={`dot${s}`}>
            <circle cx={noteX(f)} cy={stringY(s)} r={thumb ? 6 : 9.5} fill="#f0c040"
              stroke="#1a1208" strokeWidth="1" />
            {!thumb && (
              <text x={noteX(f)} y={stringY(s) + 3.5} textAnchor="middle" fontSize="10"
                fontWeight="700" fontFamily="Oswald,sans-serif" fill="#1a1208">{CHROMA[n]}</text>
            )}
          </g>
        );
      })}

      {/* left-of-nut open/mute markers */}
      {STRINGS.map((st, s) => {
        const y = stringY(s);
        const f = shape[s];
        if (interactive) {
          // two tap targets: open (○) and mute (✕)
          const isOpen = f === 0;
          const isMute = f == null;
          return (
            <g key={`m${s}`}>
              <circle cx={openMarkerX} cy={y} r="8" fill="transparent"
                style={{ cursor: "pointer" }} onClick={() => onSetOpen && onSetOpen(s)} />
              <circle cx={openMarkerX} cy={y} r={isOpen ? 7 : 6}
                fill="none" stroke={isOpen ? "#f0c040" : "#5a5a72"} strokeWidth={isOpen ? 2.4 : 1.4} />
              <g style={{ cursor: "pointer" }} onClick={() => onSetMute && onSetMute(s)}>
                <rect x={openMarkerX + 14} y={y - 8} width="16" height="16" fill="transparent" />
                <text x={openMarkerX + 22} y={y + 4} textAnchor="middle" fontSize="12"
                  fontWeight="700" fill={isMute ? "#ef5350" : "#5a5a72"}>✕</text>
              </g>
            </g>
          );
        }
        // read-only single status marker
        if (f == null) {
          return <text key={`m${s}`} x={openMarkerX} y={y + 4} textAnchor="middle" fontSize="12"
            fontWeight="700" fill="#ef5350">✕</text>;
        }
        if (f === 0) {
          const n = noteAtFret(s, 0);
          return (
            <g key={`m${s}`}>
              <circle cx={openMarkerX} cy={y} r={thumb ? 5 : 7} fill="none" stroke="#81c784"
                strokeWidth={thumb ? 1.6 : 2.2} />
              {!thumb && (
                <text x={openMarkerX} y={y + 3} textAnchor="middle" fontSize="8"
                  fontFamily="Oswald,sans-serif" fill="#81c784">{CHROMA[n]}</text>
              )}
            </g>
          );
        }
        return null;
      })}

      {/* tappable fret cells (Builder) */}
      {interactive && STRINGS.map((st, s) =>
        availableFrets(s).filter((f) => f > 0).map((f) => (
          <rect key={`tap${s}-${f}`} x={fretLineX(f - 1)} y={stringY(s) - G.stringGap / 2}
            width={G.fretGap} height={G.stringGap} fill="transparent"
            style={{ cursor: "pointer" }} onClick={() => onTapFret && onTapFret(s, f)} />
        ))
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// A single voicing card (fretboard + notes + honesty label)
// ---------------------------------------------------------------------------
function VoicingCard({ label, voicing }) {
  if (!voicing) {
    return <div className="cc-empty">No playable voicing found in this capo setup.</div>;
  }
  const a = voicing.analysis;
  const notes = a.sounding.map((x) => CHROMA[x.pc]);
  return (
    <div className="cc-voicing">
      {label && <div className="cc-chordname">{label}</div>}
      <CapoFretboard shape={voicing.shape} />
      <div className="cc-notes">
        <span className="cc-notes-lbl">Notes (low→high)</span>
        <span className="cc-notes-val">{notes.join(" · ") || "—"}</span>
      </div>
      {voicing.bassNote && (
        <div className="cc-bass">Bass: <b>{voicing.bassNote}</b></div>
      )}
      {voicing.missing && voicing.missing.length > 0 && (
        <div className="cc-honest">⚠ {voicing.missing.join(" & ")} omitted — closest playable shape</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MODE 1 — Chord Library
// ---------------------------------------------------------------------------
function ChordLibrary() {
  const [root, setRoot] = useState("E");
  const [typeId, setTypeId] = useState("maj");
  const [bass, setBass] = useState("");
  const [search, setSearch] = useState("");
  const [vidx, setVidx] = useState(0);

  const applySearch = (raw) => {
    setSearch(raw);
    const parsed = parseChord(raw);
    if (parsed) {
      setRoot(parsed.root);
      setTypeId(parsed.typeId);
      setBass(parsed.bass || "");
      setVidx(0);
    }
  };

  const result = useMemo(
    () => generateVoicings(root, typeId, { bass: bass || null }),
    [root, typeId, bass]
  );
  useEffect(() => { setVidx(0); }, [root, typeId, bass]);

  const top3 = result.voicings.slice(0, 3);
  const current = top3[Math.min(vidx, top3.length - 1)];
  const label = chordLabel(root, typeId, bass || null);

  return (
    <div className="cc-mode">
      <input className="cc-search" placeholder="Search  e.g.  Gm · A7 · E/G#"
        value={search} onChange={(e) => applySearch(e.target.value)} />

      <div className="cc-controls">
        <label className="cc-field">
          <span>Root</span>
          <select value={root} onChange={(e) => { setRoot(e.target.value); setSearch(""); }}>
            {ROOTS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="cc-field">
          <span>Type</span>
          <select value={typeId} onChange={(e) => { setTypeId(e.target.value); setSearch(""); }}>
            {CHORD_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
        <label className="cc-field">
          <span>Bass (slash)</span>
          <select value={bass} onChange={(e) => { setBass(e.target.value); setSearch(""); }}>
            <option value="">none</option>
            {ROOTS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
      </div>

      {top3.length === 0 ? (
        <div className="cc-empty">No voicing found for <b>{label}</b> in this capo setup.</div>
      ) : (
        <>
          {result.partial && (
            <div className="cc-honest">No fully-complete shape exists here — showing the closest playable voicings.</div>
          )}
          {top3.length > 1 && (
            <div className="cc-vsel">
              {top3.map((_, i) => (
                <button key={i} className={`cc-vbtn ${i === vidx ? "on" : ""}`} onClick={() => setVidx(i)}>
                  Voicing {i + 1}
                </button>
              ))}
            </div>
          )}
          <VoicingCard label={label} voicing={current} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MODE 2 — Discover
// ---------------------------------------------------------------------------
function Discover() {
  const [detail, setDetail] = useState(null); // {root, typeId}

  const grid = useMemo(() => {
    const cells = [];
    for (const root of ROOTS) {
      for (const typeId of COMMON_TYPE_IDS) {
        const res = generateVoicings(root, typeId, {});
        cells.push({ root, typeId, best: res.voicings[0] || null, partial: res.partial });
      }
    }
    return cells;
  }, []);

  const surprise = () => {
    const playable = grid.filter((c) => c.best);
    const pick = playable[Math.floor(Math.random() * playable.length)];
    if (pick) setDetail({ root: pick.root, typeId: pick.typeId });
  };

  if (detail) {
    return <ChordDetail root={detail.root} typeId={detail.typeId} onBack={() => setDetail(null)} />;
  }

  return (
    <div className="cc-mode">
      <div className="cc-row-between">
        <div className="cc-sub">Tap any chord to open it full-size with alternate voicings.</div>
        <button className="cc-mini-btn" onClick={surprise}>🎲 Surprise me</button>
      </div>
      <div className="cc-grid">
        {grid.map((c) => (
          <button key={`${c.root}-${c.typeId}`} className="cc-cell"
            onClick={() => setDetail({ root: c.root, typeId: c.typeId })}>
            <div className="cc-cell-name">{chordLabel(c.root, c.typeId)}{c.partial ? "*" : ""}</div>
            {c.best
              ? <CapoFretboard shape={c.best.shape} thumb />
              : <div className="cc-cell-none">—</div>}
          </button>
        ))}
      </div>
      <div className="cc-sub" style={{ opacity: 0.7 }}>* closest playable shape (some tones omitted)</div>
    </div>
  );
}

// Shared full-size chord view with alternate voicings (used by Discover).
function ChordDetail({ root, typeId, onBack }) {
  const [vidx, setVidx] = useState(0);
  const result = useMemo(() => generateVoicings(root, typeId, {}), [root, typeId]);
  const top3 = result.voicings.slice(0, 3);
  const current = top3[Math.min(vidx, top3.length - 1)];
  const label = chordLabel(root, typeId);
  return (
    <div className="cc-mode">
      <button className="cc-back" onClick={onBack}>← All chords</button>
      {top3.length === 0 ? (
        <div className="cc-empty">No voicing found for <b>{label}</b>.</div>
      ) : (
        <>
          {top3.length > 1 && (
            <div className="cc-vsel">
              {top3.map((_, i) => (
                <button key={i} className={`cc-vbtn ${i === vidx ? "on" : ""}`} onClick={() => setVidx(i)}>
                  Voicing {i + 1}
                </button>
              ))}
            </div>
          )}
          <VoicingCard label={label} voicing={current} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MODE 3 — Builder (reverse tool)
// ---------------------------------------------------------------------------
const EMPTY_SHAPE = [null, null, null, null, null, null];

function Builder() {
  const [shape, setShape] = useState(EMPTY_SHAPE);
  const [manual, setManual] = useState("");
  const [saved, setSaved] = useState(() => getShapes());

  const setStr = (s, val) => setShape((prev) => prev.map((f, i) => (i === s ? val : f)));
  const tapFret = (s, f) => setStr(s, shape[s] === f ? null : f);
  const toggleOpen = (s) => setStr(s, shape[s] === 0 ? null : 0);
  const toggleMute = (s) => setStr(s, null);

  const a = useMemo(() => analyzeVoicing(shape), [shape]);
  const soundingNames = a.sounding.map((x) => CHROMA[x.pc]);
  const naming = useMemo(
    () => nameChord(a.pcSet, a.bass ? a.bass.pc : null),
    [a.pcSet, a.bass]
  );

  const bestName = naming.names[0];
  const alternates = naming.names.slice(1, 4);

  const doSave = () => {
    if (a.sounding.length === 0) return;
    const name = manual.trim() || (bestName ? bestName.name : soundingNames.join(" "));
    saveShape({ name, shape, notes: soundingNames });
    setSaved(getShapes());
    setManual("");
  };
  const doDelete = (id) => { deleteShape(id); setSaved(getShapes()); };
  const openSaved = (sh) => { setShape(sh.shape); setManual(sh.name); };
  const clear = () => { setShape(EMPTY_SHAPE); setManual(""); };

  return (
    <div className="cc-mode">
      <div className="cc-sub">Tap a fret on each string. Use ○ for open/ringing and ✕ to mute.</div>
      <CapoFretboard shape={shape} showNoteNames interactive
        onTapFret={tapFret} onSetOpen={toggleOpen} onSetMute={toggleMute} />

      <div className="cc-readout">
        <div className="cc-notes-lbl">Sounding notes (low→high)</div>
        <div className="cc-readout-notes">{soundingNames.length ? soundingNames.join(" · ") : "—"}</div>
      </div>

      <div className="cc-namepanel">
        {a.sounding.length < 2 ? (
          <div className="cc-name-hint">Place at least a couple of notes to name the shape.</div>
        ) : bestName ? (
          <>
            <div className="cc-name-main">{bestName.name}
              {!bestName.exact && bestName.missing.length > 0 &&
                <span className="cc-name-note"> · {bestName.missing.join(" & ")} omitted</span>}
            </div>
            {alternates.length > 0 && (
              <div className="cc-name-alt">also: {alternates.map((n) => n.name).join(" · ")}</div>
            )}
          </>
        ) : (
          <div className="cc-name-hint">No standard chord — but the notes above are exactly what rings.</div>
        )}
      </div>

      <div className="cc-builder-actions">
        <input className="cc-search" placeholder="Name this shape (optional)"
          value={manual} onChange={(e) => setManual(e.target.value)} />
        <div className="cc-btn-row">
          <button className="cc-act" onClick={doSave} disabled={a.sounding.length === 0}>💾 Save</button>
          <button className="cc-act ghost" onClick={clear}>Clear</button>
        </div>
        <div className="cc-note-small">Saved on this device only — not synced yet.</div>
      </div>

      {saved.length > 0 && (
        <div className="cc-saved">
          <div className="cc-notes-lbl">My Shapes</div>
          {saved.map((sh) => (
            <div key={sh.id} className="cc-saved-row">
              <button className="cc-saved-open" onClick={() => openSaved(sh)}>
                <b>{sh.name}</b> <span>{(sh.notes || []).join(" ")}</span>
              </button>
              <button className="cc-saved-del" onClick={() => doDelete(sh.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------
export default function CutCapoStudio({ onBack }) {
  const [mode, setMode] = useState("library");
  return (
    <div className="shell">
      <style>{CC_STYLE}</style>
      <div className="cc-screen">
        <div className="cc-header">
          <button className="cc-back" onClick={onBack}>← Back</button>
          <div className="cc-title">Cut Capo Studio</div>
          <div className="cc-capo-note">capo · fr 2 · A D G</div>
        </div>

        <div className="cc-modebar">
          {[["library", "Chord Library"], ["discover", "Discover"], ["builder", "Builder"]].map(([id, lbl]) => (
            <button key={id} className={`cc-modebtn ${mode === id ? "on" : ""}`} onClick={() => setMode(id)}>{lbl}</button>
          ))}
        </div>

        {mode === "library" && <ChordLibrary />}
        {mode === "discover" && <Discover />}
        {mode === "builder" && <Builder />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles (scoped by cc- prefix; reuses the app's CSS variables)
// ---------------------------------------------------------------------------
const CC_STYLE = `
.cc-screen{display:flex;flex-direction:column;padding:14px 14px 40px;gap:14px;min-height:100vh;}
.cc-header{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.cc-title{font-family:'Oswald',sans-serif;font-size:19px;font-weight:700;color:var(--teacher);letter-spacing:1px;}
.cc-capo-note{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);text-align:right;}
.cc-back{background:none;border:none;color:var(--muted);font-size:14px;cursor:pointer;font-family:'Source Sans 3',sans-serif;padding:0;}
.cc-modebar{display:flex;gap:6px;background:var(--surface);border:1.5px solid var(--border);border-radius:12px;padding:4px;}
.cc-modebtn{flex:1;padding:9px 4px;border:none;border-radius:9px;background:transparent;color:var(--muted);font-family:'Oswald',sans-serif;font-size:12px;font-weight:600;letter-spacing:.5px;cursor:pointer;transition:all .15s;}
.cc-modebtn.on{background:rgba(192,132,252,.16);color:var(--teacher);}
.cc-mode{display:flex;flex-direction:column;gap:12px;}
.cc-sub{font-size:12px;color:var(--muted);line-height:1.4;}
.cc-search{width:100%;padding:11px 13px;border-radius:11px;border:1.5px solid var(--border);background:var(--surface);color:var(--text);font-size:15px;font-family:'Source Sans 3',sans-serif;}
.cc-search:focus{outline:none;border-color:var(--teacher);}
.cc-controls{display:flex;gap:8px;}
.cc-field{flex:1;display:flex;flex-direction:column;gap:4px;}
.cc-field span{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);}
.cc-field select{padding:9px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface);color:var(--text);font-size:14px;font-family:'Source Sans 3',sans-serif;}
.cc-field select:focus{outline:none;border-color:var(--teacher);}
.cc-vsel{display:flex;gap:6px;}
.cc-vbtn{flex:1;padding:8px;border-radius:9px;border:1.5px solid var(--border);background:var(--surface);color:var(--muted);font-family:'Oswald',sans-serif;font-size:12px;font-weight:600;cursor:pointer;}
.cc-vbtn.on{border-color:var(--teacher);color:var(--teacher);background:rgba(192,132,252,.1);}
.cc-voicing{background:var(--surface);border:1.5px solid var(--border);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:8px;}
.cc-chordname{font-family:'Oswald',sans-serif;font-size:26px;font-weight:700;color:var(--gold);letter-spacing:1px;text-align:center;}
.cc-notes{display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap;}
.cc-notes-lbl{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);}
.cc-notes-val{font-family:'Oswald',sans-serif;font-size:16px;color:var(--text);letter-spacing:1px;}
.cc-bass{font-size:12px;color:var(--muted);}
.cc-bass b{color:var(--text);}
.cc-honest{font-size:12px;color:#e0b050;background:rgba(240,192,64,.08);border:1px solid rgba(240,192,64,.3);border-radius:9px;padding:8px 10px;line-height:1.4;}
.cc-empty{font-size:13px;color:var(--muted);text-align:center;padding:24px 12px;background:var(--surface);border:1.5px dashed var(--border);border-radius:12px;}
.cc-row-between{display:flex;align-items:center;justify-content:space-between;gap:10px;}
.cc-mini-btn{padding:8px 12px;border-radius:9px;border:1.5px solid var(--teacher);background:rgba(192,132,252,.08);color:var(--teacher);font-family:'Oswald',sans-serif;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;}
.cc-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;}
.cc-cell{background:var(--surface);border:1.5px solid var(--border);border-radius:11px;padding:8px 6px 6px;cursor:pointer;display:flex;flex-direction:column;gap:4px;transition:border-color .15s;}
.cc-cell:active{border-color:var(--teacher);}
.cc-cell-name{font-family:'Oswald',sans-serif;font-size:14px;font-weight:600;color:var(--text);text-align:center;}
.cc-cell-none{font-size:12px;color:var(--muted);text-align:center;padding:14px 0;}
.cc-readout{background:var(--surface);border:1.5px solid var(--border);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:4px;}
.cc-readout-notes{font-family:'Oswald',sans-serif;font-size:20px;letter-spacing:2px;color:var(--gold);}
.cc-namepanel{background:rgba(192,132,252,.08);border:1.5px solid var(--teacher);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:5px;}
.cc-name-main{font-family:'Oswald',sans-serif;font-size:24px;font-weight:700;color:var(--teacher);}
.cc-name-note{font-size:12px;font-weight:400;color:var(--muted);letter-spacing:0;}
.cc-name-alt{font-size:13px;color:var(--text);}
.cc-name-hint{font-size:13px;color:var(--muted);line-height:1.4;}
.cc-builder-actions{display:flex;flex-direction:column;gap:8px;}
.cc-btn-row{display:flex;gap:8px;}
.cc-act{flex:1;padding:12px;border-radius:11px;border:none;background:var(--teacher);color:#1a1023;font-family:'Oswald',sans-serif;font-size:14px;font-weight:700;letter-spacing:1px;cursor:pointer;}
.cc-act:disabled{opacity:.4;cursor:default;}
.cc-act.ghost{background:var(--surface);color:var(--muted);border:1.5px solid var(--border);}
.cc-note-small{font-size:11px;color:var(--muted);text-align:center;font-style:italic;}
.cc-saved{background:var(--surface);border:1.5px solid var(--border);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:6px;}
.cc-saved-row{display:flex;gap:8px;align-items:center;}
.cc-saved-open{flex:1;text-align:left;background:var(--surface2);border:1px solid var(--border);border-radius:9px;padding:9px 11px;color:var(--text);font-size:14px;cursor:pointer;display:flex;justify-content:space-between;gap:8px;font-family:'Source Sans 3',sans-serif;}
.cc-saved-open span{color:var(--muted);font-size:12px;}
.cc-saved-del{width:34px;border-radius:9px;border:1px solid var(--border);background:transparent;color:#ef5350;font-size:14px;cursor:pointer;}
`;
