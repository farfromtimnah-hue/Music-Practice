/* ------------------------------------------------------------------
   pitch.js — the ONE pitch-detection implementation.

   Both mic modes (Pause Cycle and Continuous/AEC) share this file.
   That is the whole point of the feature: the two modes must differ
   ONLY in how the microphone stream is handled, never in how the
   detected pitch is computed. If you add a second detector, the
   experiment is invalid.

   Algorithm: YIN (de Cheveigne & Kawahara, 2002) — cumulative mean
   normalized difference function + absolute threshold + parabolic
   interpolation of the chosen minimum for sub-sample accuracy.

   YIN is used rather than plain autocorrelation because plain
   autocorrelation octave-errors badly on low, harmonically rich
   notes — exactly the B0/E1 bass region this tuner has to nail.
   ------------------------------------------------------------------ */

/* Frequency range we care about: B0 (30.87) down-margin through
   guitar high E (329.63) up-margin. */
export const MIN_FREQ = 28;
export const MAX_FREQ = 360;

/* Analysis window.

   YIN needs at least two full periods of the lowest frequency inside
   the buffer to find a lag minimum at all. At 28 Hz and a 48 kHz
   sample rate one period is 48000/28 = 1714 samples, so two periods
   is ~3429 — 4096 would technically "work" but leaves the tau search
   with almost no averaging headroom, and the CMND curve gets noisy
   right where B0 lives.

   8192 samples gives ~4.8 periods of 28 Hz at 48 kHz (~170 ms), which
   is where low-end readings actually settle. The brief explicitly
   prefers low-frequency stability over fast response, so we take the
   latency. */
export const BUFFER_SIZE = 8192;

/* YIN absolute threshold. Lower = stricter. 0.15 is the paper's
   suggestion; 0.12 rejects more marginal frames, which matters here
   because a wrong reading sends a student to the wrong tuning peg. */
const YIN_THRESHOLD = 0.12;

/* Frames whose clarity falls under this are discarded rather than
   reported. Clarity is 1 - d'(tau) so 1.0 is a perfect period match. */
export const CLARITY_THRESHOLD = 0.86;

/* Below this RMS the input is treated as silence (nobody is playing). */
const RMS_SILENCE = 0.008;

/* Low-pass corner, in Hz, applied before the difference function.

   This is not cosmetic. YIN finds a period, and for a signal ABOVE our
   range every integer multiple of its true period is also a perfect
   period match. A 500 Hz tone therefore has a flawless lag minimum at
   its 2nd sub-harmonic, 250 Hz — which sits inside our search window,
   so the range gate at the end never fires and the tuner confidently
   reports a note nobody played. Filtering the out-of-range energy out
   before the search is the only place this can be fixed.

   Corner placement is a real tradeoff, not a free parameter. Too low
   and it eats the harmonics YIN needs at the TOP of our range: a 4-pole
   cascade cornered at 400 Hz already attenuates guitar high E (329.63)
   enough to push clarity under threshold and drag the reading flat.
   Too high and the sub-harmonic leak comes back.

   1200 Hz with 2 poles keeps the whole 28-360 Hz range flat (E4 is
   nearly two octaves below the corner) while still putting ~20 dB of
   attenuation on a 500 Hz tone and much more above that — enough that
   an out-of-range signal fails the residual-energy check below rather
   than producing a confident sub-harmonic. */
const LOWPASS_HZ = 1200;
const LOWPASS_POLES = 2;

/**
 * Zero-phase low-pass: a 1-pole IIR run forward then backward, repeated
 * to steepen the rolloff. Running it in both directions cancels the
 * phase shift, which matters because a phase-shifted signal would smear
 * the period we are about to measure.
 */
function lowPass(src, sampleRate) {
  const n = src.length;
  const dt = 1 / sampleRate;
  const rc = 1 / (2 * Math.PI * LOWPASS_HZ);
  const a = dt / (rc + dt);
  const out = Float32Array.from(src);
  for (let p = 0; p < LOWPASS_POLES; p++) {
    let acc = out[0];
    for (let i = 0; i < n; i++) { acc += a * (out[i] - acc); out[i] = acc; }
    acc = out[n - 1];
    for (let i = n - 1; i >= 0; i--) { acc += a * (out[i] - acc); out[i] = acc; }
  }
  return out;
}

/**
 * Goertzel single-bin magnitude — the energy of `freq` in `buf`.
 * Cheaper than a full FFT when only a couple of bins are needed.
 */
function goertzel(buf, freq, sampleRate) {
  const w = (2 * Math.PI * freq) / sampleRate;
  const coeff = 2 * Math.cos(w);
  let s0 = 0, s1 = 0, s2 = 0;
  for (let i = 0; i < buf.length; i++) {
    s0 = buf[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - coeff * s1 * s2));
}

/**
 * True when `freq` is a real fundamental rather than a phantom
 * sub-harmonic of a higher tone.
 *
 * A real fundamental carries meaningful energy at its own frequency.
 * A phantom sits between the true partials, so its bin is nearly empty
 * while the octave above it is strong. Requiring the fundamental to be
 * at least a modest fraction of its own octave separates the two
 * without penalising genuinely harmonic-rich strings (a real low B0 is
 * harmonic-heavy, but still has real energy at 30.87 Hz).
 */
function hasEnergyAt(buf, freq, sampleRate) {
  const fundamental = goertzel(buf, freq, sampleRate);
  // Check several partials, not just the octave: an 800 Hz tone puts a
  // phantom at its THIRD sub-harmonic (266.7 Hz), which an octave-only
  // comparison misses entirely. The strongest partial is the honest
  // yardstick for whether the fundamental is really there.
  let strongestPartial = 0;
  for (let mult = 2; mult <= 4; mult++) {
    const p = goertzel(buf, freq * mult, sampleRate);
    if (p > strongestPartial) strongestPartial = p;
  }
  if (strongestPartial <= 0) return true;
  return fundamental / strongestPartial > 0.06;
}

/**
 * Detect the fundamental frequency of one buffer of audio.
 *
 * @param {Float32Array} buf       time-domain samples, ideally BUFFER_SIZE long
 * @param {number}       sampleRate
 * @param {number}       [maxFreq]  search ceiling, defaulting to MAX_FREQ.
 *        A capo raises the targets — high E is 392 Hz at full capo 3 — so the
 *        caller may need a higher ceiling than the open-tuning 360. Passing it
 *        in keeps that a property of the CALLER's targets rather than a second
 *        hardcoded constant that can fall out of step with them. Nothing else
 *        about detection changes: the filter corner, the clarity threshold and
 *        the residual-energy check are all untouched, because they were tuned
 *        against real hardware and a previous attempt at moving them broke
 *        high-E detection and dragged it flat.
 * @returns {{frequency:number, clarity:number}|null} null when the frame is
 *          silent, out of range, or below the clarity threshold.
 */
export function detectPitch(raw, sampleRate, maxFreq = MAX_FREQ) {
  const N = raw.length;
  const ceiling = Math.max(MAX_FREQ, Number(maxFreq) || MAX_FREQ);

  // --- gate 1: silence -------------------------------------------------
  // Measured on the RAW signal, before filtering, so that the low-pass
  // can never turn a real (if high-pitched) input into "silence".
  let sumSq = 0;
  for (let i = 0; i < N; i++) sumSq += raw[i] * raw[i];
  const rms = Math.sqrt(sumSq / N);
  if (rms < RMS_SILENCE) return null;

  // Strip everything above our range so the period search cannot lock
  // onto a sub-harmonic of an out-of-range tone. See LOWPASS_HZ.
  const buf = lowPass(raw, sampleRate);

  // If the low-pass removed most of the signal's energy, the input was
  // dominated by content above our range (speech, a high harmonic, a
  // ringing overtone) and there was no in-range note to report. Without
  // this the filter's small residue still has a clean period and YIN
  // would happily lock onto a sub-harmonic of it.
  let fSumSq = 0;
  for (let i = 0; i < N; i++) fSumSq += buf[i] * buf[i];
  // Kept deliberately loose: a harmonic-rich guitar high E has partials
  // at 660-1650 Hz that straddle the corner, so it legitimately loses
  // over half its energy here. Tightening this to 0.5 silently rejected
  // real high-E notes. Precise phantom rejection is gate 4's job, not
  // this one's; this only catches the near-total-wipeout case.
  const fRms = Math.sqrt(fSumSq / N);
  if (fRms < rms * 0.15) return null;
  if (fRms < RMS_SILENCE) return null;

  // Lag search bounds derived from the frequency range.
  const tauMin = Math.max(2, Math.floor(sampleRate / ceiling));
  const tauMax = Math.min(Math.floor(N / 2), Math.ceil(sampleRate / MIN_FREQ));
  if (tauMax <= tauMin) return null;

  // --- step 1: difference function d(tau) ------------------------------
  // d(tau) = sum over the window of (x[i] - x[i+tau])^2
  const d = new Float32Array(tauMax + 1);
  const window = N - tauMax; // samples compared at every lag, kept constant
  for (let tau = tauMin; tau <= tauMax; tau++) {
    let sum = 0;
    for (let i = 0; i < window; i++) {
      const delta = buf[i] - buf[i + tau];
      sum += delta * delta;
    }
    d[tau] = sum;
  }

  // --- step 2: cumulative mean normalized difference d'(tau) -----------
  // This is what removes the "zero lag is always best" problem that
  // plain autocorrelation has, and it is why YIN resists octave errors.
  const cmnd = new Float32Array(tauMax + 1);
  cmnd[0] = 1;
  let runningSum = 0;
  for (let tau = tauMin; tau <= tauMax; tau++) {
    runningSum += d[tau];
    cmnd[tau] = runningSum === 0 ? 1 : (d[tau] * (tau - tauMin + 1)) / runningSum;
  }

  // --- step 3: absolute threshold --------------------------------------
  // Take the FIRST dip below the threshold, not the global minimum:
  // the global minimum is often an octave-down multiple of the true lag.
  let tauEstimate = -1;
  for (let tau = tauMin; tau <= tauMax; tau++) {
    if (cmnd[tau] < YIN_THRESHOLD) {
      // walk down to the local bottom of this dip
      while (tau + 1 <= tauMax && cmnd[tau + 1] < cmnd[tau]) tau++;
      tauEstimate = tau;
      break;
    }
  }

  // No dip cleared the threshold — fall back to the best candidate so a
  // slightly noisy but genuine note is not thrown away outright. The
  // clarity gate below still has the final say.
  if (tauEstimate === -1) {
    let best = tauMin;
    for (let tau = tauMin; tau <= tauMax; tau++) {
      if (cmnd[tau] < cmnd[best]) best = tau;
    }
    tauEstimate = best;
  }

  // --- step 4: parabolic interpolation ---------------------------------
  // Sub-sample refinement of the lag. Without this, resolution at the top
  // of the range is coarse enough to matter: at 330 Hz and 48 kHz one
  // whole sample of lag is ~7 cents, which would make the meter jump in
  // visible steps instead of moving smoothly.
  let betterTau = tauEstimate;
  const x0 = tauEstimate > tauMin ? tauEstimate - 1 : tauEstimate;
  const x2 = tauEstimate + 1 <= tauMax ? tauEstimate + 1 : tauEstimate;
  if (x0 !== tauEstimate && x2 !== tauEstimate) {
    const s0 = cmnd[x0], s1 = cmnd[tauEstimate], s2 = cmnd[x2];
    const denom = 2 * (2 * s1 - s2 - s0);
    if (denom !== 0) betterTau = tauEstimate + (s2 - s0) / denom;
  } else if (x2 !== tauEstimate && cmnd[x2] < cmnd[tauEstimate]) {
    betterTau = x2;
  }

  if (betterTau <= 0) return null;

  const frequency = sampleRate / betterTau;
  const clarity = 1 - Math.min(1, Math.max(0, cmnd[tauEstimate]));

  // --- gates 2 & 3: range and confidence -------------------------------
  if (frequency < MIN_FREQ || frequency > ceiling) return null;
  if (clarity < CLARITY_THRESHOLD) return null;

  // --- gate 4: the reported fundamental must actually be present -------
  // A periodicity check alone cannot catch this. If the true tone is
  // 500 Hz, then 250 Hz is also a perfect period of it, and the CMND
  // scores that phantom at clarity 1.0 — indistinguishable from a real
  // note by confidence alone. The difference is spectral: a genuine
  // fundamental has energy AT its own frequency, whereas a phantom
  // sub-harmonic has (near) none. Measure that directly on the raw,
  // unfiltered signal.
  if (!hasEnergyAt(raw, frequency, sampleRate)) return null;

  return { frequency, clarity };
}

/* ------------------------------------------------------------------
   Tuning targets. VERIFIED against the brief — do not alter.
   Reference pitch is A440, fixed. There is deliberately no adjustable
   reference-pitch control.
   ------------------------------------------------------------------ */

export const TUNINGS = {
  guitar: {
    id: "guitar",
    label: "Guitar",
    sublabel: "Standard EADGBE",
    // low -> high
    strings: [
      { note: "E", octave: 2, label: "E2", freq: 82.41 },
      { note: "A", octave: 2, label: "A2", freq: 110.0 },
      { note: "D", octave: 3, label: "D3", freq: 146.83 },
      { note: "G", octave: 3, label: "G3", freq: 196.0 },
      { note: "B", octave: 3, label: "B3", freq: 246.94 },
      { note: "E", octave: 4, label: "E4", freq: 329.63 },
    ],
  },
  bass4: {
    id: "bass4",
    label: "Bass — 4 string",
    sublabel: "EADG",
    strings: [
      { note: "E", octave: 1, label: "E1", freq: 41.2 },
      { note: "A", octave: 1, label: "A1", freq: 55.0 },
      { note: "D", octave: 2, label: "D2", freq: 73.42 },
      { note: "G", octave: 2, label: "G2", freq: 98.0 },
    ],
  },
  bass5: {
    id: "bass5",
    label: "Bass — 5 string",
    sublabel: "BEADG",
    strings: [
      { note: "B", octave: 0, label: "B0", freq: 30.87 },
      { note: "E", octave: 1, label: "E1", freq: 41.2 },
      { note: "A", octave: 1, label: "A1", freq: 55.0 },
      { note: "D", octave: 2, label: "D2", freq: 73.42 },
      { note: "G", octave: 2, label: "G2", freq: 98.0 },
    ],
  },
};

/** Default tuning id for a student's `instrument` field. */
export function defaultTuningFor(instrument) {
  return instrument === "bass" ? "bass4" : "guitar";
}

/** Cents that `detected` sits above (+) or below (-) `target`. */
export function centsOff(detected, target) {
  return 1200 * Math.log2(detected / target);
}

/* Within this many cents of the target the string counts as in tune. */
export const IN_TUNE_CENTS = 5;

/* If the nearest string is further away than this we refuse to guess.
   A wrong auto-guess sends a student to tighten the wrong peg, which is
   worse than showing no guess at all. */
export const AUTO_DETECT_MAX_CENTS = 150;

/**
 * Pick which string a detected frequency belongs to.
 *
 * @returns {{index:number, cents:number, sure:boolean}} — `sure` is false
 *          when the nearest target is more than AUTO_DETECT_MAX_CENTS away,
 *          in which case the UI must ask the student to pick manually
 *          instead of guessing.
 */
export function nearestString(frequency, strings) {
  let index = 0;
  let bestAbs = Infinity;
  let cents = 0;
  for (let i = 0; i < strings.length; i++) {
    const c = centsOff(frequency, strings[i].freq);
    if (Math.abs(c) < bestAbs) {
      bestAbs = Math.abs(c);
      index = i;
      cents = c;
    }
  }
  return { index, cents, sure: bestAbs <= AUTO_DETECT_MAX_CENTS };
}
