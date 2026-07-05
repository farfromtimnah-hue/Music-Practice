// ============================================================================
// OPEN VOICINGS STUDIO  —  teacher-only section
// Two modes: Chord Library · Discover
// Standard tuning, NO capo. Shows ONLY open-string voicings (>=1 open string,
// no barres, <=3 fingers). When a chord has no clean open voicing it says so
// honestly and never falls back to a barre. Sibling to Cut Capo Studio.
// ============================================================================
import { useState, useMemo, useEffect } from "react";
import {
  STRINGS, NUM_STRINGS, MAX_FRET, noteAtFret, CHROMA,
} from "./tuning.js";
import {
  ROOTS, CHORD_TYPES, COMMON_TYPE_IDS, chordLabel, parseChord,
} from "./chords.js";
import { generateVoicings } from "./voicing.js";

// ---------------------------------------------------------------------------
// Fretboard geometry (horizontal · low E on top · nut on the left · no capo)
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
const openMarkerX = nutX - 22;

// ---------------------------------------------------------------------------
// Fretboard SVG
//   shape : array6 of null(mute) | 0(open) | fret
//   thumb : small read-only rendering for the Discover grid
// ---------------------------------------------------------------------------
function OpenFretboard({ shape = [null, null, null, null, null, null], thumb = false }) {
  const boardTop = stringY(0) - 12;
  const boardBot = stringY(5) + 12;
  const inlayY = (stringY(2) + stringY(3)) / 2;

  return (
    <svg viewBox={`0 0 ${boardW} ${boardH}`}
      style={{ width: "100%", maxWidth: boardW, height: "auto", touchAction: "manipulation" }}
      role="img" aria-label="Open-voicing fretboard (standard tuning, no capo)">
      <defs>
        <linearGradient id="ovWood" x1="0" y1="0" x2="0" y2="1">
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
        rx="4" fill="url(#ovWood)" stroke="#1c1009" strokeWidth="1.5" />

      {/* inlays — single at 3·5·7·9, double at 12 */}
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
      {/* nut (no capo graphic in this studio) */}
      <rect x={nutX - 5} y={boardTop} width="6" height={boardBot - boardTop} rx="1.5" fill="#e8dcc0" />

      {/* strings */}
      {STRINGS.map((st, s) => {
        const y = stringY(s);
        return (
          <line key={`str${s}`} x1={nutX - 5} y1={y} x2={fretLineX(FRETS)} y2={y}
            stroke="#cfcfd8" strokeWidth={thumb ? Math.max(1, st.w * 0.6) : st.w} strokeLinecap="round" />
        );
      })}

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

      {/* left-of-nut open (○) / muted (✕) markers */}
      {STRINGS.map((st, s) => {
        const y = stringY(s);
        const f = shape[s];
        if (f == null) {
          return <text key={`m${s}`} x={openMarkerX} y={y + 4} textAnchor="middle" fontSize="12"
            fontWeight="700" fill="#ef5350">✕</text>;
        }
        if (f === 0) {
          const n = noteAtFret(s, 0);
          // open strings are the whole point here — draw the ring boldly
          return (
            <g key={`m${s}`}>
              <circle cx={openMarkerX} cy={y} r={thumb ? 5.5 : 8} fill="none" stroke="#81c784"
                strokeWidth={thumb ? 1.8 : 2.6} />
              {!thumb && (
                <text x={openMarkerX} y={y + 3} textAnchor="middle" fontSize="8"
                  fontFamily="Oswald,sans-serif" fill="#81c784">{CHROMA[n]}</text>
              )}
            </g>
          );
        }
        return null; // fretted string — no left marker
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// The honest "no open voicing" panel
// ---------------------------------------------------------------------------
function NoVoicing({ label }) {
  return (
    <div className="ov-empty">
      <div className="ov-empty-chord">{label}</div>
      No clean open voicing in standard tuning — this chord needs a barre.
    </div>
  );
}

// ---------------------------------------------------------------------------
// A single voicing card (fretboard + notes)
// ---------------------------------------------------------------------------
function VoicingCard({ label, voicing }) {
  const a = voicing.analysis;
  const notes = a.sounding.map((x) => CHROMA[x.pc]);
  return (
    <div className="ov-voicing">
      {label && <div className="ov-chordname">{label}</div>}
      <OpenFretboard shape={voicing.shape} />
      <div className="ov-notes">
        <span className="ov-notes-lbl">Notes (low→high)</span>
        <span className="ov-notes-val">{notes.join(" · ") || "—"}</span>
      </div>
      <div className="ov-ringcount">
        {a.openCount} open string{a.openCount === 1 ? "" : "s"} ringing
        {voicing.bassNote ? <> · bass <b>{voicing.bassNote}</b></> : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MODE 1 — Chord Library
// ---------------------------------------------------------------------------
function ChordLibrary() {
  const [root, setRoot] = useState("C");
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
    <div className="ov-mode">
      <input className="ov-search" placeholder="Search  e.g.  Gm · A7 · Cmaj7 · D/F#"
        value={search} onChange={(e) => applySearch(e.target.value)} />

      <div className="ov-controls">
        <label className="ov-field">
          <span>Root</span>
          <select value={root} onChange={(e) => { setRoot(e.target.value); setSearch(""); }}>
            {ROOTS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="ov-field">
          <span>Type</span>
          <select value={typeId} onChange={(e) => { setTypeId(e.target.value); setSearch(""); }}>
            {CHORD_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
        <label className="ov-field">
          <span>Bass (slash)</span>
          <select value={bass} onChange={(e) => { setBass(e.target.value); setSearch(""); }}>
            <option value="">none</option>
            {ROOTS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
      </div>

      {top3.length === 0 ? (
        <NoVoicing label={label} />
      ) : (
        <>
          {top3.length > 1 && (
            <div className="ov-vsel">
              {top3.map((_, i) => (
                <button key={i} className={`ov-vbtn ${i === vidx ? "on" : ""}`} onClick={() => setVidx(i)}>
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
        cells.push({ root, typeId, best: res.voicings[0] || null });
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
    <div className="ov-mode">
      <div className="ov-row-between">
        <div className="ov-sub">Tap any chord to open it full-size. Greyed chords have no open voicing.</div>
        <button className="ov-mini-btn" onClick={surprise}>🎲 Surprise me</button>
      </div>
      <div className="ov-grid">
        {grid.map((c) => (
          <button key={`${c.root}-${c.typeId}`}
            className={`ov-cell ${c.best ? "" : "muted"}`}
            disabled={!c.best}
            onClick={() => c.best && setDetail({ root: c.root, typeId: c.typeId })}>
            <div className="ov-cell-name">{chordLabel(c.root, c.typeId)}</div>
            {c.best
              ? <OpenFretboard shape={c.best.shape} thumb />
              : <div className="ov-cell-tag">needs barre</div>}
          </button>
        ))}
      </div>
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
    <div className="ov-mode">
      <button className="ov-back" onClick={onBack}>← All chords</button>
      {top3.length === 0 ? (
        <NoVoicing label={label} />
      ) : (
        <>
          {top3.length > 1 && (
            <div className="ov-vsel">
              {top3.map((_, i) => (
                <button key={i} className={`ov-vbtn ${i === vidx ? "on" : ""}`} onClick={() => setVidx(i)}>
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
// Root component
// ---------------------------------------------------------------------------
export default function OpenVoicingsStudio({ onBack }) {
  const [mode, setMode] = useState("library");
  return (
    <div className="shell">
      <style>{OV_STYLE}</style>
      <div className="ov-screen">
        <div className="ov-header">
          <button className="ov-back" onClick={onBack}>← Back</button>
          <div className="ov-title">Open Voicings Studio</div>
          <div className="ov-tune-note">standard · no capo</div>
        </div>

        <div className="ov-intro">
          Open-string voicings only — shapes that let open strings ring against a
          few fretted notes for a shimmery, non-traditional sound. No barres, ever.
        </div>

        <div className="ov-modebar">
          {[["library", "Chord Library"], ["discover", "Discover"]].map(([id, lbl]) => (
            <button key={id} className={`ov-modebtn ${mode === id ? "on" : ""}`} onClick={() => setMode(id)}>{lbl}</button>
          ))}
        </div>

        {mode === "library" && <ChordLibrary />}
        {mode === "discover" && <Discover />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles (scoped by ov- prefix; reuses the app's CSS variables)
// ---------------------------------------------------------------------------
const OV_STYLE = `
.ov-screen{display:flex;flex-direction:column;padding:14px 14px 40px;gap:14px;min-height:100vh;}
.ov-header{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.ov-title{font-family:'Oswald',sans-serif;font-size:18px;font-weight:700;color:var(--teacher);letter-spacing:1px;}
.ov-tune-note{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);text-align:right;}
.ov-back{background:none;border:none;color:var(--muted);font-size:14px;cursor:pointer;font-family:'Source Sans 3',sans-serif;padding:0;}
.ov-intro{font-size:12px;color:var(--muted);line-height:1.5;background:rgba(192,132,252,.06);border:1px solid rgba(192,132,252,.25);border-radius:10px;padding:9px 11px;}
.ov-modebar{display:flex;gap:6px;background:var(--surface);border:1.5px solid var(--border);border-radius:12px;padding:4px;}
.ov-modebtn{flex:1;padding:9px 4px;border:none;border-radius:9px;background:transparent;color:var(--muted);font-family:'Oswald',sans-serif;font-size:12px;font-weight:600;letter-spacing:.5px;cursor:pointer;transition:all .15s;}
.ov-modebtn.on{background:rgba(192,132,252,.16);color:var(--teacher);}
.ov-mode{display:flex;flex-direction:column;gap:12px;}
.ov-sub{font-size:12px;color:var(--muted);line-height:1.4;}
.ov-search{width:100%;padding:11px 13px;border-radius:11px;border:1.5px solid var(--border);background:var(--surface);color:var(--text);font-size:15px;font-family:'Source Sans 3',sans-serif;}
.ov-search:focus{outline:none;border-color:var(--teacher);}
.ov-controls{display:flex;gap:8px;}
.ov-field{flex:1;display:flex;flex-direction:column;gap:4px;}
.ov-field span{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);}
.ov-field select{padding:9px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface);color:var(--text);font-size:14px;font-family:'Source Sans 3',sans-serif;}
.ov-field select:focus{outline:none;border-color:var(--teacher);}
.ov-vsel{display:flex;gap:6px;}
.ov-vbtn{flex:1;padding:8px;border-radius:9px;border:1.5px solid var(--border);background:var(--surface);color:var(--muted);font-family:'Oswald',sans-serif;font-size:12px;font-weight:600;cursor:pointer;}
.ov-vbtn.on{border-color:var(--teacher);color:var(--teacher);background:rgba(192,132,252,.1);}
.ov-voicing{background:var(--surface);border:1.5px solid var(--border);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:8px;}
.ov-chordname{font-family:'Oswald',sans-serif;font-size:26px;font-weight:700;color:var(--gold);letter-spacing:1px;text-align:center;}
.ov-notes{display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap;}
.ov-notes-lbl{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);}
.ov-notes-val{font-family:'Oswald',sans-serif;font-size:16px;color:var(--text);letter-spacing:1px;}
.ov-ringcount{font-size:12px;color:#81c784;}
.ov-ringcount b{color:var(--text);}
.ov-empty{font-size:13px;color:var(--muted);text-align:center;padding:22px 14px;background:var(--surface);border:1.5px dashed var(--border);border-radius:12px;line-height:1.5;display:flex;flex-direction:column;gap:8px;}
.ov-empty-chord{font-family:'Oswald',sans-serif;font-size:24px;font-weight:700;color:var(--text);letter-spacing:1px;}
.ov-row-between{display:flex;align-items:center;justify-content:space-between;gap:10px;}
.ov-mini-btn{padding:8px 12px;border-radius:9px;border:1.5px solid var(--teacher);background:rgba(192,132,252,.08);color:var(--teacher);font-family:'Oswald',sans-serif;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;}
.ov-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;}
.ov-cell{background:var(--surface);border:1.5px solid var(--border);border-radius:11px;padding:8px 6px 6px;cursor:pointer;display:flex;flex-direction:column;gap:4px;transition:border-color .15s;}
.ov-cell:active{border-color:var(--teacher);}
.ov-cell.muted{opacity:.45;cursor:default;}
.ov-cell-name{font-family:'Oswald',sans-serif;font-size:14px;font-weight:600;color:var(--text);text-align:center;}
.ov-cell-tag{font-size:11px;color:var(--muted);text-align:center;padding:16px 0;font-style:italic;letter-spacing:.5px;}
`;
