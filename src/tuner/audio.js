/* ------------------------------------------------------------------
   audio.js — microphone capture and the reference tone.

   Everything that differs between the two mic modes lives here. The
   detection maths lives in pitch.js and is shared verbatim, so the
   experiment actually compares mic strategies rather than algorithms.
   ------------------------------------------------------------------ */

import { BUFFER_SIZE } from "./pitch.js";

/* ------------------------------------------------------------------
   CONSTRAINT LADDERS.

   OBSERVED ON A REAL iPAD. With echoCancellation:false the tuner
   detected NOTHING — not a guitar, not a shout — while every indicator
   read healthy: context running, mic granted, recording light on. With
   echoCancellation:true a SUNG note detected and a guitar still did
   not. Two separate faults stacked on one flag:

     1. echoCancellation:false yields a SILENT STREAM on iOS Safari.
        Asking for raw capture gets a track that is handed back happily
        and then delivers nothing but zeros for ever. It does not
        reject the constraint, so nothing anywhere reports a problem.

     2. echoCancellation:true routes capture through iOS's VOICE
        PROCESSING — aggressive high-pass plus noise gating. That
        pipeline treats a held guitar note as stationary background and
        gates it away while passing speech cleanly. Hence the exact
        asymmetry reported: singing detects, the guitar does not.

   So neither extreme works, and the fix is a LADDER rather than a
   flag: try the ideal first, measure whether audio actually arrives,
   and fall back a rung at a time. Each rung is tried in full — asked
   for, wired up, and PROVED to deliver non-zero samples — before the
   next is considered.

   iOS ignores constraints it does not honour rather than erroring, so
   what was asked for tells you nothing. Every rung reads back
   MediaStreamTrack.getSettings() and that is what the diagnostic
   shows: what the device ACTUALLY applied.

   channelCount:1 and an explicit sampleRate are requested because on
   some iOS versions they select a different capture path entirely. */

/* Rung 1 — the ideal. Raw capture, nothing in the way of the string.
   This is the one that returns silence on the affected iPads, which is
   precisely why it can no longer be the only thing we try. */
const RAW = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: 1,
};

/* Rung 2 — raw, without the extra hints. If channelCount or sampleRate
   is what pushed iOS onto the dead capture path, this is the rung that
   finds out. */
const RAW_PLAIN = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
};

/* Rung 3 — the compromise, and the important one. Echo cancellation ON
   because that is the pipeline that demonstrably delivers samples on
   this hardware, but noiseSuppression and autoGainControl explicitly
   OFF, asking that pipeline not to gate what it is passing. A sustained
   30.87 Hz low B is exactly what a speech denoiser throws away. */
const PROCESSED_UNGATED = {
  echoCancellation: true,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: 1,
};

/* Rung 4 — last resort. Whatever the device wants to give us. Better a
   gated stream than no stream: a voice detects through this, so the
   tuner is degraded rather than dead. */
const DEFAULTS = true;

/* MODE A — Pause Cycle. The mic is muted while the reference tone
   plays, so the browser never hears our own tone and echo cancellation
   has no work to do. Raw capture is genuinely preferable here; the
   ladder exists because "preferable" and "functional" parted company
   on iOS. */
export const CONSTRAINTS_PAUSE = [
  { id: "raw", label: "raw (no AEC/NS/AGC, mono)", audio: RAW },
  { id: "raw-plain", label: "raw (no AEC/NS/AGC)", audio: RAW_PLAIN },
  { id: "aec-ungated", label: "AEC on, NS/AGC off", audio: PROCESSED_UNGATED },
  { id: "device-default", label: "device defaults", audio: DEFAULTS },
];

/* MODE B — Continuous (experimental). The tone and the mic run at the
   same time, so echo cancellation is the only thing that could stop the
   tone swamping the string: the AEC rung leads. Raw still follows,
   because a silent stream is worse than an un-cancelled one. */
export const CONSTRAINTS_CONTINUOUS = [
  { id: "aec-ungated", label: "AEC on, NS/AGC off", audio: PROCESSED_UNGATED },
  { id: "device-default", label: "device defaults", audio: DEFAULTS },
  { id: "raw", label: "raw (no AEC/NS/AGC, mono)", audio: RAW },
];

/* How long to listen before calling a stream dead, and what counts as
   alive. The window has to be long enough to cross a quiet moment in a
   room — a decaying string, a pause between words — but short enough
   that a real failure falls through the ladder quickly. 400ms at 60fps
   is ~24 analyser frames.

   The floor is deliberately just above zero rather than a signal-level
   threshold. This check answers ONE question: is this track delivering
   samples at all? A quiet room must read as alive, because gating a
   quiet room out here would silently drop us to a worse rung. Only
   literal digital silence — the symptom actually observed — fails. */
export const SILENCE_PROBE_MS = 400;
export const SILENCE_FLOOR = 1e-5;

/**
 * Owns the AudioContext, the mic stream and the analyser.
 *
 * Deliberately NOT a React hook: the mic must be acquired when the
 * tuner opens and released when it closes, and tying that to render
 * cycles invites double-acquire in StrictMode.
 */
export class TunerAudio {
  constructor() {
    this.ctx = null;
    this.stream = null;
    this.source = null;
    this.analyser = null;
    this.buffer = null;
    this.toneNodes = null;
    this.micGain = null;
    this.sink = null;
    // What the ladder actually settled on. Read by the diagnostic, so a
    // fallback can never happen invisibly — this project has now been
    // bitten twice by a healthy-looking pipeline carrying no audio.
    this.attempts = [];        // [{ id, label, outcome, settings, peak }]
    this.chosen = null;        // the rung that produced audio
    this.probeSkipped = false; // context suspended: silence proves nothing
  }

  /**
   * Read the analyser for a short window and report the largest absolute
   * sample seen. This is THE check: a granted permission, a running
   * context and a lit recording indicator all coexist happily with a
   * track that delivers nothing but zeros, which is exactly the iOS
   * failure this exists to catch.
   *
   * A suspended context is NOT silence — no samples flow while suspended
   * regardless of the track — so the caller must only judge a stream dead
   * when the context is genuinely running.
   */
  async probePeak(ms = SILENCE_PROBE_MS) {
    if (!this.analyser || !this.buffer) return 0;
    const deadline = (typeof performance !== "undefined" ? performance.now() : Date.now()) + ms;
    const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
    let peak = 0;
    while (now() < deadline) {
      this.analyser.getFloatTimeDomainData(this.buffer);
      for (let i = 0; i < this.buffer.length; i++) {
        const v = Math.abs(this.buffer[i]);
        if (v > peak) peak = v;
      }
      // Bail the moment it is proven alive; only a genuinely dead stream
      // pays the full window.
      if (peak > SILENCE_FLOOR) return peak;
      await new Promise((r) => setTimeout(r, 20));
    }
    return peak;
  }

  /** What the device ACTUALLY applied, not what was asked for. */
  appliedSettings() {
    try {
      const track = this.stream && this.stream.getAudioTracks()[0];
      if (!track || !track.getSettings) return null;
      const s = track.getSettings();
      return {
        echoCancellation: s.echoCancellation,
        noiseSuppression: s.noiseSuppression,
        autoGainControl: s.autoGainControl,
        channelCount: s.channelCount,
        sampleRate: s.sampleRate,
        deviceId: s.deviceId ? String(s.deviceId).slice(0, 8) : undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * ONE rung of the ladder: acquire the mic with exactly these
   * constraints and wire up the graph. Throws with a `.reason` of
   * "denied", "notfound" or "unsupported" so the UI can explain what
   * actually happened rather than showing a generic failure.
   *
   * Does NOT decide whether the stream is any good — that is the
   * caller's job, via probePeak(). Keeping acquisition and judgement
   * separate is what makes the fallback testable.
   */
  async startWith(audioConstraints) {
    if (!navigator.mediaDevices?.getUserMedia) {
      const e = new Error("This browser cannot access the microphone.");
      e.reason = "unsupported";
      throw e;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
    } catch (err) {
      const e = new Error(err?.message || "Microphone unavailable");
      if (err?.name === "NotAllowedError" || err?.name === "SecurityError") {
        e.reason = "denied";
      } else if (err?.name === "NotFoundError" || err?.name === "OverconstrainedError") {
        e.reason = "notfound";
      } else {
        e.reason = "unsupported";
      }
      throw e;
    }

    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    // Safari/iOS hands back a SUSPENDED context and only accepts resume()
    // from inside a real user-gesture handler. This call sits after an
    // awaited getUserMedia, which iOS no longer counts as a gesture, so it
    // can reject here — and a suspended context still grants the mic, so
    // the recording indicator lights while getFloatTimeDomainData returns
    // pure silence for ever. That failure is invisible: the tuner looks
    // live and simply never detects anything.
    //
    // So this attempt is best-effort only. `ensureRunning()` below is
    // called again from a genuine tap, and `isRunning` lets the UI tell
    // "mic muted" apart from "context suspended".
    await this.ensureRunning();

    this.source = this.ctx.createMediaStreamSource(this.stream);

    // A gain node between mic and analyser is how Mode A "pauses" the
    // mic without tearing down the stream — see setMicMuted().
    this.micGain = this.ctx.createGain();
    this.micGain.gain.value = 1;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = BUFFER_SIZE;
    // No smoothing: we read raw time-domain samples, and smoothing would
    // only blur the waveform we are about to autocorrelate.
    this.analyser.smoothingTimeConstant = 0;

    this.source.connect(this.micGain);
    this.micGain.connect(this.analyser);

    // iOS Safari only PULLS a node graph that reaches the destination.
    // An analyser left dangling is never fed, so getFloatTimeDomainData
    // returns a buffer of zeros for ever while the context happily
    // reports "running" and the mic indicator stays lit — detection then
    // fails on silence no matter how loud the room is.
    //
    // Routing the mic to the speakers would feed back, so the sink is a
    // gain node pinned at 0: the graph gets pulled, and nothing is
    // audible. Keep a reference so stop() can tear it down.
    this.sink = this.ctx.createGain();
    this.sink.gain.value = 0;
    this.analyser.connect(this.sink);
    this.sink.connect(this.ctx.destination);

    this.buffer = new Float32Array(this.analyser.fftSize);
    return this.ctx.sampleRate;
  }

  /**
   * Release only the capture side, keeping the object reusable for the
   * next rung. stop() is the full teardown; this is the retry path.
   */
  releaseAttempt() {
    try { this.source && this.source.disconnect(); } catch {}
    try { this.micGain && this.micGain.disconnect(); } catch {}
    try { this.analyser && this.analyser.disconnect(); } catch {}
    try { this.sink && this.sink.disconnect(); } catch {}
    if (this.stream) {
      this.stream.getTracks().forEach((t) => { try { t.stop(); } catch {} });
    }
    if (this.ctx && this.ctx.state !== "closed") {
      try { this.ctx.close(); } catch {}
    }
    this.ctx = null; this.stream = null; this.source = null;
    this.analyser = null; this.micGain = null; this.sink = null; this.buffer = null;
  }

  /**
   * Walk a constraint ladder until one rung actually delivers audio.
   *
   * The rule that matters: a rung is only rejected when the context is
   * RUNNING and the analyser still reads pure silence. A suspended
   * context reads silent no matter how good the track is, so judging it
   * there would send us down the ladder for the wrong reason and land
   * on a worse rung on every iOS cold start. When the context cannot be
   * resumed without a gesture we keep the first rung, record why the
   * probe was skipped, and let the tap-to-enable path do its job.
   *
   * `onAttempt` reports progress so the UI can say which rung is being
   * tried rather than sitting blank.
   */
  async start(ladder, onAttempt) {
    const rungs = Array.isArray(ladder) ? ladder : [{ id: "given", label: "given", audio: ladder }];
    this.attempts = [];
    this.chosen = null;
    this.probeSkipped = false;
    let lastErr = null;

    for (let i = 0; i < rungs.length; i++) {
      const rung = rungs[i];
      if (onAttempt) { try { onAttempt(rung, i, rungs.length); } catch {} }
      let rate;
      try {
        rate = await this.startWith(rung.audio);
      } catch (err) {
        lastErr = err;
        // A refusal is about permission or hardware, not about this
        // particular constraint set — no other rung will fare better.
        if (err.reason === "denied" || err.reason === "unsupported") throw err;
        this.attempts.push({ id: rung.id, label: rung.label, outcome: "rejected", error: err.reason, settings: null, peak: null });
        this.releaseAttempt();
        continue;
      }

      const settings = this.appliedSettings();

      // Cannot judge silence against a context that is not running.
      if (!this.isRunning) {
        this.probeSkipped = true;
        this.attempts.push({ id: rung.id, label: rung.label, outcome: "unprobed", settings, peak: null });
        this.chosen = { ...rung, settings, peak: null, probed: false };
        return rate;
      }

      const peak = await this.probePeak();
      if (peak > SILENCE_FLOOR) {
        this.attempts.push({ id: rung.id, label: rung.label, outcome: "audio", settings, peak });
        this.chosen = { ...rung, settings, peak, probed: true };
        return rate;
      }

      // Proven dead: running context, wired graph, nothing but zeros.
      this.attempts.push({ id: rung.id, label: rung.label, outcome: "silent", settings, peak });
      this.releaseAttempt();
    }

    // Every rung either was refused or delivered silence.
    const e = lastErr || new Error("The microphone is on but no audio is reaching the tuner.");
    if (!e.reason) e.reason = "silent";
    throw e;
  }

  /** Latest time-domain frame, or null if not running. */
  read() {
    if (!this.analyser || !this.buffer) return null;
    this.analyser.getFloatTimeDomainData(this.buffer);
    return this.buffer;
  }

  get sampleRate() {
    return this.ctx ? this.ctx.sampleRate : 48000;
  }

  /** True once audio is actually flowing, not merely permitted. */
  get isRunning() {
    return !!this.ctx && this.ctx.state === "running";
  }

  /**
   * Probe a rung that could not be judged at start() because the context
   * was suspended. Returns "audio", "silent" or "unknown".
   *
   * This matters on iOS specifically: a cold start hands back a suspended
   * context, so the ladder keeps rung 1 unprobed and waits. If rung 1 is
   * the silent one, the tap that finally resumes the context is the FIRST
   * moment the stream can be judged at all — without this the tuner
   * settles onto a dead rung and never reconsiders, which is the original
   * bug wearing a different hat.
   */
  async probeAfterResume() {
    if (!this.chosen || this.chosen.probed || !this.isRunning) return "unknown";
    const peak = await this.probePeak();
    this.chosen.probed = true;
    this.chosen.peak = peak;
    const alive = peak > SILENCE_FLOOR;
    const rec = this.attempts[this.attempts.length - 1];
    if (rec) { rec.outcome = alive ? "audio" : "silent"; rec.peak = peak; }
    this.probeSkipped = false;
    return alive ? "audio" : "silent";
  }

  /**
   * Resume the AudioContext. Safe to call repeatedly, and MUST be called
   * synchronously from inside a real tap handler on iOS — that is the only
   * moment Safari will honour it.
   */
  async ensureRunning() {
    if (!this.ctx) return false;
    if (this.ctx.state === "running") return true;
    try {
      await this.ctx.resume();
    } catch {
      // Not a gesture. Caller retries from the next real tap.
    }
    return this.ctx.state === "running";
  }

  /**
   * MODE A's "pause". Gates the mic signal before the analyser instead
   * of stopping the track: re-acquiring a MediaStreamTrack takes long
   * enough to make the listen/tone cycle feel jarring, and on iOS it can
   * re-prompt for permission.
   */
  setMicMuted(muted) {
    if (!this.micGain || !this.ctx) return;
    const t = this.ctx.currentTime;
    const g = this.micGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(muted ? 0 : 1, t + 0.03);
  }

  /**
   * Play the reference tone for `duration` seconds.
   *
   * Not a pure sine. A bare sine at 30-100 Hz is very hard to pitch-match
   * by ear, and most phone speakers barely move at those frequencies —
   * the listener mostly hears nothing. Adding quiet overtones gives the
   * ear something to latch onto and lets a small speaker imply the
   * fundamental it cannot physically reproduce.
   */
  playTone(freq, duration = 1.5) {
    if (!this.ctx) return () => {};
    const ctx = this.ctx;
    const t0 = ctx.currentTime;

    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(ctx.destination);

    // Fundamental plus a few decreasing partials. The 2nd and 3rd carry
    // most of the audibility on a small speaker.
    const partials = [
      { mult: 1, gain: 0.5, type: "sine" },
      { mult: 2, gain: 0.26, type: "sine" },
      { mult: 3, gain: 0.14, type: "triangle" },
      { mult: 4, gain: 0.07, type: "sine" },
      { mult: 6, gain: 0.035, type: "sine" },
    ];

    const oscs = partials.map((p) => {
      const osc = ctx.createOscillator();
      osc.type = p.type;
      osc.frequency.value = freq * p.mult;
      const g = ctx.createGain();
      g.gain.value = p.gain;
      osc.connect(g);
      g.connect(out);
      osc.start(t0);
      return osc;
    });

    // Gentle attack/release so there is no click at either end.
    const attack = 0.05;
    const release = 0.18;
    const peak = 0.22; // reasonable, not startling
    out.gain.setValueAtTime(0, t0);
    out.gain.linearRampToValueAtTime(peak, t0 + attack);
    out.gain.setValueAtTime(peak, t0 + Math.max(attack, duration - release));
    out.gain.linearRampToValueAtTime(0.0001, t0 + duration);

    oscs.forEach((o) => o.stop(t0 + duration + 0.02));

    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      const now = ctx.currentTime;
      try {
        out.gain.cancelScheduledValues(now);
        out.gain.setValueAtTime(out.gain.value, now);
        out.gain.linearRampToValueAtTime(0.0001, now + 0.06);
        oscs.forEach((o) => o.stop(now + 0.08));
      } catch { /* already stopped */ }
    };
  }

  /**
   * A tone that runs until stopped — Mode B holds this open while the
   * mic keeps listening.
   */
  startContinuousTone(freq) {
    // A very long duration with a manual stop; same timbre and envelope
    // as the pulsed tone so the two modes sound identical.
    return this.playTone(freq, 3600);
  }

  /** Release everything. The mic must not stay open after leaving. */
  stop() {
    try { this.source && this.source.disconnect(); } catch {}
    try { this.micGain && this.micGain.disconnect(); } catch {}
    try { this.analyser && this.analyser.disconnect(); } catch {}
    try { this.sink && this.sink.disconnect(); } catch {}
    if (this.stream) {
      // Stopping every track is what actually clears the browser's
      // "recording" indicator.
      this.stream.getTracks().forEach((t) => { try { t.stop(); } catch {} });
    }
    if (this.ctx && this.ctx.state !== "closed") {
      try { this.ctx.close(); } catch {}
    }
    this.ctx = null;
    this.stream = null;
    this.source = null;
    this.analyser = null;
    this.micGain = null;
    this.sink = null;
    this.buffer = null;
    this.chosen = null;
  }
}
