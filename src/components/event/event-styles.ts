/**
 * Gemeinsame Styles der Event-Seiten (Angebot + Danke). Weiß, Typografie, schwarze Karte,
 * eine Pastell-Regenbogen-Linie (Styleguide aus dem App-Intro, Farben wie NEWS_RAINBOW_STOPS).
 * Große Schrift und große Bedienelemente: die Zielgruppe ist älter und technisch nicht fit.
 */
export const EVENT_RAINBOW = 'linear-gradient(90deg, #F4B9AE 0%, #F5DBA2 35%, #CBE6CD 68%, #B8D2F1 100%)'
/** Flieder-Akzent wie auf der Startseite (HeroSection accent/eyebrow) */
export const EVENT_ACCENT = '#6B4FD8'
/** Gespiegelte Stops, damit die Bewegung der Leiste oben nahtlos hin und her läuft */
export const EVENT_RAINBOW_FLOW = 'linear-gradient(90deg, #F4B9AE, #F5DBA2, #CBE6CD, #B8D2F1, #CBE6CD, #F5DBA2, #F4B9AE)'

export const EVENT_CSS = `
  @font-face { font-family: 'Plein'; src: url('/fonts/Plein-Regular.otf') format('opentype'); font-weight: 400; font-display: swap; }
  @font-face { font-family: 'Plein'; src: url('/fonts/Plein-Medium.otf') format('opentype'); font-weight: 500; font-display: swap; }
  .ev { --ink: #111111; --body: #3D3D3D; --muted: #6F6F6F; --faint: #A3A3A3; --line: #E7E5E4; --soft: #F7F6F4;
        --rainbow: ${EVENT_RAINBOW};
        min-height: 100vh; background: #fff; color: var(--body);
        font-family: var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
        font-size: 17px; line-height: 1.55; -webkit-font-smoothing: antialiased; }
  .ev * { box-sizing: border-box; }
  .ev-top { height: 4px; width: 100%; background: ${EVENT_RAINBOW_FLOW}; background-size: 300% 100%; animation: ev-flow 18s ease-in-out infinite alternate; }
  @keyframes ev-flow { from { background-position: 0% 50%; } to { background-position: 100% 50%; } }
  @media (prefers-reduced-motion: reduce) { .ev-top { animation: none; } }
  .ev-head { display: flex; justify-content: center; padding: 24px 20px 10px; }
  .ev-head img { height: 26px; width: auto; display: block; }
  .ev-main { max-width: 480px; margin: 0 auto; padding: 26px 20px 60px; }
  .ev-cd { display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); margin: 0 0 6px; }
  .ev-cd div { padding: 14px 0 12px; text-align: center; border-left: 1px solid var(--line); }
  .ev-cd div:first-child { border-left: 0; }
  .ev-cd b { display: block; font-family: 'Plein', var(--font-geist-sans), sans-serif; font-size: 40px; font-weight: 500; letter-spacing: -1.5px; line-height: 1; color: var(--ink); font-variant-numeric: tabular-nums; }
  .ev-cd span { display: block; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); margin-top: 7px; }
  .ev-cd-label { text-align: center; font-size: 14px; color: var(--muted); margin: 0 0 26px; }
  .ev-ended { background: var(--soft); border: 1px solid var(--line); border-radius: 16px; padding: 16px 18px; font-size: 16px; color: var(--ink); margin: 0 0 24px; text-align: center; }
  .ev-h1 { font-family: 'Plein', var(--font-geist-sans), sans-serif; font-size: clamp(30px, 8vw, 36px); line-height: 1.12; letter-spacing: -0.02em; color: var(--ink); font-weight: 500; text-align: center; margin: 0 0 12px; text-wrap: balance; }
  .ev-h1 .c { color: ${EVENT_ACCENT}; }
  .ev-sub { font-size: 17px; color: var(--body); text-align: center; margin: 0 0 24px; }
  .ev-seg { display: flex; background: var(--soft); border: 1px solid var(--line); border-radius: 999px; padding: 4px; margin: 0 0 16px; }
  .ev-seg button { flex: 1; border: 0; background: transparent; border-radius: 999px; padding: 12px 6px; font: inherit; font-size: 15px; font-weight: 600; color: var(--muted); cursor: pointer; }
  .ev-seg button[aria-pressed="true"] { background: var(--ink); color: #fff; }
  .ev-seg button em { font-style: normal; font-size: 12px; font-weight: 600; margin-left: 6px; opacity: .85; }
  .ev-card { position: relative; overflow: hidden; background: #111; color: #fff; border-radius: 24px; padding: 24px 22px 20px; margin: 0 0 16px; }
  .ev-card::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 3px; background: var(--rainbow); }
  .ev-card .n { font-size: 12px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,.55); margin: 0 0 12px; }
  .ev-card .p { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
  .ev-card .s { font-size: 18px; color: rgba(255,255,255,.4); text-decoration: line-through; }
  .ev-card .b { font-family: 'Plein', var(--font-geist-sans), sans-serif; font-size: 54px; font-weight: 500; letter-spacing: -0.03em; line-height: 1; color: #fff; }
  .ev-card .u { font-size: 14px; color: rgba(255,255,255,.5); }
  .ev-card .per { font-size: 16px; color: #fff; font-weight: 500; margin: 10px 0 2px; }
  .ev-card .f { font-size: 13.5px; color: rgba(255,255,255,.6); line-height: 1.5; margin: 0 0 16px; }
  .ev-card .sites { border-top: 1px solid rgba(255,255,255,.14); padding-top: 14px; }
  .ev-card .sites b { display: block; color: #fff; font-size: 16px; font-weight: 600; margin-bottom: 4px; }
  .ev-card .sites span { color: rgba(255,255,255,.72); font-size: 14px; line-height: 1.5; }
  .ev-field { display: block; margin: 0 0 12px; }
  .ev-field span { display: block; font-size: 14px; font-weight: 600; color: var(--ink); margin: 0 0 6px; }
  .ev-field input { width: 100%; border: 1.5px solid var(--line); border-radius: 14px; padding: 15px 16px; font: inherit; font-size: 18px; color: var(--ink); background: #fff; }
  .ev-field .ev-hint { display: block; font-size: 13px; font-weight: 400; color: var(--muted); line-height: 1.45; margin: 6px 0 0; }
  .ev-field .ev-hint b { display: inline; color: var(--ink); font-weight: 600; font-size: inherit; margin: 0; }
  .ev-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .ev-field input:focus { outline: 3px solid #B8D2F1; outline-offset: 1px; border-color: var(--ink); }
  .ev-btn { display: block; width: 100%; border: 0; background: var(--ink); color: #fff; border-radius: 999px; padding: 18px; font: inherit; font-size: 18px; font-weight: 600; cursor: pointer; margin: 6px 0 10px; }
  .ev-btn:disabled { opacity: .6; cursor: wait; }
  .ev-fine { font-size: 13px; color: var(--muted); text-align: center; line-height: 1.5; margin: 0 0 18px; }
  .ev-err { background: #FFF4F2; border: 1px solid #F3C4BB; color: #8A2E1F; border-radius: 14px; padding: 14px 16px; font-size: 15.5px; margin: 0 0 14px; line-height: 1.5; }
  .ev-err a { color: inherit; font-weight: 600; }
  .ev-ok { background: #F0FDF4; border: 1px solid #BBF7D0; color: #166534; border-radius: 14px; padding: 14px 16px; font-size: 15.5px; margin: 0 0 14px; line-height: 1.5; }
  .ev-alt { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 6px 10px; margin: 0 0 36px; font-size: 14px; color: var(--muted); }
  .ev-alt > span { flex-basis: 100%; text-align: center; }
  .ev-alt button { border: 1px solid var(--line); background: #fff; border-radius: 999px; font: inherit; font-size: 14px; color: var(--body); cursor: pointer; padding: 7px 14px; }
  .ev-shots-wrap { border-top: 1px solid var(--line); padding-top: 24px; }
  .ev-shots-h { font-size: 12px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); margin: 0 0 10px; }
  .ev-shots { display: flex; gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory; padding: 2px 2px 10px; margin: 0 -20px 4px; padding-left: 20px; padding-right: 20px; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  .ev-shots::-webkit-scrollbar { display: none; }
  .ev-shot { flex: 0 0 66%; scroll-snap-align: start; border: 1px solid var(--line); border-radius: 16px; overflow: hidden; background: var(--soft); text-decoration: none; color: var(--ink); box-shadow: 0 1px 2px rgba(0,0,0,.04), 0 10px 28px rgba(0,0,0,.06); }
  .ev-shot .img { aspect-ratio: 16 / 10; background: #EDEBE8 center top / cover no-repeat; display: block; }
  .ev-shot .cap { display: flex; flex-direction: column; gap: 1px; padding: 10px 14px; font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; }
  .ev-shot .cap small { font-weight: 400; color: var(--muted); font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; }
  .ev-shots-label { font-size: 14px; color: var(--muted); text-align: center; margin: 4px 0 28px; }
  .ev-foot { text-align: center; font-size: 13px; color: var(--faint); padding: 0 20px 40px; }
  .ev-foot a { color: var(--faint); text-decoration: underline; text-underline-offset: 3px; margin: 0 6px; }
  .ev-steps { list-style: none; padding: 0; margin: 20px 0 0; counter-reset: s; }
  .ev-steps li { counter-increment: s; display: grid; grid-template-columns: 40px 1fr; column-gap: 14px; padding: 16px 0; border-top: 1px solid var(--line); }
  .ev-steps li::before { content: counter(s); width: 36px; height: 36px; border-radius: 999px; background: var(--ink); color: #fff; font-weight: 600; font-size: 16px; display: flex; align-items: center; justify-content: center; grid-row: 1 / span 2; }
  .ev-steps li.done::before { content: "✓"; background: #166534; }
  .ev-steps b { display: block; color: var(--ink); font-size: 17px; margin-bottom: 2px; }
  .ev-steps span { display: block; font-size: 15.5px; color: var(--body); line-height: 1.5; }
  .ev-steps a { color: var(--ink); font-weight: 600; }
  .ev-mailbox { background: var(--soft); border: 1px solid var(--line); border-radius: 16px; padding: 14px 18px; margin: 18px 0; text-align: center; }
  .ev-mailbox small { display: block; font-size: 13px; color: var(--muted); margin-bottom: 4px; }
  .ev-mailbox b { font-size: 19px; color: var(--ink); word-break: break-all; }
  .ev-pw { position: relative; }
  .ev-pw button { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); border: 0; background: none; font: inherit; font-size: 14px; color: var(--muted); cursor: pointer; padding: 6px; }
  .ev-pw input { padding-right: 90px; }
  @media (prefers-reduced-motion: no-preference) { .ev-shots { scroll-behavior: smooth; } }
`
