# Music Practice App — Change Log

---
## 2026-08-09 — Instrument Tuner (guitar + bass, two mic modes)

### What Was Added
A new **🎯 Tuner** section for the students who play a stringed instrument. It listens through
the microphone, works out which string is being played, and tells the student in plain words
which way to turn the peg. Reachable from the student home (guitar/bass only) and from Teacher
Home (`screen==="tuner"`).

**Visibility is gated on the existing `instrument` field, never on student names**
(`!isTeacher && studentInstrument==="keys"` bounces back to home):
- **Bernardo** (bass) — yes, defaults to 4-string bass
- **Julia** (guitar) — yes, defaults to guitar
- **Lara** (keys) — **no**, the section does not appear for her at all
- **Teacher** — yes, including the experimental mode and the diagnostic

No new field was added for tuner defaults. The `STUDENTS` object, PIN logic, the `c5Log`
localStorage key, the teacher settings screen, and every existing quiz/studio/fretboard were
left untouched — all Tuner work is additive.

### File structure added
- `src/tuner/pitch.js` — the single detection implementation, the tuning tables, cents
  conversion, and string auto-detect.
- `src/tuner/audio.js` — mic capture and the reference tone. **All the difference between the
  two modes lives here**, so the detection maths stays identical between them.
- `src/tuner/Headstock.jsx` — the three SVG headstocks.
- `src/tuner/Tuner.jsx` — the UI, the two mode cycles, the readout, and the teacher diagnostic.
- `src/tuner/tunerStyles.js` — self-contained `tn-` prefixed CSS reusing the app's variables.
- `src/App.jsx` — additive only: import, a `tuner` screen route, and two entry buttons.

### Detection algorithm and buffer size
**YIN** (cumulative mean normalized difference + absolute threshold + parabolic interpolation),
not plain autocorrelation: plain autocorrelation octave-errors badly on low, harmonically rich
notes, which is exactly the B0/E1 bass region this has to get right.

**Buffer: 8192 samples.** The brief's 4096 floor is enough to contain two periods of 28 Hz
(1714 samples each at 48 kHz) but leaves the CMND curve noisy right where B0 lives. 8192 gives
~4.8 periods of 28 Hz (~170 ms) and is where the low-end readings actually settle. That latency
is a deliberate trade — the brief prefers low-frequency stability over fast response.

Three things had to be added beyond textbook YIN, each for a concrete failure found in testing:
1. **Zero-phase low-pass (2-pole, 1200 Hz)** before the period search. For any signal *above*
   the range, every integer multiple of its true period is also a perfect period match, so a
   500 Hz tone produced a flawless lag minimum at 250 Hz — inside our window, so the final range
   check never fired and the tuner confidently reported a note nobody played. Corner placement
   is a real trade: a 4-pole filter at 400 Hz fixed the leak but ate guitar high E's harmonics
   and dragged it flat, so the gentler filter plus check (3) is what works.
2. **Fundamental-presence check** (Goertzel at the candidate frequency vs. partials 2–4). A
   phantom sub-harmonic scores clarity **1.0000** — identical to a real note — so confidence
   alone cannot reject it. A real fundamental has energy at its own frequency; a phantom has
   almost none. Checking partials 2–4 rather than just the octave is required because an 800 Hz
   tone puts its phantom at the *third* sub-harmonic.
3. **Clarity gate at 0.86** and a silence gate on the raw (unfiltered) RMS, so filtering can
   never manufacture "silence" out of a real signal.

Verified against synthetic plucked tones before shipping: all 11 targets detect within **0.4
cents** at both 44.1 kHz and 48 kHz, no octave errors even when the fundamental is much weaker
than its harmonics, and silence / white noise / out-of-range tones all correctly return null.
~9 ms per frame.

### How the two modes differ in code
They share `detectPitch()`, the headstock, the readout, and every threshold. The difference is
confined to mic handling:

- **Mode A — Pause Cycle** (default, students and teacher). `CONSTRAINTS_PAUSE` requests the mic
  with echo cancellation **off** (the mic never hears our tone, and AEC is a nonlinear process
  that could only hurt a signal we measure to a few cents). The cycle runs
  listen → tone (mic muted) → settle → listen, so the student hears target-note / their-note
  alternating. The mic is gated at a **GainNode**, not by stopping the track: re-acquiring a
  MediaStreamTrack is slow enough to make the cycle feel jarring and can re-prompt for
  permission on iOS.
- **Mode B — Continuous (experimental, teacher only).** `CONSTRAINTS_CONTINUOUS` requests
  `echoCancellation: true` with `noiseSuppression: false` and `autoGainControl: false`. Both of
  those are speech-tuned: suppression treats a sustained low tone as stationary noise and gates
  it away, and AGC smears amplitude. The tone runs unbroken and the mic is never muted.
  Switching modes tears down and re-acquires the stream, because echo cancellation is a property
  of the captured track and cannot be toggled after the fact.

Mode B is rendered only inside the `isTeacher` block, so it is not reachable from any student
view. Alongside it, the **teacher diagnostic** shows detected frequency, clarity, whether
detection is currently succeeding or failing, and whether the mic is open or muted — all live,
so a student's phone can be checked with the reference tone running.

### Other details
- **Reference tone** is a fundamental plus four quiet partials (2nd, 3rd as triangle, 4th, 6th),
  not a pure sine — a bare sine at 30–100 Hz is very hard to pitch-match and most phone speakers
  barely reproduce it, whereas overtones let a small speaker imply a fundamental it cannot
  physically produce. Gentle 50 ms attack / 180 ms release, peak gain 0.22.
- **Auto-detect refuses to guess** beyond 150 cents, showing "Not sure which string — pick one
  below". A wrong guess would send a student to tighten the wrong peg, which is worse than no
  guess. Tapping a string locks to it and overrides auto-detect until tapped again.
- **In tune = within 5 cents**, shown as a green centred needle, green cents value, and a green
  "✓ In Tune" panel.
- **Tighten/loosen** is the most prominent element of the readout, in its own bordered panel
  (too low = tighten, too high = loosen).
- **Mic permission** is requested only when the Tuner screen opens, never on app load, and every
  track is stopped plus the AudioContext closed on the way out. Denial, no-device, and
  unsupported-browser are handled with distinct messages and a Try Again button.
- Reference pitch is fixed at A440; there is deliberately no adjustable reference control.

### Musical accuracy — verified by rendering, not eyeballed
All three headstocks were server-rendered to PNG and inspected as images, which caught two
mapping errors that reading the code did not:
- **Guitar 3+3** — low E takes the bass-side post *furthest from the nut*, giving the symmetric
  E·A·D / G·B·e fan of a real headstock.
- **Bass 5-string 4+1** — the low B sits alone on the treble side.
- Nut slots are assigned **per side**, not low→high across the nut. Spacing them naively dragged
  the 5-string's low B diagonally across all four other strings; strings now never cross, as on
  a real instrument.

### Device / browser limitations discovered
- **`npm run build` and `npm run dev` do not run on this machine.** The installed esbuild native
  binary (vite 4.4) hangs indefinitely under the local Node v26.5.0 — even `esbuild --version`
  never returns. This is pre-existing and unrelated to the Tuner. To verify this work the app
  was bundled with **rollup + @babel/preset-react** instead and driven in a real browser; every
  Tuner file plus `App.jsx` also passes a Babel parse check. **The tuner has not been verified
  through the project's own vite build** — that needs a working toolchain (a Node version
  matching the lockfile, or `npm install` to refresh esbuild).
- Chrome's `--use-file-for-fake-audio-capture` was silently ignored when
  `--use-fake-device-for-media-stream` was also passed (the built-in beep won), and even alone
  it attenuates the file by roughly 50 dB — far below any sane silence gate. End-to-end testing
  therefore injected a synthetic plucked string by overriding `getUserMedia`, which exercises
  the real AnalyserNode → `detectPitch` → auto-detect → readout path.
- Mode B's usefulness is genuinely unknown until it is tried on real student devices — browser
  echo cancellation is tuned for speech and may well destroy a 30–100 Hz tone. That is the
  point of the mode, and the diagnostic exists to measure it.

### Verified
In-browser against the bundled real app (390×844 mobile viewport), no console errors:
Julia → guitar, E2/G3/B3 auto-detect with exact cents and correct Tighten/Loosen; a pitch
halfway between two strings shows the "not sure" refusal; Bernardo → defaults to 4-string bass
(E1 A1 D2 G2) and sees no teacher block or Continuous mode; 5-string B0 at 30.87 Hz reads exact
and holds −18.0 cents steady when detuned; Lara → **no Tuner button anywhere**; Teacher → both
modes, the experimental warning, and a live diagnostic reading "succeeding" at clarity 1.000.
Leaving the tuner unmounts it and releases the stream.

### Left unresolved
- The vite build could not be exercised here (see above) — worth running once the toolchain is
  fixed, before relying on the deploy.
- Mode B on real hardware is untested by definition; that is the experiment.
- The tuner shows guitar/bass tunings only. A keys student has no use for it, hence the gate.
- Tuning targets are the verified values from the brief, entered as given and not recomputed.

---
## 2026-07-28 — Roster swap (Samuel → Lara) + Keyboard Studio

### Task 1 — Replaced Samuel with Lara
- `STUDENTS` in `src/App.jsx`: `Samuel { pin:"7361", instrument:"keys" }` removed, replaced by
  `Lara { pin:"4321", instrument:"keys" }`. Samuel no longer appears anywhere in the app.
- PIN login logic, the teacher settings screen structure, `TEACHER_PIN`, and the `c5Log`
  localStorage key were **not** touched — only roster data and section assignment.
- Lara's assigned sections: Circle of 5ths Quiz, Portuguese Note Names Quiz, and the new
  Keyboard Studio. She does not see the guitar or bass sections.

### Task 2 — New section: 🎹 Keyboard Studio
New files: `src/keyboard/theory.js` (data) and `src/keyboard/KeyboardStudio.jsx` (UI).
Wired into `App.jsx` as `screen==="keyboardStudio"`, guarded by
`isTeacher || studentInstrument==="keys"` — visible to **Lara** and **Teacher (9999)** only.
Entry buttons added to both the student home (keys students) and the Teacher Home screen.

**Core principle: the answer is never handed over up front.** This is a quiz that ends in a
reference diagram. The keyboard does not render until every gate is passed.

**Mode A — Scales.** All 15 major keys as separate entries (C G D A E B F# C# F Bb Eb Ab Db Gb Cb).
- Gate 1 — sharp side / flat side. C major instead asks "How many sharps or flats does C major
  have?" and accepts 0; C then goes straight to the reveal (1 gate, not 3) rather than showing a
  broken sharp/flat question.
- Gate 2 — "How many sharps?" / "How many flats?", wording follows the Gate 1 answer. Buttons 0–7.
- Gate 3 — "Which ones?" multi-select. **All twelve** possible accidentals of that type are shown
  as chips (F# C# G# D# A# E# B# / Bb Eb Ab Db Gb Cb Fb) so the set cannot be guessed by
  elimination. Exact-set match required, then Check.
- Reveal — top-down keyboard with the scale lit in order, fingering numbers on the keys, plus a
  note/finger table. **LH / RH toggle**, defaulting to right hand, clearly labelled.

**Mode B — Chords.** Major, minor, diminished and dominant 7 on all 12 chromatic roots (48 chords).
- Gate — "Which notes are in this chord?" multi-select over 12 chromatic chips in the spelling
  appropriate to the chord (flat chords get flat chips, sharp chords sharp chips; exotic spellings
  such as Cb/Fb are appended so every chord tone is actually offered).
- Reveal — chord tones lit with RH fingering: **1 3 5** for triads, **1 2 3 5** for dominant 7.

**"Show Me" at every gate** — reveals the correct answer, advances, and is never counted wrong.
Matches the established pattern used by the Chord Diagram Trainer. The reveal bar reads
"Revealed" instead of "✓ Solved" when Show Me was used at any gate.

**Usage logging** goes to the existing `c5Log` key via the existing `logActivity()` helper
(`keyboard_scale_start`, `keyboard_scale_complete`, `keyboard_chord_start`,
`keyboard_chord_complete`, each carrying a `shown` flag). The key was not renamed.

### The keyboard graphic
Pure inline SVG — no external images, image URLs, or CDN assets.
- **Straight-down orthographic view.** No perspective, no vanishing point, no key sides visible.
- Realistic rendering: layered ivory gradients on the white keys, seam shading down each white
  key's right edge, glossy black keys with a gloss band and a soft drop shadow onto the whites,
  rounded edges, a felt strip along the back of the case.
- **Real black-key geometry.** Black-key centres are set in white-key units from the left edge of
  C: C#=0.90, D#=2.10, F#=3.85, G#=5.00, A#=6.15 — i.e. they are *not* evenly centred on the
  cracks. In the 2-group C#/D# lean outward; in the 3-group only G# sits on its boundary while F#
  and A# lean out. Every black key still straddles its seam. Black keys are 61% of white-key
  length and 60% of white-key width.
- Two full octaves plus the closing C (25 white-key positions), so any one-octave scale plus its
  octave note always fits. `placeAscending()` normalises every root down into the first octave, so
  a high-rooted scale (Bb, B, Cb, C#) starts at the left instead of crowding the right edge.
- Lit keys use a gold gradient plus a glow rather than a flat colour fill, so they still read as
  keys. Fingering numbers are large; on black keys they are cream-on-dark for contrast.
- Responsive: the SVG scales to container width with a `viewBox`, and a `max-width:400px`
  breakpoint shrinks the type for phones.

### Musical accuracy — verified, not assumed
Both data tables were checked programmatically before shipping, not eyeballed:
- **All 15 scales** — verified that the ascending interval pattern is exactly 0 2 4 5 7 9 11 12
  **and** that the letter names run as seven consecutive letters (so Cb major spells
  Cb Db Eb Fb Gb Ab Bb Cb, and C# major spells C# D# E# F# G# A# B# C#).
- **All 48 chords** — verified against root-relative interval sets: major 0 4 7, minor 0 3 7,
  diminished 0 3 6, dominant 7 0 4 7 10. (Spot checks from the brief: G = G B D, Gm = G Bb D,
  Gdim = G Bb Db, G7 = G B D F — all correct.)
- **All 30 fingerings** (15 RH + 15 LH) — compared string-for-string against the patterns supplied
  in the brief, including the enharmonic rules (F# takes Gb's, C# takes Db's, Cb takes B's).
- Every scale and chord was also range-checked to confirm it lands on real keys inside the
  rendered two-octave span.
- The reveal was additionally server-rendered to static SVG and inspected as an image for C, Eb,
  B, Gb, Cb, C#, Bb, G7 and Bb dim to confirm the right keys light with the right numbers.

### Notes / limitations
- **Diminished spellings avoid double-flats — flag this for review.** Strict theory spells a
  diminished triad as root + minor 3rd + diminished 5th *by letter*, which for some roots requires
  a double flat: Dbdim would be Db Fb Abb, Ebdim would be Eb Gb Bbb, Abdim would be Ab Cb Ebb,
  Gbdim would be Gb Bbb Dbb. The app instead uses the common practical/teaching spellings that
  keep every note a single accidental: Db E G, Eb Gb A, Ab B D, Gb A C. Every chord is the
  correct *sound* (verified as intervals 0-3-6 in all 12 cases), and the plain roots are spelled
  strictly correctly (Cdim = C Eb Gb, Fdim = F Ab Cb, Bbdim = Bb Db Fb, Bdim = B D F). If the
  strict double-flat spellings are wanted for teaching, they are a one-line change per root in
  the `CHORDS` table in `src/keyboard/theory.js`.
- Chord fingering is root position only, as specified. No inversions.
- Scales are one octave ascending only; no descending fingering is shown.

---
## 2026-07-05 — Rich Voicings Piano Studio (teacher-only section)

### What Was Added
A new **teacher-only** section, **🎹 Rich Voicings Piano Studio**, reachable from the Teacher Home screen (`screen==="richVoicings"`, guarded by `isTeacher`). It is a piano practice app for a player who knows theory/notes cold but hasn't drilled piano technique: it serves **pre-voiced, rich pop-gospel progressions** and shows exactly which keys to play with each hand so the user can apply rich voicings (7ths, add9, sus, slash bass) in a worship setting. Self-paced reference & practice — not a timed play-along. Sibling to the Cut Capo and Open Voicings studios.

- **Two difficulty levels** (toggle, changeable anytime): **Foundations** — clean 7ths + add9, no slash chords or secondary dominants (3 progressions); **Pop Gospel** — 7ths + add9/sus + slash-bass movement + one secondary-dominant lift (4 progressions).
- **Curated, transposable voicing library** — voicings are **hand-authored in the key of C** (to preserve smooth voice-leading) and transposed to the chosen key by a pure semitone shift. We never algorithmically stack intervals. If the upward shift would exceed 6 semitones we transpose **down** instead (e.g. G: +7 → −5) to keep voicings in a comfortable worship register.
- **Two-hand blue/yellow keyboard** — a horizontal piano keyboard lights **LH notes blue** and **RH notes yellow**, with the note name printed on each lit key. Chord chip row (Nashville numbers underneath), tap-to-jump, prominent current-chord symbol, Prev/Next chord, and "New progression" to cycle the level's set. Per-hand note readout below.
- **Worship-weighted key selection** — manual picker (all 12 keys) plus a "🎲 Surprise me" button weighted 3× toward worship keys (C, G, D, A, E, F, Bb).
- **Thin device-only persistence** — last-used key + level saved to `localStorage` (no syncing promised).

### Keyboard range (design note)
Rather than a fixed C2–C6 window, the keyboard range is computed **per progression** from every note the progression actually uses (across all its chords, in the current key), padded a couple semitones and snapped to white keys, then **fit to the screen width**. This guarantees both hands are always visible at once (bass sits ~octave 2, treble ~octave 4–5, ~3+ octaves apart) and that no bass note ever falls off the low end after a downward transposition (e.g. key G pushes some LH notes to G1, below C2). Legible on mobile (verified at 375px).

### Files
- `src/pianovoicings/library.js` — the curated voicing data (Foundations F1–F3, Pop Gospel P1–P4, authored in C) plus the pitch engine: SPN↔MIDI, enharmonic-aware note spelling (flat keys spell flats, sharp keys sharps), 12-key table with per-key accidental preference, offset/transpose helpers, and the worship-weighted `surpriseKey()`.
- `src/pianovoicings/RichVoicingsStudio.jsx` — the two-hand piano keyboard SVG (whites + overlaid blacks, per-progression fit-to-width range, blue LH / yellow RH lit keys with note labels) and the full UI (level toggle, key picker + Surprise me, chord chip row with Nashville numbers, Prev/Next, New progression, per-hand readout). Self-contained styles (`rv-` prefix) reusing the app's CSS variables.
- `src/App.jsx` — additive only: import + a `richVoicings` screen route + a "🎹 Rich Voicings Piano Studio" button on Teacher Home. No existing section touched.

### Manual Steps Required
- None. Verified in-browser (teacher login, PIN 9999): Foundations/C F1 → Cmaj7 lights LH C2 blue + RH E4·G4·B4 yellow; Pop Gospel/C P1 → G7sus4 lights LH G2 + RH F4·G4·C5; Pop Gospel/G P2 → transposes down (offset −5) with the descending bass (C·B·A→D) preserved and both hands in view; P4/C → E7 lights the G# black key (secondary-dominant color note); level toggle swaps the progression set. `npm run build` passes; no console errors; keyboard legible at mobile 375px. Cut Capo Studio, Open Voicings Studio, and student sections unaffected.

---
## 2026-07-05 — Open Voicings Studio (teacher-only section)

### What Was Added
A new **teacher-only** section, **✨ Open Voicings Studio**, reachable from the Teacher Home screen (`screen==="openVoicings"`, guarded by `isTeacher`). It is a sibling to Cut Capo Studio but models a guitar in **standard tuning with NO capo** (open strings **E A D G B E**, low E on top). Its whole purpose is **open-string voicings**: shapes where one or more open strings ring against a few fretted notes — often high up the neck with two or three fingers — for a shimmery, non-traditional sound. It **only ever shows voicings that ring open and never a barre**. Two modes (tabs):
- **Chord Library** — root + type + optional slash-bass pickers and a free-text search box (`Gm`, `A7`, `Cmaj7`, `D/F#`, `F#m7b5` all parse). Generates open voicings, ranks them (bass correctness → most open/ringing strings → fewest fretted fingers → smaller span → mild bonus for higher-up shapes) and renders the top 3 with a voicing selector, plus a "N open strings ringing" line. When no clean open voicing exists it shows the honest message **"No clean open voicing in standard tuning — this chord needs a barre."** — never a barre fallback.
- **Discover** — a 12 roots × 8 common-types grid of best open-voicing thumbnails; chords with no open voicing are greyed with a "needs barre" tag (honest and still visible), plus a "🎲 Surprise me" button that opens a random chord that HAS an open voicing.

### THE OPEN FILTER (voicing.js)
Every returned voicing must pass ALL hard rules: **≥1 open string sounding**; **no barres** (reject if 2+ *fretted* strings share a fret); **≤3 fretted strings**; **fretted span ≤4**; **≥3 sounding strings**; all required chord tones present (optional tones droppable); no pitch classes outside the chord (guaranteed by candidate construction); and if a slash bass is given, the lowest sounding string must be that pitch class. A full-neck (frets 0–12) enumeration is used so discovery shapes at the 5th/7th/9th fret are found. A 11,296-voicing sweep across the Discover grid confirmed **0 invariant violations** (every shown voicing rings open and has no barre).

### Files
- `src/openvoicings/tuning.js` — standard-tuning pitch engine (no capo). Exports open pitches per string and `noteAtFret(s, fret)`, plus MIDI/available-fret helpers. Low E on top, frets 0–12 all available.
- `src/openvoicings/chords.js` — thin re-export of the Cut Capo chord engine (chord formulas, search parsing, naming) — chord theory is tuning-independent, so it is reused rather than duplicated.
- `src/openvoicings/voicing.js` — the open-voicing generator + ranking + the hard OPEN FILTER above. Returns an empty list (→ honest message) when no open voicing exists; no barre fallback.
- `src/openvoicings/OpenVoicingsStudio.jsx` — the photorealistic horizontal fretboard (low E on top, nut left, frets 0–12, wood/frets/nut, inlays 3·5·7·9 single & 12 double, **no capo graphic**, bold ○ for ringing open strings / ✕ for muted) and the two-mode UI. Self-contained styles (`ov-` prefix) reusing the app's CSS variables.
- `src/App.jsx` — additive only: import + an `openVoicings` screen route + a "✨ Open Voicings Studio" button on Teacher Home. No existing section touched.

### Note on F major
F major does yield a thin but genuine open voicing (F fretted with an open A ringing), not the "needs barre" message, because the chord-type table marks the 5th as **optional** for `maj` — so root+third with an open string passes the filter. The hard guarantee still holds: it is a real ringing open voicing, **not** a barre. Truly barre-only chords (e.g. F#/C#/G# majors, several sus/9 shapes) correctly return the honest no-voicing message — 25 of the 96 Discover cells are greyed.

### Manual Steps Required
- None. Verified in-browser (teacher login, PIN 9999): C major → open voicing (C·G·E, 2 open strings, no barre); F#maj → honest "needs a barre" message; D/F# → lowest note F# with 2 open strings ringing; Discover shows 96 cells, 25 greyed "needs barre", "Surprise me" opened a valid Asus4; Cut Capo Studio and student sections unaffected. `npm run build` passes; no console errors.

---
## 2026-07-05 — Cut Capo Studio (teacher-only section)

### What Was Added
A new **teacher-only** section, **🎼 Cut Capo Studio**, reachable from the Teacher Home screen (`screen==="cutCapo"`, guarded by `isTeacher`). It models a guitar in standard tuning with a **partial ("cut") capo clamped at fret 2 over ONLY the A, D and G strings** (low E, B, high E left open). Open-strummed this sounds **E B E A B E**. One app, three modes (tabs):
- **Chord Library** — root + type + optional slash-bass pickers and a free-text search box (`Gm`, `A7`, `E/G#`, `Bb`, `F#m7b5` all parse). Computes every playable voicing in the capo setup, ranks them (bass note → open/ringing strings → fewer fretted strings → smaller span → no full barre) and renders the top 3 on the fretboard with a voicing selector. Honestly labels omitted tones / partial shapes.
- **Discover** — a 12 roots × 8 common-types grid of best-voicing thumbnails, tap-to-open with alternates, plus a "🎲 Surprise me" button.
- **Builder** — reverse tool: tap frets string-by-string (note name printed on every available position), ○ open / ✕ mute per string, live low→high note readout, auto-naming with alternates + slash detection, manual label, Save/Clear, and a "My Shapes" list. Saved to `localStorage` (honest "Saved on this device only — not synced yet." note).

### Files
- `src/cutcapo/tuning.js` — partial-capo pitch engine. Exports open pitches per string, `isCapoed(s)`, `noteAtFret(s, fret)` (respects "no frets 0–1 on capoed strings"), plus MIDI/available-fret helpers. Uses the physically correct rule (fret = one semitone), which the brief also states in prose.
- `src/cutcapo/chords.js` — chord-type formulas (required vs droppable tones), search parsing, and reverse auto-naming.
- `src/cutcapo/voicing.js` — voicing generator + ranking, with an honest partial fallback when no complete shape exists.
- `src/cutcapo/shapeStore.js` — thin `getShapes()/saveShape()/deleteShape()` store on `localStorage`; interface is Firebase-swappable behind the same three functions (no backend added now).
- `src/cutcapo/CutCapoStudio.jsx` — the photorealistic horizontal fretboard (low E on top, nut left, frets 0–12, wood/frets/nut, inlays 3·5·7·9 single & 12 double, partial-capo bar clamping only the A/D/G rows at fret 2) and the three-mode UI. Self-contained styles reusing the app's CSS variables.
- `src/App.jsx` — additive only: import + a `cutCapo` screen route + a "🎼 Cut Capo Studio" button on Teacher Home. No existing section touched.

### Note on the brief's example note-table
The prose rule ("each semitone above a string's open pitch adds 1") is implemented as-is and matches a real guitar. Two cells of the brief's *example* table (and acceptance-check #6's D-string value) were hand-computed two semitones high on the D and G rows — e.g. D string / fret 4 physically sounds **F#**, not G#. The engine follows the physically correct rule so voicings match the actual instrument.

### Manual Steps Required
- None. Verified in-browser (teacher login, PIN 9999): E major → wide-open ringing voicing (E B E B G#); Gm/Cm playable; A7 = A C# E G; E/G# lowest note G#; Builder A-string fret 3 → C and D-string fret 4 → F#; Discover renders 96 thumbnails. `npm run build` passes, no console errors, existing sections unaffected.

---
## 2026-06-12 — Phase 5 Fix: Bass Note Labels Hidden During Quiz

### What Was Changed
- `src/App.jsx` — `BassFretboard` now takes a `showLabels` prop (default `false`). The note-label layer only renders a cell's text when `showLabels` is true. During a question the names are hidden so they can't be used as a cheat sheet; a highlighted cell (glow/green/red) still draws its **marker** but **not its name**, so "Name That Note" reveals WHERE the note is, not WHAT it is.
- The three quiz fretboards now pass `showLabels={bassAnswered}` — labels are hidden while the question is open and revealed as feedback after the student answers (or taps, in Find the Note):
  - **String Names:** only the highlighted string glows; all note + open-string names hidden. After answering, the string name is revealed (feedback text "Yes! 🎸" / "Not quite — it's X") and the full board labels reveal.
  - **Find the Note:** all labels hidden; student taps from memory. After tapping, every label reveals with the correct fret green and any wrong tap red.
  - **Name That Note:** all labels hidden; only the highlighted intersection shows as a gold marker (no name). After answering, all labels reveal.
- Untouched (per the brief): visual styling, string order (E·A·D·G top→bottom), inlay fret markers (still at frets 3/5/7), fret-number landmarks, and every non-bass part of the app. Fret numbers and inlay dots are navigation aids, not note names, so they remain visible in every mode.

### What Was Added
- **Study (reference) mode:** a new "📖 Study" card on the bass mode-select screen and a new `bassStudy` screen. It renders `<BassFretboard showLabels={true}/>` — the full neck with every note name visible, no quiz, no glow — plus a header back arrow and a "← Back to Modes" button that both return to the mode-select screen.
- `showLabels` prop on `BassFretboard` (additive; default `false`).

### Known Issues or Limitations
- After answering in String Names, the whole board's labels reveal (not just the one string's name). This is intentional reinforcement and still satisfies "reveal the string name as part of the feedback"; the feedback line also names the string.
- Fret-position numbers (0–7) and inlay dots stay visible during questions by design — they aid navigation but never reveal a note's name, so they aren't a cheat.

### Manual Steps Required
- None. Verified locally in a 390×844 mobile viewport (logged in as Bernardo): in all three modes the SVG shows 0 note labels during the question (String Names shows only the glowing string; Name That Note shows only a gold position dot with no name); after answering all 32 labels reveal with correct/incorrect coloring and the right feedback. Study mode shows all 32 labels with a working back button. `npm run build` passes; no console errors.

### Next Phase
- Phase 7: Full teacher mode audit — confirm all student sections visible

---
## 2026-06-11 — Phase 6 Fix: Chord Diagram Orientation and Marker Corrections

### What Was Changed
- `src/App.jsx` — three corrections to Julia's guitar chord diagrams, applied to BOTH the static `ChordDiagram` (shown on reveal) and the `InteractiveFretboard` (tappable input board), which share one geometry block.
- **Fix 1 — marker position:** fret position dots now sit between the **D and G strings** (the two middle strings, indices 2 & 3) instead of between G and B. `fbMarkerY = (fbStringY(2)+fbStringY(3))/2`.
- **Fix 2 — fret 7 marker:** fret 7 is now a **single** dot like frets 3 and 5 (double dots only occur at fret 12, outside the 7-fret window). `FretMarkers` no longer special-cases fret 7.
- **Fix 3 — horizontal orientation:** the whole board was rotated to how you hold a guitar — **nut on the LEFT**, strings run **horizontally** (top→bottom E · A · D · G · B · e), frets run **vertically**. O/X open/muted markers now sit to the **left of the nut**; the `{n}fr` position number appears **above** the board when a chord starts above fret 1; the interactive board's fret numbers (1–7) moved from the left to **above** each fret column. Barre chords now draw as a **vertical** bar spanning the barred strings. Finger dots keep the same size (r=17 / 34px) and style.
- Bumped `FB.marginTop` 30→40 and pinned the fret-number / position-label baseline to y=17 so the `{n}fr` label clears the rounded top of a barre bar (was overlapping on G#m).

### What Was Added
- Reworked geometry helpers: `fbStringY(s)` (string row Y), `fbNutX` (nut X), `fbBoardH` (fixed board height); `FB` now uses `marginTop` / `marginLeft` (nut X) / `marginRight` / `marginBottom`. Each component defines `dotX(f)` / `fretLineX(i)` (was `dotY` / `fretLineY`).
- `FretMarkers` now takes a `dotX` prop and draws one cream/pearl (`#f0ead6`, opacity 0.55) circle per fret.

### Known Issues or Limitations
- The tap-key format (`"string-fret"`, string 0–5, fret 1–7) and all quiz/scoring handlers (`handleCdTap`, `handleCdCheck`, Show Me, Skip) are unchanged — only the SVG layout was rotated, so the quiz flow is untouched.
- The static diagram still only draws position markers that fall inside its visible 5-fret window (so a nut-position chord shows dots at 3 and 5, not 7) — correct neck behavior.
- The horizontal board is wider than tall; on a narrow phone it scales uniformly to fit the screen width, so finger dots render at ~30px there rather than the full 34px. Proportions are preserved and taps remain accurate.

### Manual Steps Required
- None. Verified locally in a 375×812 mobile viewport (logged in as Julia): the interactive board and the Asus2 reveal show the nut on the left, E→e top to bottom, O/X left of the nut, single markers between D and G at frets 3/5/7; tapping still scores correctly ("✓ Nailed it!"); and the G#m reveal shows the vertical barre bar with a clearly legible `4fr` label above it. `npm run build` passes; no console errors.

### Next Phase
- Phase 7: Full teacher mode audit — confirm all student sections visible

---
## 2026-06-11 — Phase 6: Fret Markers on Julia's Chord Diagrams

### What Was Changed
- `src/App.jsx` — added standard guitar fret position markers (inlay dots) to both guitar fretboard surfaces. The markers are purely decorative neck landmarks; nothing about the chord library, quiz flow, Show Me / Check Answer / Skip buttons, string order, or any tap/scoring logic was touched.
- `ChordDiagram` (the static diagram shown when revealing an answer) — renders markers for any of frets 3/5/7 that fall inside the diagram's visible fret window (`baseFret … baseFret+4`). So a nut-position chord shows dots at 3 and 5; a raised-position chord like G#m (window 4–8) shows the dot at 5 and the double-dot at 7.
- `InteractiveFretboard` (the tappable board Julia uses to input answers) — renders markers at frets 3, 5, and 7 (all within its fixed 1–7 range). Markers are drawn before the transparent tap targets, so they sit visually behind and do not affect tapping.

### What Was Added
- `FB_MARKER_FRETS = [3, 5, 7]` and `fbMarkerX` (the x-coordinate centered between the middle two strings — G (index 3) and B (index 4)).
- `FretMarkers({ frets, dotY })` component: draws a single pearl/cream (`#f0ead6`, opacity 0.55) circle (r=5) at each fret, and a double dot (two circles offset ±9px) at fret 7 — the standard guitar convention. Reused by both fretboard components so they stay identical.

### Known Issues or Limitations
- Markers are intentionally always-on and are not tappable / not part of the answer; they sit between strings so they never overlap a finger dot or a tapped position.
- On the static diagram, only markers within the visible 5-fret window are drawn (correct neck-orientation behavior), so nut-position chords don't show the fret-7 double dot.
- The double dot is placed at fret 7 per the brief (a real neck's double dot is at fret 12); single dots match real necks at 3 and 5.

### Manual Steps Required
- None. Verified locally in a 375×812 mobile viewport (logged in as Julia): the interactive board shows single dots at frets 3 and 5 and a double dot at fret 7, all centered between the G and B strings in subtle cream; the static reveal diagram (Asus2) shows the in-window dots at 3 and 5 behind the finger dots. `npm run build` passes; no console errors.

### Next Phase
- Phase 7: Full teacher mode audit — confirm all student sections visible

---
## 2026-06-11 — Phase 5 Fix: Bass String Order

### What Was Changed
- `src/App.jsx` — reordered the `BASS_STRINGS` array from top→bottom **G · D · A · E** to **E · A · D · G**, matching how a bassist sees the neck looking down while playing (low E on top, high G on bottom). Updated the component's doc comment to describe the new order.
- Because the fretboard renders one row per array entry and every consumer (note labels, `glowString`/`glowCell` highlighting, and the three round builders `buildBassStringRound` / `buildBassFindRound` / `buildBassNameRound`) references `BASS_STRINGS` by index, this single reorder updates all of: row positions, the always-on note-name labels per string, string thickness (E keeps the thickest `w:4.8` on top, G keeps the thinnest `w:1.6` on bottom), and which string/cell the quiz highlights when it asks a question.

### What Was Added
- Nothing — this is a pure reorder of existing data.

### Known Issues or Limitations
- None. Fret position markers (still drawn between array indices 1 and 2, which remain the middle two strings — now A and D) are unchanged, as are all visual styling and every other part of the app.

### Manual Steps Required
- None. Verified locally in a 390×844 mobile viewport (logged in as Bernardo): the board now reads top→bottom E (thickest) · A · D · G (thinnest); the note rows match the spec (E: E F F# G G# A A# B … G: G G# A A# B C C# D); inlay dots still sit at frets 3/5/7 between the middle two strings; and String Names highlights the correct string in the new order (the top E string glows and answering "E" returns "Yes! 🎸"). `npm run build` passes; no console errors.

### Next Phase
- Phase 6: Add fret position markers to Julia's chord diagrams

---
## 2026-06-11 — Phase 5: Bass Fretboard Quiz (Bernardo)

### What Was Changed
- `src/App.jsx` — wired a new "🎸 Bass Fretboard" button into both home screens:
  - Student home: shown only when `studentInstrument==="bass"` (so only Bernardo sees it), placed next to the guitar-only Chord Diagrams button.
  - Teacher home: always shown (teacher can preview every student section), placed after Chord Diagrams.
- No existing screens, data, styles, or behavior were modified — all Phase 5 work is additive.

### What Was Added
- **`BassFretboard` SVG component** — a realistic, phone-sized 4-string bass neck:
  - Horizontal orientation: cream/bone **nut at the LEFT**, silver/metallic **frets running vertically** (fret 1 nearest the nut → fret 7), steel **strings running horizontally**.
  - String order top→bottom: **G (thinnest) · D · A · E (thickest)**; stroke widths 1.6/2.5/3.5/4.8 so the thickness visibly varies.
  - Dark-brown wood fretboard via a vertical `bassWood` linear gradient (`#5a3a22→#3a2416→#2a1810`).
  - **Inlay position dots** (cream/pearl `#f0ead6`) permanently shown at frets 3, 5, 7, centered between the middle two strings (D/A) as navigation landmarks.
  - **Note names always visible** at every string/fret intersection (frets 0–7), rendered as small Oswald labels in dark pill-circles for contrast.
  - Muted fret-number landmarks (0–7) along the top.
  - Display props: `glowString` (gold-glow a whole string), `glowCell` (gold-highlight one intersection), `greenCell`/`redCell` (correct/incorrect feedback), and `onTap(s,f)` for tappable intersections.
- **Bass note data**: `BASS_STRINGS` (each with `name`, 8-fret `notes` array, and string `w`idth), `BASS_NOTE_POOL`, `BASS_MARKER_FRETS`, geometry constants `BG` + helpers (`bassStringY`, `bassNutX`, `bassFretLineX`, `bassNoteX`, `bassBoardW`, `bassBoardH`).
- **Three round builders**: `buildBassStringRound()` (all 4 strings, random order — "What is the name of this string?", options E/A/D/G), `buildBassFindRound()` (10 random "Tap the note X on the Y string", frets 0–7), `buildBassNameRound()` (10 random "What note is this?", 4 MC note options).
- **8 new state vars**: `bassMode`, `bassSteps`, `bassIdx`, `bassAns`, `bassAnswered`, `bassResults`, `bassTap`.
- **Handlers**: `startBassQuiz(mode)`, `handleBassAnswer(opt)` (string/name modes), `handleBassTap(s,f)` (find mode), `handleBassNext()`. All log activity via `logActivity` (`bass_quiz_start` / `bass_quiz_complete`).
- **Three screens**:
  - `bassModeSelect` — mode picker (String Names / Find the Note / Name That Note) + Back.
  - `bassQuiz` — one question at a time, step-progress bar, the fretboard rendered per mode, answer buttons (string/name) or tap-to-answer (find), feedback ("Yes! 🎸" / "Not quite — it's X"), Next button.
  - `bassResults` — score %, mode label, encouragement message, Play Again / Switch Mode / Back to Home.

### Known Issues or Limitations
- Within frets 0–7 each note name is unique per string, so Find-the-Note has exactly one correct cell — no ambiguity. (If the fret range were ever widened past 11, that assumption would need revisiting.)
- The fretboard is intentionally a learning tool: note names are always shown, so Name-That-Note is a reading exercise rather than pure recall. This matches the brief ("note names are shown, not hidden").
- Find-the-Note ignores open-string vs fretted technique nuance — fret 0 is treated as a normal tappable position labeled with the open-string note.

### Manual Steps Required
- None. Verified locally in a 390×844 mobile viewport: logged in as Bernardo (bass) — the Bass Fretboard button appears and all three modes work (String Names glows the right string + "Yes! 🎸"; Find the Note lights the correct fret green and a wrong tap red with "Not quite — it's X"; Name That Note gold-highlights the intersection with 4 MC options). Confirmed Julia (guitar) does **not** see the button and the teacher **does**. `npm run build` passes; no console errors.

### Next Phase
- Phase 6: Fix fret position markers on Julia's chord diagrams

---
## 2026-06-11 — Phase 4 Fix: Chord Diagram Orientation (Julia)

### What Was Changed
- `src/App.jsx` — rewrote the `ChordDiagram` SVG component and replaced the interactive quiz fretboard. Both now share one geometry so the tappable board and the answer diagram look identical: nut at the TOP, frets running horizontally, strings running vertically, strings left→right as low E (6th) · A · D · G · B · high e (1st), fret numbers increasing downward.
- Introduced a shared `FB` geometry object + `STRING_LABELS` + helpers (`fbStringX`, `fbBoardW`) used by both the static diagram and the interactive board. Sizes meet the phone-readability minimums: string spacing 40px (≥36), fret spacing 46px (≥44), finger dot diameter 34px (≥32).
- `ChordDiagram` now: shows O (open, green) / ✕ (muted, red) markers above the nut; draws a thick white nut bar when the chord starts at fret 1, or a thin line + `{n}fr` label on the left when it starts higher (e.g. G#m at fret 4); draws barre chords as a thick rounded bar across the barred strings with "1" inside; draws remaining fingers as filled circles with their finger number in dark text.
- The old box-grid quiz fretboard (`.cd-grid` / `.cd-cell` markup) was replaced by a new `InteractiveFretboard` SVG component: 6 vertical string lines, frets 1–7 as horizontal lines with fret numbers down the left, nut at the top, and tappable string/fret intersections that show a filled gold dot when tapped. Check Answer / Show Me / Skip buttons are unchanged.

### What Was Added
- `FB` geometry constant, `STRING_LABELS`, `fbStringX()`, `fbBoardW` helpers.
- `InteractiveFretboard({ tapped, onTap, disabled })` component.
- `.cd-fretboard-wrap` CSS class (centers the interactive board).

### Known Issues or Limitations
- The interactive board always shows frets 1–7 from the nut (absolute positions). For barre chords like G#m (frets 4–6) the student must tap the real fret numbers — intentional, it tests true knowledge. The reveal diagram shifts and shows the `4fr` label.
- Open/muted strings are not part of the tap answer; checking still compares only fretted positions (`fret > 0`), unchanged from before. Open/muted are shown on the reveal diagram.
- The old `.cd-grid`/`.cd-cell` CSS rules remain in the stylesheet but are now unused (left in place to avoid touching unrelated styles).

### Manual Steps Required
- None. Verified locally in a mobile viewport (logged in as Julia): the E chord taps + Check Answer reveal the correct diagram, and the G#m barre chord renders with the 4fr label and barre bar.

### Next Phase
- Phase 5: Bass fretboard quiz for Bernardo

---
## 2026-06-03 — Phase 4: Chord Diagram Trainer (Julia)

### What Was Changed
- `src/App.jsx` — added chord library data, SVG diagram component, quiz screens, CSS, state, and handlers

### What Was Added
- `GUITAR_CHORDS` constant: 25 chords (19 open, 6 barre) with `frets`, `fingers`, and `barre` fields. Strings indexed 0–5 = low E to high e; muted strings = -1, open = 0
- `ChordDiagram` SVG component: renders a 6-string × 5-fret fretboard. Draws: string name labels (E A D G B e), O/X markers above nut for open/muted strings, thick nut rect at fret 1 (thin line for higher positions), fret number label for baseFret > 1, barre as a rounded rect spanning barred strings with "1" centered inside it, individual circles with finger numbers for non-barre fingers. baseFret auto-computed as min of active frets
- 9 new state variables: `cdQueue`, `cdIdx`, `cdTapped`, `cdPhase`, `cdFeedback`, `cdCorrect`, `cdWrong`, `cdNotYet`, `cdSkipped`
- `startChordQuiz()`: shuffles GUITAR_CHORDS, resets all cd state, navigates to chordQuiz
- `handleCdTap(str, fret)`: toggles "str-fret" key in cdTapped array
- `handleCdCheck()`: compares sorted tapped positions against expected (fret > 0 strings), marks correct/wrong, sets cdPhase="revealed"
- `handleCdShowMe()`: marks chord as "not yet learned", sets cdPhase="revealed" without scoring
- `handleCdSkip()`: adds chord to cdSkipped, advances without revealing
- `handleCdNext()`: advances to next chord or navigates to cdResults
- `chordQuiz` screen: chord name header, step progress bar, 6×7 tappable grid (fret labels left, string names top), three-button row (Check Answer / Show Me / Skip); after reveal shows feedback + ChordDiagram + Next button
- `cdResults` screen: summary counts (correct/incorrect/not yet/skipped), chip lists per category, Play Again / Back to Home
- CSS: `.cd-screen`, `.cd-grid`, `.cd-cell` + state variants (tapped/hit/miss/need), `.cd-section`, `.cd-chip` variants (ok/no/notyet/skip), `.cd-diagram-wrap`, `.cd-btn-row`, `.cd-results`
- "🎸 Chord Diagrams" button on student home (visible only when `studentInstrument === "guitar"`)
- "🎸 Chord Diagrams" button on teacher home (always visible)

### Known Issues or Limitations
- The quiz grid always shows frets 1–7 (absolute). For barre chords like G#m (frets 4–6) or B/Bm/F#m (frets 2–4), the student must know the absolute fret positions. This is intentional and tests real knowledge.
- The tappable grid does not show open strings — only fretted positions are tapped. Open strings are shown in the reference diagram after answering.

### Manual Steps Required
- None (committed and pushed)

### Next Phase
- Phase 5: Bass fretboard quiz for Bernardo (open strings + first 7 frets, 4 strings)

---
## 2026-06-03 — Phase 3 Fix: Teacher Mode Visibility

### What Was Changed
- `src/App.jsx` — added two buttons to the `teacherHome` screen render (lines ~849–851)

### What Was Added
- "🔍 Look Up a Key" ghost button on teacher home → navigates to the existing `lookup` screen
- "🇧🇷 Notas em Português" ghost button on teacher home → navigates to the existing `ptModeSelect` screen
- Both buttons sit between "Preview This Key" and "View Students", matching the ordering on the student home screen

### Known Issues or Limitations
- The `lookup` screen always renders `StudentNav` at the bottom. When a teacher navigates there from teacher home they will see the student nav bar instead of the teacher one. This is a pre-existing structural limitation and was out of scope for this fix per instructions.

### Manual Steps Required
- `cd ~/Music-Practice && git push`
- GitHub Actions deploys automatically after push

### Next Phase
- Phase 4: Bass fretboard quiz for Bernardo (open strings + first 7 frets, 4 strings)

---
## 2026-06-03 — Phase 3: Portuguese Note Names Quiz

### What Was Changed
- `src/App.jsx` — added new data, helper, state, handlers, screens, and home button

### What Was Added
- `NOTE_NAMES` constant: 7 note pairs `{ en, pt }` — C/Dó, D/Ré, E/Mi, F/Fá, G/Sol, A/Lá, B/Si
- `buildPortugueseRound(mode)` helper: shuffles all 7 notes, builds one question object per note with 4 answer choices (1 correct + 3 random wrong from the same list)
- 6 new React state variables: `ptMode`, `ptSteps`, `ptIdx`, `ptAns`, `ptAnswered`, `ptResults`
- `startPortugueseQuiz(mode)` — initializes and starts the quiz for either mode, logs to `c5Log`
- `handlePtAnswer(opt)` — records single-choice answer and marks step answered
- `handlePtNext()` — advances to next question or navigates to results; logs completion to `c5Log`
- `ptStep` / `ptIsRight` computed values derived each render
- `ptModeSelect` screen: mode picker with two card-buttons (English→Português / Português→English) and a Back button
- `ptQuiz` screen: 7-question quiz using `.quiz-screen`, `.prog-bar`, `.pip`, `.ans/.reveal/.wrong` — same visual language as the rest of the app; correct feedback "Sim! ✓", incorrect feedback "Quase! The answer was [X]"; Next → / See Results → button advances flow
- `ptResults` screen: shows X/7 score, percentage, encouraging message, Play Again / Switch Mode / Back to Home buttons
- "🇧🇷 Notas em Português" button on student home screen (above "Change Learning Style")

### Known Issues or Limitations
- None noted

### Manual Steps Required
- Fix npm cache permissions if not already done: `sudo chown -R 501:20 "/Users/nicolel/.npm"`
- Then: `cd ~/Music-Practice && npm install && git push`
- GitHub Actions deploys automatically after push

### Next Phase
- Phase 4: Bass fretboard quiz for Bernardo (open strings + first 7 frets, 4 strings)

---
## 2026-06-02 — Phase 2 Fix: Sharps/Flats Button Labels

### What Was Changed
- `src/App.jsx` — updated the `whichSelect` step inside `buildKeyRound()` (lines ~112–121)

### What Was Added
- `whichOptions` now derives the 7 button labels from `accidentalType`:
  - Sharp keys → buttons show `A# B# C# D# E# F# G#`
  - Flat keys → buttons show `Ab Bb Cb Db Eb Fb Gb`
  - C major (no accidentals) → buttons show plain `A B C D E F G`, all disabled
- `whichCorrect` now uses `keyData.accidentalList` directly (e.g. `["F#","C#"]`, `["Bb"]`) instead of stripping to bare note letters — so selected values match button labels exactly

### Known Issues or Limitations
- None noted

### Manual Steps Required
- Fix npm cache permissions if not already done: `sudo chown -R 501:20 "/Users/nicolel/.npm"`
- Then: `cd ~/Music-Practice && npm install && git push`
- GitHub Actions deploys automatically after push

### Next Phase
- Phase 3: Portuguese note names quiz (all students)

---
## 2026-06-02 — Phase 1 & 2: Hardcoded students + upgraded quiz questions

### What Was Changed
- `src/App.jsx` — complete rewrite of auth system, quiz question logic, and supporting state

### What Was Added

**Phase 1 — Hardcoded student config:**
- Added `STUDENTS` constant at top of file: Bernardo (bass/2847), Julia (guitar/5913), Samuel (keys/7361)
- Added `arraysEqual()` helper used by multi-select scoring
- Replaced PIN-only login screen with a two-step flow: name select → PIN entry
- New `nameSelect` screen: shows student name buttons derived from `STUDENTS` keys, plus a "Teacher Login" button
- New `selectedLoginName` and `studentInstrument` React state (no localStorage)
- `handleNameSelect()` function routes to PIN screen with context
- `handlePin()` now validates against `STUDENTS[selectedLoginName].pin` (students) or `TEACHER_PIN` (teacher)
- PIN screen shows the selected name (gold for student, purple for teacher) and a Back button
- Removed `getStudents()`, `saveStudents()`, `students` state, `saveBadge` state, `updateStudent()`, `saveStudentsFn()`
- Settings screen changed from editable student rows to a read-only display of `STUDENTS` with instrument labels and a note to edit the code
- Teacher "Exit" now returns to `nameSelect` instead of `pin`
- Timeout screen tap now returns to `nameSelect`
- `c5Log` localStorage logging preserved untouched

**Phase 2 — Upgraded quiz questions:**
- `buildKeyRound()` now generates 11 steps (was 10): side, count, whichSelect, majorSelect, then 7 chord steps
- Step 2 (`type:"whichSelect"`): replaces old `type:"which"` multiple-choice — shows all 7 note names (A–G) as toggle buttons; student selects which notes are sharp/flat; Check Answer button submits; correct answers derived from `accidentalList` via `a[0]` (letter only); C major shows unselectable buttons with a "no sharps or flats" message
- Step 3 (`type:"majorSelect"`): new question "Which chord numbers are MAJOR in a major key?" — same 7-button multi-select UI; correct answers always `["1","4","5"]`; appears before chord questions, after key signature questions
- Added `multiSelected` state (array), `toggleMulti()`, `handleMultiSubmit()` functions
- Multi-select scoring: compares sorted arrays; wrong selections shown red, correct-but-missed shown faded green
- Phase labels updated: nav (steps 1–3), "Chord Theory" (step 4), chord (steps 5–11)
- `Reinforce` component updated to handle `whichSelect` (same display as old `which`) and `majorSelect` (shows chord grid highlighting 1, 4, 5)
- Added multi-select CSS: `.multi-grid`, `.multi-btn`, state variants (selected/right/wrong/missed/disabled)
- Added name-select CSS: `.name-screen`, `.name-list`, `.name-btn`, `.name-divider` classes

### Key signature data verification (accidentalList base letters)
All 15 keys verified against standard music theory:
- C: none | G: F | D: F,C | A: F,C,G | E: F,C,G,D | B: F,C,G,D,A | F#: F,C,G,D,A,E | C#: F,C,G,D,A,E,B
- F: B | Bb: B,E | Eb: B,E,A | Ab: B,E,A,D | Db: B,E,A,D,G | Gb: B,E,A,D,G,C | Cb: B,E,A,D,G,C,F

### Known Issues or Limitations
- npm cache has a permissions issue on this machine (`/Users/nicolel/.npm` owned by root). Build/install cannot be run until fixed. Run `sudo chown -R 501:20 "/Users/nicolel/.npm"` then `npm install` before building.
- Learning style preference is still saved to localStorage keyed by student name (`style_<name>`) — intentional, as the instructions only said to remove PIN/name storage.

### Manual Steps Required
1. Fix npm cache permissions: `sudo chown -R 501:20 "/Users/nicolel/.npm"`
2. `cd ~/Music-Practice && npm install`
3. Commit and push: `git add src/App.jsx PROGRESS.md && git commit -m "Phase 1&2: hardcoded students + multi-select quiz" && git push`
4. GitHub Actions will deploy to GitHub Pages automatically

### Next Phase
No next phase defined. Future work might include: per-student progress tracking, instrument-specific tips, or additional quiz question types.

---

## Headstock SVG geometry fix (guitar, bass4, bass5)

Only `src/tuner/Headstock.jsx` was touched. Pitch detection, mic handling and
the tuning tables were left alone.

### Verification method
Reading the code was explicitly not enough here, so each headstock was
rendered to a full-frame PNG and inspected visually, then compared against
photos now checked in under `reference/`:

- `reference/taylor-guitar-3x3.jpg` — acoustic guitar, 3+3
- `reference/yamaha-bass-4.jpg` — 4-string bass, 4-in-line
- `reference/ltd-bass-5.jpg` — 5-string bass (bass peg scale, wound strings)

Renders were produced by transforming the real `Headstock.jsx` with esbuild,
running it through `react-dom/server`, and rasterising with `qlmanage`, so
what was inspected was exactly what the component emits. Ten iterations were
inspected before the result was accepted. The render script was temporary and
has been removed; no project dependency was added.

### What was wrong, and what the renders showed

**All three — strings fanned out from a narrow nut cluster.** The nut span was
`width * 0.30` while the posts sat far wider, and each string was a single
straight `<line>` from nut to post. The baseline render showed a dramatic fan.
Fixed by widening the nut span to a large share of the neck (it is now derived
from the outline's own nut width) and by replacing the straight line with
`stringPath()`: the string holds its nut x up the head and only makes a short
lateral hop into the post at the very end. Renders now show near-vertical,
near-parallel strings.

**Guitar — strings crossed between nut and posts.** `nutXs()` handed the
outermost slot to the peg furthest from the nut on *both* sides, so the treble
G3/B3 strings crossed. Rewritten to sort strings by their post's x and hand out
nut slots in that order, which makes crossing geometrically impossible: two
strings can only cross if their nut order and post order disagree. Same-side
ties break by y.

**Guitar — outline was an oval dome.** Replaced with `guitarPath()` modelled on
the Taylor photo: wide, nearly flat crown with a soft central peak, distinct
corners, near-straight sides. Measured off the reference, the Taylor's nut is
only ~14% narrower than its crown, so the taper is now correspondingly gentle
(earlier attempts read as a trapezoid).

**Bass 4 — posts sat on the left edge with the body entirely to their right.**
Posts moved inward to x=140 of 300; renders confirm wood on both sides of every
post.

**Bass 5 — the low B cut a long diagonal across the head.** B0's post moved to
the treble side nearer the nut, and with the ordered-slot rule its string now
runs vertically down the treble side, crossing nothing. The 4+1 layout is
unchanged.

**Bass did not look different from guitar.** Now genuinely distinct:
- `bassPath()` is its own angular swept-wedge silhouette (clipped canted tip,
  long straight-ish bass edge, treble side sweeping in), not the guitar reused
- bass `postR` is 19 vs the guitar's 11, so posts are clearly larger
- per-string widths: bass 5.4→3.0 (and 6.2 for the low B) vs guitar 2.6→1.1, so
  bass strings are clearly thicker and low is thicker than high on both
- wound strings carry a dashed winding overlay so they read as ribbed

A 4-in-line has all its posts on one side, so a strictly centred string band
left the outer strings reaching sideways. `nutXs()` now leans the band toward
the post column (clamped so it always stays on the nut); a symmetric 3+3 is
unaffected because its posts average to the centreline.

### Acceptance check
1. All three rendered to PNG and inspected at full frame — yes, ten rounds
2. No string crosses another — confirmed visually **and** analytically: each
   path was sampled at 200 points and the left-to-right ordering of the strings
   never changes on any of the three
3. Strings near-vertical and near-parallel — yes
4. Pegs mounted inside the wood on all three — yes
5. Bass posts clearly larger than guitar posts — yes (r=19 vs r=11)
6. Bass strings clearly thicker, low > high on each — yes
7. Guitar outline resembles the Taylor — flat-ish crown, corners, gentle taper
8. Bass outline visibly different from the guitar — yes

Peg labels verified low→high: guitar `E2 A2 D3 G3 B3 E4`, bass4 `E1 A1 D2 G2`,
bass5 `B0 E1 A1 D2 G2`. Each peg remains individually addressable
(`data-peg`, `onSelect`, `activeIndex` highlight all unchanged).

### Residual nit
On the two basses the G string — outermost slot, post nearest the nut, so the
shortest vertical run with the widest sideways reach — still curves a little
more than its neighbours near the nut. It crosses nothing and reads as a
string; softening it further bowed the E string instead, so it was left alone.

---

## Headstock artwork port — photoreal SVGs into the component

Replaced the procedurally-drawn artwork in `src/tuner/Headstock.jsx` with the
three finished SVGs from `design-output/Headstocks.dc.html` (guitar 3+3, bass
4-in-line, bass 4+1). `design-output/` has been deleted now that its contents
are in the component.

### What changed in the component
- The old geometry helpers (`LAYOUTS`, `nutXs()`, `stringPath()`, `guitarPath()`,
  `bassPath()`, `NUT_EDGE`) are gone. The artwork is now literal inline SVG per
  instrument rather than computed from a peg table, so the layered faces, wood
  grain, cast shadows, wound-string texture and back-mounted tuner buttons all
  come across as drawn.
- Props, export shape and call signature are unchanged: still a default export
  taking `{ tuningId, strings, activeIndex, onSelect }`, so `Tuner.jsx` renders
  it exactly as before.
- The design file's `{{ hl.<id>.c / .o / .t }}` template placeholders became an
  `hl(i, activeIndex)` helper returning ring colour, ring opacity and label
  colour. The design harness's six-way `pegState` enum collapsed to the single
  active colour (`#ffb020`), which is all the app distinguishes.
- All 15 peg ids preserved and individually addressable — `peg-E2 … peg-E4`,
  `peg-E1-4 … peg-G2-4`, `peg-B0 … peg-G2-5` — each still carrying `data-peg`,
  the `onSelect` click target and its own visible note label.
- `.tn-peg-label` is no longer used: the new artwork carries its own inlaid
  labels (dark drop copy under a tinted top copy). The rule is still in
  `tunerStyles.js` and now has no effect.

### Guitar treble-side peg order — fixed while porting
The design file had the treble column running E4 / B3 / G3 from tip to nut, so
the high E sat furthest from the nut. Corrected to G3 / B3 / E4 tip→nut, which
puts the high E nearest the nut opposite D3. Walking low→high now goes down the
bass side E2 A2 D3, across, then back up the treble side G3 B3 E4. Only the two
post y values swapped (310 ↔ 120); B3 stayed at 215, and the bass side and both
basses were not touched.

The three treble strings were re-routed to their moved posts, and the note
labels moved with them.

**Nut slots deliberately did NOT move.** The treble post column leans *outboard*
as it descends toward the nut (x = 182, 194, 204), so the post nearest the nut
is also the one furthest out and must be fed by the outermost nut slot. Of the
six ways to assign the three slots to the three posts, exactly one avoids
crossings, and it is the one the artwork already had: G3←159, B3←178, E4←197.
The instinct to also swap the slots (mirroring the post swap) produces four
crossings — checked before it reached the render.

### Verification
Rendered from the real component via `react-dom/server`, rasterised full-frame
at 300×552 (nut and fretboard visible at the bottom, nothing cropped) and
inspected, plus a 4× zoom on the guitar's treble side:
- Guitar treble reads G3 top, B3 middle, E4 bottom
- No string crosses another on any of the three. Verified numerically against
  the *painted* polylines including stroke width, not just centrelines — the
  tightest clearance is A2/D3 at 0.12 units, which is inherited unchanged from
  the approved artwork
- Every label sits on its own peg. The guitar's treble labels were nudged
  inboard so they clear the 14.5-unit highlight ring; at the design file's
  original offsets the active E4 ring overlapped its own label
- Highlighting confirmed on guitar E4, guitar G3, bass4 E1 and bass5 G2: gold
  ring on the peg and the note label turns gold
- String order low→high holds: guitar E2 A2 D3 G3 B3 E4, bass4 E1 A1 D2 G2,
  bass5 B0 E1 A1 D2 G2

Inline SVG only, no external images, no new dependencies.

### Note on `npm run build`
Not run to completion here: `vite build` dies with "The service was stopped"
because the sandboxed environment kills the `esbuild` binary. Confirmed
pre-existing by stashing the change and reproducing the identical failure on
the unmodified committed file — it is not caused by this port. The component
was verified through the React server-render path instead, which exercises the
real component code.

### Carried over from the design pass
The 4+1's lone treble-side post takes **G2**, not B0. B0 is the lowest string
and sits at the bass-side edge of the nut, so routing it to a treble-side post
would cross all four other strings; "B0 on the lone post" and "no crossings"
cannot both hold. Note order B0 E1 A1 D2 G2 is unchanged.

## 2026-09-03 — Week's-set Songbook (bilingual search, Nashville numbers, offline PWA)

**What was built.** New module `src/songbook/` (App.jsx touched additively only: one import, one `screen==="songbook"` route, a 🎵 Songbook button on the teacher home and on the student home). Pure-JS logic modules with no React imports (`chords.js` key detection + Nashville + capo, `text.js` folding/normalizing/language heuristics, `chordpro.js`, `pcpdf.js` for `pdftotext -layout` output with column-index chord placement, `sections.js` dedup/roadmap/abbreviations, `match.js` PC-title matching, `search.js`, `setStore.js` API + localStorage cache). `scripts/buildLibrary.mjs` compiles `songsources/` (68 ChordPro + 1 PDF, copied from the Downloads folder as supplied on 2026-09-03 — five Sunday PDFs were replaced by ChordPro files mid-session) into the committed `library.json` (~300 KB, 69 charts grouped into 62 songs). Language is detected from content (>=3 ALL-CAPS gloss lines = PT; the one PDF uses a stopword vote). PT and EN charts of one song are grouped by shared normalized name; EN/PT toggle only appears when both exist; Eu Vou Construir shows two PT versions. Rendering: black background, white lyrics, bold gold Nashville numbers (letters small in parentheses for songs opened from search rather than the set), dark-blue section labels, gloss line under each PT lyric, roadmap strip (condensed letters, falls back to full labels when abbreviations would collide), Legend toggle, key button with manual key picker, drag/arrow reorder persisted under `songbook_order_<chart>`; all storage under `songbook_` keys. `keyOverrides.json` (build-time) pins Nada é Impossível to C — its chord content alone scores F. PWA: `public/manifest.webmanifest`, `apple-touch-icon.png` + icons at the document root (generated by `scripts/makeIcons.py`), `sw.js` emitted by a tiny inline plugin in `vite.config.js` that precaches every built file; registered from `main.jsx` via `songbook/registerSw.js`. Set lists come from a new public read-only route `GET /songbook/set?service_type_id&service_date` in the ltc-api Worker (titles + sequence only, reuses `pcoFetchOrderOfService`). Cache-first render then background revalidate; non-blocking banner when offline or when the fetch fails, showing the last-synced time. An open chart pings the app's inactivity timer every minute so the 15-minute blackout cannot fire mid-song. `chart.audio = null` is the seam for a future Play button; nothing else built for it.

**Source data fix (needs Nicole's eyes).** Three of the five new Sunday ChordPro files were truncated versus the PDF exports they replaced: Teu_Toque stopped mid-Verse 2 (no Bridge), Ele_e_Deus lacked Bridge 2, Quem_e_Como_Nosso_Deus lacked Pre-Chorus/Chorus/Bridge/Ending. The missing sections were appended from the PDF text extracted earlier in the session (chords placed by column, literal caps glosses written by Claude) and each file carries a `{comment: ... reconstructed on 2026-09-03 ...}` marker plus a `{comment: Flow: ...}` roadmap. Please proof those glosses.

**Verified by actually running it.** (1) `npx vite build` passes. (2) Set matching for both weekends run against the exact Planning Center titles (with leader suffixes) via Node: Sat resolves all four to the EN charts; Sun resolves the five PT charts and COUNTDOWN is unmatched and still listed. (3) "Here as In Heaven" → Elevation EN chart on English Service, Gabi Sampaio PT on Sunday 10AM; toggle switches the whole chart. (4) Search "the atmosphere" returns the EN chart first and the PT chart via its gloss; "a atmosfera" returns the PT chart. (5) "casa do pai" finds both House of the Lord charts. (6) Column alignment checked chord-by-chord on the remaining PDF (Eu e Minha Casa, Verse 1 + Chorus) against the rendered PDF page — matches. (7) Nashville numbers hand-checked on Teu Toque in A (D=4, E=5, F#m7=6-7, C#m=3-, A/C#=1/3, E4=5sus) and Here As In Heaven in G. (8) Quem é Como Nosso Deus shows G with the Em→G notice; "Use Em" renumbers to Em (b6 b7 1-7), reset restores G, OK dismisses persistently. (9) Real Chrome, no console errors; desktop and a 390px viewport. (10) Offline: with the preview server killed the app loaded from the service worker, both sets rendered from localStorage, full-library search worked, charts opened, banner showed the last-synced time.

**Not verified / caveats.** The Worker deploy could not be run from this session (the auto-mode permission classifier blocked `npx --yes wrangler@4.127.0 deploy` twice), so `/songbook/set` is NOT live yet; the browser tests used the set lists seeded into localStorage from the known PC titles, and the banner therefore read "Could not reach Planning Center" (the true "Offline" wording only appears when `navigator.onLine` is false, which was not simulated). The live end-to-end fetch through the endpoint is unverified until the deploy runs: `cd ~/ltc-api && npx --yes wrangler@4.127.0 deploy` then `deployments list` must show a new Version ID. iOS Add-to-Home-Screen and airplane mode on a real iPad not tested. Key detection is heuristic for all ChordPro charts (no `{key:}` directives except two); the on-chart key picker is the safety valve. Student view offers the two weekend services (English Service Sat, Sunday 10AM Sun) rather than exactly one. Nothing deleted; `package-lock.json` (previously untracked) is now committed.

## 2026-09-03 (later) — Full capo and cut capo now combine

**Why.** The previous build modelled capo as three mutually exclusive modes (`none` / `full` / `cut`), with `normalizeCapoSetting` hard-setting the fret to 2 whenever the mode was `cut`. That was physically wrong: Nicole uses both capos at once.

**New model,** in `src/songbook/cutcapoAdapter.js`: `{ capo, cut }` where `capo` is the full-capo fret (0-7, 0 = none) and `cut` is a boolean. The cut capo has no fret of its own — it always sits exactly two frets above whatever is below it, so its position is derived by `cutFretOf()` as `capo + 2` and is never stored. Both can be set together; capo 2 with cut on is valid and common.

**Migration.** `normalizeCapoSetting` still accepts every older shape and writes the new one going forward: a bare number `n` becomes `{capo:n, cut:false}`, `{mode:"none"}` becomes `{capo:0, cut:false}`, `{mode:"full", fret:n}` becomes `{capo:n, cut:false}`, and `{mode:"cut"}` becomes `{capo:0, cut:true}`. It is wrapped in try/catch and falls back to `{capo:0, cut:false}` for anything unrecognised, including strings, NaN and unknown objects. Verified against 15 inputs.

**UI.** The single mode dropdown is replaced by two independent controls: a fret selector 0-7 for the full capo, and a one-tap on/off toggle button for the cut capo showing its derived fret. Both are teacher-only. Header label now covers all four combinations: `Key: A`, `Key: A - Capo 2 (G)`, `Key: A - Cut capo (fret 2)`, and `Key: A - Capo 2 (G) + cut capo (fret 4)`. The full capo keeps its fingering key in parentheses because that transposition is real; the cut capo never gets one, because it raises only three strings and no single key describes it.

**Popup with both engaged.** The cut-capo engine models a partial capo at fret 2 from the nut. A full capo just moves that whole system up, so the sounding chord is transposed DOWN by the full capo fret (`shapeTokenFor`), the existing engine runs unchanged on that shape, and the diagram offsets its fret numbers by the capo so they read absolutely off the real neck. `CutCapoDiagram` now draws the full capo as a barre across all six strings and the cut capo as a partial barre two frets above on the A, D and G rows only. The popup labels the setup, e.g. "A sounding · play G shape · capo 2 + cut capo at fret 4". Nothing in `src/cutcapo/` or `src/openvoicings/` was modified.

**Bug found and fixed during verification.** With a nonzero full capo the popup reported the *shape's* pitch classes as the sounding notes — an A chord at capo 2 read "B · G · B · D" instead of an A chord. The engine works in shape space, so the note names and the bass note now get transposed up by the capo fret on the way out. Caught on screen, not in review; the diagrams and header had looked right while the note row was wrong.

**Verified by actually running it.** `npx vite build` passes. In real Chrome as Teacher: all four capo combinations produce the exact header strings above; the Nashville row is byte-identical across all four (`4 5 6-7 3- 4 6-7 1`), confirming numbers never move with the capo; capo 2 + cut renders both barres at frets 2 and 4 with sounding notes C#·A·C#·E for a chord written A; capo 0 + cut renders the partial capo alone at fret 2 sounding E·E·A·C#·E; changing the key left capo and cut untouched, and changing the capo left the key at its override; a chart saved in the old `{mode:"full",fret:5}` shape loaded as capo 5 with cut off and header "Key: A - Capo 5 (E)". As a student (Julia, PIN 5913) with `{capo:2,cut:true}` still on disk: zero capo controls, zero cut toggles, zero tappable chords. No console errors.

**Caveat unchanged from the previous entry.** The popup still takes roughly a second to paint for dense chords; the chord math is milliseconds, the cost is SVG rendering. Also note the service worker aggressively serves the old bundle during local testing — clear it before trusting what you see.

## 2026-09-03 (later still) — Fit-to-screen chart display, pointer swipe between set songs

**Why.** The chart view had the wrong display model. It was an ordinary scrolling page with fixed font sizes, and the whole point of the third-party songbook app it replaces is that it never scrolls: the complete song is on one screen, the type shrinks until it fits, and one swipe gets you to the next song. On stage Nicole has both hands on the guitar — she cannot scroll, and she cannot lose her place hunting for the next line.

**No scrolling in the chart view.** The chart is now a fixed pane (`.sb-pane`, `height:100dvh`, `overflow:hidden`) rather than a `min-height:100vh` page with `padding-bottom:40px`. `dvh` rather than `vh` because iOS Safari's collapsing toolbars make `vh` taller than what you can actually see. Inside it: a fixed header, a `flex:1; min-height:0` body that is the box the fit measures against, and the nav buttons. The set list and search screens still scroll normally — the rule is chart-view-only, applied by an `.sb-fixed` class on the `.sb` root.

**Auto-fit.** All chart text now derives from one CSS variable `--sbfs` on the fit container (chords `1.05em`, lyrics `1em`, gloss `.72em`, section labels `.66em`, roadmap `.78em`), so one number scales everything together proportionally. `fitFontSize()` binary-searches 8–28px to a quarter-pixel, measuring `scrollHeight`/`scrollWidth` against the body box. It runs in a `useLayoutEffect` — before paint, so the chart never flashes at the wrong size — and re-runs on song change, page change, block reorder, and every toggle that changes content height (PT/EN, gloss, legend, roadmap labels, capo, cut capo, key override, the minor-key notice). A `ResizeObserver` on the body plus `resize`/`orientationchange` listeners cover the rest, debounced 60ms. It never scales above 28px; a song that does not fill the height is centred by flex rather than blown up.

**Columns, which is where the readability actually came from.** Chord charts are tall and narrow, so on anything wider than a phone a single column wastes most of the screen and the fit has to shrink the type to compensate — Teu Toque landed at 8.8px in one column. The fit now also chooses a column count (1–3, capped by a 260px minimum column width) and keeps whichever combination yields the largest type, with `break-inside:avoid` so a section never splits across a column. Same song, same box: 8.8px → 16.3px. On a 390px phone it correctly drops back to one column.

**Pagination, only when it must.** If the song still overflows at 8px, `paginateBlocks()` splits it at section boundaries only — blocks are atomic, so a verse or chorus is never cut in half. It finds the fewest pages that fit, then re-packs to spread the song evenly across that many pages rather than cramming the early ones and leaving the last nearly empty, which is what lets every page scale its type back up. The column budget is discounted 12% because a block that will not fit at the foot of a column gets pushed whole to the next one. A final guard re-splits up to three times if the chosen page still overflows: a clipped lyric on stage is the one outcome this feature exists to prevent. Every block stays in the DOM at all times and off-page ones are hidden by the measurer, which is what lets the fit re-test the whole song on every resize and collapse back to one page as soon as it can.

**Swipe.** Pointer events, not touch events, so the same code path serves the iPad on stage and a mouse on a laptop while testing — touch events do not fire for a mouse, which would have made the feature untestable on the laptop. Horizontal drag left = next song, right = previous, requiring 60px of travel and at least 1.5× more horizontal than vertical. No wrapping at either end. Gestures starting in the chord popup, on the reorder handle, or in any form control are ignored, as is everything while reorder mode is on. When a song is paginated, vertical swipe turns its pages and the two axes stay strictly separate. `touch-action:none` on the pane, since nothing scrolls any more and there is no native pan to protect. Large Prev/Next buttons carrying the neighbouring song titles are the fallback and the only mouse-clickable path; ←/→ move between songs and ↑/↓ between pages, all ignored while focus is in a text field. A "3 / 5" set position sits next to the title, and a "1 / 2" page badge appears only when the song is paginated. Opened from search rather than the set: no swipe, no arrows, no position indicator. Song changes are instant — the chart data is already in `library.json` — and each chart's saved capo, key override and block order are keyed by chartId, so they survive navigation.

**Compact header.** Key button, capo fret, cut-capo toggle, PT/EN, version, Legend, Gloss, label style and Reorder are now one tight non-wrapping row; the legend degrees render inline in that row instead of on a line of their own; the notice and cut-capo hint are tightened; the nav buttons dropped from 100px to a 44px minimum. The pane also lost its 900px max-width, because width is exactly what the fit converts into font size.

**Three bugs found and fixed during verification, all on screen rather than in review.** (1) The measurer wrote styles inside the box its own `ResizeObserver` was watching, so every fit scheduled another fit and the tab spun forever; it now ignores a callback that is not actually a new size. (2) `chartId` changing reset `pages` from one effect while the measurer wrote it from another, and the two fought across renders; the reset now happens in the layout phase before the measurer runs. (3) With the cut capo on, `bestFit` left a losing single column applied when nothing fitted, while `paginateBlocks` computed its page budget assuming three — so the chart rendered clipped at 8px and stayed that way. When nothing fits, the widest layout now wins, because that is the one the caller is about to paginate against.

**Verified by actually running it.** `npx vite build` passes. In real Chrome as Teacher on Sunday 10AM 2026-09-06 (the live `/songbook/set` endpoint, five charted songs plus the unmatched COUNTDOWN): all five songs render complete on one page each with no clipping and `document.documentElement.scrollHeight` equal to `innerHeight` (594 = 594) — no document scroll. Every Portuguese ALL-CAPS gloss line is present and rendered at every size (34 of them on Teu Toque). A real mouse click-drag left advanced 4/5 → 5/5 and right went back, with no wrap at either end and the Prev/Next buttons correctly disabled at the ends; arrow keys walked the whole set both directions without wrapping; a 40px drag and an 80×200px drag were both correctly ignored. Reorder mode swallowed both swipe and keys. A swipe starting inside the cut-capo popup did nothing. Toggling the gloss re-fitted 9.1 → 11.6 → 9.1px, never clipped. Resizing re-fits both ways and caps at exactly 28px at 2400×1600, centring a short chart with equal 541px gaps above and below. The longest song fits on one page in all four iPad boxes — 1024×768 (11.3px, 3 cols), 768×1024 (11.8px, 2 cols), 1180×820 (12.2px, 3 cols), 820×1180 (16.1px, 3 cols) — and paginates to two pages on a 390×844 phone, where the break lands between whole sections (page 2 opens on Verse 2 and holds Bridge, Chorus 2 and Bridge 2 entire). Cut capo on: header, hint and 72 tappable chords intact, chart re-fits to 13px unclipped, and the chord popup opens over a correctly fitted chart. As a student (Julia): zero capo controls, zero cut toggles, zero tappable chords, and the fit works identically with larger type because the student header is shorter.

**Caveats.** The `ResizeObserver` path could not be exercised in the automation harness — it never fires for a backgrounded tab, and the `resize_window` tool moved the OS window without changing the viewport — so resize re-fitting was verified by dispatching the `resize` event the app also listens for, and by driving the pane to exact test dimensions. The observer itself is therefore unverified on a real device; the window listener is the independent second signal and it works. Nothing was tested on real iPad hardware or under iOS Safari's actual `dvh` behaviour. The cut-capo popup is still slow to paint (roughly a second for dense chords, unchanged and diagnosed earlier as SVG rendering cost, not chord math), which repeatedly blew the 45-second automation timeout during testing. The service worker aggressively serves the previous bundle during local testing — it must be unregistered and the caches cleared before anything on screen can be trusted.

## 2026-09-05 — Chord popup for every capo state, not only the cut capo

**The bug.** On the iPad, tapping a chord did nothing. It only worked once the cut capo was switched on. This was not a touch-handling problem, which is what the symptom suggests — it was structural. `Songbook.jsx` rendered the chord span as interactive (`role=button`, `onClick`, `tabIndex`) only when `cutOn` was true, and the only popup mounted in the whole file was `CutCapoPopup`, also gated on `cutOn`. Without the cut capo a chord was a plain, inert `<span>`. The general chord popup had never been built; the cut-capo feature had simply brought its own along with it.

**The tap target is now unconditional.** Every chord token is interactive on every render, regardless of capo state — no capo, full capo, cut capo, or both — and regardless of whether the user is the teacher or a student. This also reverses, deliberately, the "students see zero tappable chords" behaviour recorded in the two entries above: that was a side effect of the tap target being welded to a teacher-only control, not an access decision. Students never see the capo controls, which stay teacher-only, but they can now ask what a chord is.

**Routing.** `cutOn` selects the popup, never the tap target. Cut capo on (alone or with a full capo) → the existing `CutCapoPopup`, untouched. Otherwise → the new `ChordPopup`.

**Why the answer is not `src/openvoicings/`.** The obvious move was to reuse `generateVoicings` from the open-voicings studio, and it is the wrong engine for this question. It answers "what unusual shimmering shapes exist where open strings ring against fretted notes high up the neck?" — it rejects barres by design and ranks by openness. Asked for C major it returns 242 voicings and puts `8-x-x-0-x-0` first: a real and beautiful voicing, and not what anyone glancing at a chart mid-song means by "C". A player needs the ordinary shape. So `src/songbook/chordshapes.js` holds a first-position shape table plus movable E- and A-form barre shapes for everything else, and picks the lowest playable position. `src/openvoicings/` and `src/cutcapo/` were imported, never modified.

**Instrument decides the shape of the answer, from the `instrument` field already on `STUDENTS`.** Guitar and Teacher get a fretboard diagram. Keys get the notes with scale degrees and no fingering, because keyboard voicing is two-handed and variable and there is no single correct one to draw. Bass gets the root plus the available chord tones, for the same reason. `instrument` was already in `App.jsx` but was not being passed to `Songbook`; it is now threaded through to `ChartView`.

**Capo.** With a full capo at fret N the fingered shape is the sounding chord transposed DOWN by N. The popup renders that shape, draws the capo as a barre at fret N, prints fret numbers absolutely, and states both readings — "A · sounding · play G shape · capo 2" plus a sentence spelling it out. Capo does not touch the keys or bass answer at all, since it is a guitar device and does not change what the chord sounds like, which is the only thing those two instruments asked about.

**Bug found during verification, on screen and not in review.** `ChordDiagram` first imported its string geometry from `src/cutcapo/tuning.js`, the obvious sibling. That module has the partial capo baked into its geometry: its `noteAtFret` returns `null` for any fret at or below fret 2 on the A, D and G strings, because in that engine those strings are permanently behind the capo. An open A chord (`x 0 2 2 2 0`) therefore lost three of its five notes silently — the diagram rendered one gold dot where there should have been three, and the DOM confirmed only one circle existed. The fix is to take the neutral standard-tuning geometry from `src/openvoicings/tuning.js` instead. Worth remembering: these two tuning modules have the same export names and incompatible meanings.

**iPad touch.** The handler is `onPointerDown`/`onPointerUp`, not `onClick` — iOS Safari does not reliably synthesise `click` on a bare `<span>`. Because the chart is also a swipe surface, a tap is defined as a pointerup that travelled less than 10px; a drag that happens to end on a chord stays a swipe and changes the song, and only a genuine still tap calls `stopPropagation`. The tap area is grown past the small glyph with an `::after` pseudo-element rather than padding, since padding would move the chord off the syllable it sits above — which is the entire point of a chord chart. It grows downward most (the space under a chord is its own lyric line, not a target) and stays inside the horizontal gutter so neighbouring chords do not steal each other's taps; measured hit height went from 18.5px to 40px.

**Verified by actually running it.** `npx vite build` passes. In real Chrome against the live set: with NO capo, tapping a chord opens a popup showing the open A shape, `x 0 2 2 2 0`, notes A·E·A·C#·E — the reported bug, confirmed fixed. With full capo 2 in key A the popup reads "sounding · play G shape · capo 2", draws the capo barre at fret 2, numbers frets absolutely (2–6) and reports sounding notes A·C#·E·A·C#·A. Cut capo on: the existing popup is unchanged, best shape plus alternative, partial barre on the A/D/G strings only; the plain "Not playable with the cut capo / Remove the capo for this song." answer still renders, exercised on Asus2/D, a real slash chord in House of the Lord (a sweep found 108 unplayable slash chords, so that branch is live, not dead code). Capo 2 + cut capo 4 together still renders both barres exactly as before. A synthetic touch-only pointer sequence (`pointerType:'touch'`, no mouse events at all) opens the popup in both iPad orientations — 820×1180 and 1194×834 — a drag ending on a chord correctly does not, and a tap outside dismisses. As Lara (keys, PIN 4321): the popup shows A / C# / E with degrees 1 / 3 / 5 and no fretboard, while the capo and cut controls stay hidden.

**Caveats, stated plainly.** Nothing was tested on real iPad hardware or under real iOS Safari; the touch verification used synthesised pointer events with `pointerType:'touch'` in desktop Chrome at iPad viewports, which exercises the same code path but is not the same as a finger. The shape table is hand-written and covers the common vocabulary plus barre forms for the rest; a chord type outside `E_FORMS`/`A_FORMS` returns an honest "no shape for this chord" rather than a wrong diagram. The service worker still serves the previous bundle during local testing and must be cleared before anything on screen can be trusted.

## 2026-09-05 (later) — Persistent session, songbook deep link, above-the-fold entry

**Why.** Reaching the songbook took four steps on every single launch: pick a name, enter a PIN, scroll down, tap Songbook. Nothing about the login was persisted — `App.jsx` stored per-user style prefs under `style_<name>` but never the login itself — so every launch began at the name picker, including the launch five minutes before a service.

**Remembered session.** A successful PIN now writes `mp_session` — the name and a timestamp, nothing else. The PIN itself is never written to disk: that key says "Nicole was here", not "let anyone in". On load a valid remembered name skips both the name picker and the PIN screen. `style_<name>` and `c5Log` are untouched, and the PIN values and `STUDENTS` object are unchanged. A remembered student also restores their saved learning style, since otherwise the style picker would reappear every launch and the saving would be one step, not two.

**Sign out.** In teacher settings under a new "This device" section that explains what staying signed in means, and at the foot of the student home screen. It clears the session and returns the name picker, leaving style prefs and the activity log alone. The teacher header's existing "Exit" button was also clearing `isTeacher` but not the session, so it would have walked straight back in on the next render; it now clears the session too.

**Timeout, still 15 minutes.** A shared church iPad still locks. What changed is the cost of waking it: the remembered user goes back to their own PIN pad rather than all the way to the name picker — one four-digit entry, not two screens. Only an unknown or cleared session falls back to the picker. A routed screen is remembered across the lock, so unlocking returns her to the songbook she was reading rather than the home screen. The idle timer no longer arms on the PIN screen itself, which would only have bounced the user between two doors.

**Deep link.** `#songbook` and `#songbook/set` open the songbook directly. The hash is kept in sync as she navigates, so the PWA and a plain reload both reopen where she was, and unknown hashes are ignored rather than obeyed — `#cutCapo` does nothing. `start_url` in the manifest is now `/Music-Practice/#songbook`, inside the existing `/Music-Practice/` scope, so the installed home-screen icon opens straight onto the songbook.

**A real security bug, found on screen during verification.** The first working version let `#songbook` past the PIN entirely. With no session, `screen` initialised from the hash and the songbook branch rendered — anyone could type the hash on a shared iPad and read the set without ever seeing a keypad. The boot logic guarded this correctly but nothing re-checked it on a plain reload, and every other gated screen in the file guards at its own render site. The fix is one authoritative auth gate ahead of every screen branch: not signed in and not on a login screen means the name picker, full stop. The requested destination is parked in `pendingRoute` and honoured after the PIN, so the deep link still works for the person it is for and does nothing for anyone else.

**Above the fold.** The Songbook button was eighth in the teacher's list and had to be scrolled to. It is now first and styled as the primary action with a 69px tap target. That alone was not enough — measured on screen, it still sat at y=597 against a nav bar starting at 582 — because the circle diagram was a fixed 380px square that consumed the viewport above it. The circle is now capped at `min(380px, 42dvh)` on its **max-width**, not its max-height: with `aspect-ratio:1` a height cap does not shrink the width and the element stayed 380px, which the DOM confirmed. Constraining width shrinks both together. The button now measures 490–558 against a fold at 582, with no document scroll, and the cap scales with viewport height so it holds in both orientations.

**Verified by actually running it.** `npx vite build` passes and `start_url` is correct in `dist`. In real Chrome: signing in as Teacher writes `mp_session`, and a full reload goes straight to teacher home with no name picker and no PIN. `#songbook` with a session renders the songbook immediately, no intermediate screen, no scrolling. `#songbook` with the session cleared shows the name picker, and after the PIN it lands on the **songbook** with the hash preserved — the destination is not dropped. Sign out clears the session, returns the picker, and leaves `style_Lara` and `c5Log` in place. The inactivity timeout was exercised for real by temporarily shortening it to 4 seconds in the dev source: it fires, and tapping the lock screen returns the PIN pad showing "Teacher", not the name picker; the 15-minute value was restored afterwards and the file re-checked for stray test code. As Bernardo (bass, PIN 2847): his home screen lists Songbook, Practice, Look Up a Key, Notas em Português, Bass Fretboard, Tuner, Change Learning Style, Sign out — Bass Fretboard but no Chord Diagrams and no Keyboard Studio, the three-tab student nav, no teacher studios; his songbook shows the student service chips and no teacher date picker; `#cutCapo` typed as a student does nothing. The Part 1 chord popup still works after all of this, verified on the bass variant (A → A/C#/E, degrees 1/3/5, no fretboard).

**Caveats.** Nothing was tested on real iPad hardware, in real iOS Safari, or as an actually installed PWA — `start_url` was verified in the built manifest and by loading the equivalent URL, not by installing to a home screen. The `resize_window` tool moves the OS window without changing the inner viewport in this harness, so both orientations were verified by measuring against the live viewport and by the fact that the circle cap is expressed in `dvh` and therefore scales, rather than by two genuinely different device viewports. The set fetching, caching and refresh logic in `setStore.js` and around the `ChartView` fetch was not touched.

## 2026-09-05 (later still) — Manual set order and key overrides for rehearsal changes

**Why.** In rehearsal minutes before a service the worship leader changes the running order or a song's key out loud. Everyone is standing there holding an instrument; nobody walks back to a laptop to update Planning Center. The app has to follow a spoken change in seconds or it is useless in exactly the moment it matters most. Rare, but not optional.

**One derived running order.** The whole feature hangs on a single value. `setSongs` used to be Planning Center's list; it is now the override's list when one exists and PC's otherwise, and everything downstream — the set list, the swipe navigation, prev/next, the "3 / 5" position badge — reads that one value. This is why reorder, remove and add all work on swipe without any navigation code being touched: there is no second copy of the order to forget to update. PC's own list is still computed, as `pcSongs`, but only to seed new overrides and to notice drift.

**Reorder, remove, add.** Up/down buttons on every row plus HTML5 drag. The buttons are the dependable path and are sized accordingly (44×44, the touch minimum) because dragging on an iPad while holding a guitar is unreliable — drag is the convenience, not the mechanism. A removed song leaves today's running order only and stays in the library, still findable in search. A song added from the library is marked ADDED so it is never mistaken for something Planning Center sent, and it can be inserted at any position.

**Key from the set list.** A key called out in rehearsal can now be set without opening the song. The row shows the effective key at a glance and tapping it opens a picker of all 12 majors and 12 minors. It deliberately writes the SAME `songbook_key_<chartId>` the chart view has always used, so a key set from either place is one fact rather than two that can disagree — verified by checking that `overrideStore`'s writer and `ChartView`'s `lsGet` reader agree on JSON encoding in both directions. Nashville numbers follow the key because they always did; nothing in that path changed. Capo lives under `songbook_capo_<chartId>` and is never touched by a key change or by the reset — a capo is a fact about the guitar, not about the set.

**Persistence and scope.** `songbook_setorder_<serviceId>_<date>` holds `{active, items, basis, at}`. Per service AND per date, so next week starts clean and an override can never leak into a service it was not called for. Anything malformed reads as null rather than throwing: a corrupt key must not take the songbook down mid-service.

**Not letting a background refresh wipe an override.** This was called out as the part most likely to go wrong, and the defence is structural rather than defensive. `setStore.js` is byte-identical and no `fetchSet`/`readCachedSet`/`setSetData` call was modified — verified with `git diff`. The refetch updates `setData` exactly as before; it simply is not the thing the list reads any more. `override` is only ever cleared by two explicit user taps (Reset, and Load-from-PC on the notice). Drift is detected by comparing what PC returns now against `basis` — what PC said when the override was BUILT — so a background refetch of an unchanged set stays silent, and a real change raises a small non-blocking notice offering "Load from Planning Center" or "Keep mine". Nothing is discarded without her choosing it.

**Bug found on screen during verification.** The notice worked on a date switch but not on a cold page load: the `[serviceId, date]` effect called `setPcChanged(false)`, and on mount both effects run with that one last, so it clobbered the derivation. The override survived — but she was never told Planning Center had moved, which is half the guarantee missing and exactly the silent-failure case this feature exists to prevent. `pcChanged` is now owned solely by the effect that derives it. Also caught: the key button was 30×36px, under the touch minimum, on a control tapped in a hurry during rehearsal; it is now 44×44 like the move buttons.

**Verified by actually running it, all eleven steps.** `npx vite build` passes. In real Chrome against the live Saturday set (English Service, 2026-09-05): moving song 4 to position 2 reordered the list AND the swipe walk became House of the Lord → I Lift My Hands → Holy Forever → Here as In Heaven at 1/4…4/4, with the NEXT button naming the right neighbour. Removing Holy Forever dropped the walk to 1/3…3/3 skipping it, and it was still returned by a library search for "Holy Forever". Adding Goodness Of God at position 2 put it at 2/4 in the list and in the swipe walk, badged ADDED. Setting House of the Lord to C from the set list changed the chart header to "Key: C - Capo 3 (A)" and recalculated the Nashville numbers from 1 / 1sus2 / 4(add9) / 5 to 6 / 6sus2 / 2(add9) / 3 — correct, since A, D and E are the 6th, 2nd and 3rd of C — while the capo stayed `{"capo":3,"cut":false}` and the select still read 3. The indicator read "Custom order · key changed" throughout. Reset to Planning Center restored the exact original order, removed the added song, brought back the removed one, cleared the key to A, dropped the indicator and the button, deleted the stored override, and left the capo untouched. Editing the stored basis to simulate a PC change and then cold-loading the page showed the notice with the override fully intact (order, ADDED song, key C); "Keep mine" dismissed it and preserved everything. A full reload preserved reorder, removal, addition, key and indicator. Switching to 2026-09-12 showed no override, no indicator and no Reset button, and switching back restored it. The up/down buttons were driven with touch-only pointer events (`pointerType:'touch'`) and moved a song correctly, measuring 44×44 with no horizontal scroll.

**Caveats.** Nothing was tested on real iPad hardware or in real iOS Safari; touch used synthesised pointer events at iPad viewports in desktop Chrome. The `resize_window` tool moves the OS window without changing the inner viewport in this harness (as recorded in earlier entries), so the landscape check was a screenshot plus measurement at the viewport the harness reports, not a genuinely different device box. The Planning Center change in step 8 was simulated by rewriting the override's stored `basis` rather than by editing the cached set — the live fetch overwrites an edited cache immediately, and `basis` is precisely what the drift comparison reads, so this puts the app in the same state a real PC edit produces. HTML5 drag-and-drop reordering was implemented but only the up/down buttons were exercised by automation; drag is the convenience path and the buttons are the one that has to work.

## 2026-09-05 (later still) — Cut capo voicings match standard fingerings, plus saved custom shapes

**The bug, in one chord.** With the cut capo on, tapping an A in a chart returned `[0,x,0,0,2,0]`. Those pitch classes really are E, A and C#, so the engine was not lying — but the lowest note is E, and a guitarist strumming that hears an E chord with an A in it, not an A. Pushed one step further the ranking returned `[0,0,0,0,0,0]` for Asus2: six open strings, zero fingers, the instrument's own resting ring relabelled as a chord. "Play nothing" is never an answer to "how do I finger this?"

**Root cause.** `cutcapoAdapter.js` re-sorted the engine's results with `openCount` FIRST. Maximising ringing strings is the right instinct for the Studio, where she is exploring the neck, and exactly wrong for a chart, where she needs the fingering. Open strings are free, so the sort walked straight to whichever shape dropped the most fingers, regardless of what ended up in the bass. The engine in `src/cutcapo/` was correct throughout and is byte-identical — verified with `git diff`.

**The colour-tone problem, which is the actual reason this was hard.** The standard cut-capo A is low E 5th fret, A string 4th fret, everything else open — `[5,4,0,0,0,0]`, sounding A C# E A B E. The open B rings a 9th on top, and that ring is the entire reason the capo is on the neck. But `generateVoicings` only offers positions whose pitch class is strictly inside the chord, so a plain "A maj" search can NEVER produce that shape — the B is not an A-major tone. Confirmed directly: the target is absent from the 308-voicing A-maj pool and sits at index 1 of the A-add9 pool. No amount of re-ranking a maj-only pool could have found it. Since `src/cutcapo/` was not to be touched, the adapter widens the pool instead: a chord is ALSO searched as its colour extension (`maj`→`add9`, `min`→`m9`, `7`→`9`, `m7`→`m9`, `maj7`→`maj9`, `sus2`→`add9`), then filtered back to shapes that still contain every tone the chart asked for. An added 9th survives; a shape that lost its third does not. Only the 9th is admitted — a 6th or a b7 would change the chord's quality rather than decorate it.

**Filters first, preferences second.** Three hard filters, because a shape failing any of them is a DIFFERENT chord and not a worse one: the root must be the lowest sounding note (for a slash chord, the specified bass instead); no all-open shape unless the open ring genuinely is that chord; every chord tone present. Then preferences, in order: no muted string trapped between two ringing ones, more strings ringing, fewer fingers, smaller span, lower on the neck, no reach-over an open string, and open-string count LAST as a pure tiebreaker. The open-ring exception is real and is computed, not hardcoded — `nameChord` says the all-open strum is exactly Esus4, so E-sus4 is the one chord allowed to return it.

**Two orderings were tried and rejected on the evidence.** Ranking by fewest fingers alone surfaced `[x,x,x,0,2,0]` for A — a three-string fragment, technically an A triad, musically not a chord anyone plays. Adding "more strings ringing" fixed that but left `[5,4,0,0,0,0]` tied with `[5,0,0,6,0,0]` on every criterion; both are gapless six-string two-finger Aadd9 voicings. Neck position broke the tie the way a hand does. Position was then moved ABOVE reach-over, which is what makes E return the 4th-fret grip instead of a 9th-fret one.

**Her own shapes.** The generator is the fallback, not the authority — she has played this capo for years. A pinned shape shows FIRST, green, labelled MY SHAPE, and the generated one is demoted from "Best shape" to "Suggested". Storage is the existing `src/cutcapo/shapeStore.js`, unmodified: the same records the Studio's Builder writes, carrying one extra `chordKey` field so they can be found by chord rather than only by browsing. Records without it are Studio shapes and are ignored here, so the two features share a drawer without colliding. The key is the RESOLVED root and type, not the chart's spelling, so a shape saved for A is offered for A everywhere and one saved against Bbm7 is found from a chart that writes A#m7 — verified, both produce `A#|m7`. Shapes are scoped to the capo position they were saved at, because the same grip against a different effective nut is a different chord. The editor is the existing `CutCapoDiagram` made tappable rather than a second fretboard, and it names the result with the engine's own `nameChord` so she can confirm an added 9th landed where she intended. Frets behind the cut capo are not offered on the capoed strings — the capo mutes them on a real guitar.

**Verified by actually running it.** `npx vite build` passes. `cutCapoVoicingsFor` was run directly for all six required chords with sounding notes printed: A returns `[5,4,0,0,0,0]` FIRST (the acceptance test), and E, F#m7, Asus4, Asus2 and Dadd9 all return root-in-bass shapes low on the neck. A sweep of all 12 roots × 14 qualities — 168 combinations, 165 playable — found **zero** violations of the invariants: no wrong bass anywhere, no all-open shape, no missing chord tone. Slash chords honour their specified bass (`A/C#`→`[9,7,0,0,0,0]` with C# lowest). In real Chrome as Teacher, House of the Lord (EN, key of A) with the cut capo on: tapping the 1 chord shows A at the 5th fret of the low E, C# at the 4th fret of the A string, the cut capo as a partial barre at fret 2, and the other four strings ringing — zoomed in to confirm the fret numbers rather than eyeballing the dots. Notes read A · C# · E · A · B · E with the line "Open strings add B — the ring a cut capo is for." Editing was exercised on screen: muting the B string renamed the shape live from Aadd9 to A and dropped the B from the note list; restoring it renamed it back; tapping the 5th fret of the high E added an octave A. Saving pinned it as MY SHAPE · AADD9 above the Suggested shape, and after a FULL PAGE RELOAD it was still there and still first — the stored record read back as `{chordKey:"A|maj", capo:0, shape:[5,4,0,0,0,5], name:"Aadd9"}`. Unplayable chords still return the plain honest answer: D#9 and Fm9 report a missing tone, C/D# reports an unreachable bass, none fall back to a wrong shape.

**Student gating rests on two independent guards**, both confirmed in source: a student never reaches `CutCapoPopup` at all, because `cutOn = isTeacher && capo.cut`, and every editing control inside it is separately behind `isTeacher`/`canEdit`. The only unguarded diagrams are read-only — no `interactive` prop.

**Caveats.** The student path was verified by reading the two gates in source, NOT by signing in as a student — student PINs are per-child credentials and were not guessed. Nothing was tested on real iPad hardware or in iOS Safari, and the editor's tap targets were driven with desktop mouse clicks, so the fret cells have not been exercised by a real fingertip on glass. `mMaj7` still reduces to `m7` and 11ths/13ths to 7ths, as before — the colour-extension widening covers the 9th only and does not add chord types the engine has no model for. Saved shapes remain localStorage on one device, unsynced, exactly as `shapeStore` already was. The set fetching, caching and refresh logic in `setStore.js` and around `Songbook.jsx` was not touched — `setStore.js` is byte-identical and every diff hunk in `Songbook.jsx` falls in the imports, the style block, the popup call site, or `CutCapoPopup` itself.

## 2026-09-05 (later still) — Insert a section from another song, with language choice and quick whole-song load

**Why.** Mid-song the team sometimes tags the chorus of a DIFFERENT song onto the end of the one they are playing. That has to be prepared on ONE continuous screen, because nobody switches songs mid-performance. Rarely, someone decides in the moment that the whole tagged song is happening after all, and there has to be one tap that loads it. This is not the existing "add a song to the set" in `overrideStore.js` — that adds a whole song to the running order; this puts a section INSIDE another song.

**One picker, two exits.** Both outcomes start from the same search and the same song choice: pick a song, then either take one of its sections into the current song's block sequence, or hit "Load whole song" and open its full chart. Building these as two flows would have meant two searches and two ways to get the language wrong.

**Language is chosen per inserted section, and this is the part that actually matters.** Many songs here exist as BOTH a Portuguese and an English chart, and those are genuinely different arrangements rather than translations. Verified on screen rather than assumed: "Here as In Heaven" is Gabi Sampaio, 4 sections, 69 bpm in Portuguese, and Elevation Worship, 7 sections, 69.5 bpm in English — the EN chart has an Intro and two Instrumentals the PT one does not have at all. So the picker ASKS which chart a section comes from whenever there is a real choice, and never assumes the host song's language. Mixing is the use case, not an edge case, and it was exercised in both directions: an English chorus inserted into the Portuguese "Casa do Pai", and a Portuguese chorus inserted into the English "House Of The Lord". A song that exists in one language only skips the question entirely and jumps straight to its section list.

**Numbers are counted in the HOST key. This is the whole correctness argument.** An inserted section keeps its own chords but must be numbered against what the band is playing, or a "1" means two different chords on one screen. Concretely, with the EN "Here as In Heaven" (written in G) inserted into "Casa do Pai" (key D): if the block kept its source numbering, `G` would read **1** — but the host song's own **1** is `D`. Numbered in the host key instead, `G` reads **4**, `C` reads **b7**, `Em` reads **2-**, `Bm/D` reads **6-/1**. Hand-checked: G is the 4th of D; C is not diatonic to D (whose 7th is C#) so it is a flat-7; E is the 2nd; B is the 6th. The rendered block matches. `toNashville(token, key)` already accepted any chord against any key, so no transposition code was written — the host key is simply the one passed in, and the block is labelled "written in G" so the origin is never lost.

**An inserted block is a block.** `blockOrder` used to be an array of integer block ids; it now also carries synthetic `"ins:<srcChartId>:<srcBlockId>"` ids, and every consumer — reorder, drag, the roadmap, the pagination measurer, rendering — goes through one `blockOf()` lookup rather than `chart.blocks.find` scattered about. That is why reordering, the roadmap and the page-fit all work on an inserted section without any of that code being touched: there is one notion of "a block in this arrangement", not two. The synthetic id is namespaced so it can never collide with a host id, and it is derived from the source, which makes inserting the same section twice idempotent rather than producing two identical blocks nobody can tell apart when removing one.

**Only a pointer is stored, never a copy.** `songbook_inserts_<chartId>` holds `[{id, srcChartId, srcBlockId}]` — no lyrics, no chords. If a chart is re-imported with corrected chords, every insertion of it corrects with it. The cost is that an insertion whose source no longer exists has to be dropped rather than rendered broken, which `resolveInsert` does, and dropping it also keeps the stale id out of `blockOrder`. Language needs no field of its own: a chart IS either the Portuguese or the English arrangement, so `srcChartId` already records which was chosen and the two can never drift apart.

**Persistence and reset.** Insertions ride alongside the existing block order under the same `songbook_` prefix and are cleared by the same "Reset order" button, so there is one "this chart has been rearranged" fact rather than two that can disagree. `c5Log` and every other existing key are untouched.

**Quick-load decides set navigation from the SET, not from where the tap came from.** A song on today's running order opens as part of it and keeps prev/next and the swipe; one that is not opens standalone, exactly as a song opened from search behaves. The lookup is by entry, matching how `navIndex` is already derived, so a song opened in its other language still lands in the right slot. Verified both ways on screen: loading "A Boa Parte" (not on the set) opened it standalone with NO navigation bar, and loading "Here as In Heaven" (position 3 of 4) from inside a different song opened it at **3 / 4** with PREV → Holy Forever and NEXT → I Lift My Hands.

**Verified by actually running it, all nine steps.** `npx vite build` passes. In real Chrome as Teacher: opened the Portuguese "Casa do Pai" (key D), entered Reorder, and inserted the ENGLISH chorus of "Here as In Heaven" — the picker offered the language choice showing the two arrangements' differing artist, section count and tempo, and the inserted block came in with English lyrics. The block reads `CHORUS · from Here As In Heaven · [EN] · written in G` — source song, language badge and source key, zoomed in to read it rather than eyeballing. The host was unchanged throughout: still Key: D, Portuguese lyrics, its own gloss lines, its own numbers `1 (D)` / `4(add9) (Gadd9)` / `6-7 (Bm7)`. The inserted block's numbers were checked by hand against the host key as above. Moving it up with the ↑ button reordered it past the Bridge, which reflowed below, and the roadmap changed from `V1 C V2 B C` to `V1 C V2 Chorus^EN B C`. A full page reload brought it back in its moved position with everything intact, and localStorage read `order: [0,1,2,"ins:here-as-in-heaven-en:2",3]` with the pointer-only insert record. Reset order removed the block, restored the roadmap, cleared both keys and made its own button disappear. "A Boa Parte" (PT only) skipped the language question and went straight to its sections. Both quick-load cases behaved as described above.

**Caveats.** Nothing was tested on real iPad hardware or in iOS Safari; the picker and the inserted block's controls were driven with desktop mouse clicks and some programmatic DOM clicks, not by a fingertip on glass — the "Load whole song" slab is sized to the 44px+ touch minimum (60px in the picker) but that is a measurement, not a touch test. One apparent failure during verification was my own stale click coordinate landing on the backdrop of a shorter modal, not a defect; re-measuring the element position and clicking it confirmed the single-language path works. Repeat counts (`×2`) are not carried onto an inserted section — it appears once, which is what tagging a chorus onto the end means in practice; if a tagged section ever needs to repeat, that is a follow-up. An inserted section's own gloss lines come along with it, which is deliberate: they belong to the borrowed lyrics, not to the host. The set fetching, caching and refresh logic in `setStore.js` and around the fetch path in `Songbook.jsx` was not touched — `setStore.js` is byte-identical and a diff filtered for `fetchSet` / `readCachedSet` / `setSetData` / `loading` / `disconnected` / `refresh` shows no added or removed line.

## 2026-09-05 (later still) — Use the standard G7th cut capo chord chart instead of generated voicings

**Why the previous approach was wrong in kind, not in degree.** The app derived cut-capo fingerings by searching for voicings whose pitches matched the chord, then ranking them. Even after the ranking was fixed to put the root in the bass and prefer the ring, it produced shapes Nicole did not recognise — A and F#m among them. The reason is that "a valid voicing of A" and "the A every guitarist with this capo plays" are different questions, and no ranking function turns the first into the second. There is one canonical chart, she already knows it, and the app has to use it rather than re-derive it.

**The source, read rather than trusted.** G7th, The Capo Company — "3-string partial capo chord chart for Worship Guitarists", for a 3-string partial capo at the 2nd fret covering A-D-G, which strummed open is Esus4: exactly this app's cut capo. The PDF was fetched and rendered at 400dpi. The chord NAMES extract as reliable text and matched what was expected; the FINGERINGS are images, so they were measured, not read off anyone's transcription. Each of the twelve boxes was located, its own 6-string × 6-fret lattice detected from the grid lines, and every dot, open circle, X and the capo bar mapped to a string and fret by nearest-line. Open circles and X marks were separated by interior fill (a hollow ring measures 0.24 fill, an X 0.47) rather than by eye. That the detected capo bar spans strings 1..3 in all twelve boxes is the check that the string ordering was read correctly.

**Every shape verified against its own name before shipping.** All twelve were run through the engine's own `soundingNoteNames()` and their pitch sets compared against what the chord name requires, bass included. Twelve of twelve match, zero mismatches — for example E5 → E B with no third, Aadd9 → A C# E A B E with A in the bass, F#m11 → F# C# F# A B E, G#m b13 → G# D# G# B B E, Badd11/D# → D# F# B B E. The engine independently names several of them identically (Aadd9, Aadd9/C#, Bsus4, C#m7), which is a second, unprompted confirmation. The note names recorded in `cutcapoChart.js` are documentation; the analysis is the authority, and the popup recomputes rather than trusting them.

**Keyed by the chord it REPLACES.** That is the whole point of the table. A chart asking for A gets Aadd9; F#m and F#m7 both get F#m11; C#m gets C#m7 with the chart's "(no 5th)" version offered as its alternate; G#m gets G#m b13; E gets E5; B gets Bsus4. The chart's own note that E5/G# "often replaces G#m too" is carried as a second mapping. A shape's formal name is registered as a self-lookup as well, so a chart that literally writes "Aadd9" is answered from the chart rather than falling through to generation — but only when the name is unambiguous, so the "(no 5th)" C#m7 cannot displace the primary C#m7. Root spellings are folded to sharps, so a chart writing Db finds the C# entry.

**Order of authority: pinned shape, then chart, then generation.** A shape Nicole has pinned still outranks everything, unchanged. The chart is consulted next and is the first source for any diagram. Only a chord the chart does not carry reaches the old search, and when that happens the popup says so plainly — "Not on the standard chart — best available shape, worked out from the notes" — so an unfamiliar diagram is explained rather than looking authoritative.

**Transposing the lookup, never the shape.** The chart is written for the key of E with the partial capo at the nut. Under a full capo the hand does the same thing relative to the capo, so the SHAPE is identical and only the name of the resulting chord moves. `shapeTokenFor` already computed exactly that transposition for the old code path, and it is reused rather than duplicated: by the time the lookup runs, `shape.label` is already the chord as fingered, so the chart is consulted in its own frame with no further arithmetic.

**The chart's own playing advice is carried.** The F#m11 instruction — "You have to reach over your partial capo, or mute the low E string" — is real and easy to lose in a data structure. It is stored with the shape and shown on that chord's popup, and it is audibly true: that shape frets the low E at fret 2, behind the partial capo's own fret. Where a shape covers more than one chord the popup says which.

**Verified by actually running it, all seven steps.** `npx vite build` passes. All twelve shapes were printed with their computed sounding notes and every one matches its name — zero mismatches, the table is in the session log. In real Chrome as Teacher: with the cut capo on and no full capo, tapping a chord sounding A gives **Aadd9** badged "standard cut capo chart (G7th)", drawn as 5th fret low E, 4th fret A string, the rest ringing — notes A · C# · E · A · B · E. Tapping F#m7 gives **F#m11** with the reach-over-or-mute note shown and "Also the chart's shape for F#m." With full capo 3 and the cut capo on (header "Key: G - Capo 3 (E) + cut capo (fret 5)"), the chord sounding **Am7** resolves to "play F#m7 shape" and draws the chart's **F#m11** above the capo, fret numbers starting at 3, sounding notes A · E · A · C · D · G — correctly transposed up three semitones. Em under the same capo gives the chart's C#m7 with its "(no 5th)" alternate beneath it. Dm7, which is not on the chart, shows the fallback banner and the generated shape with no chart badge. Pinning a shape for Am7 put MY SHAPE above the chart's F#m11, confirming the precedence still holds.

**Caveats.** Nothing was tested on real iPad hardware or in iOS Safari. Several of the app interactions were driven programmatically through the DOM rather than by synthetic clicks, because the popup scrolls and coordinates drift — the rendering was confirmed by screenshot in every case. The chart covers the key of E only, which is what it is for; every other key still falls through to generation, now labelled honestly. `G#m b13` and `E5` are not parseable as ordinary chart tokens, so they have no self-lookup, which is harmless since charts do not write them. `src/cutcapo/` and `src/openvoicings/` are byte-identical — all new code is in `src/songbook/cutcapoChart.js` plus the lookup call in `cutcapoAdapter.js` and the popup labelling in `Songbook.jsx`. The set fetching, caching and refresh logic was not touched: `setStore.js` is byte-identical and a diff of `Songbook.jsx` filtered for `fetchSet` / `readCachedSet` / `setSetData` / `loading` / `disconnected` / `refresh` shows no added or removed line. Unrelated uncommitted edits to `src/tuner/` were present in the working tree and were deliberately left out of this commit so they are not mislabelled under this message.
