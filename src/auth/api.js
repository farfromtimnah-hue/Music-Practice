// Client for music-practice-api (Cloudflare Worker + Stytch passkeys).
// Teacher calls send the teacher PIN as X-Teacher-PIN; students never send a secret,
// they prove themselves with the iPad's own passkey (Face ID / Touch ID / passcode).

export const API_URL = import.meta.env.VITE_API_URL || "https://music-practice-api.musicpractice.workers.dev";

// ---- teacher PIN (memory + sessionStorage only; never localStorage) ----
const PIN_KEY = "mp_tpin";
let pinMem = "";
export const setTeacherPin = (p) => { pinMem = p; try { sessionStorage.setItem(PIN_KEY, p); } catch (e) { /* ignore */ } };
export const getTeacherPin = () => {
  if (pinMem) return pinMem;
  try { pinMem = sessionStorage.getItem(PIN_KEY) || ""; } catch (e) { /* ignore */ }
  return pinMem;
};
// A teacher who signed in with a passkey holds a short-lived Worker token instead of the PIN.
const TOK_KEY = "mp_ttok";
let tokMem = "";
export const setTeacherToken = (t) => { tokMem = t; try { sessionStorage.setItem(TOK_KEY, t); } catch (e) { /* ignore */ } };
const getTeacherToken = () => {
  if (tokMem) return tokMem;
  try { tokMem = sessionStorage.getItem(TOK_KEY) || ""; } catch (e) { /* ignore */ }
  return tokMem;
};
export const hasTeacherAuth = () => !!(getTeacherPin() || getTeacherToken());
export const clearTeacherPin = () => {
  pinMem = ""; tokMem = "";
  try { sessionStorage.removeItem(PIN_KEY); sessionStorage.removeItem(TOK_KEY); } catch (e) { /* ignore */ }
};

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const call = async (method, path, body, { teacher = false } = {}) => {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (teacher) {
    if (getTeacherPin()) headers["X-Teacher-PIN"] = getTeacherPin();
    else if (getTeacherToken()) headers["X-Teacher-Token"] = getTeacherToken();
  }
  let res;
  try {
    res = await fetch(API_URL + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (e) {
    throw new ApiError(0, "Can't reach the server — check the internet connection");
  }
  let data = null;
  try { data = await res.json(); } catch (e) { /* non-JSON */ }
  if (!res.ok) throw new ApiError(res.status, (data && data.error) || `Request failed (${res.status})`);
  return data;
};

// ---- roster / admin ----
export const fetchRoster = () => call("GET", "/roster").then((d) => d.students);
export const listStudents = () => call("GET", "/students", undefined, { teacher: true }).then((d) => d.students);
export const createStudent = (s) => call("POST", "/students", s, { teacher: true });
export const resendCode = (id) => call("POST", `/students/${id}/resend`, {}, { teacher: true });
export const removeStudent = (id) => call("POST", `/students/${id}/remove`, {}, { teacher: true });

// ---- WebAuthn plumbing ----
const b64uToBuf = (s) => {
  const p = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(p);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
};
const bufToB64u = (buf) => {
  const b = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const decodeDescriptors = (list) => (list || []).map((d) => ({ ...d, id: b64uToBuf(d.id) }));

const webauthnSupported = () => typeof window !== "undefined" && !!window.PublicKeyCredential && !!navigator.credentials;

// Stytch's serialization shape (see their WebAuthn API guide, step 4).
const serializeAttestation = (c) => ({
  id: c.id,
  rawId: bufToB64u(c.rawId),
  type: c.type,
  authenticatorAttachment: c.authenticatorAttachment || undefined,
  response: {
    clientDataJSON: bufToB64u(c.response.clientDataJSON),
    attestationObject: bufToB64u(c.response.attestationObject),
  },
});
const serializeAssertion = (c) => ({
  id: c.id,
  rawId: bufToB64u(c.rawId),
  type: c.type,
  authenticatorAttachment: c.authenticatorAttachment || undefined,
  response: {
    clientDataJSON: bufToB64u(c.response.clientDataJSON),
    authenticatorData: bufToB64u(c.response.authenticatorData),
    signature: bufToB64u(c.response.signature),
    userHandle: c.response.userHandle ? bufToB64u(c.response.userHandle) : null,
  },
});

const friendlyWebAuthnError = (e) => {
  if (e && e.name === "NotAllowedError") return "Cancelled or no passkey for this student on this iPad.";
  if (e && e.name === "InvalidStateError") return "This iPad already has a passkey for that student.";
  return (e && e.message) || "Passkey failed";
};

// ---- enrollment (teacher-initiated, on the student's own iPad) ----
/** Check the SMS code. Resolves with the passkey creation options. Omit `code` to re-issue a challenge right after a verified code. */
export const verifyCode = (id, code) =>
  call("POST", `/students/${id}/verify`, code ? { code } : {}).then((d) => d.public_key_credential_creation_options);

/** Create the passkey on THIS device, then complete registration. */
export const registerPasskey = async (id, options) => {
  if (!webauthnSupported()) throw new ApiError(0, "This browser doesn't support passkeys");
  let cred;
  try {
    cred = await navigator.credentials.create({
      publicKey: {
        ...options,
        challenge: b64uToBuf(options.challenge),
        user: { ...options.user, id: b64uToBuf(options.user.id) },
        excludeCredentials: decodeDescriptors(options.excludeCredentials),
      },
    });
  } catch (e) { throw new ApiError(0, friendlyWebAuthnError(e)); }
  return call("POST", `/students/${id}/passkey`, { public_key_credential: JSON.stringify(serializeAttestation(cred)) });
};

// ---- sign-in ----
// Shared ceremony: ask the Worker for a challenge, let the device answer it, send the answer back.
const passkeyCeremony = async (startBody) => {
  if (!webauthnSupported()) throw new ApiError(0, "This browser doesn't support passkeys");
  const { public_key_credential_request_options: o } = await call("POST", "/auth/passkey/start", startBody);
  let cred;
  try {
    cred = await navigator.credentials.get({
      publicKey: { ...o, challenge: b64uToBuf(o.challenge), allowCredentials: decodeDescriptors(o.allowCredentials) },
    });
  } catch (e) { throw new ApiError(0, friendlyWebAuthnError(e)); }
  return call("POST", "/auth/passkey", { ...startBody, public_key_credential: JSON.stringify(serializeAssertion(cred)) });
};
export const signInWithPasskey = (id) => passkeyCeremony({ student_id: id });
export const signInTeacherWithPasskey = async () => {
  const r = await passkeyCeremony({ role: "teacher" });
  setTeacherToken(r.teacher_token); // unlocks the teacher-only API calls, like the PIN does
  return r;
};
