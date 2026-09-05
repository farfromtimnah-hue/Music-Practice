/* Tuner styles. Self-contained with a `tn-` prefix, reusing the app's
   CSS variables so it matches the rest of the sections. */

export const TUNER_CSS = `
.tn-shell{max-width:480px;margin:0 auto;min-height:100vh;display:flex;flex-direction:column;
  gap:14px;padding:16px 16px 40px;}
.tn-header{display:flex;align-items:center;justify-content:space-between;}
.tn-back{background:none;border:none;color:var(--muted);font-size:14px;cursor:pointer;
  font-family:'Source Sans 3',sans-serif;padding:4px 0;}
.tn-title{font-family:'Oswald',sans-serif;font-size:22px;letter-spacing:2px;color:var(--text);}

/* tuning picker */
.tn-tunings{display:flex;gap:8px;}
.tn-tuning-btn{flex:1;padding:9px 6px;border-radius:12px;border:1.5px solid var(--border);
  background:var(--surface);color:var(--muted);font-family:'Oswald',sans-serif;font-size:13px;
  letter-spacing:.5px;cursor:pointer;display:flex;flex-direction:column;gap:2px;transition:all .15s;}
.tn-tuning-btn span{font-family:'Source Sans 3',sans-serif;font-size:10px;opacity:.75;letter-spacing:0;}
.tn-tuning-btn.on{border-color:var(--gold);color:var(--gold);background:var(--surface2);}

/* listening indicator */
.tn-listening{display:flex;align-items:center;justify-content:center;gap:8px;font-size:13px;
  color:var(--muted);transition:opacity .25s;}
.tn-listening.off{opacity:.4;}
.tn-dot{width:9px;height:9px;border-radius:50%;background:var(--green);
  box-shadow:0 0 8px var(--green);}
.tn-listening.off .tn-dot{background:var(--muted);box-shadow:none;}
.tn-listening.on .tn-dot{animation:tnPulse 1.4s ease-in-out infinite;}
@keyframes tnPulse{0%,100%{opacity:1;}50%{opacity:.35;}}

.tn-main{display:flex;gap:12px;align-items:flex-start;}
.tn-headstock{width:46%;max-width:190px;height:auto;flex-shrink:0;}
.tn-peg-label{fill:#c9ced8;font-family:'Oswald',sans-serif;font-size:19px;font-weight:600;}
.tn-peg-label.on{fill:var(--gold);}

/* readout */
.tn-readout{flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;
  padding-top:6px;min-width:0;}
.tn-note{font-family:'Oswald',sans-serif;font-size:52px;line-height:1;color:var(--gold);}
.tn-target{font-size:11px;color:var(--muted);}
.tn-freq{font-family:'Oswald',sans-serif;font-size:20px;color:var(--text);margin-top:2px;}

/* The meter spans +/-50 cents edge to edge, so 50% is dead centre and the
   needle's left% maps linearly onto that scale. Insetting the track by
   half the needle width keeps the needle fully visible at the extremes
   instead of being clipped by the rounded ends. */
.tn-meter{position:relative;width:100%;height:26px;border-radius:13px;background:var(--surface2);
  border:1px solid var(--border);margin-top:8px;overflow:hidden;}
.tn-meter-track{position:absolute;left:4px;right:4px;top:0;bottom:0;}
/* The green band is the real in-tune tolerance: +/-5 cents on a +/-50
   cent scale, i.e. 5% either side of centre. */
.tn-meter-zone{position:absolute;left:45%;right:45%;top:0;bottom:0;
  background:rgba(129,199,132,.22);}
.tn-meter-center{position:absolute;left:50%;top:3px;bottom:3px;width:2px;margin-left:-1px;
  background:var(--green);opacity:.8;}
.tn-needle{position:absolute;top:2px;bottom:2px;width:4px;margin-left:-2px;border-radius:2px;
  background:var(--gold);box-shadow:0 0 10px var(--gold);transition:left .09s linear;}
.tn-needle.ok{background:var(--green);box-shadow:0 0 12px var(--green);}
.tn-meter-scale{display:flex;justify-content:space-between;width:100%;font-size:10px;
  color:var(--muted);}

.tn-cents{font-family:'Oswald',sans-serif;font-size:24px;color:var(--text);margin-top:4px;}
.tn-cents.ok{color:var(--green);}
.tn-direction{font-family:'Oswald',sans-serif;font-size:19px;letter-spacing:1px;}
.tn-direction.low{color:var(--sharp);}
.tn-direction.high{color:var(--flat);}
.tn-direction.ok{color:var(--green);}

/* the tighten/loosen instruction — deliberately the loudest thing here */
.tn-action{margin-top:6px;padding:11px 14px;border-radius:12px;width:100%;text-align:center;
  font-family:'Oswald',sans-serif;font-size:19px;letter-spacing:.5px;line-height:1.25;
  background:var(--surface2);border:1.5px solid var(--border);color:var(--text);}
.tn-action.ok{background:rgba(129,199,132,.16);border-color:var(--green);color:var(--green);}
.tn-check{margin-right:7px;}

.tn-idle,.tn-unsure{font-size:14px;color:var(--muted);text-align:center;padding:26px 8px;
  line-height:1.5;}
.tn-unsure{color:var(--gold);}

/* string picker */
.tn-strings{display:flex;gap:7px;justify-content:center;flex-wrap:wrap;}
.tn-string-btn{min-width:52px;padding:10px 8px;border-radius:11px;border:1.5px solid var(--border);
  background:var(--surface);color:var(--muted);font-family:'Oswald',sans-serif;font-size:16px;
  cursor:pointer;transition:all .15s;}
.tn-string-btn.on{border-color:var(--gold);color:var(--gold);background:var(--surface2);}
.tn-string-btn.locked{box-shadow:0 0 0 2px rgba(240,192,64,.35);}
.tn-hint{text-align:center;font-size:11px;color:var(--muted);}

/* teacher block */
.tn-teacher{margin-top:6px;padding:14px;border-radius:var(--radius);background:var(--surface);
  border:1.5px solid var(--teacher);display:flex;flex-direction:column;gap:10px;}
.tn-teacher-title{font-family:'Oswald',sans-serif;font-size:14px;letter-spacing:1.5px;
  color:var(--teacher);}
.tn-modes{display:flex;gap:8px;}
.tn-mode-btn{flex:1;padding:10px 8px;border-radius:11px;border:1.5px solid var(--border);
  background:var(--surface2);color:var(--muted);font-family:'Oswald',sans-serif;font-size:12px;
  cursor:pointer;display:flex;flex-direction:column;gap:3px;text-align:left;transition:all .15s;}
.tn-mode-btn span{font-family:'Source Sans 3',sans-serif;font-size:10px;opacity:.8;line-height:1.35;}
.tn-mode-btn.on{border-color:var(--teacher);color:var(--text);}
.tn-warn{font-size:11px;line-height:1.5;color:var(--gold);background:rgba(240,192,64,.08);
  border:1px solid rgba(240,192,64,.3);border-radius:10px;padding:9px 11px;}
.tn-diag{display:flex;flex-direction:column;gap:5px;background:var(--bg);border-radius:10px;
  padding:10px 12px;}
.tn-diag-row{display:flex;justify-content:space-between;font-size:12px;color:var(--muted);}
.tn-diag-row strong{font-family:'Oswald',sans-serif;color:var(--text);font-weight:500;}
.tn-diag-row strong.ok{color:var(--green);}
.tn-diag-row strong.no{color:var(--dim);}

/* permission / error */
.tn-perm{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:16px;padding:30px 20px;text-align:center;}
.tn-perm-icon{font-size:44px;}
.tn-perm-msg{font-size:15px;line-height:1.6;color:var(--text);max-width:330px;}

@media (max-width:380px){
  .tn-note{font-size:42px;}
  .tn-action{font-size:17px;}
  .tn-headstock{width:42%;}
}

.tn-tapwake{display:block;width:100%;margin:10px 0;padding:12px 14px;border-radius:10px;
  border:1px solid #7a5a10;background:#2a1f05;color:#f0c040;font-size:14px;font-family:inherit;
  text-align:left;cursor:pointer;min-height:44px;}
`;
