#!/usr/bin/env python3
"""
Übersetzt die DE-Strings des PM-Business-Templates (source.json + attrs.json) in die Zielsprachen.
Ergebnis je Sprache: i18n/{lang}.json  {"strings": {de: xx}, "attrs": {de: xx}}
Nur fehlende Einträge werden übersetzt (Cache nach DE-Text). Die englische Fassung aus dem Template
wird als Zweitquelle mitgegeben, damit Ton und Bedeutung eindeutig sind.
Aufruf: OPENAI_API_KEY=… python3 translate.py [lang ...]   (nicht parallel starten: OpenAI 429)
"""
import json, os, sys, re, time, urllib.request
HERE=os.path.dirname(os.path.abspath(__file__))
LANGS={'en':'English','it':'Italian','ru':'Russian','uk':'Ukrainian','pl':'Polish','bg':'Bulgarian','hi':'Hindi'}
MODEL=os.environ.get('I18N_MODEL','gpt-5.5-2026-04-23')
KEY=os.environ['OPENAI_API_KEY']
SYSTEM="""You translate the copy of a personal landing page on which a PM-International team partner invites people to build a side income by recommending wellness products (referral marketing, "recommend what you use yourself", no selling, no pressure, 30-day money-back trial, a German family business founded in 1993). The German source is warm, colloquial, personal ("du"), short sentences, no corporate or MLM-recruiter tone.
Rules:
- Write natural, idiomatic, everyday {lang} as a native speaker would say it to a friend. Informal/personal register (informal "you" where the language has it; Hindi: आप, polite but warm; Russian/Ukrainian/Polish/Bulgarian: informal singular "ты/ти/ty/ти"). Avoid literal, word-by-word German sentence structure; prefer how people actually talk.
- Keep the meaning exact. Do not add, drop, strengthen or soften claims (no earnings promises, no health claims beyond the source).
- Keep EVERY placeholder exactly as is: {{vorname}}, {{nachname}}, {{#if ...}}, {{/if}}, {{#unless ...}}, {{/unless}}, {{{...}}} etc. Never translate inside braces. Text inside {{#if partner_modus=duo}}…{{/if}} addresses two people (a couple/team), text inside {{#unless partner_modus=duo}}…{{/unless}} one person: use the matching singular/plural forms.
- Keep HTML tags and attributes exactly (e.g. <strong>, <br>, <span class="accent">, <a href="...">); translate only the text between tags.
- Keep product and brand names unchanged: PM-International, FitLine, PowerCocktail, Activize, Restorate, Basics. Keep "FAQ".
- Numbers, units, currencies unchanged. "€" stays.
- Keep the length similar (UI labels, nav links and buttons must stay short). Button labels stay short imperatives.
- Typographic quotes and punctuation of the target language. No trailing periods added to labels that had none. Keep the ellipsis character "…" where the source has it.
- Return ONLY a JSON object mapping each input id (string) to the translation."""
def call(lang, items, kind):
    msgs=[{"role":"system","content":SYSTEM.replace('{lang}',LANGS[lang])},
          {"role":"user","content":f"Target language: {LANGS[lang]} ({lang}). Context: {kind}. Translate the German strings; the English version is given only as a reference for meaning and tone. Input JSON (id → {{de, en}}):\n"+json.dumps(items,ensure_ascii=False)}]
    body={"model":MODEL,"messages":msgs,"response_format":{"type":"json_object"}}
    for attempt in range(4):
        try:
            req=urllib.request.Request('https://api.openai.com/v1/chat/completions',data=json.dumps(body).encode(),headers={'Authorization':'Bearer '+KEY,'Content-Type':'application/json'})
            d=json.load(urllib.request.urlopen(req,timeout=600))
            out=json.loads(d['choices'][0]['message']['content'])
            if all(str(k) in out and isinstance(out[str(k)],str) for k in items): return {str(k):out[str(k)] for k in items}
            print('  fehlende ids, retry', file=sys.stderr)
        except Exception as e:
            print('  fehler', e, file=sys.stderr); time.sleep(5*(attempt+1))
    raise SystemExit('Übersetzung fehlgeschlagen: '+lang)
def ok(de, xx):
    ph=lambda t: sorted(re.findall(r'\{\{[^}]*\}\}', t)); tg=lambda t: sorted(re.findall(r'<[a-zA-Z/][^>]*>', t))
    return ph(de)==ph(xx) and len(tg(de))==len(tg(xx))
src=json.load(open(os.path.join(HERE,'source.json'))); attrs=json.load(open(os.path.join(HERE,'attrs.json')))
en_of={x['de']:x['en'] for x in src}
for lang in (sys.argv[1:] or [l for l in LANGS if l!='en']):
    path=os.path.join(HERE,f'{lang}.json')
    cur=json.load(open(path)) if os.path.exists(path) else {"strings":{},"attrs":{}}
    todo=[x for x in src if x['de'] not in cur['strings']]
    print(lang, 'zu übersetzen:', len(todo), 'Strings,', len([a for a in attrs if a not in cur['attrs']]), 'Attribute')
    for i in range(0,len(todo),40):
        chunk=todo[i:i+40]; res=call(lang,{str(x['id']):{'de':x['de'],'en':x['en']} for x in chunk},'website texts: headings, paragraphs, buttons, FAQ, form steps')
        for x in chunk:
            t=res[str(x['id'])]
            if not ok(x['de'],t): print('  WARN Platzhalter/Tags weichen ab:', x['id'], repr(t[:60]), file=sys.stderr)
            cur['strings'][x['de']]=t
        json.dump(cur,open(path,'w'),ensure_ascii=False,indent=1); print(f'  {min(i+40,len(todo))}/{len(todo)}')
    atodo=[a for a in attrs if a not in cur['attrs']]
    for i in range(0,len(atodo),60):
        chunk=atodo[i:i+60]; res=call(lang,{str(j):{'de':a,'en':en_of.get(a,'')} for j,a in enumerate(chunk)},'HTML attributes and meta: input placeholders, image alt texts, aria-labels, page title, meta description (short)')
        for j,a in enumerate(chunk): cur['attrs'][a]=res[str(j)]
        json.dump(cur,open(path,'w'),ensure_ascii=False,indent=1)
    print(lang,'fertig')
