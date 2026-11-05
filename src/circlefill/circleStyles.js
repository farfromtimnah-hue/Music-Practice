// CSS for the hand, stickers, reveal and games. Added into the App stylesheet.
// Motion rule: only transform and opacity, under 300ms, off for reduced motion.
export const CG_CSS = `
/* CIRCLE GAMES */
.cf-circle-sm{max-width:200px !important;}
.cf-nums{grid-template-columns:repeat(4,1fr) !important;}
.cf-nums .multi-btn,.cf-notes .multi-btn,.cg-grp .multi-btn{min-height:56px;font-size:20px;}
.cf-notes{grid-template-columns:repeat(4,1fr) !important;}
.cg-grp-lbl{font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--muted);margin:4px 0 -4px;}
.cg-ask{font-size:17px;color:var(--text);text-align:center;line-height:1.4;}
.cg-step,.cg-answer,.cg-know-pane{display:flex;flex-direction:column;gap:12px;}
.cg-hand{display:flex;flex-direction:column;gap:8px;align-items:center;}
.cg-hand-svg{width:100%;max-width:340px;display:block;touch-action:manipulation;}
.cg-hand-svg g[data-finger]{outline:none;}
.cg-lock{animation:cgPop .22s ease-out;transform-box:fill-box;transform-origin:center;}
.cg-shake{animation:shake .3s;}
.cg-msg{min-height:22px;font-size:15px;color:var(--muted);text-align:center;}
.cg-msg.bad{color:var(--text);}
.cg-tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;width:100%;max-width:340px;}
.cg-tile{min-height:56px;border-radius:12px;border:1.5px solid var(--border);background:var(--surface);color:var(--text);font-family:'Oswald',sans-serif;font-size:26px;font-weight:700;cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none;transition:transform .12s ease-out,opacity .12s ease-out;}
.cg-tile:active{transform:scale(.97);}
.cg-tile.sel{border-color:var(--gold);color:var(--gold);}
.cg-tile.glow{border-color:var(--gold);color:var(--gold);animation:cgPulse 1s ease-in-out infinite;}
.cg-tile:focus-visible,.cg-btn:focus-visible,.cg-menu-btn:focus-visible,.cg-sl:focus-visible{outline:2px solid var(--gold);outline-offset:2px;}
.cg-tile:disabled,.cg-btn:disabled,.cg-menu-btn:disabled{opacity:.4;cursor:default;}
.cg-ghost{position:fixed;left:0;top:0;width:56px;height:56px;border-radius:12px;background:var(--surface2);border:1.5px solid var(--gold);color:var(--gold);display:flex;align-items:center;justify-content:center;font-family:'Oswald',sans-serif;font-size:26px;font-weight:700;pointer-events:none;z-index:50;}
.cg-callout{display:flex;align-items:center;justify-content:center;gap:8px;background:var(--surface2);border:1.5px solid var(--border);border-radius:12px;padding:10px 14px;font-size:16px;color:var(--text);}
.cg-know{min-height:56px;}
.cg-answer{align-items:center;text-align:center;}
.cg-answer-big{font-family:'Oswald',sans-serif;font-size:96px;font-weight:700;color:var(--gold);line-height:1;animation:cgPop .25s ease-out;}
.cg-answer-line{font-size:18px;color:var(--text);}
.cg-answer .cg-next,.cg-reveal .cg-next{min-height:56px;}
.cg-sticker{border-radius:50%;border:2px solid var(--border);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;box-sizing:border-box;flex:none;}
.cg-sticker.off{background:transparent;border-style:dashed;color:var(--muted);}
.cg-sticker.pop{animation:cgPop .28s ease-out;}
.cg-sticker-emoji{line-height:1;}
.cg-sticker-name{font-family:'Oswald',sans-serif;font-weight:600;color:var(--text);line-height:1;}
.cg-sticker.off .cg-sticker-name{color:var(--muted);font-size:18px !important;}
.cg-reveal{display:flex;flex-direction:column;align-items:center;gap:14px;padding-top:6px;}
.cg-reveal-title{font-family:'Oswald',sans-serif;font-size:22px;color:var(--gold);letter-spacing:1px;}
.cg-line{display:flex;gap:6px;justify-content:center;flex-wrap:nowrap;}
.cg-note{font-family:'Oswald',sans-serif;font-size:24px;font-weight:700;color:var(--text);min-width:30px;text-align:center;padding:4px 2px;border-radius:8px;transition:transform .15s ease-out,opacity .15s ease-out;}
.cg-note.acc.sharp{color:var(--sharp);}
.cg-note.acc.flat{color:var(--flat);}
.cg-note.now{transform:scale(1.2);background:var(--surface2);}
.cg-actions{display:flex;gap:10px;width:100%;}
.cg-btn{flex:1;min-height:56px;border-radius:12px;border:1.5px solid var(--border);background:var(--surface);color:var(--text);font-family:'Oswald',sans-serif;font-size:15px;font-weight:600;letter-spacing:1px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:transform .12s ease-out;}
.cg-btn:active{transform:scale(.97);}
.cg-btn[aria-pressed="true"]{border-color:var(--gold);color:var(--gold);}
.cg-kb{width:100%;animation:cgIn .22s ease-out;}
.cg-menu{display:flex;flex-direction:column;gap:12px;}
.cg-menu-btn{min-height:64px;border-radius:12px;border:1.5px solid var(--border);background:var(--surface);color:var(--text);font-family:'Oswald',sans-serif;font-size:19px;font-weight:600;letter-spacing:1px;cursor:pointer;width:100%;transition:transform .12s ease-out;}
.cg-menu-btn:active{transform:scale(.97);}
.cg-menu-btn.back{color:var(--muted);min-height:56px;font-size:15px;}
.cg-stickers{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;justify-items:center;}
.cg-count{font-family:'Oswald',sans-serif;color:var(--muted);text-align:center;font-size:15px;}
.cg-slots{display:flex;gap:10px;justify-content:center;}
.cg-sl{min-width:56px;min-height:56px;border-radius:12px;border:1.5px solid var(--border);background:var(--surface);color:var(--text);font-family:'Oswald',sans-serif;font-size:22px;font-weight:700;cursor:pointer;}
.cg-sl:active{transform:scale(.97);}
.cg-sl.done{color:var(--green);border-color:rgba(129,199,132,.5);cursor:default;}
.cg-token{transition:transform .28s ease-out;}
.cg-done{display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;}
.cg-done-title{font-family:'Oswald',sans-serif;font-size:28px;color:var(--gold);}
@keyframes cgPop{0%{transform:scale(.85);opacity:.4}100%{transform:scale(1);opacity:1}}
@keyframes cgIn{0%{transform:translateY(8px);opacity:0}100%{transform:translateY(0);opacity:1}}
@keyframes cgPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
@media (prefers-reduced-motion: reduce){
.cg-lock,.cg-shake,.cg-answer-big,.cg-sticker.pop,.cg-kb,.cg-tile.glow,.cg-pbtn.bad{animation:none !important;}
.cg-token,.cg-note,.cg-tile,.cg-btn,.cg-menu-btn{transition:none !important;}
}
`;
