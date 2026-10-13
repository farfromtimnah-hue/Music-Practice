import stytch from "stytch";

const INSTRUMENTS = ["guitar", "bass", "keys"];
const PROD_ORIGINS = ["https://farfromtimnah-hue.github.io"];
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const ENROLL_WINDOW_MS = 10 * 60 * 1000; // OTP verified -> passkey must be registered within this
const RESEND_COOLDOWN_MS = 30 * 1000;

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const originAllowed = (o) => !!o && (PROD_ORIGINS.includes(o) || LOCAL_ORIGIN.test(o));

const corsHeaders = (req) => {
  const o = req.headers.get("Origin");
  const h = { Vary: "Origin" };
  if (originAllowed(o)) {
    h["Access-Control-Allow-Origin"] = o;
    h["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    h["Access-Control-Allow-Headers"] = "Content-Type, X-Teacher-PIN, X-Teacher-Token";
    h["Access-Control-Max-Age"] = "86400";
  }
  return h;
};

const json = (req, body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders(req) },
  });

const client = (env) =>
  new stytch.Client({ project_id: env.STYTCH_PROJECT_ID, secret: env.STYTCH_SECRET });

// Constant-time compare so the PIN gate does not leak by timing.
const safeEqual = (a, b) => {
  const x = new TextEncoder().encode(String(a));
  const y = new TextEncoder().encode(String(b));
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] || 0) ^ (y[i] || 0);
  return d === 0;
};

// A teacher who signed in with a passkey has no PIN to send, so the Worker hands back a
// short-lived HMAC token (keyed with the Stytch secret) that unlocks the same teacher calls.
const TEACHER_TOKEN_MS = 8 * 60 * 60 * 1000;
const hmacHex = async (env, msg) => {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.STYTCH_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
};
const mintTeacherToken = async (env, teacherId) => {
  const exp = Date.now() + TEACHER_TOKEN_MS;
  return `${teacherId}.${exp}.${await hmacHex(env, `teacher.${teacherId}.${exp}`)}`;
};
const requireTeacher = async (req, env) => {
  // PIN retired 2026-10-12: a working teacher passkey exists, so the shared 4-digit
  // secret is no longer accepted here. The Worker secret TEACHER_PIN is left unset/unused
  // on purpose rather than deleted, in case it needs to be restored.
  const [id, exp, sig] = (req.headers.get("X-Teacher-Token") || "").split(".");
  if (sig && Number(exp) > Date.now() && safeEqual(sig, await hmacHex(env, `teacher.${id}.${exp}`))) {
    const t = await env.DB.prepare("SELECT 1 FROM students WHERE id = ? AND role = 'teacher' AND active = 1").bind(Number(id)).first();
    if (t) return;
  }
  throw new HttpError(401, "Teacher sign-in required");
};

// WebAuthn binds a passkey to the page's hostname (the RP ID), so it comes from the
// caller's Origin, never from the body — and only allow-listed origins qualify.
const rpDomain = (req) => {
  const o = req.headers.get("Origin");
  if (!originAllowed(o)) throw new HttpError(403, "Origin not allowed");
  return new URL(o).hostname;
};

const normalizePhone = (raw) => {
  let p = String(raw || "").replace(/[\s().-]/g, "");
  if (/^\d{10}$/.test(p)) p = "+1" + p;
  else if (/^1\d{10}$/.test(p)) p = "+" + p;
  if (!/^\+[1-9]\d{7,14}$/.test(p)) throw new HttpError(400, "Enter the phone as +<country code><number> (US numbers can be 10 digits)");
  return p;
};

const readBody = async (req) => {
  try { return await req.json(); } catch { throw new HttpError(400, "Body must be JSON"); }
};

const getStudent = async (env, id) => {
  const s = await env.DB.prepare("SELECT * FROM students WHERE id = ? AND active = 1").bind(Number(id)).first();
  if (!s) throw new HttpError(404, "No such student");
  return s;
};

const ids = (s) => (s.passkey_ids ? s.passkey_ids.split(",") : []);
const publicStudent = (s) => ({ id: s.id, name: s.name, instrument: s.instrument, enrolled: ids(s).length > 0 });
const teacherStudent = (s) => ({ ...publicStudent(s), role: s.role, phone: s.phone, created_at: s.created_at, active: !!s.active });

// Send (or re-send) the SMS passcode. loginOrCreate creates the Stytch user on first use.
const sendOtp = async (env, student) => {
  const res = await client(env).otps.sms.loginOrCreate({ phone_number: student.phone, expiration_minutes: 10 });
  await env.DB.prepare(
    "UPDATE students SET stytch_user_id = ?, otp_method_id = ?, otp_sent_at = ?, verified_at = NULL WHERE id = ?"
  ).bind(res.user_id, res.phone_id, new Date().toISOString(), student.id).run();
  return res.user_id;
};

const registrationOptions = async (env, req, userId) => {
  const r = await client(env).webauthn.registerStart({
    user_id: userId,
    domain: rpDomain(req),
    authenticator_type: "platform",             // the iPad's own Face ID / Touch ID / passcode
    return_passkey_credential_options: true,
    use_base64_url_encoding: true,              // for navigator.credentials.create()
  });
  return JSON.parse(r.public_key_credential_creation_options);
};

const routes = [
  // Public, minimal: the name picker needs this before anyone has signed in.
  ["GET", /^\/roster$/, async (req, env) => {
    const { results } = await env.DB.prepare("SELECT * FROM students WHERE active = 1 AND role = 'student' ORDER BY name COLLATE NOCASE").all();
    return { students: results.map(publicStudent) };
  }],

  ["GET", /^\/students$/, async (req, env) => {
    await requireTeacher(req, env);
    const { results } = await env.DB.prepare("SELECT * FROM students WHERE active = 1 ORDER BY name COLLATE NOCASE").all();
    return { students: results.map(teacherStudent) };
  }],

  ["POST", /^\/students$/, async (req, env) => {
    await requireTeacher(req, env);
    const b = await readBody(req);
    const name = String(b.name || "").trim();
    const instrument = String(b.instrument || "");
    if (!name || name.length > 40) throw new HttpError(400, "Name is required (40 characters max)");
    if (!INSTRUMENTS.includes(instrument)) throw new HttpError(400, "Instrument must be guitar, bass or keys");
    const phone = normalizePhone(b.phone);
    const role = b.role === "teacher" ? "teacher" : "student";
    let row;
    try {
      row = await env.DB.prepare("INSERT INTO students (name, instrument, phone, role) VALUES (?, ?, ?, ?) RETURNING *")
        .bind(name, instrument, phone, role).first();
    } catch (e) {
      if (/UNIQUE/i.test(String(e.message))) throw new HttpError(409, `${name} is already on the roster`);
      throw e;
    }
    try { await sendOtp(env, row); }
    catch (e) {
      // Do not leave a student nobody can enroll: roll the row back (it never had history).
      await env.DB.prepare("DELETE FROM students WHERE id = ?").bind(row.id).run();
      throw e;
    }
    return { student: publicStudent(await getStudent(env, row.id)), otp_sent: true };
  }, 201],

  ["POST", /^\/students\/(\d+)\/resend$/, async (req, env, m) => {
    await requireTeacher(req, env);
    const s = await getStudent(env, m[1]);
    if (s.otp_sent_at && Date.now() - Date.parse(s.otp_sent_at) < RESEND_COOLDOWN_MS)
      throw new HttpError(429, "A code was just sent — wait a few seconds");
    await sendOtp(env, s);
    return { otp_sent: true };
  }],

  // Check the SMS code, then hand back the passkey registration challenge.
  ["POST", /^\/students\/(\d+)\/verify$/, async (req, env, m) => {
    const s = await getStudent(env, m[1]);
    const b = await readBody(req);
    const fresh = s.verified_at && Date.now() - Date.parse(s.verified_at) < ENROLL_WINDOW_MS;
    if (b.code) {
      if (!s.otp_method_id) throw new HttpError(400, "No code has been sent for this student");
      await client(env).otps.authenticate({ method_id: s.otp_method_id, code: String(b.code).trim() });
      await env.DB.prepare("UPDATE students SET verified_at = ?, otp_method_id = NULL WHERE id = ?")
        .bind(new Date().toISOString(), s.id).run();
    } else if (!fresh) {
      throw new HttpError(400, "Enter the code from the text message");
    } // else: code accepted moments ago (e.g. the passkey sheet was dismissed) — issue a new challenge
    return {
      verified: true,
      student: publicStudent(s),
      public_key_credential_creation_options: await registrationOptions(env, req, s.stytch_user_id),
    };
  }],

  ["POST", /^\/students\/(\d+)\/passkey$/, async (req, env, m) => {
    const s = await getStudent(env, m[1]);
    if (!s.verified_at || Date.now() - Date.parse(s.verified_at) > ENROLL_WINDOW_MS)
      throw new HttpError(403, "Phone not verified (or the setup window expired) — ask the teacher to send a new code");
    const b = await readBody(req);
    if (!b.public_key_credential) throw new HttpError(400, "public_key_credential required");
    const r = await client(env).webauthn.register({
      user_id: s.stytch_user_id,
      public_key_credential: typeof b.public_key_credential === "string" ? b.public_key_credential : JSON.stringify(b.public_key_credential),
    });
    await env.DB.prepare("UPDATE students SET passkey_ids = ?, verified_at = NULL WHERE id = ?")
      .bind([...ids(s), r.webauthn_registration_id].join(","), s.id).run();
    return { registered: true, student: { ...publicStudent(s), enrolled: true }, webauthn_registration_id: r.webauthn_registration_id };
  }],

  ["POST", /^\/auth\/passkey\/start$/, async (req, env) => {
    const b = await readBody(req);
    if (b.role === "teacher") {
      // No user_id: Stytch issues a challenge for any passkey on this domain; /auth/passkey then
      // matches the answer to an enrolled teacher row. /roster stays student-only.
      const t = await env.DB.prepare("SELECT 1 FROM students WHERE role = 'teacher' AND active = 1 AND passkey_ids IS NOT NULL AND passkey_ids != ''").first();
      if (!t) throw new HttpError(409, "No teacher passkey is set up yet");
      const r = await client(env).webauthn.authenticateStart({
        domain: rpDomain(req), return_passkey_credential_options: true, use_base64_url_encoding: true,
      });
      return { public_key_credential_request_options: JSON.parse(r.public_key_credential_request_options) };
    }
    const s = await getStudent(env, b.student_id);
    if (!ids(s).length) throw new HttpError(409, "This student has no passkey yet — ask the teacher to set them up");
    const r = await client(env).webauthn.authenticateStart({
      user_id: s.stytch_user_id,
      domain: rpDomain(req),
      return_passkey_credential_options: true,
      use_base64_url_encoding: true,
    });
    return { public_key_credential_request_options: JSON.parse(r.public_key_credential_request_options) };
  }],

  ["POST", /^\/auth\/passkey$/, async (req, env) => {
    const b = await readBody(req);
    if (!b.public_key_credential) throw new HttpError(400, "public_key_credential required");
    if (b.role === "teacher") {
      const r = await client(env).webauthn.authenticate({
        public_key_credential: typeof b.public_key_credential === "string" ? b.public_key_credential : JSON.stringify(b.public_key_credential),
        session_duration_minutes: 60,
      });
      const { results } = await env.DB.prepare("SELECT * FROM students WHERE role = 'teacher' AND active = 1 AND stytch_user_id = ?").bind(r.user_id).all();
      const t = results.find((x) => ids(x).includes(r.webauthn_registration_id));
      if (!t) throw new HttpError(401, "That passkey does not belong to a teacher account");
      return { authenticated: true, role: "teacher", student: publicStudent(t), session_token: r.session_token, teacher_token: await mintTeacherToken(env, t.id) };
    }
    const s = await getStudent(env, b.student_id);
    const r = await client(env).webauthn.authenticate({
      public_key_credential: typeof b.public_key_credential === "string" ? b.public_key_credential : JSON.stringify(b.public_key_credential),
      session_duration_minutes: 60,
    });
    // The passkey must be one registered for THIS student (siblings can share a parent phone / Stytch user).
    if (r.user_id !== s.stytch_user_id || !ids(s).includes(r.webauthn_registration_id))
      throw new HttpError(401, "That passkey does not belong to this student");
    return { authenticated: true, student: publicStudent(s), session_token: r.session_token };
  }],

  ["POST", /^\/students\/(\d+)\/remove$/, async (req, env, m) => {
    await requireTeacher(req, env);
    const s = await getStudent(env, m[1]);
    if (s.role === "teacher") throw new HttpError(400, "The teacher account can't be removed here");
    await env.DB.prepare("UPDATE students SET active = 0 WHERE id = ?").bind(s.id).run(); // soft delete: row + name kept for history
    return { removed: true, id: s.id, name: s.name };
  }],
];

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
    const { pathname } = new URL(req.url);
    try {
      for (const [method, re, handler, okStatus] of routes) {
        const m = pathname.match(re);
        if (m && method === req.method) return json(req, await handler(req, env, m), okStatus || 200);
      }
      throw new HttpError(404, "Not found");
    } catch (e) {
      if (e instanceof HttpError) return json(req, { error: e.message }, e.status);
      // Stytch SDK errors carry a status code and a readable message.
      if (e && e.status_code) {
        console.log("stytch error", e.status_code, e.error_type, e.error_message);
        return json(req, { error: e.error_message || "Stytch error", error_type: e.error_type }, e.status_code >= 500 ? 502 : 400);
      }
      console.log("unhandled", (e && e.stack) || e);
      return json(req, { error: "Server error" }, 500);
    }
  },
};
