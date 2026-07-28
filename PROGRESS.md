# Music Practice App — Change Log

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
