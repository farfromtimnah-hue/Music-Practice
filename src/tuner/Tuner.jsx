import { useState, useEffect, useRef, useCallback } from "react";
import Headstock from "./Headstock.jsx";
import { TUNER_CSS } from "./tunerStyles.js";
import { TunerAudio, CONSTRAINTS_PAUSE, CONSTRAINTS_CONTINUOUS } from "./audio.js";
import {
  detectPitch,
  TUNINGS,
  defaultTuningFor,
  centsOff,
  nearestString,
  IN_TUNE_CENTS,
} from "./pitch.js";

/* Mode A cycle timings, in ms. */
const TONE_MS = 1500;      // how long the reference tone sounds
const LISTEN_MS = 4000;    // listening stretch between tones
const SETTLE_MS = 250;     // pause after the tone before the mic reopens,
                           // so the speaker has stopped ringing

/* A reading is held on screen briefly after the signal dies, otherwise
   the readout blanks between plucks and flickers unpleasantly. */
const HOLD_MS = 900;

export default function Tuner({ instrument = "guitar", isTeacher = false, onBack }) {
  const [tuningId, setTuningId] = useState(() => defaultTuningFor(instrument));
  const tuning = TUNINGS[tuningId] || TUNINGS.guitar;
  const strings = tuning.strings;

  // "pause" = Mode A, "continuous" = Mode B (teacher only)
  const [micMode, setMicMode] = useState("pause");

  const [status, setStatus] = useState("idle"); // idle|starting|running|error
  const [errorReason, setErrorReason] = useState(null);

  // Detection state
  const [reading, setReading] = useState(null); // {frequency, clarity, cents, index}
  const [unsure, setUnsure] = useState(false);  // nearest target > 150 cents away
  const [lockedIndex, setLockedIndex] = useState(-1); // manual override
  const [listening, setListening] = useState(true);   // false while a tone plays
  const [diag, setDiag] = useState({ frequency: null, clarity: null, ok: false });

  const audioRef = useRef(null);
  const rafRef = useRef(0);
  const lastGoodRef = useRef(0);
  const cycleRef = useRef(null);
  const stopToneRef = useRef(null);
  // Mirrors of state the animation loop reads, so the loop is not
  // re-created on every state change.
  const lockedRef = useRef(-1);
  const stringsRef = useRef(strings);
  const listeningRef = useRef(true);

  useEffect(() => { lockedRef.current = lockedIndex; }, [lockedIndex]);
  useEffect(() => { stringsRef.current = strings; }, [strings]);
  useEffect(() => { listeningRef.current = listening; }, [listening]);

  /* ---------------- the analysis loop (shared by both modes) --------- */
  const loop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const buf = audio.read();
    if (buf) {
      const res = detectPitch(buf, audio.sampleRate);
      const now = performance.now();

      if (res) {
        const list = stringsRef.current;
        const locked = lockedRef.current;
        let index, cents, sure;
        if (locked >= 0 && locked < list.length) {
          // Manual override: measure against the chosen string, whatever
          // it is. The student has told us which peg they are turning.
          index = locked;
          cents = centsOff(res.frequency, list[locked].freq);
          sure = true;
        } else {
          const n = nearestString(res.frequency, list);
          index = n.index; cents = n.cents; sure = n.sure;
        }

        if (sure) {
          lastGoodRef.current = now;
          setUnsure(false);
          setReading({ frequency: res.frequency, clarity: res.clarity, cents, index });
        } else {
          // Too far from any string to guess. Say so rather than
          // sending the student to the wrong peg.
          setUnsure(true);
          setReading(null);
        }
        setDiag({ frequency: res.frequency, clarity: res.clarity, ok: true });
      } else {
        setDiag((d) => ({ ...d, ok: false, clarity: null }));
        if (now - lastGoodRef.current > HOLD_MS) {
          setReading(null);
          setUnsure(false);
        }
      }
    }
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  /* ---------------- start / stop the mic ---------------------------- */
  const startAudio = useCallback(async () => {
    setStatus("starting");
    setErrorReason(null);
    const audio = new TunerAudio();
    try {
      // THE ONE DIFFERENCE BETWEEN THE MODES, part 1: which constraints
      // we ask for. Mode B needs echo cancellation because the tone and
      // the mic overlap; Mode A never hears its own tone.
      await audio.start(micMode === "continuous" ? CONSTRAINTS_CONTINUOUS : CONSTRAINTS_PAUSE);
      audioRef.current = audio;
      setStatus("running");
      rafRef.current = requestAnimationFrame(loop);
    } catch (err) {
      audio.stop();
      setErrorReason(err.reason || "unsupported");
      setStatus("error");
    }
  }, [micMode, loop]);

  const stopAudio = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (cycleRef.current) { clearTimeout(cycleRef.current); cycleRef.current = null; }
    if (stopToneRef.current) { stopToneRef.current(); stopToneRef.current = null; }
    if (audioRef.current) { audioRef.current.stop(); audioRef.current = null; }
    setStatus("idle");
    setReading(null);
    setListening(true);
  }, []);

  /* Mic is requested when the tuner opens, and released on the way out —
     never held open in the background. */
  useEffect(() => {
    startAudio();
    return () => stopAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switching mic mode requires a new getUserMedia call, since echo
  // cancellation is a property of the captured track.
  const switchMode = useCallback((next) => {
    if (next === micMode) return;
    stopAudio();
    setMicMode(next);
  }, [micMode, stopAudio]);

  useEffect(() => {
    if (status === "idle" && !audioRef.current) startAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micMode]);

  /* ---------------- which string are we working on? ----------------- */
  const activeIndex = lockedIndex >= 0 ? lockedIndex
    : reading ? reading.index
    : -1;
  const activeString = activeIndex >= 0 ? strings[activeIndex] : null;

  /* ---------------- reference tone: the two modes ------------------- */

  /* MODE A — Pause Cycle.
     listen -> tone (mic muted) -> settle -> listen ...
     The alternation of target-note / their-note is the ear-training
     goal, so the cycle runs on its own rather than needing a button. */
  useEffect(() => {
    if (status !== "running" || micMode !== "pause" || !activeString) return;

    let cancelled = false;
    const audio = audioRef.current;
    if (!audio) return;

    const runCycle = () => {
      if (cancelled) return;
      // --- tone phase: mute the mic first so we never hear ourselves
      audio.setMicMuted(true);
      setListening(false);
      stopToneRef.current = audio.playTone(activeString.freq, TONE_MS / 1000);

      cycleRef.current = setTimeout(() => {
        if (cancelled) return;
        stopToneRef.current = null;
        // --- settle, then reopen the mic
        cycleRef.current = setTimeout(() => {
          if (cancelled) return;
          audio.setMicMuted(false);
          setListening(true);
          // --- listen phase, then round again
          cycleRef.current = setTimeout(runCycle, LISTEN_MS);
        }, SETTLE_MS);
      }, TONE_MS);
    };

    // Give the student a moment to play before the first tone.
    cycleRef.current = setTimeout(runCycle, LISTEN_MS);

    return () => {
      cancelled = true;
      if (cycleRef.current) { clearTimeout(cycleRef.current); cycleRef.current = null; }
      if (stopToneRef.current) { stopToneRef.current(); stopToneRef.current = null; }
      if (audioRef.current) audioRef.current.setMicMuted(false);
      setListening(true);
    };
  }, [status, micMode, activeString?.label, activeString?.freq]);

  /* MODE B — Continuous (experimental, teacher only).
     The tone runs unbroken and the mic is never muted. Whether the
     browser's echo cancellation can keep a 30-100 Hz tone from swamping
     the string is exactly the thing being tested. */
  useEffect(() => {
    if (status !== "running" || micMode !== "continuous" || !activeString) return;
    const audio = audioRef.current;
    if (!audio) return;

    audio.setMicMuted(false);
    setListening(true);
    stopToneRef.current = audio.startContinuousTone(activeString.freq);

    return () => {
      if (stopToneRef.current) { stopToneRef.current(); stopToneRef.current = null; }
    };
  }, [status, micMode, activeString?.label, activeString?.freq]);

  /* ---------------- readout values ---------------------------------- */
  const cents = reading ? reading.cents : null;
  const inTune = cents !== null && Math.abs(cents) <= IN_TUNE_CENTS;
  const tooLow = cents !== null && cents < -IN_TUNE_CENTS;
  const tooHigh = cents !== null && cents > IN_TUNE_CENTS;

  const directionWord = inTune ? "In Tune" : tooLow ? "Too Low" : tooHigh ? "Too High" : "—";
  // too low = tighten, too high = loosen. This is the instruction a
  // student is most likely to get backwards, so it is stated plainly.
  const actionWord = inTune ? "In Tune" : tooLow ? "Tighten the peg" : tooHigh ? "Loosen the peg" : "Play a string";

  // Meter needle: clamp to +/-50 cents so the needle stays on screen
  // even when a string is wildly out.
  const clamped = cents === null ? 0 : Math.max(-50, Math.min(50, cents));
  const needlePct = 50 + clamped;

  const tuningOptions = instrument === "bass" || isTeacher
    ? ["guitar", "bass4", "bass5"]
    : ["guitar"];

  /* ---------------- render ------------------------------------------ */

  if (status === "error") {
    const msg =
      errorReason === "denied"
        ? "The tuner needs your microphone to hear the string. Your browser blocked it — allow microphone access for this site, then tap Try Again."
        : errorReason === "notfound"
        ? "No microphone was found on this device. The tuner needs a mic to hear the string."
        : "This browser can't reach the microphone. Try Chrome or Safari, and make sure the page is on https.";
    return (
      <><style>{TUNER_CSS}</style>
      <div className="tn-shell">
        <TunerHeader onBack={onBack} title="Tuner" />
        <div className="tn-perm">
          <div className="tn-perm-icon">🎤</div>
          <div className="tn-perm-msg">{msg}</div>
          <button className="primary-btn" onClick={startAudio}>Try Again</button>
          <button className="ghost-btn" onClick={onBack}>← Back</button>
        </div>
      </div></>
    );
  }

  return (
    <><style>{TUNER_CSS}</style>
    <div className="tn-shell">
      <TunerHeader onBack={onBack} title="Tuner" />

      {/* instrument / tuning picker */}
      {tuningOptions.length > 1 && (
        <div className="tn-tunings">
          {tuningOptions.map((id) => (
            <button
              key={id}
              className={`tn-tuning-btn ${id === tuningId ? "on" : ""}`}
              onClick={() => {
                setTuningId(id);
                setLockedIndex(-1);
                setReading(null);
              }}
            >
              {TUNINGS[id].label}
              <span>{TUNINGS[id].sublabel}</span>
            </button>
          ))}
        </div>
      )}

      {/* listening indicator — dims while the reference tone plays */}
      <div className={`tn-listening ${listening ? "on" : "off"}`}>
        <span className="tn-dot" />
        {status !== "running"
          ? "Starting the microphone…"
          : listening
          ? "Listening — play a string"
          : "Listen to the note…"}
      </div>

      <div className="tn-main">
        <Headstock
          tuningId={tuningId}
          strings={strings}
          activeIndex={activeIndex}
          onSelect={(i) => setLockedIndex(i === lockedIndex ? -1 : i)}
        />

        <div className="tn-readout">
          {unsure && lockedIndex < 0 ? (
            <div className="tn-unsure">
              Not sure which string — pick one below
            </div>
          ) : activeString ? (
            <>
              <div className="tn-note">{activeString.label}</div>
              <div className="tn-target">
                target {activeString.freq.toFixed(2)} Hz
              </div>
              <div className="tn-freq">
                {reading ? `${reading.frequency.toFixed(2)} Hz` : "—"}
              </div>

              {/* meter */}
              <div className="tn-meter">
                <div className="tn-meter-track">
                  <div className="tn-meter-zone" />
                  <div className="tn-meter-center" />
                  {reading && (
                    <div
                      className={`tn-needle ${inTune ? "ok" : ""}`}
                      style={{ left: `${needlePct}%` }}
                    />
                  )}
                </div>
              </div>
              <div className="tn-meter-scale">
                <span>♭ flat</span><span>0</span><span>sharp ♯</span>
              </div>

              <div className={`tn-cents ${inTune ? "ok" : ""}`}>
                {reading ? `${cents > 0 ? "+" : ""}${cents.toFixed(1)} cents` : "—"}
              </div>

              <div className={`tn-direction ${inTune ? "ok" : tooLow ? "low" : tooHigh ? "high" : ""}`}>
                {directionWord}
              </div>
              <div className={`tn-action ${inTune ? "ok" : ""}`}>
                {inTune && <span className="tn-check">✓</span>}
                {actionWord}
              </div>
            </>
          ) : (
            <div className="tn-idle">Play a string to begin</div>
          )}
        </div>
      </div>

      {/* manual string picker / override */}
      <div className="tn-strings">
        {strings.map((s, i) => (
          <button
            key={s.label}
            className={`tn-string-btn ${i === activeIndex ? "on" : ""} ${i === lockedIndex ? "locked" : ""}`}
            onClick={() => setLockedIndex(i === lockedIndex ? -1 : i)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="tn-hint">
        {lockedIndex >= 0
          ? "Locked to this string — tap it again to go back to auto-detect"
          : "Auto-detecting the string — tap one to lock it"}
      </div>

      {/* ---- teacher-only: Mode B and the diagnostic ---- */}
      {isTeacher && (
        <div className="tn-teacher">
          <div className="tn-teacher-title">Teacher — mic mode</div>
          <div className="tn-modes">
            <button
              className={`tn-mode-btn ${micMode === "pause" ? "on" : ""}`}
              onClick={() => switchMode("pause")}
            >
              Pause Cycle
              <span>Mic mutes while the tone plays</span>
            </button>
            <button
              className={`tn-mode-btn ${micMode === "continuous" ? "on" : ""}`}
              onClick={() => switchMode("continuous")}
            >
              Continuous ⚠ Experimental
              <span>Tone runs while the mic listens (echo cancellation on)</span>
            </button>
          </div>
          {micMode === "continuous" && (
            <div className="tn-warn">
              Experimental. The tone and the mic are live at the same time,
              so detection depends on this device's echo cancellation
              surviving low frequencies. It may not work — that is what
              this mode is for testing.
            </div>
          )}
          <div className="tn-diag">
            <div className="tn-diag-row">
              <span>Detected</span>
              <strong>{diag.frequency ? `${diag.frequency.toFixed(2)} Hz` : "—"}</strong>
            </div>
            <div className="tn-diag-row">
              <span>Clarity</span>
              <strong>{diag.clarity != null ? diag.clarity.toFixed(3) : "—"}</strong>
            </div>
            <div className="tn-diag-row">
              <span>Detection</span>
              <strong className={diag.ok ? "ok" : "no"}>
                {diag.ok ? "succeeding" : "failing"}
              </strong>
            </div>
            <div className="tn-diag-row">
              <span>Mic</span>
              <strong>{listening ? "open" : "muted"}</strong>
            </div>
          </div>
        </div>
      )}
    </div></>
  );
}

function TunerHeader({ onBack, title }) {
  return (
    <div className="tn-header">
      <button className="tn-back" onClick={onBack}>← Back</button>
      <div className="tn-title">{title}</div>
      <div style={{ width: 54 }} />
    </div>
  );
}
