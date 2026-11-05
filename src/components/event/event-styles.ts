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
  .ev-card .chips { list-style: none; display: flex; flex-wrap: wrap; gap: 6px; padding: 0; margin: 10px 0 14px; }
  .ev-card .sites .choice { display: block; color: #fff; font-weight: 600; font-size: 15px; margin-bottom: 2px; }
  .ev-card .chips li { font-size: 13px; font-weight: 500; color: #fff; background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.14); border-radius: 999px; padding: 5px 11px; }
  .ev-card .chips li.soon { color: rgba(255,255,255,.55); background: transparent; border-style: dashed; }
  .ev-field { display: block; margin: 0 0 12px; }
  .ev-field span { display: block; font-size: 14px; font-weight: 600; color: var(--ink); margin: 0 0 6px; }
  .ev-field input { width: 100%; border: 1.5px solid var(--line); border-radius: 14px; padding: 15px 16px; font: inherit; font-size: 18px; color: var(--ink); background: #fff; }
  .ev-field .ev-hint { display: block; font-size: 13px; font-weight: 400; color: var(--muted); line-height: 1.45; margin: 6px 0 0; }
  .ev-field .ev-hint b { display: inline; color: var(--ink); font-weight: 600; font-size: inherit; margin: 0; }
  .ev-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .ev-field .ev-urlbox { display: block; background: #fff; border: 1px solid var(--line); border-radius: 16px; box-shadow: 0 1px 2px rgba(0,0,0,.04), 0 10px 28px rgba(0,0,0,.06); padding: 10px 10px 12px; margin: 0 0 10px; font-weight: 400; transition: border-color .2s, box-shadow .2s; }
  .ev-field .ev-urlbox.ok { border-color: #BBF7D0; box-shadow: 0 1px 2px rgba(0,0,0,.04), 0 10px 28px rgba(22,101,52,.10); }
  .ev-field .ev-urlbox.bad { border-color: #F3C4BB; }
  .ev-field .ev-urlbar { display: flex; align-items: center; gap: 8px; background: var(--soft); border-radius: 999px; padding: 10px 12px 10px 14px; font-size: 15.5px; color: var(--muted); line-height: 1.2; }
  .ev-field .ev-urlbar svg { flex: 0 0 auto; color: var(--faint); }
  .ev-field .ev-urlbar .u { display: block; min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: inherit; color: inherit; font-variant-ligatures: none; }
  .ev-field .ev-urlbar .u b { display: inline; color: var(--ink); font-weight: 600; font-size: inherit; margin: 0; }
  .ev-field .ev-urlbar .u b:empty::before { content: "dein-name"; color: var(--faint); font-weight: 500; }
  .ev-field .ev-urlbar .st { flex: 0 0 auto; width: 22px; height: 22px; border-radius: 999px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #fff; opacity: 0; transform: scale(.6); transition: opacity .2s, transform .2s; }
  .ev-field .ev-urlbox.ok .st { background: #166534; opacity: 1; transform: none; }
  .ev-field .ev-urlbox.bad .st { background: #B42318; opacity: 1; transform: none; }
  .ev-field .ev-urlbox.checking .st { background: var(--faint); opacity: 1; transform: none; }
  .ev-field .ev-urlpage { display: grid; gap: 7px; padding: 14px 10px 2px; }
  .ev-field .ev-urlpage i { display: block; height: 8px; border-radius: 4px; background: #ECEAE7; }
  .ev-field .ev-urlpage i:first-child { width: 48%; height: 10px; background: var(--ink); opacity: .85; }
  .ev-field .ev-urlpage i:nth-child(2) { width: 84%; }
  .ev-field .ev-urlpage i:nth-child(3) { width: 66%; }
  .ev-field .ev-urlpage i:last-child { width: 32%; height: 14px; border-radius: 7px; background: var(--rainbow); opacity: .9; margin-top: 2px; }
  .ev-status.ok { color: #166534; font-weight: 600; }
  .ev-status.bad { color: #8A2E1F; font-weight: 600; }
  .ev-note { margin-top: 8px !important; }
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
  /* ── Danke-Seite: Abschluss-Moment ─────────────────────────────────────────── */
  .ev-in { animation: ev-in .7s cubic-bezier(.2,.7,.2,1) both; }
  .ev-d1 { animation-delay: .15s; }
  .ev-d2 { animation-delay: .3s; }
  .ev-d3 { animation-delay: .45s; }
  @keyframes ev-in { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
  .ev-hero { text-align: center; padding: 6px 0 4px; }
  .ev-check { width: 76px; height: 76px; display: block; margin: 4px auto 18px; fill: none; stroke: var(--ink); stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
  .ev-check circle { stroke-dasharray: 190; stroke-dashoffset: 190; animation: ev-draw .9s cubic-bezier(.4,0,.2,1) .2s forwards; }
  .ev-check path { stroke-dasharray: 40; stroke-dashoffset: 40; animation: ev-draw .5s cubic-bezier(.4,0,.2,1) .9s forwards; }
  @keyframes ev-draw { to { stroke-dashoffset: 0; } }
  .ev-link { color: var(--ink); font-weight: 600; text-decoration: underline; text-underline-offset: 3px; text-decoration-color: var(--line); }
  .ev-pack { position: relative; overflow: hidden; background: #111; color: #fff; border-radius: 24px; padding: 22px 20px 20px; margin: 22px 0 10px; }
  .ev-pack::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 3px; background: var(--rainbow); }
  .ev-pack-head .k { font-size: 12px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,.55); margin: 0 0 8px; }
  .ev-pack-head b { display: block; font-family: 'Plein', var(--font-geist-sans), sans-serif; font-size: 26px; font-weight: 500; letter-spacing: -0.02em; line-height: 1.15; color: #fff; }
  .ev-pack-head span { display: block; font-size: 14px; color: rgba(255,255,255,.65); margin-top: 4px; }
  .ev-pack-sites { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 18px 0 14px; }
  .ev-pack-sites figure { margin: 0; }
  .ev-pack-sites .img { display: block; aspect-ratio: 16 / 11; border-radius: 12px; background: rgba(255,255,255,.08) center top / cover no-repeat; border: 1px solid rgba(255,255,255,.12); box-shadow: 0 10px 24px rgba(0,0,0,.35); }
  .ev-pack-sites figcaption { font-size: 11.5px; font-weight: 600; color: rgba(255,255,255,.85); margin-top: 8px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ev-pack-text { font-size: 14.5px; color: rgba(255,255,255,.72); line-height: 1.5; margin: 0; border-top: 1px solid rgba(255,255,255,.14); padding-top: 14px; }
  .ev-journey { list-style: none; padding: 0; margin: 22px 0 0; counter-reset: s; }
  .ev-journey li { counter-increment: s; position: relative; display: grid; grid-template-columns: 40px 1fr; column-gap: 14px; padding: 18px 12px 22px; margin: 0 -12px; }
  .ev-journey li::before { content: counter(s); width: 36px; height: 36px; border-radius: 999px; background: var(--ink); color: #fff; font-weight: 600; font-size: 16px; display: flex; align-items: center; justify-content: center; grid-row: 1 / span 9; box-shadow: 0 0 0 6px #fff; z-index: 1; }
  .ev-journey li::after { content: ""; position: absolute; left: 29px; top: 18px; bottom: -4px; width: 2px; background: var(--line); }
  .ev-journey li:last-child::after { display: none; }
  .ev-journey li.done::before { content: "✓"; background: #166534; }
  .ev-journey li.next::before { background: #fff; color: var(--muted); border: 2px solid var(--line); }
  .ev-journey li.next b { color: var(--muted); }
  .ev-journey li.next span { color: var(--muted); }
  .ev-journey li.active { background: var(--soft); border-radius: 22px; padding-bottom: 18px; }
  .ev-journey li.active::before { box-shadow: 0 0 0 6px var(--soft); }
  .ev-journey li.active .ev-field input { background: #fff; }
  .ev-journey > li > b { display: block; color: var(--ink); font-size: 18px; margin-bottom: 4px; font-weight: 600; line-height: 1.3; }
  .ev-journey > li > span { display: block; font-size: 15.5px; color: var(--body); line-height: 1.5; }
  .ev-login-as { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 10px 14px; margin: 6px 0 2px; font-size: 14.5px !important; color: var(--muted) !important; }
  .ev-login-as b { display: inline; color: var(--ink); font-size: inherit; margin: 0; overflow-wrap: anywhere; }
  .ev-store { display: inline-flex; align-items: center; gap: 8px; margin-top: 12px; border: 1.5px solid var(--line); border-radius: 999px; padding: 10px 16px; font-size: 14.5px; font-weight: 600; color: var(--ink); text-decoration: none; background: #fff; }
  .ev-journey li.next .ev-store { color: var(--muted); }
  @media (prefers-reduced-motion: reduce) { .ev-in, .ev-check circle, .ev-check path { animation: none; opacity: 1; transform: none; stroke-dashoffset: 0; } }
  .ev-pw { position: relative; }
  .ev-pw button { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); border: 0; background: none; font: inherit; font-size: 14px; color: var(--muted); cursor: pointer; padding: 6px; }
  .ev-pw input { padding-right: 90px; }
  @media (prefers-reduced-motion: no-preference) { .ev-shots { scroll-behavior: smooth; } }
`
