import { useState, useEffect, useCallback } from "react";
import {
  hasTeacherAuth, listStudents, createStudent, resendCode, removeStudent,
  issueInvite, inviteLink, verifyCode, registerPasskey, ApiError,
} from "./api.js";
import { css, EnrollFlow } from "./EnrollSteps.jsx";

// Teacher-only: roster, Add Student, Remove Student.
// Two ways to enroll: (1) send an invite LINK the parent opens on the student's own device, or
// (2) hold the student's device and do it on the spot (teacher-present).
// Styles are `sa-` prefixed (EnrollSteps.css) and reuse the app's CSS variables and button classes.

const INSTRUMENTS = [["guitar", "🎸 Guitar"], ["bass", "🎸 Bass"], ["keys", "🎹 Keys"]];
const EMPTY = { name: "", instrument: "guitar", phone: "", role: "student" };
const fmtExp = (iso) => new Date(iso).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
const linkLive = (s) => s.invite_token && s.invite_expires_at && Date.parse(s.invite_expires_at) > Date.now();

export default function StudentsAdmin({ onRosterChange }) {
  const [pinOk, setPinOk] = useState(hasTeacherAuth());
  const [students, setStudents] = useState(null);
  const [err, setErr] = useState("");
  const [mode, setMode] = useState("list"); // list | form | invite | enroll
  const [form, setForm] = useState(EMPTY);
  const [current, setCurrent] = useState(null); // { id, name, token, expires }
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [copied, setCopied] = useState(false);

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
  const back = () => { setMode("list"); setErr(""); setCopied(false); };

  // PIN retired 2026-10-12. A teacher reaches this screen only via a signed-in passkey
  // session (hasTeacherAuth() checks the token, not a PIN) — if that session expired,
  // the fix is signing in again on the name screen, not typing a PIN here.
  if (!pinOk) return (
    <>
      <style>{css}</style>
      <div className="sec-lbl">Your teacher sign-in expired. Go back and sign in again with Face ID / Touch ID.</div>
      <div className="sa-err">{err}</div>
    </>
  );

  // Create the row; `invite` = no text now, just a link to send. Otherwise text the code now.
  const create = (invite) => run(async () => {
    const r = await createStudent({ ...form, mode: invite ? "invite" : undefined });
    setCurrent({ id: r.student.id, name: r.student.name, token: r.invite_token, expires: r.invite_expires_at });
    setMode(invite ? "invite" : "enroll"); changed();
  });
  const showLink = (s) => run(async () => {
    const t = linkLive(s) ? { invite_token: s.invite_token, invite_expires_at: s.invite_expires_at } : await issueInvite(s.id);
    setCurrent({ id: s.id, name: s.name, token: t.invite_token, expires: t.invite_expires_at });
    setCopied(false); setMode("invite"); changed();
  });
  const startHere = (s) => run(async () => {
    await resendCode(s.id);
    setCurrent({ id: s.id, name: s.name }); setMode("enroll");
  });

  if (mode === "form") return (
    <>
      <style>{css}</style>
      <div className="sa-field"><div className="sec-lbl">Name</div>
        <input className="sa-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoCapitalize="words" /></div>
      <div className="sa-field"><div className="sec-lbl">Instrument</div>
        <div className="sa-seg">{INSTRUMENTS.map(([v, l]) =>
          <button key={v} className="ghost-btn" style={form.instrument === v ? { borderColor: "var(--teacher)", color: "var(--teacher)", background: "rgba(192,132,252,.12)" } : null}
            onClick={() => setForm({ ...form, instrument: v })}>{l}</button>)}</div></div>
      <div className="sa-field"><div className="sec-lbl">Parent's mobile number</div>
        <input className="sa-input" type="tel" inputMode="tel" placeholder="(813) 555-0123 or +55…" value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
      <button className="ghost-btn" style={form.role === "teacher" ? { borderColor: "var(--teacher)", color: "var(--teacher)" } : null}
        onClick={() => setForm({ ...form, role: form.role === "teacher" ? "student" : "teacher" })}>
        {form.role === "teacher" ? "✓ Teacher / admin account (not shown to students)" : "Make this the teacher / admin account"}</button>
      <div className="sa-err">{err}</div>
      <button className="primary-btn" disabled={busy || !form.name.trim() || !form.phone.trim()} onClick={() => create(true)}>{busy ? "Working…" : "Create invite link"}</button>
      <div className="sa-note">You get a link to text to the parent. They open it on the student's own device, tap Send code, and set up the passkey there. Nothing is texted until they do.</div>
      <button className="ghost-btn" disabled={busy || !form.name.trim() || !form.phone.trim()} onClick={() => create(false)}>I'm holding their device — text the code now</button>
      <button className="ghost-btn" onClick={back}>Cancel</button>
    </>
  );

  if (mode === "invite") {
    const link = inviteLink(current.token);
    const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch (e) { setErr("Press and hold the link to copy it."); } };
    const text = `Hi! Open this on ${current.name}'s own device to set up sign-in for Circle of Fifths: ${link}`;
    return (
      <>
        <style>{css}</style>
        <div className="sec-lbl">Invite link for {current.name}</div>
        <div className="sa-link">{link}</div>
        <button className="primary-btn" onClick={copy}>{copied ? "✓ Copied" : "Copy link"}</button>
        <a className="teacher-btn" style={{ textAlign: "center", textDecoration: "none", boxSizing: "border-box" }} href={`sms:?&body=${encodeURIComponent(text)}`}>Open in Messages</a>
        <div className="sa-note">Expires {fmtExp(current.expires)} (72 hours). Anyone with the link can start setup for {current.name} only, and they still need the code texted to the number on file. A new link replaces this one.</div>
        <div className="sa-err">{err}</div>
        <button className="ghost-btn" onClick={back}>Done</button>
      </>
    );
  }

  if (mode === "enroll") return (
    <EnrollFlow name={current.name}
      driver={{ verify: (c) => verifyCode(current.id, c), register: (o) => registerPasskey(current.id, o), resend: () => resendCode(current.id) }}
      onDone={() => { changed(); back(); }} onLater={() => { changed(); back(); }} />
  );

  return (
    <>
      <style>{css}</style>
      <div className="sec-lbl">Active students</div>
      {students === null && !err && <div className="sa-note">Loading…</div>}
      {students && students.length === 0 && <div className="sa-note">No students yet. Tap Add Student to enroll the first one.</div>}
      {(students || []).map((s) => (
        <div key={s.id} className="sa-row" style={{ flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 120 }}>
            <div className="ro-name">{s.name}</div>
            <div className="sa-sub">{s.role === "teacher" ? "TEACHER · " : ""}{s.phone} · {s.enrolled ? "passkey set" : "not set up yet"}</div>
          </div>
          <div className="ro-inst">{s.instrument}</div>
          <button className="sa-x" disabled={busy} onClick={() => showLink(s)}>{linkLive(s) ? "LINK" : "NEW LINK"}</button>
          {!s.enrolled && <button className="sa-x" disabled={busy} onClick={() => startHere(s)}>SETUP HERE</button>}
          {s.role === "teacher" ? null : confirmId === s.id
            ? <button className="sa-x danger" disabled={busy} onClick={() => run(async () => { await removeStudent(s.id); setConfirmId(null); changed(); })}>CONFIRM</button>
            : <button className="sa-x" onClick={() => setConfirmId(s.id)}>REMOVE</button>}
        </div>
      ))}
      <div className="sa-err">{err}</div>
      <div className="sa-note">Removing a student hides them from the sign-in list. Their practice history stays on the iPad and returns if the same name is added again.</div>
      <button className="teacher-btn" onClick={() => { setForm(EMPTY); setErr(""); setMode("form"); }}>＋ Add Student</button>
    </>
  );
}
