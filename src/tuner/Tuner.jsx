import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import {
  capoStrings, ceilingFor, capoLabel, normalizeCapo, cutFretOf, isCapoOff,
  MAX_FULL_CAPO, DEFAULT_CAPO,
} from "./capo.js";

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

  /* THE TUNER'S OWN capo setting, defaulting to off. Deliberately NOT read
     from or written to the songbook's per-chart capo: this is a property of
     how the guitar is set up right now, not of a song. */
  const [capo, setCapo] = useState(DEFAULT_CAPO);
  // A cut capo is a 6-string guitar thing; a bass has no such capo.
  const cuttable = tuning.strings.length === 6;
  const capoOff = isCapoOff(capo);

  // Targets with the capo applied — a NEW array every time, so TUNINGS
  // itself is never mutated and the open path cannot regress. Every string
  // carries its OWN semitone count; there is no shared offset anywhere.
  const strings = useMemo(
    () => capoStrings(tuning, capo, cuttable),
    [tuning, capo.capo, capo.cut, cuttable]
  );
  // The search ceiling follows the highest target in play. With a full capo
  // the high E climbs past MAX_FREQ (392 Hz at capo 3) and would otherwise be
  // undetectable no matter how it displays.
  const ceiling = useMemo(() => ceilingFor(strings), [strings]);

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
  // Which constraint set actually produced audio, what the device really
  // applied, and every rung tried on the way. Surfaced in the diagnostic:
  // a fallback that happens invisibly is how this bug survived a release.
  const [capture, setCapture] = useState(null);
  const [probing, setProbing] = useState(null);   // rung being tried right now
  // iOS may hand back a SUSPENDED AudioContext: the mic is granted (the
  // recording indicator lights) but no samples ever arrive. Track that
  // separately from "muted" so the UI can say which one is happening.
  const [needsTap, setNeedsTap] = useState(false);

  const audioRef = useRef(null);
  // Set true once the tuner is torn down. getUserMedia is async, so a stream
  // can resolve AFTER unmount; without this flag that stream has no owner and
  // the mic stays live until a page refresh.
  const deadRef = useRef(false);
  const rafRef = useRef(0);
  const lastGoodRef = useRef(0);
  const cycleRef = useRef(null);
  const stopToneRef = useRef(null);
  // Mirrors of state the animation loop reads, so the loop is not
  // re-created on every state change.
  const lockedRef = useRef(-1);
  const stringsRef = useRef(strings);
  const listeningRef = useRef(true);
  // Read by the analysis loop, which is deliberately not re-created on every
  // state change — so the capo ceiling reaches it through a ref like the rest.
  const ceilingRef = useRef(ceiling);

  useEffect(() => { lockedRef.current = lockedIndex; }, [lockedIndex]);
  useEffect(() => { stringsRef.current = strings; }, [strings]);
  useEffect(() => { listeningRef.current = listening; }, [listening]);
  useEffect(() => { ceilingRef.current = ceiling; }, [ceiling]);

  /* ---------------- the analysis loop (shared by both modes) --------- */
  const loop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const buf = audio.read();
    if (buf) {
      const res = detectPitch(buf, audio.sampleRate, ceilingRef.current);
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
    setCapture(null);
    try {
      // THE ONE DIFFERENCE BETWEEN THE MODES, part 1: which LADDER we
      // walk. Mode B leads with echo cancellation because the tone and
      // the mic overlap; Mode A leads with raw capture, which it can
      // afford because it never hears its own tone. Both fall back
      // through the same rungs, because on iOS the preferred rung can
      // hand back a stream that delivers nothing at all.
      await audio.start(
        micMode === "continuous" ? CONSTRAINTS_CONTINUOUS : CONSTRAINTS_PAUSE,
        (rung, i, n) => { if (!deadRef.current) setProbing({ label: rung.label, i: i + 1, n }); }
      );
      // The user may have hit Back while getUserMedia was still resolving.
      // Nothing owns this stream now, so release it here or the mic light
      // stays on until the page is refreshed.
      if (deadRef.current) { audio.stop(); return; }
      audioRef.current = audio;
      setProbing(null);
      setCapture({ chosen: audio.chosen, attempts: audio.attempts, probeSkipped: audio.probeSkipped });
      setNeedsTap(!audio.isRunning);
      setStatus("running");
      rafRef.current = requestAnimationFrame(loop);
    } catch (err) {
      audio.stop();
      if (deadRef.current) return;
      setProbing(null);
      setCapture({ chosen: null, attempts: audio.attempts, probeSkipped: audio.probeSkipped });
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

  /* iOS only honours AudioContext.resume() inside a real gesture handler,
     and the mount-time start() is not one. Retry on the next genuine tap
     anywhere in the tuner, then stop listening once audio is flowing.

     The resume is also the FIRST moment the stream can be judged: while
     the context was suspended the analyser read zeros no matter how good
     the track was, so the ladder had to keep its first rung unprobed. If
     that rung turns out to be the silent one, re-run the whole ladder now
     that silence actually means something — otherwise an iOS cold start
     would settle on a dead stream and never reconsider. */
  useEffect(() => {
    if (!needsTap) return undefined;
    const onGesture = async () => {
      const audio = audioRef.current;
      if (!audio) return;
      if (await audio.ensureRunning()) {
        setNeedsTap(false);
        const verdict = await audio.probeAfterResume();
        if (deadRef.current) return;
        if (verdict === "silent") { stopAudio(); startAudio(); return; }
        setCapture({ chosen: audio.chosen, attempts: audio.attempts, probeSkipped: audio.probeSkipped });
      }
    };
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("touchend", onGesture);
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("touchend", onGesture);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsTap]);

  /* Mic is requested when the tuner opens, and released on the way out —
     never held open in the background. */
  useEffect(() => {
    deadRef.current = false;
    startAudio();
    return () => { deadRef.current = true; stopAudio(); };
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
        : errorReason === "silent"
        // Every constraint set was granted and every one delivered pure
        // silence. Naming it precisely matters: the mic indicator is lit,
        // so "no microphone" would be plainly wrong and send her hunting
        // in the wrong settings panel.
        ? "The microphone is on but no sound is reaching the tuner — every capture setting this device offered came back silent. Close any other app that might be using the mic, then tap Try Again."
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

      {/* ---- capo: verify in playing position ----
           Tuning OPEN is the accurate baseline — that is what the strings are
           actually set to. A capo pulls them slightly sharp by pressing them
           to the fret, so this exists to CHECK the guitar in the position it
           will be played in, not to replace tuning open. Said plainly below,
           because a target that silently means something else is worse than
           no capo support at all. */}
      <div className="tn-capo">
        <div className="tn-capo-row">
          <span className="tn-capo-lbl">Capo</span>
          <div className="tn-capo-frets">
            {Array.from({ length: MAX_FULL_CAPO + 1 }, (_, n) => (
              <button
                key={n}
                className={`tn-capo-btn ${capo.capo === n ? "on" : ""}`}
                onClick={() => { setCapo((c) => ({ ...normalizeCapo(c), capo: n })); setLockedIndex(-1); }}
              >
                {n === 0 ? "off" : n}
              </button>
            ))}
          </div>
        </div>
        {cuttable && (
          <div className="tn-capo-row">
            <span className="tn-capo-lbl">Cut capo</span>
            <button
              className={`tn-capo-btn wide ${capo.cut ? "on" : ""}`}
              onClick={() => { setCapo((c) => ({ ...normalizeCapo(c), cut: !c.cut })); setLockedIndex(-1); }}
            >
              {capo.cut ? "on · fret " + cutFretOf(capo) + " (A D G)" : "off"}
            </button>
          </div>
        )}
        <div className="tn-capo-note">
          {capoOff
            ? "Tune open — that is the accurate baseline. Set a capo to verify in playing position."
            : <>Targets are <strong>capo positions</strong> ({capoLabel(capo, cuttable)}), not open pitches.
               Tune open first for accuracy, then check here in playing position.</>}
        </div>
      </div>

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
              {/* With a capo on, never show a bare note: say which open string
                  it is and that this is a capo position, so there is no doubt
                  which pitch the number refers to. */}
              {activeString.capoed ? (
                <div className="tn-target">
                  <span className="tn-capo-from">{activeString.openLabel} → {activeString.label}</span>
                  {" · "}{activeString.freq.toFixed(2)} Hz · {capoLabel(capo, cuttable)}
                </div>
              ) : (
                <div className="tn-target">
                  target {activeString.freq.toFixed(2)} Hz
                  {!capoOff && <span className="tn-capo-from"> · open under {capoLabel(capo, cuttable)}</span>}
                </div>
              )}
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
            {s.capoed && <span className="tn-string-open">{s.openLabel}</span>}
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
          {needsTap && (
            <button
              type="button"
              className="tn-tapwake"
              onClick={async () => {
                const audio = audioRef.current;
                if (!audio || !(await audio.ensureRunning())) return;
                setNeedsTap(false);
                const verdict = await audio.probeAfterResume();
                if (deadRef.current) return;
                if (verdict === "silent") { stopAudio(); startAudio(); return; }
                setCapture({ chosen: audio.chosen, attempts: audio.attempts, probeSkipped: audio.probeSkipped });
              }}
            >
              Microphone is on but no audio is reaching the tuner — tap to enable
            </button>
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
            <div className="tn-diag-row">
              <span>Range</span>
              <strong>{"28–" + ceiling + " Hz"}</strong>
            </div>
            <div className="tn-diag-row">
              <span>Audio</span>
              <strong className={needsTap ? "no" : "ok"}>
                {needsTap ? "suspended" : "running"}
              </strong>
            </div>

            {/* WHICH CONSTRAINT SET ACTUALLY PRODUCED AUDIO. The whole
                point: a silent first choice used to fail invisibly, and
                what iOS applies is not what was asked for. */}
            <div className="tn-diag-row">
              <span>Capture</span>
              <strong className={capture && capture.chosen ? "ok" : "no"}>
                {probing
                  ? `trying ${probing.i}/${probing.n}: ${probing.label}`
                  : capture && capture.chosen
                  ? capture.chosen.label + (capture.chosen.probed ? "" : " (unprobed)")
                  : "—"}
              </strong>
            </div>
            {capture && capture.chosen && capture.chosen.probed && (
              <div className="tn-diag-row">
                <span>Signal peak</span>
                <strong>{capture.chosen.peak.toExponential(2)}</strong>
              </div>
            )}
            {capture && capture.probeSkipped && (
              <div className="tn-diag-row">
                <span>Silence check</span>
                <strong className="no">skipped — context suspended</strong>
              </div>
            )}
            {/* What the DEVICE applied, not what we asked for. iOS ignores
                constraints it does not honour rather than erroring. */}
            {capture && capture.chosen && capture.chosen.settings && (
              <div className="tn-diag-row">
                <span>Applied</span>
                <strong>{describeSettings(capture.chosen.settings)}</strong>
              </div>
            )}
            {/* Every rung tried, so a fallback is never invisible. */}
            {capture && capture.attempts && capture.attempts.length > 1 && (
              <div className="tn-diag-row tn-diag-stack">
                <span>Fallback</span>
                <strong>
                  {capture.attempts.map((a, i) => (
                    <span key={i} className={a.outcome === "audio" ? "ok" : "no"}>
                      {a.label}: {a.outcome === "audio" ? "audio" : a.outcome === "silent" ? "SILENT" : a.outcome === "rejected" ? "rejected (" + a.error + ")" : a.outcome}
                      {a.settings ? " [" + describeSettings(a.settings) + "]" : ""}
                    </span>
                  ))}
                </strong>
              </div>
            )}
          </div>
        </div>
      )}
    </div></>
  );
}

/**
 * Render what the device ACTUALLY applied. iOS ignores constraints it
 * does not honour rather than erroring, so the only trustworthy record
 * is the read-back — and `undefined` (the device declined to say) is
 * shown as "?" rather than being quietly folded into "off".
 */
function describeSettings(s) {
  const flag = (v) => (v === true ? "on" : v === false ? "off" : "?");
  const bits = [
    "AEC " + flag(s.echoCancellation),
    "NS " + flag(s.noiseSuppression),
    "AGC " + flag(s.autoGainControl),
  ];
  if (s.channelCount != null) bits.push(s.channelCount + "ch");
  if (s.sampleRate != null) bits.push(s.sampleRate + "Hz");
  return bits.join(" · ");
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
