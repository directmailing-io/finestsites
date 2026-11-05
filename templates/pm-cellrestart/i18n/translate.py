#!/usr/bin/env python3
"""
Übersetzt die DE-Strings des Optimalset-Templates (source.json + attrs.json) in die Zielsprachen.
Ergebnis je Sprache: i18n/{lang}.json  {"strings": {de: xx}, "attrs": {de: xx}}
Nur fehlende Einträge werden übersetzt (Cache nach DE-Text) — bei Textänderungen am Template einfach erneut laufen lassen.
Aufruf: OPENAI_API_KEY=… python3 translate.py [lang ...]
"""
import json, os, sys, re, time, urllib.request
HERE=os.path.dirname(os.path.abspath(__file__))
LANGS={'en':'English','it':'Italian','ru':'Russian','uk':'Ukrainian','pl':'Polish','bg':'Bulgarian','hi':'Hindi',
       'tr':'Turkish','sr':'Serbian','es':'Spanish','zh':'Chinese','ko':'Korean'}
# Zusatzhinweise je Sprache (Register, Schrift, Varietät) – seit 05.11.2026 für tr/sr/es/zh/ko
NOTES={'tr':'Turkish as spoken in Turkey today; informal "sen"; natural everyday Turkish, not stiff translationese; Turkish punctuation and typographic quotes (“…”).',
       'sr':'Serbian in LATIN script (latinica), ekavian standard as used in Serbia; informal "ti"; natural everyday Serbian, the way a person from Belgrade would write to a friend; Serbian quotes „…“.',
       'es':'Spanish as spoken in Spain (neutral, no regional slang), informal "tú"; natural, warm everyday Spanish; opening ¿ ¡ where needed; quotes «…» or “…”.',
       'zh':'Simplified Chinese (Mainland China), natural spoken Mandarin style as on a modern Chinese consumer website; informal 你 (never 您 unless unavoidable); full-width Chinese punctuation (，。？！：“”); no spaces between Chinese characters and placeholders are kept as is.',
       'ko':'Korean as used on modern Korean consumer websites: polite informal 해요체 (not 합니다체, not 반말), warm and natural; Korean spacing rules; keep headlines short; use Korean typographic conventions (no full-width punctuation, normal quotes).'}
MODEL=os.environ.get('I18N_MODEL','gpt-5.5-2026-04-23')
KEY=os.environ['OPENAI_API_KEY']
SYSTEM="""You translate the website of a FitLine (PM-International) team partner about the "cellRESET" metabolism reset programme ("Stoffwechselkur"): four phases (preparation, activation with a keto-like eating principle, stabilisation, everyday routine), four fixed meals a day, no snacking, no sugar/salt/dairy in the core phase, patented FitLine supplements (NTC = nutrient transport concept), Cologne List and ELAB lab testing, a self-check form, WhatsApp contact, testimonials, FAQ. The German is warm, colloquial, personal ("du"), short punchy sentences, honest tone, no hype.
How to translate:
- FIRST understand what each sentence means and what it is for on the page (headline, button, FAQ answer, legal note). THEN say it the way a native {lang} speaker would naturally say it to a friend in everyday speech. Never translate word for word; drop German sentence structure, idioms and word order; choose the idiom, rhythm and particles that are natural in {lang}. A native reader must feel the page was written in {lang}.
- Keep meaning, facts and tone exactly. Health and effect statements must not become stronger, more certain or more medical than the German (keep hedges like "kann", "viele berichten"). Nothing added, nothing dropped.
- Brand and product names unchanged: cellRESET, FitLine, PM-International, PowerCocktail, Activize, Restorate, Basics, ProShape, Kölner Liste (may add the local name once, e.g. "Cologne List"), ELAB, NTC (explain once if the sentence does), WhatsApp, Instagram, Facebook.
- Keep EVERY placeholder exactly: {{vorname}}, {{#if ...}}...{{/if}}, {{#unless ...}}...{{/unless}}, {{{...}}}. Blocks with partner_modus=duo mean two people speak ("wir"); the visitor is always ONE person ("du"). geschlecht=weiblich/maennlich: use feminine/masculine forms if the language has them. Never attach case endings or suffixes to a placeholder name.
- Keep HTML tags, entities (&amp; &mdash; &nbsp;) and attributes exactly; translate only text between tags. No em dashes in your own wording (use comma, period or colon); existing &mdash; entities may stay.
- UI labels and buttons short. Numbers, units and "€" unchanged. Typographic quotes of {lang}.
- Return ONLY a JSON object mapping each input id (string) to the translation."""
def call(lang, items, kind):
    msgs=[{"role":"system","content":SYSTEM.replace('{lang}',LANGS[lang])},
          {"role":"user","content":f"Target language: {LANGS[lang]} ({lang}). {NOTES.get(lang,'')} Context: {kind}. Translate these German strings. Input JSON (id → German):\n"+json.dumps(items,ensure_ascii=False)}]
    body={"model":MODEL,"messages":msgs,"response_format":{"type":"json_object"}}
    for attempt in range(8):   # 429: länger warten
        try:
            req=urllib.request.Request('https://api.openai.com/v1/chat/completions',data=json.dumps(body).encode(),headers={'Authorization':'Bearer '+KEY,'Content-Type':'application/json'})
            d=json.load(urllib.request.urlopen(req,timeout=600))
            out=json.loads(d['choices'][0]['message']['content'])
            if all(str(k) in out for k in items): return {str(k):out[str(k)] for k in items}
            print('  fehlende ids, retry', file=sys.stderr)
        except Exception as e:
            print('  fehler', e, file=sys.stderr); time.sleep(30*(attempt+1))
    raise SystemExit('Übersetzung fehlgeschlagen: '+lang)
def ok(de, xx):
    ph=lambda t: sorted(re.findall(r'\{\{[^}]*\}\}', t)); tg=lambda t: sorted(re.findall(r'<[a-zA-Z/][^>]*>', t))
    return ph(de)==ph(xx) and len(tg(de))==len(tg(xx))
src=json.load(open(os.path.join(HERE,'source.json'))); attrs=json.load(open(os.path.join(HERE,'attrs.json')))
for lang in (sys.argv[1:] or [l for l in LANGS if l!='en']):
    path=os.path.join(HERE,f'{lang}.json')
    cur=json.load(open(path)) if os.path.exists(path) else {"strings":{},"attrs":{}}
    todo=[x for x in src if x['de'] not in cur['strings']]
    print(lang, 'zu übersetzen:', len(todo), 'Strings,', len([a for a in attrs if a not in cur['attrs']]), 'Attribute')
    for i in range(0,len(todo),40):
        chunk=todo[i:i+40]; res=call(lang,{str(x['id']):x['de'] for x in chunk},'website texts: headings, paragraphs, buttons, FAQ, product descriptions')
        for x in chunk:
            t=res[str(x['id'])]
            if not ok(x['de'],t): print('  WARN Platzhalter/Tags weichen ab:', x['id'], repr(t[:60]), file=sys.stderr)
            cur['strings'][x['de']]=t
        json.dump(cur,open(path,'w'),ensure_ascii=False,indent=1); print(f'  {min(i+40,len(todo))}/{len(todo)}')
    atodo=[a for a in attrs if a not in cur['attrs']]
    for i in range(0,len(atodo),60):
        chunk=atodo[i:i+60]; res=call(lang,{str(j):a for j,a in enumerate(chunk)},'HTML attributes: input placeholders, image alt texts, aria-labels, tooltips (short)')
        for j,a in enumerate(chunk): cur['attrs'][a]=res[str(j)]
        json.dump(cur,open(path,'w'),ensure_ascii=False,indent=1)
    print(lang,'fertig')
