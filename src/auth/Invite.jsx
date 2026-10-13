import { useState, useEffect } from "react";
import { inviteInfo, inviteSend, inviteVerify, inviteRegister } from "./api.js";
import { css, EnrollFlow } from "./EnrollSteps.jsx";

// Opened from a link the teacher texted (#/invite/<token>). No sign-in: the token in the URL
// identifies ONE row, and the phone number on file never reaches this page — the Worker texts it.
export default function Invite({ token, onExit }) {
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    inviteInfo(token).then(setInfo).catch((e) => setErr(e.message));
  }, [token]);

  const send = async () => {
    setBusy(true); setErr("");
    try { await inviteSend(token); setSent(true); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const driver = {
    verify: (code) => inviteVerify(token, code),
    register: (options) => inviteRegister(token, options),
    resend: () => inviteSend(token),
  };

  return (
    <div className="name-screen" style={{ maxWidth: 420, margin: "0 auto" }}>
      <style>{css}</style>
      <div><div className="pin-logo">♩♪♫♬</div><div className="pin-sub">Circle of Fifths</div></div>
      {!info && !err && <div className="sa-note">Loading…</div>}
      {!info && err && <>
        <div className="sa-err" style={{ textAlign: "center" }}>{err}</div>
        <button className="ghost-btn" onClick={onExit}>Go to the app</button>
      </>}
      {info && !sent && <>
        <div className="pin-name" style={{ color: "var(--gold)" }}>Hi, {info.name}</div>
        <div className="sa-note" style={{ textAlign: "center" }}>
          Let's set up this device so {info.name} can sign in with Face ID / Touch ID — no PIN.
          We'll text a 6-digit code to the number your teacher has on file.
        </div>
        <div className="sa-err" style={{ textAlign: "center" }}>{err}</div>
        <button className="primary-btn" disabled={busy} onClick={send}>{busy ? "Sending…" : "Send code"}</button>
      </>}
      {info && sent && <EnrollFlow driver={driver} name={info.name} onDone={onExit} onLater={onExit}
        doneText={`${info.name} can now open the app on this device, tap their name, and sign in with Face ID / Touch ID / passcode.`} />}
    </div>
  );
}
