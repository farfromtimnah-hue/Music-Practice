# Music Practice App — Change Log

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
