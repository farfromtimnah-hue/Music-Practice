// Soft Web Audio tones for the circle games. Nothing here plays by itself.
// Every public function that makes sound must be called from a click or tap
// handler. ensureCtx() creates or resumes the AudioContext synchronously,
// which is what iOS needs.
let ctx = null;
let timers = [];
let oscs = [];

export function ensureCtx() {
  const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(c, freq, t, dur, vol) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "triangle";
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.04);           // soft attack
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);    // soft release
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
  oscs.push(osc);
  return osc;
}

export function stopScale() {
  timers.forEach(clearTimeout);
  timers = [];
  oscs.forEach((o) => { try { o.stop(); } catch (e) { /* already stopped */ } });
  oscs = [];
}

// One short tone, for a right answer.
export function playTone(freq) {
  const c = ensureCtx();
  if (!c) return;
  tone(c, freq, c.currentTime + 0.01, 0.7, 0.16);
}

// Eight notes, one after another. onStep(i) fires as each note starts.
// Calling it again restarts. onEnd fires after the last note.
export function playScale(freqs, onStep, onEnd, step = 0.5) {
  stopScale();
  const c = ensureCtx();
  if (!c) return false;
  const t0 = c.currentTime + 0.05;
  freqs.forEach((f, i) => {
    tone(c, f, t0 + i * step, step * 0.92, 0.16);
    timers.push(setTimeout(() => onStep && onStep(i), 50 + i * step * 1000));
  });
  timers.push(setTimeout(() => onEnd && onEnd(), 50 + freqs.length * step * 1000));
  return true;
}
