/* ------------------------------------------------------------------
   audio.js — microphone capture and the reference tone.

   Everything that differs between the two mic modes lives here. The
   detection maths lives in pitch.js and is shared verbatim, so the
   experiment actually compares mic strategies rather than algorithms.
   ------------------------------------------------------------------ */

import { BUFFER_SIZE } from "./pitch.js";

/* Constraints for MODE A — Pause Cycle.

   The mic is muted while the reference tone plays, so the browser never
   hears our own tone and echo cancellation has no work to do. We leave
   it off: AEC is a nonlinear process and can only hurt a signal we are
   about to measure to within a few cents. */
export const CONSTRAINTS_PAUSE = {
  audio: {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  },
};

/* Constraints for MODE B — Continuous (experimental).

   Echo cancellation ON, because here the tone and the mic run at the
   same time and AEC is the only thing that could stop the tone from
   swamping the string.

   noiseSuppression and autoGainControl stay OFF deliberately. Both are
   tuned for speech: suppression treats a sustained low tone as
   stationary noise and gates it away, and AGC pumps the gain in a way
   that smears amplitude. Those are precisely the signals we measure —
   a 30.87 Hz low B is exactly what a speech denoiser throws out. */
export const CONSTRAINTS_CONTINUOUS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: false,
    autoGainControl: false,
  },
};

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
  }

  /**
   * Acquire the mic. Throws with a `.reason` of "denied", "notfound" or
   * "unsupported" so the UI can explain what actually happened rather
   * than showing a generic failure.
   */
  async start(constraints) {
    if (!navigator.mediaDevices?.getUserMedia) {
      const e = new Error("This browser cannot access the microphone.");
      e.reason = "unsupported";
      throw e;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
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
  }
}
