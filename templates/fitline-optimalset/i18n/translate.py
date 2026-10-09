#!/usr/bin/env python3
"""
Übersetzt die DE-Strings des Optimalset-Templates (source.json + attrs.json) in die Zielsprachen.
Ergebnis je Sprache: i18n/{lang}.json  {"strings": {de: xx}, "attrs": {de: xx}}
Nur fehlende Einträge werden übersetzt (Cache nach DE-Text) — bei Textänderungen am Template einfach erneut laufen lassen.
Aufruf: OPENAI_API_KEY=… python3 translate.py [lang ...]
"""
import json, os, sys, re, time, urllib.request
HERE=os.path.dirname(os.path.abspath(__file__))
LANGS={'en':'English','it':'Italian','ru':'Russian','uk':'Ukrainian','pl':'Polish','bg':'Bulgarian','hi':'Hindi'}
MODEL=os.environ.get('I18N_MODEL','gpt-5.5-2026-04-23')
KEY=os.environ['OPENAI_API_KEY']
SYSTEM="""You translate marketing copy for a personal recommendation website of a FitLine (PM-International) team partner. The German source is warm, colloquial, personal ("du"), short sentences, no corporate tone.
Rules:
- Translate into natural, idiomatic, everyday {lang} as a native speaker would write to a friend. Keep the informal/personal register (informal "you" where the language has it; Hindi: तुम/आप as natural for friendly marketing — use आप politely but warm).
- Keep meaning exact. Do not add, drop or soften claims. No marketing exaggeration beyond the source.
- Keep EVERY placeholder exactly as is: {{vorname}}, {{nachname}}, {{#if ...}}, {{/if}}, {{{...}}} etc. Never translate inside braces.
- Keep HTML tags and attributes exactly (e.g. <strong>, <br>, <a href="...">); translate only the text between tags.
- Keep product and brand names unchanged: FitLine, PowerCocktail, Activize, Restorate, Basics, Optimalset (translate "Optimalset" as the product name "Optimalset"), PM-International, Joghurt-Drink → keep as product name if capitalised product, Yoghurt maker etc. may be translated when generic.
- Numbers, units, currencies unchanged. "€" stays.
- Keep the length similar (UI labels must stay short). Button labels stay short imperatives.
- Typographic quotes of the target language. No trailing periods added to labels that had none.
- Return ONLY a JSON object mapping each input id (string) to the translation."""
def call(lang, items, kind):
    msgs=[{"role":"system","content":SYSTEM.replace('{lang}',LANGS[lang])},
          {"role":"user","content":f"Target language: {LANGS[lang]} ({lang}). Context: {kind}. Translate these German strings. Input JSON (id → German):\n"+json.dumps(items,ensure_ascii=False)}]
    body={"model":MODEL,"messages":msgs,"response_format":{"type":"json_object"}}
    for attempt in range(4):
        try:
            req=urllib.request.Request('https://api.openai.com/v1/chat/completions',data=json.dumps(body).encode(),headers={'Authorization':'Bearer '+KEY,'Content-Type':'application/json'})
            d=json.load(urllib.request.urlopen(req,timeout=600))
            out=json.loads(d['choices'][0]['message']['content'])
            if all(str(k) in out for k in items): return {str(k):out[str(k)] for k in items}
            print('  fehlende ids, retry', file=sys.stderr)
        except Exception as e:
            print('  fehler', e, file=sys.stderr); time.sleep(5*(attempt+1))
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
