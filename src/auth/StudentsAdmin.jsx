import { useState, useEffect, useCallback } from "react";
import {
  getTeacherPin, setTeacherPin, listStudents, createStudent, resendCode, removeStudent,
  verifyCode, registerPasskey, ApiError,
} from "./api.js";

// Teacher-only: roster, Add Student (SMS code -> passkey on THIS iPad), Remove Student.
// Styles are `sa-` prefixed and reuse the app's CSS variables and button classes.
const css = `
.sa-field{display:flex;flex-direction:column;gap:6px;}
.sa-input{background:var(--surface);border:1.5px solid var(--border);border-radius:var(--radius);color:var(--text);font-size:17px;padding:13px;font-family:'Source Sans 3',sans-serif;width:100%;box-sizing:border-box;}
.sa-input:focus{outline:none;border-color:var(--teacher);}
.sa-code{font-family:'Oswald',sans-serif;font-size:28px;letter-spacing:10px;text-align:center;}
.sa-seg{display:flex;gap:8px;}
.sa-seg button{flex:1;}
.sa-seg .on{border-color:var(--teacher);color:var(--teacher);background:rgba(192,132,252,.12);}
.sa-err{color:#f87171;font-size:14px;min-height:18px;}
.sa-note{font-size:13px;color:var(--muted);line-height:1.6;}
.sa-row{display:flex;align-items:center;gap:8px;background:var(--surface);border:1.5px solid var(--border);border-radius:var(--radius);padding:11px 13px;}
.sa-sub{font-size:12px;color:var(--muted);}
.sa-x{background:none;border:1.5px solid var(--border);border-radius:8px;color:var(--muted);padding:6px 10px;font-size:12px;cursor:pointer;font-family:'Oswald',sans-serif;letter-spacing:1px;}
.sa-x.danger{border-color:#f87171;color:#f87171;}
`;

const INSTRUMENTS = [["guitar", "🎸 Guitar"], ["bass", "🎸 Bass"], ["keys", "🎹 Keys"]];

export default function StudentsAdmin({ onRosterChange }) {
  const [pinOk, setPinOk] = useState(!!getTeacherPin());
  const [pinIn, setPinIn] = useState("");
  const [students, setStudents] = useState(null);
  const [err, setErr] = useState("");
  const [mode, setMode] = useState("list"); // list | form | code | done
  const [form, setForm] = useState({ name: "", instrument: "guitar", phone: "", role: "student" });
  const [current, setCurrent] = useState(null); // { id, name }
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState(null);

  const refresh = useCallback(async () => {
    try { setStudents(await listStudents()); setErr(""); }
    catch (e) {
      if (e instanceof ApiError && e.status === 401) setPinOk(false);
      else setErr(e.message);
    }
  }, []);
  useEffect(() => { if (pinOk) refresh(); }, [pinOk, refresh]);

  const run = async (fn) => {
    setBusy(true); setErr("");
    try { await fn(); }
    catch (e) { if (e instanceof ApiError && e.status === 401) setPinOk(false); setErr(e.message); }
    finally { setBusy(false); }
  };
  const changed = () => { refresh(); if (onRosterChange) onRosterChange(); };

  // A restored teacher session has no PIN in memory (it is never written to disk).
  if (!pinOk) return (
    <>
      <style>{css}</style>
      <div className="sec-lbl">Teacher PIN needed to manage students</div>
      <input className="sa-input sa-code" type="password" inputMode="numeric" maxLength={4} placeholder="••••"
        value={pinIn} onChange={(e) => setPinIn(e.target.value.replace(/\D/g, ""))} />
      <button className="teacher-btn" onClick={() => { setTeacherPin(pinIn); setPinIn(""); setPinOk(true); setErr(""); }}>Unlock</button>
      <div className="sa-err">{err}</div>
    </>
  );

  const startAdd = () => run(async () => {
    const r = await createStudent(form);
    setCurrent({ id: r.student.id, name: r.student.name });
    setCode(""); setMode("code"); changed();
  });

  // Verify the code, then immediately register the passkey on THIS device.
  const submitCode = () => run(async () => {
    const options = await verifyCode(current.id, code.trim());
    await finishPasskey(options);
  });
  const finishPasskey = async (options) => {
    await registerPasskey(current.id, options);
    setMode("done"); changed();
  };
  // If the Face ID sheet was dismissed the code is already accepted; ask for a fresh challenge, not a new text.
  const retryPasskey = () => run(async () => finishPasskey(await verifyCode(current.id)));
  const resend = () => run(async () => { await resendCode(current.id); setErr("New code sent."); });

  if (mode === "form") return (
    <>
      <style>{css}</style>
      <div className="sa-field"><div className="sec-lbl">Student name</div>
        <input className="sa-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoCapitalize="words" /></div>
      <div className="sa-field"><div className="sec-lbl">Instrument</div>
        <div className="sa-seg">{INSTRUMENTS.map(([v, l]) =>
          <button key={v} className={`ghost-btn ${form.instrument === v ? "on" : ""}`} onClick={() => setForm({ ...form, instrument: v })}>{l}</button>)}</div></div>
      <div className="sa-field"><div className="sec-lbl">Parent's mobile number</div>
        <input className="sa-input" type="tel" inputMode="tel" placeholder="(813) 555-0123 or +55…" value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
      <button className={`ghost-btn ${form.role === "teacher" ? "on" : ""}`} style={form.role === "teacher" ? { borderColor: "var(--teacher)", color: "var(--teacher)" } : null}
        onClick={() => setForm({ ...form, role: form.role === "teacher" ? "student" : "teacher" })}>
        {form.role === "teacher" ? "✓ Teacher / admin account (not shown to students)" : "Make this the teacher / admin account"}</button>
      <div className="sa-note">A text message with a 6-digit code goes to this number. Do this on the student's own iPad — the passkey is saved on the device you're holding.</div>
      <div className="sa-err">{err}</div>
      <button className="primary-btn" disabled={busy || !form.name.trim() || !form.phone.trim()} onClick={startAdd}>{busy ? "Sending…" : "Send code"}</button>
      <button className="ghost-btn" onClick={() => { setMode("list"); setErr(""); }}>Cancel</button>
    </>
  );

  if (mode === "code") return (
    <>
      <style>{css}</style>
      <div className="sec-lbl">Code sent for {current.name}</div>
      <div className="sa-note">Enter the 6-digit code from the text message. Then this iPad will ask for Face ID / Touch ID / passcode to save {current.name}'s passkey.</div>
      <input className="sa-input sa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••"
        value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
      <div className="sa-err">{err}</div>
      <button className="primary-btn" disabled={busy || code.length < 6} onClick={submitCode}>{busy ? "Working…" : "Verify & set up passkey"}</button>
      <button className="ghost-btn" disabled={busy} onClick={retryPasskey}>Code already accepted? Retry passkey</button>
      <button className="ghost-btn" disabled={busy} onClick={resend}>Send a new code</button>
      <button className="ghost-btn" onClick={() => { setMode("list"); setErr(""); }}>Finish later</button>
    </>
  );

  if (mode === "done") return (
    <>
      <style>{css}</style>
      <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 22, color: "var(--gold)" }}>✓ {current.name} is set up</div>
      <div className="sa-note">From now on {current.name} taps their name on this iPad and signs in with Face ID / Touch ID / passcode. No code or PIN.</div>
      <button className="primary-btn" onClick={() => setMode("list")}>Done</button>
    </>
  );

  return (
    <>
      <style>{css}</style>
      <div className="sec-lbl">Active students</div>
      {students === null && !err && <div className="sa-note">Loading…</div>}
      {students && students.length === 0 && <div className="sa-note">No students yet. Tap Add Student to enroll the first one.</div>}
      {(students || []).map((s) => (
        <div key={s.id} className="sa-row">
          <div style={{ flex: 1 }}>
            <div className="ro-name">{s.name}</div>
            <div className="sa-sub">{s.role === "teacher" ? "TEACHER · " : ""}{s.phone} · {s.enrolled ? "passkey set" : "not set up yet"}</div>
          </div>
          <div className="ro-inst">{s.instrument}</div>
          {!s.enrolled && <button className="sa-x" onClick={() => { setCurrent({ id: s.id, name: s.name }); setCode(""); setErr(""); run(() => resendCode(s.id)).then(() => setMode("code")); }}>SETUP</button>}
          {s.role === "teacher" ? null : confirmId === s.id
            ? <button className="sa-x danger" disabled={busy} onClick={() => run(async () => { await removeStudent(s.id); setConfirmId(null); changed(); })}>CONFIRM</button>
            : <button className="sa-x" onClick={() => setConfirmId(s.id)}>REMOVE</button>}
        </div>
      ))}
      <div className="sa-err">{err}</div>
      <div className="sa-note">Removing a student hides them from the sign-in list. Their practice history stays on the iPad and returns if the same name is added again.</div>
      <button className="teacher-btn" onClick={() => { setForm({ name: "", instrument: "guitar", phone: "", role: "student" }); setErr(""); setMode("form"); }}>＋ Add Student</button>
    </>
  );
}
