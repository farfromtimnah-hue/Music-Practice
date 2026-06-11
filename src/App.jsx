import { useState, useEffect, useCallback, useRef } from "react";

// ============================================================
// TEACHER PIN
// ============================================================
const TEACHER_PIN = "9999";

// ============================================================
// HARDCODED STUDENTS
// ============================================================
const STUDENTS = {
  Bernardo: { pin: "2847", instrument: "bass" },
  Julia:    { pin: "5913", instrument: "guitar" },
  Samuel:   { pin: "7361", instrument: "keys" },
};

// ============================================================
// ALL 15 KEYS — enharmonics are fully separate entries
// ============================================================
const KEYS = [
{ name:"C",   side:"neither", accidentals:0, accidentalType:null,    accidentalList:[],                                worship:true,
chords:[{num:1,name:"C",quality:"Major"},{num:2,name:"D",quality:"minor"},{num:3,name:"E",quality:"minor"},{num:4,name:"F",quality:"Major"},{num:5,name:"G",quality:"Major"},{num:6,name:"A",quality:"minor"},{num:7,name:"B",quality:"dim"}]},
{ name:"G",   side:"sharp",   accidentals:1, accidentalType:"sharp", accidentalList:["F#"],                            worship:true,
chords:[{num:1,name:"G",quality:"Major"},{num:2,name:"A",quality:"minor"},{num:3,name:"B",quality:"minor"},{num:4,name:"C",quality:"Major"},{num:5,name:"D",quality:"Major"},{num:6,name:"E",quality:"minor"},{num:7,name:"F#",quality:"dim"}]},
{ name:"D",   side:"sharp",   accidentals:2, accidentalType:"sharp", accidentalList:["F#","C#"],                       worship:true,
chords:[{num:1,name:"D",quality:"Major"},{num:2,name:"E",quality:"minor"},{num:3,name:"F#",quality:"minor"},{num:4,name:"G",quality:"Major"},{num:5,name:"A",quality:"Major"},{num:6,name:"B",quality:"minor"},{num:7,name:"C#",quality:"dim"}]},
{ name:"A",   side:"sharp",   accidentals:3, accidentalType:"sharp", accidentalList:["F#","C#","G#"],                  worship:true,
chords:[{num:1,name:"A",quality:"Major"},{num:2,name:"B",quality:"minor"},{num:3,name:"C#",quality:"minor"},{num:4,name:"D",quality:"Major"},{num:5,name:"E",quality:"Major"},{num:6,name:"F#",quality:"minor"},{num:7,name:"G#",quality:"dim"}]},
{ name:"E",   side:"sharp",   accidentals:4, accidentalType:"sharp", accidentalList:["F#","C#","G#","D#"],             worship:true,
chords:[{num:1,name:"E",quality:"Major"},{num:2,name:"F#",quality:"minor"},{num:3,name:"G#",quality:"minor"},{num:4,name:"A",quality:"Major"},{num:5,name:"B",quality:"Major"},{num:6,name:"C#",quality:"minor"},{num:7,name:"D#",quality:"dim"}]},
{ name:"B",   side:"sharp",   accidentals:5, accidentalType:"sharp", accidentalList:["F#","C#","G#","D#","A#"],        worship:true,
chords:[{num:1,name:"B",quality:"Major"},{num:2,name:"C#",quality:"minor"},{num:3,name:"D#",quality:"minor"},{num:4,name:"E",quality:"Major"},{num:5,name:"F#",quality:"Major"},{num:6,name:"G#",quality:"minor"},{num:7,name:"A#",quality:"dim"}]},
{ name:"F#",  side:"sharp",   accidentals:6, accidentalType:"sharp", accidentalList:["F#","C#","G#","D#","A#","E#"],   worship:false,
chords:[{num:1,name:"F#",quality:"Major"},{num:2,name:"G#",quality:"minor"},{num:3,name:"A#",quality:"minor"},{num:4,name:"B",quality:"Major"},{num:5,name:"C#",quality:"Major"},{num:6,name:"D#",quality:"minor"},{num:7,name:"E#",quality:"dim"}]},
{ name:"C#",  side:"sharp",   accidentals:7, accidentalType:"sharp", accidentalList:["F#","C#","G#","D#","A#","E#","B#"], worship:false,
chords:[{num:1,name:"C#",quality:"Major"},{num:2,name:"D#",quality:"minor"},{num:3,name:"E#",quality:"minor"},{num:4,name:"F#",quality:"Major"},{num:5,name:"G#",quality:"Major"},{num:6,name:"A#",quality:"minor"},{num:7,name:"B#",quality:"dim"}]},
{ name:"Cb",  side:"flat",    accidentals:7, accidentalType:"flat",  accidentalList:["Bb","Eb","Ab","Db","Gb","Cb","Fb"], worship:false,
chords:[{num:1,name:"Cb",quality:"Major"},{num:2,name:"Db",quality:"minor"},{num:3,name:"Eb",quality:"minor"},{num:4,name:"Fb",quality:"Major"},{num:5,name:"Gb",quality:"Major"},{num:6,name:"Ab",quality:"minor"},{num:7,name:"Bb",quality:"dim"}]},
{ name:"Gb",  side:"flat",    accidentals:6, accidentalType:"flat",  accidentalList:["Bb","Eb","Ab","Db","Gb","Cb"],   worship:false,
chords:[{num:1,name:"Gb",quality:"Major"},{num:2,name:"Ab",quality:"minor"},{num:3,name:"Bb",quality:"minor"},{num:4,name:"Cb",quality:"Major"},{num:5,name:"Db",quality:"Major"},{num:6,name:"Eb",quality:"minor"},{num:7,name:"F",quality:"dim"}]},
{ name:"Db",  side:"flat",    accidentals:5, accidentalType:"flat",  accidentalList:["Bb","Eb","Ab","Db","Gb"],        worship:false,
chords:[{num:1,name:"Db",quality:"Major"},{num:2,name:"Eb",quality:"minor"},{num:3,name:"F",quality:"minor"},{num:4,name:"Gb",quality:"Major"},{num:5,name:"Ab",quality:"Major"},{num:6,name:"Bb",quality:"minor"},{num:7,name:"C",quality:"dim"}]},
{ name:"Ab",  side:"flat",    accidentals:4, accidentalType:"flat",  accidentalList:["Bb","Eb","Ab","Db"],             worship:false,
chords:[{num:1,name:"Ab",quality:"Major"},{num:2,name:"Bb",quality:"minor"},{num:3,name:"C",quality:"minor"},{num:4,name:"Db",quality:"Major"},{num:5,name:"Eb",quality:"Major"},{num:6,name:"F",quality:"minor"},{num:7,name:"G",quality:"dim"}]},
{ name:"Eb",  side:"flat",    accidentals:3, accidentalType:"flat",  accidentalList:["Bb","Eb","Ab"],                  worship:false,
chords:[{num:1,name:"Eb",quality:"Major"},{num:2,name:"F",quality:"minor"},{num:3,name:"G",quality:"minor"},{num:4,name:"Ab",quality:"Major"},{num:5,name:"Bb",quality:"Major"},{num:6,name:"C",quality:"minor"},{num:7,name:"D",quality:"dim"}]},
{ name:"Bb",  side:"flat",    accidentals:2, accidentalType:"flat",  accidentalList:["Bb","Eb"],                       worship:false,
chords:[{num:1,name:"Bb",quality:"Major"},{num:2,name:"C",quality:"minor"},{num:3,name:"D",quality:"minor"},{num:4,name:"Eb",quality:"Major"},{num:5,name:"F",quality:"Major"},{num:6,name:"G",quality:"minor"},{num:7,name:"A",quality:"dim"}]},
{ name:"F",   side:"flat",    accidentals:1, accidentalType:"flat",  accidentalList:["Bb"],                            worship:true,
chords:[{num:1,name:"F",quality:"Major"},{num:2,name:"G",quality:"minor"},{num:3,name:"A",quality:"minor"},{num:4,name:"Bb",quality:"Major"},{num:5,name:"C",quality:"Major"},{num:6,name:"D",quality:"minor"},{num:7,name:"E",quality:"dim"}]},
];

// 15-position circle order (clockwise) — sharps expand right, flats expand left, enharmonics sit at the bottom
const CIRCLE_ORDER = ["C","G","D","A","E","B","F#","C#","Cb","Gb","Db","Ab","Eb","Bb","F"];
const WORSHIP_KEYS = ["C","G","D","A","E","B","F"];


// ============================================================
// LEARNING STYLE QUIZ — 4 questions, replace with your own
// ============================================================
const LEARNING_STYLE_QUIZ = [
  { q: "When you try to remember a new chord, you...", options: [
    { text: "Picture where it sits on the circle", style: "visual" },
    { text: "Play it on your instrument", style: "kinesthetic" },
    { text: "Say the chord name out loud", style: "auditory" },
  ]},
  { q: "What helps you learn a new song fastest?", options: [
    { text: "Reading a chord chart", style: "visual" },
    { text: "Playing along with the recording", style: "kinesthetic" },
    { text: "Listening and picking it out by ear", style: "auditory" },
  ]},
  { q: "You'd describe music theory as...", options: [
    { text: "Patterns and diagrams to study", style: "visual" },
    { text: "Something to experiment with on your instrument", style: "kinesthetic" },
    { text: "Ideas that make sense when explained aloud", style: "auditory" },
  ]},
  { q: "When you mess up a chord, you...", options: [
    { text: "Trace back through the chart to find the mistake", style: "visual" },
    { text: "Replay it with your hands until it feels right", style: "kinesthetic" },
    { text: "Hum the right chord to hear what's off", style: "auditory" },
  ]},
];

// ============================================================
// HELPERS
// ============================================================
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

function pickWeightedKey(excludeName) {
const worship = KEYS.filter(k => k.worship && k.name !== excludeName);
const other   = KEYS.filter(k => !k.worship && k.name !== excludeName);
const pool = Math.random() < 0.7 ? worship : other;
return pool[Math.floor(Math.random() * pool.length)];
}

function arraysEqual(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function buildKeyRound(keyData) {
const steps = [];
const accWord = keyData.accidentalType === "sharp" ? "sharps" : keyData.accidentalType === "flat" ? "flats" : "sharps or flats";

const sideCorrect = keyData.side === "sharp" ? "Sharp side ♯" : keyData.side === "flat" ? "Flat side ♭" : "Neither — no sharps or flats";
steps.push({ type:"side", question:"Which side of the circle is it on?", options:shuffle(["Sharp side ♯","Flat side ♭","Neither — no sharps or flats"]), correct:sideCorrect });

const countCorrect = String(keyData.accidentals);
const wrongCounts = shuffle([0,1,2,3,4,5,6,7].filter(n=>n!==keyData.accidentals)).slice(0,3).map(String);
steps.push({ type:"count", question:`How many ${accWord} does it have?`, options:shuffle([countCorrect,...wrongCounts]), correct:countCorrect });

// UPGRADED: multi-select by full accidental name (e.g. F# / Bb), buttons match the key's accidental type
const isNone = keyData.accidentals === 0;
const accType = keyData.accidentalType; // "sharp", "flat", or null
const whichOptions = accType === "sharp"
  ? ["A#","B#","C#","D#","E#","F#","G#"]
  : accType === "flat"
  ? ["Ab","Bb","Cb","Db","Eb","Fb","Gb"]
  : ["A","B","C","D","E","F","G"];
// correct is the actual accidentalList (already full names: "F#", "Bb", etc.)
const whichCorrect = keyData.accidentalList.slice(); // e.g. ["F#","C#"] or ["Bb","Eb"]
const whichQ = isNone
  ? "This key has no sharps or flats — tap Check Answer to confirm"
  : `Which notes are ${accType} in the key of ${keyData.name}?`;
steps.push({ type:"whichSelect", question:whichQ, options:whichOptions, correct:whichCorrect, isNone });

// NEW: multi-select chord quality theory question
steps.push({
  type:"majorSelect",
  question:"Which chord numbers are MAJOR in a major key?",
  options:["1","2","3","4","5","6","7"],
  correct:["1","4","5"],
  isNone:false,
});

shuffle([1,2,3,4,5,6,7]).forEach(num => {
const chord = keyData.chords.find(c=>c.num===num);
const correct = `${chord.name} ${chord.quality}`;
const wrongs = shuffle(KEYS.filter(k=>k.name!==keyData.name)).slice(0,3).map(k=>{const c=k.chords.find(c2=>c2.num===num);return `${c.name} ${c.quality}`;});
const ordinal = num===1?"1st":num===2?"2nd":num===3?"3rd":`${num}th`;
steps.push({ type:"chord", question:`What is the ${ordinal} chord?`, options:shuffle([correct,...wrongs]), correct, chordNum:num });
});
return steps;
}

// ============================================================
// PORTUGUESE NOTE NAMES
// ============================================================
const NOTE_NAMES = [
  { en:"C", pt:"Dó"  },
  { en:"D", pt:"Ré"  },
  { en:"E", pt:"Mi"  },
  { en:"F", pt:"Fá"  },
  { en:"G", pt:"Sol" },
  { en:"A", pt:"Lá"  },
  { en:"B", pt:"Si"  },
];

function buildPortugueseRound(mode) {
  return shuffle(NOTE_NAMES).map(note => {
    if (mode === "en-pt") {
      const correct = note.pt;
      const wrongs = shuffle(NOTE_NAMES.filter(n=>n.en!==note.en)).slice(0,3).map(n=>n.pt);
      return { question:`What is ${note.en} called in Portuguese?`, options:shuffle([correct,...wrongs]), correct };
    } else {
      const correct = note.en;
      const wrongs = shuffle(NOTE_NAMES.filter(n=>n.en!==note.en)).slice(0,3).map(n=>n.en);
      return { question:`What English note is called ${note.pt}?`, options:shuffle([correct,...wrongs]), correct };
    }
  });
}

// ============================================================
// GUITAR CHORD LIBRARY (Julia)
// ============================================================
const GUITAR_CHORDS = [
  { name:"E",        frets:[ 0, 2, 2, 1, 0, 0], fingers:[0,2,3,1,0,0], barre:false },
  { name:"Em",       frets:[ 0, 2, 2, 0, 0, 0], fingers:[0,2,3,0,0,0], barre:false },
  { name:"E7",       frets:[ 0, 2, 0, 1, 0, 0], fingers:[0,2,0,1,0,0], barre:false },
  { name:"A",        frets:[-1, 0, 2, 2, 2, 0], fingers:[0,0,1,2,3,0], barre:false },
  { name:"Am",       frets:[-1, 0, 2, 2, 1, 0], fingers:[0,0,2,3,1,0], barre:false },
  { name:"A7",       frets:[-1, 0, 2, 0, 2, 0], fingers:[0,0,2,0,3,0], barre:false },
  { name:"D",        frets:[-1,-1, 0, 2, 3, 2], fingers:[0,0,0,1,3,2], barre:false },
  { name:"Dm",       frets:[-1,-1, 0, 2, 3, 1], fingers:[0,0,0,2,3,1], barre:false },
  { name:"D7",       frets:[-1,-1, 0, 2, 1, 2], fingers:[0,0,0,2,1,3], barre:false },
  { name:"G",        frets:[ 3, 2, 0, 0, 0, 3], fingers:[2,1,0,0,0,3], barre:false },
  { name:"G7",       frets:[ 3, 2, 0, 0, 0, 1], fingers:[3,2,0,0,0,1], barre:false },
  { name:"C",        frets:[-1, 3, 2, 0, 1, 0], fingers:[0,3,2,0,1,0], barre:false },
  { name:"Cmaj7",    frets:[-1, 3, 2, 0, 0, 0], fingers:[0,3,2,0,0,0], barre:false },
  { name:"Dsus2",    frets:[-1,-1, 0, 2, 3, 0], fingers:[0,0,0,1,2,0], barre:false },
  { name:"Dsus4",    frets:[-1,-1, 0, 2, 3, 3], fingers:[0,0,0,1,2,3], barre:false },
  { name:"Asus2",    frets:[-1, 0, 2, 2, 0, 0], fingers:[0,0,1,2,0,0], barre:false },
  { name:"Asus4",    frets:[-1, 0, 2, 2, 3, 0], fingers:[0,0,1,2,3,0], barre:false },
  { name:"Cadd9",    frets:[-1, 3, 2, 0, 3, 0], fingers:[0,3,2,0,4,0], barre:false },
  { name:"G/B",      frets:[-1, 2, 0, 0, 0, 3], fingers:[0,1,0,0,0,3], barre:false },
  { name:"F",        frets:[ 1, 1, 2, 3, 3, 1], fingers:[1,1,2,3,4,1], barre:true  },
  { name:"F (easy)", frets:[-1,-1, 3, 2, 1, 1], fingers:[0,0,3,2,1,1], barre:true  },
  { name:"B",        frets:[-1, 2, 4, 4, 4, 2], fingers:[0,1,2,3,4,1], barre:true  },
  { name:"Bm",       frets:[-1, 2, 4, 4, 3, 2], fingers:[0,1,3,4,2,1], barre:true  },
  { name:"F#m",      frets:[ 2, 2, 4, 4, 4, 2], fingers:[1,1,2,3,4,1], barre:true  },
  { name:"G#m",      frets:[ 4, 4, 6, 6, 6, 4], fingers:[1,1,2,3,4,1], barre:true  },
];

function logActivity(name, activity) {
try {
const existing = JSON.parse(localStorage.getItem("c5Log")||"[]");
existing.push({student:name, timestamp:new Date().toISOString(), ...activity});
localStorage.setItem("c5Log", JSON.stringify(existing));
} catch(e){}
}

// ============================================================
// STYLES
// ============================================================
const S = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=Source+Sans+3:wght@300;400;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
--bg:#0a0a0f;--surface:#13131f;--surface2:#1c1c2e;--border:#2a2a40;
--gold:#f0c040;--sharp:#4fc3f7;--flat:#ef9a9a;--green:#81c784;
--major:#f0c040;--minor:#7986cb;--dim:#ef5350;
--text:#e8e8f0;--muted:#8888aa;--radius:16px;--teacher:#c084fc;
}
body{font-family:'Source Sans 3',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;overscroll-behavior:none;}
.shell{max-width:480px;margin:0 auto;min-height:100vh;display:flex;flex-direction:column;}

/* NAME SELECT */
.name-screen{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;padding:24px;}
.name-list{display:flex;flex-direction:column;gap:10px;width:100%;max-width:320px;}
.name-btn{padding:18px 20px;border-radius:var(--radius);border:1.5px solid var(--border);background:var(--surface);color:var(--text);font-family:'Oswald',sans-serif;font-size:20px;font-weight:600;letter-spacing:2px;cursor:pointer;text-align:center;transition:all .15s;}
.name-btn:active{border-color:var(--gold);background:var(--surface2);color:var(--gold);}
.name-divider{width:100%;max-width:320px;display:flex;align-items:center;gap:10px;}
.name-divider-line{flex:1;height:1px;background:var(--border);}
.name-divider-text{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);}

/* PIN */
.pin-screen{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;padding:24px;}
.pin-logo{font-family:'Oswald',sans-serif;font-size:48px;font-weight:700;letter-spacing:4px;color:var(--gold);text-align:center;}
.pin-sub{font-size:13px;color:var(--muted);letter-spacing:3px;text-transform:uppercase;text-align:center;margin-top:6px;}
.pin-name{font-family:'Oswald',sans-serif;font-size:22px;font-weight:600;letter-spacing:3px;text-align:center;}
.pin-dots{display:flex;gap:14px;}
.dot{width:16px;height:16px;border-radius:50%;border:2px solid var(--border);background:transparent;transition:all .2s;}
.dot.filled{background:var(--gold);border-color:var(--gold);}
.dot.error{background:var(--dim);border-color:var(--dim);animation:shake .3s;}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.pin-pad{display:grid;grid-template-columns:repeat(3,72px);gap:12px;}
.pin-btn{width:72px;height:72px;border-radius:50%;border:1.5px solid var(--border);background:var(--surface);color:var(--text);font-family:'Oswald',sans-serif;font-size:24px;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;}
.pin-btn:active{background:var(--gold);color:var(--bg);transform:scale(.93);}
.pin-error{color:var(--dim);font-size:13px;text-align:center;min-height:18px;}

/* SHARED */
.center-screen{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 24px;gap:20px;}
.screen-title{font-family:'Oswald',sans-serif;font-size:26px;font-weight:600;color:var(--gold);letter-spacing:2px;text-align:center;}
.screen-sub{font-size:14px;color:var(--muted);text-align:center;max-width:280px;line-height:1.5;}
.vlist{display:flex;flex-direction:column;gap:10px;width:100%;max-width:320px;}
.card-btn{padding:15px 18px;border-radius:var(--radius);border:1.5px solid var(--border);background:var(--surface);color:var(--text);font-size:16px;font-weight:600;cursor:pointer;text-align:left;transition:all .15s;font-family:'Source Sans 3',sans-serif;display:flex;flex-direction:column;gap:3px;}
.card-btn:active{border-color:var(--gold);background:var(--surface2);}
.card-btn-sub{font-size:12px;font-weight:400;color:var(--muted);}
.card-btn.muted{border-style:dashed;color:var(--muted);}
.primary-btn{padding:15px;border-radius:var(--radius);border:none;background:var(--gold);color:var(--bg);font-family:'Oswald',sans-serif;font-size:17px;font-weight:700;letter-spacing:2px;cursor:pointer;width:100%;transition:all .15s;}
.primary-btn:active{opacity:.85;transform:scale(.98);}
.ghost-btn{padding:13px;border-radius:var(--radius);border:1.5px solid var(--border);background:var(--surface);color:var(--muted);font-family:'Oswald',sans-serif;font-size:14px;font-weight:600;letter-spacing:1px;cursor:pointer;width:100%;transition:all .15s;}
.ghost-btn:active{border-color:var(--gold);color:var(--gold);}
.teacher-btn{padding:13px;border-radius:var(--radius);border:1.5px solid var(--teacher);background:rgba(192,132,252,.08);color:var(--teacher);font-family:'Oswald',sans-serif;font-size:14px;font-weight:600;letter-spacing:1px;cursor:pointer;width:100%;transition:all .15s;}
.teacher-btn:active{background:rgba(192,132,252,.2);}
.sec-lbl{font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--muted);}

/* QUIZ */
.quiz-screen{min-height:100vh;display:flex;flex-direction:column;padding:40px 24px 32px;gap:24px;}
.prog-bar{display:flex;gap:8px;}
.pip{height:4px;flex:1;border-radius:2px;background:var(--border);transition:background .3s;}
.pip.on{background:var(--gold);}
.big-q{font-family:'Oswald',sans-serif;font-size:22px;line-height:1.3;color:var(--text);}

/* HOME */
.home-screen{display:flex;flex-direction:column;padding:16px 16px 90px;gap:14px;min-height:100vh;}
.top-bar{display:flex;align-items:center;justify-content:space-between;padding:6px 0;}
.top-name{font-family:'Oswald',sans-serif;font-size:14px;letter-spacing:2px;color:var(--muted);text-transform:uppercase;}
.top-logo{font-family:'Oswald',sans-serif;font-size:20px;font-weight:700;color:var(--gold);letter-spacing:3px;}
.circle-wrap{position:relative;width:100%;aspect-ratio:1;max-width:380px;margin:0 auto;}
.circle-svg{width:100%;height:100%;}
.legend{display:flex;justify-content:center;gap:14px;flex-wrap:wrap;}
.leg{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--muted);}
.leg-dot{width:9px;height:9px;border-radius:50%;}

/* TEACHER */
.teacher-badge{background:rgba(192,132,252,.12);border:1.5px solid var(--teacher);border-radius:8px;padding:6px 14px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--teacher);text-align:center;}
.locked-display{background:rgba(192,132,252,.08);border:1.5px solid var(--teacher);border-radius:var(--radius);padding:14px;text-align:center;}
.locked-name{font-family:'Oswald',sans-serif;font-size:44px;font-weight:700;color:var(--teacher);line-height:1;}

/* SETTINGS */
.settings-screen{display:flex;flex-direction:column;padding:20px 20px 100px;gap:14px;min-height:100vh;}
.student-row-ro{display:flex;align-items:center;gap:8px;background:var(--surface);border:1.5px solid var(--border);border-radius:var(--radius);padding:11px 13px;}
.ro-name{flex:1;font-size:15px;font-weight:600;color:var(--text);}
.ro-pin{width:66px;background:var(--surface2);border:1.5px solid var(--border);border-radius:8px;color:var(--muted);font-size:14px;font-family:'Oswald',sans-serif;padding:5px 7px;text-align:center;}
.ro-inst{font-size:12px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;min-width:48px;text-align:right;}

/* LOOKUP */
.lookup-screen{display:flex;flex-direction:column;padding:20px 20px 90px;gap:16px;min-height:100vh;}
.key-picker{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;}
.key-pick-btn{padding:12px 4px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface);color:var(--text);font-family:'Oswald',sans-serif;font-size:14px;font-weight:700;cursor:pointer;text-align:center;transition:all .15s;}
.key-pick-btn:active{transform:scale(.94);}
.key-pick-btn.sharp-key{border-color:rgba(79,195,247,.4);color:var(--sharp);}
.key-pick-btn.flat-key{border-color:rgba(239,154,154,.4);color:var(--flat);}
.key-pick-btn.neither-key{border-color:rgba(165,214,167,.4);color:var(--green);}
.key-pick-btn.selected{border-width:2px;background:var(--surface2);}
.key-pick-btn.selected.sharp-key{border-color:var(--sharp);}
.key-pick-btn.selected.flat-key{border-color:var(--flat);}
.key-pick-btn.selected.neither-key{border-color:var(--green);}

/* CHORD REFERENCE CARD — large, readable */
.chord-ref-card{background:var(--surface);border:1.5px solid var(--border);border-radius:var(--radius);padding:16px;display:flex;flex-direction:column;gap:10px;}
.chord-ref-key{font-family:'Oswald',sans-serif;font-size:36px;font-weight:700;color:var(--gold);}
.chord-ref-sig{font-size:13px;color:var(--muted);margin-top:-4px;}
.chord-ref-grid{display:flex;flex-direction:column;gap:7px;}
.chord-ref-row{display:flex;align-items:center;gap:0;border-radius:10px;overflow:hidden;border:1.5px solid var(--border);}
.chord-ref-num{width:44px;min-width:44px;padding:12px 0;text-align:center;font-family:'Oswald',sans-serif;font-size:20px;font-weight:700;}
.chord-ref-num.Major{background:rgba(240,192,64,.12);color:var(--major);}
.chord-ref-num.minor{background:rgba(121,134,203,.12);color:var(--minor);}
.chord-ref-num.dim{background:rgba(239,83,80,.12);color:var(--dim);}
.chord-ref-name{flex:1;padding:12px 14px;font-size:18px;font-weight:700;color:var(--text);}
.chord-ref-quality{padding:12px 14px;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--muted);}
.chord-ref-row.worship-1{border-color:var(--gold);}
.chord-ref-row.worship-4{border-color:var(--sharp);}
.chord-ref-row.worship-5{border-color:var(--green);}
.worship-tag{font-size:10px;letter-spacing:1px;color:var(--gold);padding:12px 10px;font-weight:700;}

/* GAME */
.game-screen{display:flex;flex-direction:column;padding:18px 18px 90px;gap:12px;min-height:100vh;}
.g-header{display:flex;align-items:center;justify-content:space-between;}
.key-hero{font-family:'Oswald',sans-serif;font-size:52px;font-weight:700;color:var(--gold);line-height:1;text-align:center;}
.key-hero.t{color:var(--teacher);}
.key-sub{font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--muted);text-align:center;}
.step-prog{display:flex;gap:3px;}
.sp{height:6px;flex:1;border-radius:3px;background:var(--border);}
.sp.ok{background:var(--green);}
.sp.no{background:var(--dim);}
.sp.cur{background:var(--gold);}
.q-card{background:var(--surface);border:1.5px solid var(--border);border-radius:var(--radius);padding:16px;}
.q-lbl{font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--muted);margin-bottom:5px;}
.q-text{font-family:'Oswald',sans-serif;font-size:20px;color:var(--text);}
.ans-list{display:flex;flex-direction:column;gap:8px;}
.ans{padding:14px 16px;border-radius:12px;border:1.5px solid var(--border);background:var(--surface);color:var(--text);font-size:15px;font-weight:600;cursor:pointer;text-align:left;transition:all .15s;font-family:'Source Sans 3',sans-serif;}
.ans:active{transform:scale(.97);}
.ans.reveal{border-color:var(--green);background:rgba(129,199,132,.15);color:var(--green);}
.ans.wrong{border-color:var(--dim);background:rgba(239,83,80,.15);color:var(--dim);}
.ans:disabled{cursor:default;}
.feedback{text-align:center;font-size:16px;font-weight:700;min-height:22px;}
.feedback.ok{color:var(--green);}
.feedback.no{color:var(--dim);}

/* MULTI-SELECT */
.multi-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;}
.multi-btn{padding:14px 2px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface);color:var(--text);font-family:'Oswald',sans-serif;font-size:18px;font-weight:700;cursor:pointer;text-align:center;transition:all .15s;}
.multi-btn:active{transform:scale(.93);}
.multi-btn.multi-selected{border-color:var(--gold);background:rgba(240,192,64,.18);color:var(--gold);}
.multi-btn.multi-right{border-color:var(--green);background:rgba(129,199,132,.18);color:var(--green);}
.multi-btn.multi-wrong{border-color:var(--dim);background:rgba(239,83,80,.18);color:var(--dim);}
.multi-btn.multi-missed{border-color:var(--green);background:rgba(129,199,132,.07);color:var(--green);opacity:.6;}
.multi-btn.multi-disabled{opacity:.3;cursor:default;}
.multi-btn:disabled{cursor:default;}
.multi-hint{font-size:12px;color:var(--muted);text-align:center;line-height:1.5;}

/* VISUAL REINFORCEMENT PANEL */
.reinforce{background:var(--surface2);border:1.5px solid var(--border);border-radius:var(--radius);padding:14px;display:flex;flex-direction:column;gap:10px;}
.reinforce-title{font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--muted);}

/* Mini circle for reinforcement */
.mini-circle-wrap{width:100%;aspect-ratio:1;max-width:240px;margin:0 auto;}

/* Chord grid in reinforcement — bigger, more readable */
.chord-reinforce-grid{display:flex;flex-direction:column;gap:6px;}
.cri-row{display:flex;align-items:stretch;border-radius:10px;overflow:hidden;border:1.5px solid var(--border);}
.cri-row.w1{border-color:var(--gold);}
.cri-row.w4{border-color:var(--sharp);}
.cri-row.w5{border-color:var(--green);}
.cri-row.hl{border-width:2.5px;border-color:var(--gold);background:rgba(240,192,64,.06);}
.cri-num{width:38px;min-width:38px;display:flex;align-items:center;justify-content:center;font-family:'Oswald',sans-serif;font-size:18px;font-weight:700;}
.cri-num.Major{background:rgba(240,192,64,.15);color:var(--major);}
.cri-num.minor{background:rgba(121,134,203,.15);color:var(--minor);}
.cri-num.dim{background:rgba(239,83,80,.15);color:var(--dim);}
.cri-name{flex:1;padding:10px 12px;font-size:17px;font-weight:700;color:var(--text);}
.cri-q{padding:10px 12px;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--muted);display:flex;align-items:center;}

/* accidental list */
.acc-list{display:flex;flex-wrap:wrap;gap:8px;}
.acc-chip{padding:7px 14px;border-radius:20px;font-family:'Oswald',sans-serif;font-size:16px;font-weight:700;}
.acc-chip.sharp{background:rgba(79,195,247,.15);color:var(--sharp);border:1.5px solid rgba(79,195,247,.4);}
.acc-chip.flat{background:rgba(239,154,154,.15);color:var(--flat);border:1.5px solid rgba(239,154,154,.4);}

/* RESULTS */
.results-screen{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 24px;gap:16px;text-align:center;}
.r-score{font-family:'Oswald',sans-serif;font-size:80px;font-weight:700;color:var(--gold);line-height:1;}

/* NAV */
.nav-bar{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:480px;background:var(--surface);border-top:1px solid var(--border);display:flex;padding:8px 0 14px;z-index:100;}
.nav-tab{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;background:none;border:none;color:var(--muted);font-size:9px;letter-spacing:1px;text-transform:uppercase;cursor:pointer;padding:5px 0;font-family:'Source Sans 3',sans-serif;transition:color .15s;}
.nav-tab.active{color:var(--gold);}
.nav-tab.t.active{color:var(--teacher);}
.nav-tab svg{width:20px;height:20px;}

.timeout-screen{position:fixed;inset:0;background:#000;z-index:9999;}
input{color:var(--text);}

/* CHORD DIAGRAM TRAINER */
.cd-screen{display:flex;flex-direction:column;padding:18px 18px 32px;gap:12px;min-height:100vh;}
.cd-chord-name{font-family:'Oswald',sans-serif;font-size:36px;font-weight:700;color:var(--gold);text-align:center;letter-spacing:2px;}
.cd-sub{font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--muted);text-align:center;}
.cd-grid{display:grid;grid-template-columns:22px repeat(6,1fr);gap:4px;}
.cd-hdr{font-family:'Oswald',sans-serif;font-size:13px;font-weight:600;color:var(--muted);text-align:center;display:flex;align-items:center;justify-content:center;height:26px;}
.cd-fret-lbl{font-family:'Oswald',sans-serif;font-size:11px;color:var(--border);display:flex;align-items:center;justify-content:center;height:40px;}
.cd-cell{height:40px;border-radius:8px;border:1.5px solid var(--border);background:var(--surface2);cursor:pointer;transition:all .12s;-webkit-tap-highlight-color:transparent;}
.cd-cell:active{transform:scale(.9);}
.cd-cell.tapped{border-color:var(--gold);background:rgba(240,192,64,.22);}
.cd-cell.hit{border-color:var(--green);background:rgba(129,199,132,.22);cursor:default;}
.cd-cell.miss{border-color:var(--dim);background:rgba(239,83,80,.22);cursor:default;}
.cd-cell.need{border-color:var(--green);background:rgba(129,199,132,.07);cursor:default;opacity:.7;}
.cd-cell:disabled{cursor:default;transform:none;}
.cd-diagram-wrap{display:flex;justify-content:center;padding:6px 0;}
.cd-fretboard-wrap{display:flex;justify-content:center;padding:6px 0;}
.cd-btn-row{display:flex;gap:8px;}
.cd-btn-row .ghost-btn,.cd-btn-row .primary-btn{flex:1;padding:12px 6px;font-size:13px;}
.cd-results{display:flex;flex-direction:column;padding:24px 20px 40px;gap:14px;min-height:100vh;}
.cd-section{background:var(--surface);border:1.5px solid var(--border);border-radius:var(--radius);padding:14px;display:flex;flex-direction:column;gap:10px;}
.cd-section-lbl{font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--muted);}
.cd-chips{display:flex;flex-wrap:wrap;gap:6px;}
.cd-chip{padding:5px 12px;border-radius:20px;font-family:'Oswald',sans-serif;font-size:14px;font-weight:700;}
.cd-chip.ok{background:rgba(129,199,132,.15);color:var(--green);border:1.5px solid rgba(129,199,132,.4);}
.cd-chip.no{background:rgba(239,83,80,.15);color:var(--dim);border:1.5px solid rgba(239,83,80,.4);}
.cd-chip.notyet{background:rgba(240,192,64,.12);color:var(--gold);border:1.5px solid rgba(240,192,64,.3);}
.cd-chip.skip{background:var(--surface2);color:var(--muted);border:1.5px solid var(--border);}
`;


// ============================================================
// 15-KEY CIRCLE SVG
// ============================================================
function CircleSVG({ activeKey, onTap, teacherMode, mini }) {
const cx=160, cy=160, R=mini?148:140, rInner=mini?68:72;
const n=CIRCLE_ORDER.length; // 15
const activeColor = teacherMode ? "#c084fc" : "#f0c040";

return (
<svg viewBox="0 0 320 320" className="circle-svg">
{CIRCLE_ORDER.map((k,i) => {
const a1 = (i/n)*2*Math.PI - Math.PI/2;
const a2 = ((i+1)/n)*2*Math.PI - Math.PI/2;
const r1=rInner+3, r2=R;
const path=`M ${cx+r1*Math.cos(a1)} ${cy+r1*Math.sin(a1)} L ${cx+r2*Math.cos(a1)} ${cy+r2*Math.sin(a1)} A ${r2} ${r2} 0 0 1 ${cx+r2*Math.cos(a2)} ${cy+r2*Math.sin(a2)} L ${cx+r1*Math.cos(a2)} ${cy+r1*Math.sin(a2)} A ${r1} ${r1} 0 0 0 ${cx+r1*Math.cos(a1)} ${cy+r1*Math.sin(a1)} Z`;
const kd=KEYS.find(x=>x.name===k);
const isActive=activeKey===k;
const am=(a1+a2)/2;
const lr=(r1+r2)/2;
const lx=cx+lr*Math.cos(am), ly=cy+lr*Math.sin(am);
let isNeighbor=false;
if (activeKey && !teacherMode) {
const si=CIRCLE_ORDER.indexOf(activeKey);
if (i===(si-1+15)%15||i===(si+1)%15) isNeighbor=true;
}
let fill="#1c1c2e", stroke="#2a2a40";
if (kd?.side==="sharp") fill=isActive?"rgba(79,195,247,.35)":"rgba(79,195,247,.07)";
if (kd?.side==="flat")  fill=isActive?"rgba(239,154,154,.35)":"rgba(239,154,154,.07)";
if (kd?.side==="neither") fill=isActive?"rgba(165,214,167,.35)":"rgba(165,214,167,.07)";
if (isActive) stroke=activeColor;
if (isNeighbor) stroke="#81c784";
const fs = k.length>2?"8":k.length>1?"10":"12";
return (
<g key={k} onClick={()=>onTap&&onTap(k)} style={{cursor:onTap?"pointer":"default"}}>
<path d={path} fill={fill} stroke={stroke} strokeWidth={isActive?2.5:1}/>
<text x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
fontSize={fs} fontWeight="700" fontFamily="Oswald,sans-serif"
fill={isActive?activeColor:isNeighbor?"#81c784":"#e8e8f0"}>
{k}
</text>
</g>
);
})}
<circle cx={cx} cy={cy} r={rInner-1} fill="#13131f" stroke="#2a2a40" strokeWidth="1"/>
{!mini && <>
<text x={cx} y={cy-8} textAnchor="middle" fontSize="9" fill="#8888aa" fontFamily="Oswald" letterSpacing="2">CIRCLE OF</text>
<text x={cx} y={cy+8} textAnchor="middle" fontSize="9" fill="#8888aa" fontFamily="Oswald" letterSpacing="2">FIFTHS</text>
</>}
</svg>
);
}

// ============================================================
// CHORD REFERENCE — large readable card
// ============================================================
function ChordRefCard({ keyData, highlightNum }) {
if (!keyData) return null;
const accWord = keyData.accidentalType==="sharp"?"sharp":(keyData.accidentalType==="flat"?"flat":null);
const sig = keyData.accidentals===0 ? "No sharps or flats" : `${keyData.accidentals} ${accWord}${keyData.accidentals>1?"s":""}: ${keyData.accidentalList.join(", ")}`;
return (
<div className="chord-ref-card">
<div>
<div className="chord-ref-key">{keyData.name} Major</div>
<div className="chord-ref-sig">{sig}</div>
</div>
<div className="chord-ref-grid">
{keyData.chords.map(c => {
let wCls = "";
if (c.num===1) wCls="worship-1"; else if (c.num===4) wCls="worship-4"; else if (c.num===5) wCls="worship-5";
const isHl = highlightNum===c.num;
return (
<div key={c.num} className={`chord-ref-row ${wCls} ${isHl?"hl":""}`}>
<div className={`chord-ref-num ${c.quality}`}>{c.num}</div>
<div className="chord-ref-name">{c.name}</div>
<div className="chord-ref-quality">{c.quality==="dim"?"diminished":c.quality}</div>
{(c.num===1||c.num===4||c.num===5) && <div className="worship-tag">{c.num===1?"1":c.num===4?"4":"5"}</div>}
</div>
);
})}
</div>
</div>
);
}

// ============================================================
// VISUAL REINFORCEMENT — shown after every answer
// ============================================================
function Reinforce({ step, keyData, isCorrect }) {
if (!step||!keyData) return null;
const accWord = keyData.accidentalType==="sharp"?"sharps":(keyData.accidentalType==="flat"?"flats":"sharps or flats");

if (step.type==="side"||step.type==="count") {
return (
<div className="reinforce">
<div className="reinforce-title">
{isCorrect?"✓ Confirmed on the circle":"↓ Find it on the circle"}
</div>
<div className="mini-circle-wrap">
<CircleSVG activeKey={keyData.name} teacherMode={false} mini={true}/>
</div>
<div style={{fontSize:13,color:"var(--muted)",textAlign:"center",lineHeight:1.6}}>
<span style={{color:keyData.side==="sharp"?"var(--sharp)":keyData.side==="flat"?"var(--flat)":"var(--green)",fontWeight:700}}>
{keyData.name}
</span> is on the <strong style={{color:"var(--text)"}}>{keyData.side==="neither"?"neither side (C — no accidentals)":keyData.side+" side"}</strong>
{keyData.accidentals>0 && <> with <strong style={{color:"var(--text)"}}>{keyData.accidentals} {accWord}</strong></>}
</div>
</div>
);
}

if (step.type==="whichSelect") {
return (
<div className="reinforce">
<div className="reinforce-title">
{isCorrect?"✓ The accidentals in "+keyData.name:"↓ Accidentals in "+keyData.name+" Major"}
</div>
{keyData.accidentals===0 ? (
<div style={{fontSize:15,color:"var(--green)",fontWeight:700,textAlign:"center"}}>No sharps or flats</div>
) : (
<div className="acc-list">
{keyData.accidentalList.map(a=>(
<div key={a} className={`acc-chip ${keyData.accidentalType}`}>{a}</div>
))}
</div>
)}
<div className="mini-circle-wrap">
<CircleSVG activeKey={keyData.name} teacherMode={false} mini={true}/>
</div>
</div>
);
}

if (step.type==="majorSelect") {
return (
<div className="reinforce">
<div className="reinforce-title">Major chords in every major key: 1, 4, 5</div>
<div className="chord-reinforce-grid">
{keyData.chords.map(c=>{
let wCls="";
if (c.num===1) wCls="w1"; else if (c.num===4) wCls="w4"; else if (c.num===5) wCls="w5";
const isHl=[1,4,5].includes(c.num);
return (
<div key={c.num} className={`cri-row ${wCls} ${isHl?"hl":""}`}>
<div className={`cri-num ${c.quality}`}>{c.num}</div>
<div className="cri-name">{c.name}</div>
<div className="cri-q">{c.quality==="dim"?"dim":c.quality==="minor"?"minor":"Major"}</div>
</div>
);
})}
</div>
</div>
);
}

// chord type
return (
<div className="reinforce">
<div className="reinforce-title">
{isCorrect?"✓ All chords in "+keyData.name+" Major":"↓ All chords in "+keyData.name+" Major"}
</div>
<div className="chord-reinforce-grid">
{keyData.chords.map(c=>{
let wCls="";
if (c.num===1) wCls="w1"; else if (c.num===4) wCls="w4"; else if (c.num===5) wCls="w5";
const isHl=step.chordNum===c.num;
return (
<div key={c.num} className={`cri-row ${wCls} ${isHl?"hl":""}`}>
<div className={`cri-num ${c.quality}`}>{c.num}</div>
<div className="cri-name">{c.name}</div>
<div className="cri-q">{c.quality==="dim"?"dim":c.quality==="minor"?"minor":"Major"}</div>
</div>
);
})}
</div>
</div>
);
}

// ============================================================
// CHORD DIAGRAM SVG
// Shared fretboard geometry — the static diagram and the interactive
// quiz fretboard use the SAME layout so they look identical:
//   • nut at the TOP, frets run horizontally, strings run vertically
//   • strings left→right: low E (6th) · A · D · G · B · high e (1st)
//   • fret numbers increase downward
// Sizes are in SVG units that render ~1:1 px on a phone, chosen to meet
// the readability/tap minimums: string gap 40px, fret gap 46px, dot 34px.
// ============================================================
const FB = {
  stringGap: 40,   // ≥ 36px between strings
  fretGap:   46,   // ≥ 44px between frets
  dotR:      17,   // 34px diameter ≥ 32px
  marginLeft: 42,  // room for fret-number labels on the left
  marginRight: 24,
  marginTop: 54,   // room for string labels + O/X markers + the nut
};
const STRING_LABELS = ["E", "A", "D", "G", "B", "e"]; // low E (6th) → high e (1st)
const fbStringX = s => FB.marginLeft + s * FB.stringGap;
const fbBoardW  = FB.marginLeft + 5 * FB.stringGap + FB.marginRight;

function ChordDiagram({ chord }) {
  const { stringGap, fretGap, dotR: R, marginTop: mT } = FB;
  const ROWS = 5; // visible fret rows in the static diagram
  const x0 = fbStringX(0), x1 = fbStringX(5);
  const used = chord.frets.filter(f => f > 0);
  const maxFret = used.length ? Math.max(...used) : 1;
  const minFret = used.length ? Math.min(...used) : 1;
  // Start at the nut when the chord fits in the first ROWS frets,
  // otherwise shift up and label the top fret (e.g. G#m at fret 4).
  const baseFret = maxFret <= ROWS ? 1 : minFret;
  const dotY = f => mT + (f - baseFret + 0.5) * fretGap;
  const fretLineY = i => mT + i * fretGap;

  const barreFret = chord.barre
    ? (chord.frets.find((f, s) => chord.fingers[s] === 1 && f > 0) ?? null)
    : null;
  const barreStr = (chord.barre && barreFret !== null)
    ? chord.frets.reduce((a, f, s) => { if (chord.fingers[s] === 1 && f === barreFret) a.push(s); return a; }, [])
    : [];
  const hasBarre = barreStr.length >= 2;
  const bx1 = hasBarre ? fbStringX(barreStr[0]) : 0;
  const bx2 = hasBarre ? fbStringX(barreStr[barreStr.length - 1]) : 0;
  const bcy = barreFret !== null ? dotY(barreFret) : 0;

  const W = fbBoardW;
  const H = mT + ROWS * fretGap + 26;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W, height: "auto" }}
      role="img" aria-label={`${chord.name} chord diagram`}>
      {/* string name labels */}
      {STRING_LABELS.map((l, s) => (
        <text key={`l${s}`} x={fbStringX(s)} y={18} textAnchor="middle" fontSize="15"
          fontWeight="600" fill="#8888aa" fontFamily="Oswald,sans-serif">{l}</text>
      ))}
      {/* open (O) / muted (X) markers above the nut */}
      {chord.frets.map((f, s) => {
        if (f === 0) return <text key={`o${s}`} x={fbStringX(s)} y={mT - 14} textAnchor="middle"
          fontSize="18" fontWeight="700" fill="#81c784" fontFamily="Oswald,sans-serif">O</text>;
        if (f === -1) return <text key={`x${s}`} x={fbStringX(s)} y={mT - 14} textAnchor="middle"
          fontSize="18" fontWeight="700" fill="#ef5350" fontFamily="Oswald,sans-serif">✕</text>;
        return null;
      })}
      {/* nut (thick) at fret 1, otherwise a thin top line + fret number */}
      {baseFret === 1
        ? <rect x={x0 - 5} y={mT - 4} width={x1 - x0 + 10} height={6} rx="2" fill="#e8e8f0" />
        : <line x1={x0 - 5} y1={mT} x2={x1 + 5} y2={mT} stroke="#4a4a60" strokeWidth="2" />}
      {baseFret > 1 && <text x={x0 - 16} y={dotY(baseFret) + 5} textAnchor="end" fontSize="14"
        fill="#8888aa" fontFamily="Oswald,sans-serif">{baseFret}fr</text>}
      {/* horizontal fret lines */}
      {[1, 2, 3, 4, 5].map(i => (
        <line key={`f${i}`} x1={x0 - 5} y1={fretLineY(i)} x2={x1 + 5} y2={fretLineY(i)}
          stroke="#2a2a40" strokeWidth="2" />
      ))}
      {/* vertical strings */}
      {STRING_LABELS.map((_, s) => (
        <line key={`s${s}`} x1={fbStringX(s)} y1={mT} x2={fbStringX(s)} y2={fretLineY(ROWS)}
          stroke="#3a3a52" strokeWidth="2" />
      ))}
      {/* barre bar */}
      {hasBarre && (
        <rect x={bx1 - R} y={bcy - R} width={bx2 - bx1 + 2 * R} height={2 * R} rx={R}
          fill="#e8e8f0" opacity="0.95" />
      )}
      {hasBarre && (
        <text x={(bx1 + bx2) / 2} y={bcy + 6} textAnchor="middle" fontSize="17"
          fontWeight="700" fill="#0a0a0f" fontFamily="Oswald,sans-serif">1</text>
      )}
      {/* finger dots with numbers */}
      {chord.frets.map((f, s) => {
        if (f <= 0) return null;
        if (chord.barre && chord.fingers[s] === 1 && f === barreFret) return null;
        const cy = dotY(f);
        return (
          <g key={`d${s}`}>
            <circle cx={fbStringX(s)} cy={cy} r={R} fill="#e8e8f0" />
            {chord.fingers[s] > 0 && (
              <text x={fbStringX(s)} y={cy + 6} textAnchor="middle" fontSize="17"
                fontWeight="700" fill="#0a0a0f" fontFamily="Oswald,sans-serif">{chord.fingers[s]}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ============================================================
// INTERACTIVE QUIZ FRETBOARD
// Same orientation/geometry as ChordDiagram. Shows all 6 strings as
// vertical lines and frets 1–7 as horizontal lines. Each string/fret
// intersection is tappable; a filled gold dot appears when tapped.
// ============================================================
function InteractiveFretboard({ tapped, onTap, disabled }) {
  const { stringGap, fretGap, dotR: R, marginTop: mT } = FB;
  const FRETS = 7;
  const x0 = fbStringX(0), x1 = fbStringX(5);
  const dotY = f => mT + (f - 0.5) * fretGap;
  const fretLineY = i => mT + i * fretGap;
  const W = fbBoardW;
  const H = mT + FRETS * fretGap + 20;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W, height: "auto", touchAction: "manipulation" }}>
      {/* string name labels */}
      {STRING_LABELS.map((l, s) => (
        <text key={`l${s}`} x={fbStringX(s)} y={18} textAnchor="middle" fontSize="15"
          fontWeight="600" fill="#8888aa" fontFamily="Oswald,sans-serif">{l}</text>
      ))}
      {/* nut at the top */}
      <rect x={x0 - 5} y={mT - 4} width={x1 - x0 + 10} height={6} rx="2" fill="#e8e8f0" />
      {/* horizontal fret lines + fret numbers on the left */}
      {[1, 2, 3, 4, 5, 6, 7].map(i => (
        <line key={`f${i}`} x1={x0 - 5} y1={fretLineY(i)} x2={x1 + 5} y2={fretLineY(i)}
          stroke="#2a2a40" strokeWidth="2" />
      ))}
      {[1, 2, 3, 4, 5, 6, 7].map(f => (
        <text key={`fn${f}`} x={x0 - 18} y={dotY(f) + 5} textAnchor="end" fontSize="13"
          fill="#8888aa" fontFamily="Oswald,sans-serif">{f}</text>
      ))}
      {/* vertical strings */}
      {STRING_LABELS.map((_, s) => (
        <line key={`s${s}`} x1={fbStringX(s)} y1={mT} x2={fbStringX(s)} y2={fretLineY(FRETS)}
          stroke="#3a3a52" strokeWidth="2" />
      ))}
      {/* tappable intersections */}
      {[1, 2, 3, 4, 5, 6, 7].flatMap(f => [0, 1, 2, 3, 4, 5].map(s => {
        const key = `${s}-${f}`;
        const on = tapped.includes(key);
        const cy = dotY(f);
        return (
          <g key={key} onClick={() => !disabled && onTap(s, f)}
            style={{ cursor: disabled ? "default" : "pointer" }}>
            <rect x={fbStringX(s) - stringGap / 2} y={cy - fretGap / 2}
              width={stringGap} height={fretGap} fill="transparent" />
            {on && <circle cx={fbStringX(s)} cy={cy} r={R} fill="#f0c040" />}
          </g>
        );
      }))}
    </svg>
  );
}

// ============================================================
// APP
// ============================================================
export default function App() {
const [screen, setScreen]             = useState("nameSelect");
const [selectedLoginName, setSelectedLoginName] = useState("");
const [pin, setPin]                   = useState("");
const [pinError, setPinError]         = useState(false);
const [isTeacher, setIsTeacher]       = useState(false);
const [studentName, setStudentName]   = useState("");
const [studentInstrument, setStudentInstrument] = useState("");
const [learningStyle, setLearningStyle] = useState(null);
const [quizAnswers, setQuizAnswers]   = useState([]);
const [quizQ, setQuizQ]               = useState(0);
const [lockedKey, setLockedKey]       = useState(null);
const [lookupKey, setLookupKey]       = useState(null);
const [currentKey, setCurrentKey]     = useState(null);
const [steps, setSteps]               = useState([]);
const [stepIdx, setStepIdx]           = useState(0);
const [selectedAns, setSelectedAns]   = useState(null);
const [answered, setAnswered]         = useState(false);
const [stepResults, setStepResults]   = useState([]);
const [multiSelected, setMultiSelected] = useState([]);
const [activeTab, setActiveTab]       = useState("circle");
const [ptMode, setPtMode]             = useState(null);
const [ptSteps, setPtSteps]           = useState([]);
const [ptIdx, setPtIdx]               = useState(0);
const [ptAns, setPtAns]               = useState(null);
const [ptAnswered, setPtAnswered]     = useState(false);
const [ptResults, setPtResults]       = useState([]);
const [cdQueue, setCdQueue]           = useState([]);
const [cdIdx, setCdIdx]               = useState(0);
const [cdTapped, setCdTapped]         = useState([]);
const [cdPhase, setCdPhase]           = useState("quiz");
const [cdFeedback, setCdFeedback]     = useState(null);
const [cdCorrect, setCdCorrect]       = useState([]);
const [cdWrong, setCdWrong]           = useState([]);
const [cdNotYet, setCdNotYet]         = useState([]);
const [cdSkipped, setCdSkipped]       = useState([]);

const timer = useRef(null);
const resetTimer = useCallback(() => {
if (timer.current) clearTimeout(timer.current);
if (screen!=="nameSelect"&&screen!=="timeout")
timer.current = setTimeout(()=>setScreen("timeout"), 15*60*1000);
}, [screen]);
useEffect(() => {
const evts=["touchstart","touchmove","click","keydown"];
evts.forEach(e=>window.addEventListener(e,resetTimer));
resetTimer();
return ()=>{evts.forEach(e=>window.removeEventListener(e,resetTimer));if(timer.current)clearTimeout(timer.current);};
}, [resetTimer]);

// Login: name selected, now show PIN entry
const handleNameSelect = (name) => {
setSelectedLoginName(name);
setPin("");
setPinError(false);
setScreen("pin");
};

// PIN entry — works for both students and teacher
const handlePin = (d) => {
const next=pin+d; if (next.length>4) return;
setPin(next); setPinError(false);
if (next.length===4) {
setTimeout(()=>{
if (selectedLoginName==="__teacher__") {
if (next===TEACHER_PIN) {
setPin(""); setIsTeacher(true); setScreen("teacherHome");
} else { setPinError(true); setTimeout(()=>{setPin("");setPinError(false);},700); }
} else {
const student = STUDENTS[selectedLoginName];
if (student && next===student.pin) {
setPin(""); setIsTeacher(false);
setStudentName(selectedLoginName);
setStudentInstrument(student.instrument);
logActivity(selectedLoginName,{type:"login"});
const saved=localStorage.getItem(`style_${selectedLoginName}`);
if (saved){setLearningStyle(saved);setScreen("home");}
else setScreen("stylePick");
} else { setPinError(true); setTimeout(()=>{setPin("");setPinError(false);},700); }
}
},150);
}
};

const handleStyle = (s) => {
if (s==="quiz"){setQuizAnswers([]);setQuizQ(0);setScreen("quiz");return;}
setLearningStyle(s); localStorage.setItem(`style_${studentName}`,s);
logActivity(studentName,{type:"style_set",style:s}); setScreen("home");
};

const handleQuizAns = (s) => {
const next=[...quizAnswers,s]; setQuizAnswers(next);
if (quizQ+1<LEARNING_STYLE_QUIZ.length){setQuizQ(q=>q+1);return;}
const tally={visual:0,kinesthetic:0,auditory:0};
next.forEach(x=>tally[x]++);
const winner=Object.entries(tally).sort((a,b)=>b[1]-a[1])[0][0];
setLearningStyle(winner); localStorage.setItem(`style_${studentName}`,winner);
logActivity(studentName,{type:"quiz_complete",style:winner}); setScreen("home");
};

const startRound = (keyOverride) => {
const key=keyOverride||(lockedKey?lockedKey:null)||pickWeightedKey(currentKey?.name);
setCurrentKey(key); setSteps(buildKeyRound(key));
setStepIdx(0); setSelectedAns(null); setAnswered(false); setStepResults([]); setMultiSelected([]);
setScreen("game"); logActivity(studentName||"teacher",{type:"round_start",key:key.name});
};

const handleAnswer = (opt) => {
if (answered) return;
setSelectedAns(opt); setAnswered(true);
setStepResults(r=>[...r, opt===steps[stepIdx].correct]);
};

const toggleMulti = (opt) => {
setMultiSelected(prev => prev.includes(opt) ? prev.filter(x=>x!==opt) : [...prev, opt]);
};

const handleMultiSubmit = () => {
if (answered) return;
const sorted = multiSelected.slice().sort();
const correctSorted = (steps[stepIdx].correct||[]).slice().sort();
const isCorrect = arraysEqual(sorted, correctSorted);
setAnswered(true);
setStepResults(r=>[...r, isCorrect]);
};

const handleNext = () => {
const next=stepIdx+1;
if (next>=steps.length){
logActivity(studentName||"teacher",{type:"round_complete",key:currentKey.name,correct:stepResults.filter(Boolean).length,total:steps.length});
setScreen("results");
} else { setStepIdx(next); setSelectedAns(null); setAnswered(false); setMultiSelected([]); }
};

const startPortugueseQuiz = (mode) => {
setPtMode(mode);
setPtSteps(buildPortugueseRound(mode));
setPtIdx(0); setPtAns(null); setPtAnswered(false); setPtResults([]);
setScreen("ptQuiz");
logActivity(studentName,{type:"pt_quiz_start",mode});
};

const handlePtAnswer = (opt) => {
if (ptAnswered) return;
setPtAns(opt); setPtAnswered(true);
setPtResults(r=>[...r, opt===ptSteps[ptIdx].correct]);
};

const handlePtNext = () => {
const next=ptIdx+1;
if (next>=ptSteps.length){
logActivity(studentName,{type:"pt_quiz_complete",correct:ptResults.filter(Boolean).length,total:7});
setScreen("ptResults");
} else { setPtIdx(next); setPtAns(null); setPtAnswered(false); }
};

const startChordQuiz = () => {
const q=shuffle(GUITAR_CHORDS);
setCdQueue(q); setCdIdx(0); setCdTapped([]); setCdPhase("quiz"); setCdFeedback(null);
setCdCorrect([]); setCdWrong([]); setCdNotYet([]); setCdSkipped([]);
setScreen("chordQuiz");
logActivity(studentName||"teacher",{type:"chord_quiz_start"});
};

const handleCdTap = (str,fret) => {
if(cdPhase!=="quiz")return;
const key=`${str}-${fret}`;
setCdTapped(prev=>prev.includes(key)?prev.filter(k=>k!==key):[...prev,key]);
};

const handleCdCheck = () => {
if(cdPhase!=="quiz")return;
const chord=cdQueue[cdIdx];
const expected=chord.frets.map((f,s)=>f>0?`${s}-${f}`:null).filter(Boolean).sort();
const tapped=[...cdTapped].sort();
const ok=arraysEqual(expected,tapped);
if(ok)setCdCorrect(c=>[...c,chord.name]);
else setCdWrong(w=>[...w,chord.name]);
setCdFeedback(ok?"correct":"wrong");
setCdPhase("revealed");
};

const handleCdShowMe = () => {
if(cdPhase!=="quiz")return;
setCdNotYet(n=>[...n,cdQueue[cdIdx].name]);
setCdFeedback("showme");
setCdPhase("revealed");
};

const handleCdSkip = () => {
if(cdPhase!=="quiz")return;
setCdSkipped(s=>[...s,cdQueue[cdIdx].name]);
const next=cdIdx+1;
if(next>=cdQueue.length){logActivity(studentName||"teacher",{type:"chord_quiz_complete"});setScreen("cdResults");}
else{setCdIdx(next);setCdTapped([]);setCdPhase("quiz");setCdFeedback(null);}
};

const handleCdNext = () => {
const next=cdIdx+1;
if(next>=cdQueue.length){logActivity(studentName||"teacher",{type:"chord_quiz_complete",correct:cdCorrect.length});setScreen("cdResults");}
else{setCdIdx(next);setCdTapped([]);setCdPhase("quiz");setCdFeedback(null);}
};

const step=steps[stepIdx];
const isMultiSelect = step?.type==="whichSelect"||step?.type==="majorSelect";
const circleIdx=currentKey?CIRCLE_ORDER.indexOf(currentKey.name):-1;
const fourKey=circleIdx>=0?CIRCLE_ORDER[(circleIdx-1+15)%15]:null;
const fiveKey=circleIdx>=0?CIRCLE_ORDER[(circleIdx+1)%15]:null;
const isRight = answered && (
  isMultiSelect
    ? arraysEqual(multiSelected.slice().sort(), (step?.correct||[]).slice().sort())
    : selectedAns===step?.correct
);
const styleLabel={visual:"👁 Visual",kinesthetic:"🤸 Hands-On",auditory:"👂 Listening"};

const goHome=()=>setScreen(isTeacher?"teacherHome":"home");

const ptStep = ptSteps[ptIdx];
const ptIsRight = ptAnswered && ptAns===ptStep?.correct;

const cdChord = cdQueue[cdIdx];
const cdExpected = cdChord
? cdChord.frets.map((f,s)=>f>0?`${s}-${f}`:null).filter(Boolean)
: [];

// NAV BARS
const StudentNav = ({active}) => (
<nav className="nav-bar">
<button className={`nav-tab ${active==="circle"?"active":""}`} onClick={()=>{setActiveTab("circle");setScreen("home");}}>
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/></svg>Circle
</button>
<button className={`nav-tab ${active==="practice"?"active":""}`} onClick={()=>startRound()}>
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>Practice
</button>
<button className={`nav-tab ${active==="lookup"?"active":""}`} onClick={()=>{setActiveTab("lookup");setScreen("lookup");}}>
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>Key Lookup
</button>
</nav>
);

const TeacherNav = ({active}) => (
<nav className="nav-bar">
<button className={`nav-tab t ${active==="circle"?"active":""}`} onClick={()=>setScreen("teacherHome")}>
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/></svg>Circle
</button>
<button className={`nav-tab t ${active==="settings"?"active":""}`} onClick={()=>setScreen("settings")}>
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>Settings
</button>
</nav>
);

// ============================================================
if (screen==="timeout") return <><style>{S}</style><div className="timeout-screen" onClick={()=>setScreen("nameSelect")}/></>;

// NAME SELECT
if (screen==="nameSelect") return (
<><style>{S}</style>
<div className="name-screen">
<div><div className="pin-logo">♩♪♫♬</div><div className="pin-sub">Circle of Fifths</div></div>
<div className="name-list">
{Object.keys(STUDENTS).map(name => (
<button key={name} className="name-btn" onClick={()=>handleNameSelect(name)}>{name}</button>
))}
</div>
<div className="name-divider">
<div className="name-divider-line"/>
<div className="name-divider-text">or</div>
<div className="name-divider-line"/>
</div>
<div style={{width:"100%",maxWidth:320}}>
<button className="teacher-btn" onClick={()=>handleNameSelect("__teacher__")}>🎓 Teacher Login</button>
</div>
</div></>
);

if (screen==="pin") return (
<><style>{S}</style>
<div className="pin-screen">
<div>
<div className="pin-logo">♩♪♫♬</div>
<div className="pin-sub">Circle of Fifths</div>
</div>
<div className={`pin-name ${selectedLoginName==="__teacher__"?"":"" }`} style={{color:selectedLoginName==="__teacher__"?"var(--teacher)":"var(--gold)"}}>
{selectedLoginName==="__teacher__"?"Teacher":selectedLoginName}
</div>
<div className="pin-dots">{Array.from({length:4}).map((_,i)=><div key={i} className={`dot ${i<pin.length?(pinError?"error":"filled"):""}`}/>)}</div>
<div className="pin-pad">
{[1,2,3,4,5,6,7,8,9].map(d=><button key={d} className="pin-btn" onClick={()=>handlePin(String(d))}>{d}</button>)}
<div/><button className="pin-btn" onClick={()=>handlePin("0")}>0</button>
<button className="pin-btn" style={{fontSize:18,color:"var(--muted)"}} onClick={()=>setPin(p=>p.slice(0,-1))}>⌫</button>
</div>
<div className="pin-error">{pinError?"Incorrect PIN — try again":""}</div>
<button className="ghost-btn" style={{maxWidth:320}} onClick={()=>{setPin("");setPinError(false);setScreen("nameSelect");}}>← Back</button>
</div></>
);

if (screen==="stylePick") return (
<><style>{S}</style>
<div className="center-screen">
<div className="screen-title">How do you learn best?</div>
<div className="screen-sub">Pick what feels most like you.</div>
<div className="vlist">
<button className="card-btn" onClick={()=>handleStyle("visual")}>👁 Visual<span className="card-btn-sub">Charts, patterns, seeing things laid out</span></button>
<button className="card-btn" onClick={()=>handleStyle("kinesthetic")}>🤸 Hands-On<span className="card-btn-sub">Tapping, building, doing things yourself</span></button>
<button className="card-btn" onClick={()=>handleStyle("auditory")}>👂 Listening<span className="card-btn-sub">Hearing it explained, reading clues out loud</span></button>
<button className="card-btn muted" onClick={()=>handleStyle("quiz")}>🤷 Not sure — take the quiz<span className="card-btn-sub">4 quick questions to figure it out</span></button>
</div>
</div></>
);

if (screen==="quiz") {
const q=LEARNING_STYLE_QUIZ[quizQ];
return (
<><style>{S}</style>
<div className="shell">
<div className="quiz-screen">
<div className="prog-bar">{LEARNING_STYLE_QUIZ.map((_,i)=><div key={i} className={`pip ${i<=quizQ?"on":""}`}/>)}</div>
<div style={{fontSize:12,color:"var(--muted)",letterSpacing:2,textTransform:"uppercase"}}>How Do You Learn?</div>
<div className="big-q">{q.q}</div>
<div className="vlist">{q.options.map(o=><button key={o.text} className="card-btn" onClick={()=>handleQuizAns(o.style)}>{o.text}</button>)}</div>
</div>
</div></>
);
}

if (screen==="teacherHome") return (
<><style>{S}</style>
<div className="shell">
<div className="home-screen">
<div className="top-bar">
<div className="top-name" style={{color:"var(--teacher)"}}>Teacher</div>
<div className="top-logo">C5</div>
<button className="ghost-btn" style={{width:"auto",padding:"4px 12px",fontSize:12}} onClick={()=>{setIsTeacher(false);setLockedKey(null);setScreen("nameSelect");}}>Exit</button>
</div>
<div className="teacher-badge">🎓 Teacher Mode</div>
{lockedKey ? (
<div className="locked-display">
<div className="locked-name">{lockedKey.name}</div>
<div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:"var(--muted)",marginTop:4}}>Locked Key</div>
<button className="ghost-btn" style={{marginTop:10}} onClick={()=>setLockedKey(null)}>Unlock — use weighted random</button>
</div>
) : (
<div style={{textAlign:"center",fontSize:13,color:"var(--muted)",lineHeight:1.6}}>
Tap a key on the circle to lock it for students.<br/>
<span style={{fontSize:11,opacity:.7}}>No key locked — 70% worship keys</span>
</div>
)}
<div className="circle-wrap">
<CircleSVG activeKey={lockedKey?.name} onTap={k=>{const kd=KEYS.find(x=>x.name===k);setLockedKey(kd);}} teacherMode={true}/>
</div>
<div className="legend">
<div className="leg"><div className="leg-dot" style={{background:"rgba(79,195,247,.6)"}}/> Sharp</div>
<div className="leg"><div className="leg-dot" style={{background:"rgba(239,154,154,.6)"}}/> Flat</div>
<div className="leg"><div className="leg-dot" style={{background:"rgba(192,132,252,.6)"}}/> Locked</div>
</div>
<button className="primary-btn" onClick={()=>startRound()}>🎮 Preview This Key</button>
<button className="ghost-btn" onClick={()=>{setActiveTab("lookup");setScreen("lookup");}}>🔍 Look Up a Key</button>
<button className="ghost-btn" onClick={()=>setScreen("ptModeSelect")}>🇧🇷 Notas em Português</button>
<button className="ghost-btn" onClick={startChordQuiz}>🎸 Chord Diagrams</button>
<button className="teacher-btn" onClick={()=>setScreen("settings")}>⚙️ View Students</button>
</div>
<TeacherNav active="circle"/>
</div></>
);

if (screen==="settings") return (
<><style>{S}</style>
<div className="shell">
<div className="settings-screen">
<div style={{display:"flex",alignItems:"center",gap:12}}>
<button className="ghost-btn" style={{width:"auto",padding:"6px 14px"}} onClick={()=>setScreen("teacherHome")}>← Back</button>
<div style={{fontFamily:"'Oswald',sans-serif",fontSize:22,fontWeight:700,color:"var(--teacher)",letterSpacing:2}}>Students</div>
</div>
<div className="sec-lbl">Hardcoded in the app — edit App.jsx to change</div>
{Object.entries(STUDENTS).map(([name, info]) => (
<div key={name} className="student-row-ro">
<div className="ro-name">{name}</div>
<div className="ro-pin">{"•".repeat(4)}</div>
<div className="ro-inst">{info.instrument}</div>
</div>
))}
<div style={{marginTop:8,fontSize:13,color:"var(--muted)",lineHeight:1.6}}>
To add, remove, or change a student, update the <code style={{background:"var(--surface2)",padding:"2px 6px",borderRadius:4,fontSize:12}}>STUDENTS</code> object at the top of <code style={{background:"var(--surface2)",padding:"2px 6px",borderRadius:4,fontSize:12}}>src/App.jsx</code>.
</div>
<div className="sec-lbl" style={{marginTop:8}}>Teacher PIN</div>
<div style={{fontSize:13,color:"var(--muted)"}}>Set at the top of the code file — look for <code style={{background:"var(--surface2)",padding:"2px 6px",borderRadius:4,fontSize:12}}>TEACHER_PIN</code></div>
</div>
<TeacherNav active="settings"/>
</div></>
);

// LOOKUP
if (screen==="lookup") {
const lkd = lookupKey ? KEYS.find(k=>k.name===lookupKey) : null;
return (
<><style>{S}</style>
<div className="shell">
<div className="lookup-screen">
<div style={{fontFamily:"'Oswald',sans-serif",fontSize:22,fontWeight:700,color:"var(--gold)",letterSpacing:2}}>Key Lookup</div>
<div style={{fontSize:13,color:"var(--muted)"}}>Pick the key your song is in — see all the chords.</div>
<div className="key-picker">
{KEYS.map(k=>{
const cls=k.side==="sharp"?"sharp-key":k.side==="flat"?"flat-key":"neither-key";
return (
<button key={k.name} className={`key-pick-btn ${cls} ${lookupKey===k.name?"selected":""}`} onClick={()=>setLookupKey(k.name)}>
{k.name}
</button>
);
})}
</div>
{lkd && <ChordRefCard keyData={lkd} highlightNum={null}/>}
</div>
<StudentNav active="lookup"/>
</div></>
);
}

// RESULTS
if (screen==="results") {
const correct=stepResults.filter(Boolean).length;
const total=steps.length;
const p=Math.round((correct/total)*100);
const msg=p===100?"Perfect round! 🔥 You nailed every question.":p>=80?"Really strong. Keep going — it's sticking.":p>=60?"Good effort. Try this key again and watch it improve.":"Keep at it — every rep builds the memory.";
return (
<><style>{S}</style>
<div className="results-screen">
<div style={{fontSize:13,letterSpacing:3,color:"var(--muted)",textTransform:"uppercase"}}>{studentName||"Teacher"}</div>
<div style={{fontSize:14,color:"var(--muted)"}}>Key of {currentKey?.name} Major</div>
<div className="r-score">{p}%</div>
<div style={{fontSize:14,color:"var(--muted)"}}>{correct} of {total} correct</div>
<div style={{fontSize:17,color:"var(--text)",maxWidth:280,lineHeight:1.5,textAlign:"center"}}>{msg}</div>
<div style={{display:"flex",flexDirection:"column",gap:10,width:"100%",maxWidth:300}}>
<button className="primary-btn" onClick={()=>startRound()}>{lockedKey?`Practice ${lockedKey.name} Again`:"Next Key →"}</button>
{!lockedKey&&<button className="ghost-btn" onClick={()=>startRound(currentKey)}>Try {currentKey?.name} Again</button>}
<button className="ghost-btn" onClick={goHome}>Back to Circle</button>
</div>
</div></>
);
}

// GAME
if (screen==="game"&&step) {
// Steps: 0=side, 1=count, 2=whichSelect, 3=majorSelect, 4-10=chord (7 chords)
const phase = stepIdx<3?"nav":stepIdx===3?"theory":"chord";
const total=steps.length;
return (
<><style>{S}</style>
<div className="shell">
<div className="game-screen">
<div className="g-header">
<button style={{background:"none",border:"none",color:"var(--muted)",fontSize:14,cursor:"pointer",fontFamily:"'Source Sans 3',sans-serif"}} onClick={goHome}>← Exit</button>
<div>
<div className={`key-hero ${isTeacher?"t":""}`}>{currentKey.name}</div>
<div className="key-sub">Major Key{lockedKey?" · Locked":""}</div>
</div>
<div style={{fontSize:12,color:"var(--muted)",textAlign:"right"}}>{stepIdx+1}<span style={{color:"var(--border)"}}>/{total}</span></div>
</div>

      <div className="step-prog">
        {steps.map((_,i)=>{let c="sp";if(i<stepIdx)c+=stepResults[i]?" ok":" no";else if(i===stepIdx)c+=" cur";return <div key={i} className={c}/>;}) }
      </div>

      <div className="sec-lbl">
        {phase==="nav"?`Step ${stepIdx+1} of 3 — Key Signature`:
         phase==="theory"?"Chord Theory — All Keys":
         `Chord ${stepIdx-3} of 7 — ${currentKey.name} Major`}
      </div>

      <div className="q-card">
        <div className="q-lbl">{phase==="nav"?"Key Navigation":phase==="theory"?"Chord Theory":"Chord Quality"}</div>
        <div className="q-text">{step.question}</div>
      </div>

      {isMultiSelect ? (
        <>
          <div className="multi-grid">
            {step.options.map(opt => {
              const isSelected = multiSelected.includes(opt);
              const inCorrect = (step.correct||[]).includes(opt);
              let cls = "multi-btn";
              if (step.isNone) {
                cls += " multi-disabled";
              } else if (answered) {
                if (inCorrect && isSelected) cls += " multi-right";
                else if (!inCorrect && isSelected) cls += " multi-wrong";
                else if (inCorrect && !isSelected) cls += " multi-missed";
              } else if (isSelected) {
                cls += " multi-selected";
              }
              return (
                <button key={opt} className={cls}
                  onClick={() => !answered && !step.isNone && toggleMulti(opt)}
                  disabled={answered || step.isNone}>
                  {opt}
                </button>
              );
            })}
          </div>
          {!answered && (
            <button className="primary-btn" onClick={handleMultiSubmit}>Check Answer</button>
          )}
        </>
      ) : (
        <div className="ans-list">
          {step.options.map(opt=>{
            let cls="ans";
            if(answered){if(opt===step.correct)cls+=" reveal";else if(opt===selectedAns)cls+=" wrong";}
            return <button key={opt} className={cls} onClick={()=>handleAnswer(opt)} disabled={answered}>{opt}</button>;
          })}
        </div>
      )}

      <div className={`feedback ${answered?(isRight?"ok":"no"):""}`}>
        {answered ? (
          isRight ? "✓ Correct!" : (
            isMultiSelect
              ? `✗  Correct: ${(step.correct||[]).length===0?"None":(step.correct||[]).join(", ")}`
              : `✗  ${step.correct}`
          )
        ) : ""}
      </div>

      {answered && <Reinforce step={step} keyData={currentKey} isCorrect={isRight}/>}

      {answered&&phase==="nav"&&stepIdx===2&&(
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,padding:"12px 14px",background:"var(--surface)",borderRadius:"var(--radius)",border:"1.5px solid var(--border)"}}>
          <div style={{textAlign:"center"}}>
            <div style={{fontFamily:"'Oswald',sans-serif",fontSize:26,fontWeight:700,color:"var(--sharp)"}}>{fourKey}</div>
            <div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"var(--muted)",marginTop:2}}>← step back</div>
            <div style={{fontSize:9,letterSpacing:1,color:"var(--sharp)"}}>= the 4 chord</div>
          </div>
          <div style={{fontSize:14,color:"var(--muted)"}}>◀ {currentKey.name} ▶</div>
          <div style={{textAlign:"center"}}>
            <div style={{fontFamily:"'Oswald',sans-serif",fontSize:26,fontWeight:700,color:"var(--green)"}}>{fiveKey}</div>
            <div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"var(--muted)",marginTop:2}}>step forward →</div>
            <div style={{fontSize:9,letterSpacing:1,color:"var(--green)"}}>= the 5 chord</div>
          </div>
        </div>
      )}

      {answered&&<button className="primary-btn" onClick={handleNext}>{stepIdx+1>=total?"See Results →":"Next →"}</button>}
    </div>
    {isTeacher ? <TeacherNav active="practice"/> : <StudentNav active="practice"/>}
  </div></>
);

}

// PORTUGUESE MODE SELECT
if (screen==="ptModeSelect") return (
<><style>{S}</style>
<div className="center-screen">
<div className="screen-title">Notas em Português</div>
<div className="screen-sub">Choose a direction to practice</div>
<div className="vlist">
<button className="card-btn" onClick={()=>startPortugueseQuiz("en-pt")}>
English → Português
<span className="card-btn-sub">C, D, E ... → Dó, Ré, Mi ...</span>
</button>
<button className="card-btn" onClick={()=>startPortugueseQuiz("pt-en")}>
Português → English
<span className="card-btn-sub">Dó, Ré, Mi ... → C, D, E ...</span>
</button>
</div>
<button className="ghost-btn" style={{maxWidth:320}} onClick={()=>setScreen("home")}>← Back</button>
</div></>
);

// PORTUGUESE QUIZ
if (screen==="ptQuiz"&&ptStep) return (
<><style>{S}</style>
<div className="shell">
<div className="quiz-screen">
<div className="prog-bar">{ptSteps.map((_,i)=><div key={i} className={`pip ${i<=ptIdx?"on":""}`}/>)}</div>
<div style={{fontSize:12,color:"var(--muted)",letterSpacing:2,textTransform:"uppercase"}}>
{ptMode==="en-pt"?"English → Português":"Português → English"} · {ptIdx+1} of 7
</div>
<div className="big-q">{ptStep.question}</div>
<div className="ans-list">
{ptStep.options.map(opt=>{
let cls="ans";
if(ptAnswered){if(opt===ptStep.correct)cls+=" reveal";else if(opt===ptAns)cls+=" wrong";}
return <button key={opt} className={cls} onClick={()=>handlePtAnswer(opt)} disabled={ptAnswered}>{opt}</button>;
})}
</div>
{ptAnswered&&(
<div style={{textAlign:"center",fontSize:18,fontWeight:700,color:ptIsRight?"var(--green)":"var(--dim)"}}>
{ptIsRight?"Sim! ✓":`Quase! The answer was ${ptStep.correct}`}
</div>
)}
{ptAnswered&&(
<button className="primary-btn" onClick={handlePtNext}>{ptIdx+1>=ptSteps.length?"See Results →":"Next →"}</button>
)}
<button className="ghost-btn" onClick={()=>setScreen("home")}>← Exit</button>
</div>
</div></>
);

// PORTUGUESE RESULTS
if (screen==="ptResults") {
const ptCorrect=ptResults.filter(Boolean).length;
const ptPct=Math.round((ptCorrect/7)*100);
const ptMsg=ptPct===100?"Perfeito! You know all 7 notes!":ptPct>=80?"Almost perfect — keep it up!":ptPct>=60?"Good effort — try again to lock it in.":"Keep practicing — it gets easier!";
return (
<><style>{S}</style>
<div className="results-screen">
<div style={{fontSize:13,letterSpacing:3,color:"var(--muted)",textTransform:"uppercase"}}>Notas em Português</div>
<div style={{fontSize:14,color:"var(--muted)"}}>{ptMode==="en-pt"?"English → Português":"Português → English"}</div>
<div className="r-score">{ptCorrect}/7</div>
<div style={{fontSize:16,color:"var(--muted)"}}>{ptPct}%</div>
<div style={{fontSize:17,color:"var(--text)",maxWidth:280,lineHeight:1.5,textAlign:"center"}}>{ptMsg}</div>
<div style={{display:"flex",flexDirection:"column",gap:10,width:"100%",maxWidth:300}}>
<button className="primary-btn" onClick={()=>startPortugueseQuiz(ptMode)}>Play Again</button>
<button className="ghost-btn" onClick={()=>setScreen("ptModeSelect")}>Switch Mode</button>
<button className="ghost-btn" onClick={()=>setScreen("home")}>Back to Home</button>
</div>
</div></>
);
}

// CHORD QUIZ
if (screen==="chordQuiz"&&cdChord) return (
<><style>{S}</style>
<div className="shell">
<div className="cd-screen">
<div className="g-header">
<button style={{background:"none",border:"none",color:"var(--muted)",fontSize:14,cursor:"pointer",fontFamily:"'Source Sans 3',sans-serif"}} onClick={goHome}>← Exit</button>
<div style={{fontSize:11,color:"var(--muted)",letterSpacing:2,textTransform:"uppercase"}}>{cdIdx+1} / {cdQueue.length}</div>
</div>
<div className="step-prog">
{cdQueue.map((_,i)=>{
let c="sp";
if(i<cdIdx)c+=cdCorrect.includes(cdQueue[i].name)?" ok":(cdNotYet.includes(cdQueue[i].name)||cdSkipped.includes(cdQueue[i].name))?" cur":" no";
else if(i===cdIdx)c+=" cur";
return <div key={i} className={c}/>;
})}
</div>
<div className="cd-chord-name">{cdChord.name}</div>
{cdPhase==="quiz"&&(
<div className="cd-sub">Tap where your fingers go</div>
)}
{cdPhase==="quiz"?(
<>
<div className="cd-fretboard-wrap">
<InteractiveFretboard tapped={cdTapped} onTap={handleCdTap}/>
</div>
<div className="cd-btn-row">
<button className="primary-btn" onClick={handleCdCheck}>Check Answer</button>
<button className="ghost-btn" onClick={handleCdShowMe}>Show Me</button>
<button className="ghost-btn" onClick={handleCdSkip}>Skip</button>
</div>
</>
):(
<>
<div className={`feedback ${cdFeedback==="correct"?"ok":"no"}`} style={{fontSize:18}}>
{cdFeedback==="correct"?"✓ Nailed it!":cdFeedback==="showme"?"Here it is — practice this one:":"✗ Not quite — here's the chord:"}
</div>
<div className="cd-diagram-wrap"><ChordDiagram chord={cdChord}/></div>
<button className="primary-btn" onClick={handleCdNext}>{cdIdx+1>=cdQueue.length?"See Results →":"Next →"}</button>
</>
)}
</div>
</div></>
);

// CHORD RESULTS
if (screen==="cdResults") return (
<><style>{S}</style>
<div className="shell">
<div className="cd-results">
<div className="screen-title" style={{textAlign:"left"}}>Chord Diagrams</div>
<div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
<div style={{fontSize:13,color:"var(--green)"}}><strong style={{fontFamily:"'Oswald',sans-serif",fontSize:22}}>{cdCorrect.length}</strong> correct</div>
<div style={{fontSize:13,color:"var(--dim)"}}><strong style={{fontFamily:"'Oswald',sans-serif",fontSize:22}}>{cdWrong.length}</strong> incorrect</div>
<div style={{fontSize:13,color:"var(--gold)"}}><strong style={{fontFamily:"'Oswald',sans-serif",fontSize:22}}>{cdNotYet.length}</strong> not yet learned</div>
<div style={{fontSize:13,color:"var(--muted)"}}><strong style={{fontFamily:"'Oswald',sans-serif",fontSize:22}}>{cdSkipped.length}</strong> skipped</div>
</div>
{cdCorrect.length>0&&(
<div className="cd-section">
<div className="cd-section-lbl">✓ Correct</div>
<div className="cd-chips">{cdCorrect.map(n=><span key={n} className="cd-chip ok">{n}</span>)}</div>
</div>
)}
{cdWrong.length>0&&(
<div className="cd-section">
<div className="cd-section-lbl">✗ Incorrect</div>
<div className="cd-chips">{cdWrong.map(n=><span key={n} className="cd-chip no">{n}</span>)}</div>
</div>
)}
{cdNotYet.length>0&&(
<div className="cd-section">
<div className="cd-section-lbl">Not yet learned — keep practicing</div>
<div className="cd-chips">{cdNotYet.map(n=><span key={n} className="cd-chip notyet">{n}</span>)}</div>
</div>
)}
{cdSkipped.length>0&&(
<div className="cd-section">
<div className="cd-section-lbl">Skipped</div>
<div className="cd-chips">{cdSkipped.map(n=><span key={n} className="cd-chip skip">{n}</span>)}</div>
</div>
)}
<button className="primary-btn" onClick={startChordQuiz}>Play Again</button>
<button className="ghost-btn" onClick={goHome}>Back to Home</button>
</div>
</div></>
);

// STUDENT HOME
return (
<><style>{S}</style>
<div className="shell">
<div className="home-screen">
<div className="top-bar">
<div className="top-name">{studentName}</div>
<div className="top-logo">C5</div>
<div style={{fontSize:11,color:"var(--muted)"}}>{styleLabel[learningStyle]||""}</div>
</div>
<div className="circle-wrap"><CircleSVG activeKey={currentKey?.name} teacherMode={false}/></div>
<div className="legend">
<div className="leg"><div className="leg-dot" style={{background:"rgba(79,195,247,.6)"}}/> Sharp keys</div>
<div className="leg"><div className="leg-dot" style={{background:"rgba(239,154,154,.6)"}}/> Flat keys</div>
<div className="leg"><div className="leg-dot" style={{background:"#81c784"}}/> 4 & 5 neighbors</div>
</div>
<div style={{textAlign:"center",fontSize:12,color:"var(--muted)"}}>One step back = the 4 · One step forward = the 5</div>
<button className="primary-btn" onClick={()=>startRound()}>🎮 Start Practice</button>
<button className="ghost-btn" onClick={()=>{setActiveTab("lookup");setScreen("lookup");}}>🔍 Look Up a Key</button>
<button className="ghost-btn" onClick={()=>setScreen("ptModeSelect")}>🇧🇷 Notas em Português</button>
{studentInstrument==="guitar"&&<button className="ghost-btn" onClick={startChordQuiz}>🎸 Chord Diagrams</button>}
<button className="ghost-btn" onClick={()=>setScreen("stylePick")}>Change Learning Style</button>
</div>
<StudentNav active="circle"/>
</div></>
);
}
