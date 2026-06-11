# Music Practice App — Change Log

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
