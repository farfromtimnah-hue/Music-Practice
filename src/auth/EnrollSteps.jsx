import { useState } from "react";

// Shared by the teacher-present flow (StudentsAdmin) and the invite page (Invite):
// enter the SMS code -> save the passkey on THIS device -> done. The two callers differ only
// in the `driver` they pass in (which API routes the three calls go to).
export const css = `
.sa-field{display:flex;flex-direction:column;gap:6px;}
.sa-input{background:var(--surface);border:1.5px solid var(--border);border-radius:var(--radius);color:var(--text);font-size:17px;padding:13px;font-family:'Source Sans 3',sans-serif;width:100%;box-sizing:border-box;}
.sa-input:focus{outline:none;border-color:var(--teacher);}
.sa-code{font-family:'Oswald',sans-serif;font-size:28px;letter-spacing:10px;text-align:center;}
.sa-seg{display:flex;gap:8px;}
.sa-seg button{flex:1;}
.sa-err{color:#f87171;font-size:14px;min-height:18px;}
.sa-note{font-size:13px;color:var(--muted);line-height:1.6;}
.sa-row{display:flex;align-items:center;gap:8px;background:var(--surface);border:1.5px solid var(--border);border-radius:var(--radius);padding:11px 13px;}
.sa-sub{font-size:12px;color:var(--muted);}
.sa-x{background:none;border:1.5px solid var(--border);border-radius:8px;color:var(--muted);padding:6px 10px;font-size:12px;cursor:pointer;font-family:'Oswald',sans-serif;letter-spacing:1px;}
.sa-x.danger{border-color:#f87171;color:#f87171;}
.sa-link{font-size:12px;word-break:break-all;background:var(--surface2);border:1.5px solid var(--border);border-radius:var(--radius);padding:10px;color:var(--text);user-select:all;}
`;

/**
 * driver = { verify(code?) -> creation options, register(options), resend() }
 * Props: name, onDone(), onLater() (the "Finish later" exit), doneText.
 */
export function EnrollFlow({ driver, name, onDone, onLater, doneText }) {
  const [phase, setPhase] = useState("code");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const run = async (fn) => {
    setBusy(true); setErr("");
    try { await fn(); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const finish = async (options) => { await driver.register(options); setPhase("done"); };
  const submit = () => run(async () => finish(await driver.verify(code.trim())));
  // If the Face ID sheet was dismissed the code is already accepted; ask for a fresh challenge, not a new text.
  const retry = () => run(async () => finish(await driver.verify()));
  const resend = () => run(async () => { await driver.resend(); setErr("New code sent."); });

  if (phase === "done") return (
    <>
      <style>{css}</style>
      <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 22, color: "var(--gold)" }}>✓ {name} is set up</div>
      <div className="sa-note">{doneText || `From now on ${name} taps their name on this iPad and signs in with Face ID / Touch ID / passcode. No code or PIN.`}</div>
      <button className="primary-btn" onClick={onDone}>Done</button>
    </>
  );

  return (
    <>
      <style>{css}</style>
      <div className="sec-lbl">Code sent for {name}</div>
      <div className="sa-note">Enter the 6-digit code from the text message. Then this device will ask for Face ID / Touch ID / passcode to save {name}'s passkey.</div>
      <input className="sa-input sa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••"
        value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
      <div className="sa-err">{err}</div>
      <button className="primary-btn" disabled={busy || code.length < 6} onClick={submit}>{busy ? "Working…" : "Verify & set up passkey"}</button>
      <button className="ghost-btn" disabled={busy} onClick={retry}>Code already accepted? Retry passkey</button>
      <button className="ghost-btn" disabled={busy} onClick={resend}>Send a new code</button>
      {onLater && <button className="ghost-btn" onClick={onLater}>Finish later</button>}
    </>
  );
}
