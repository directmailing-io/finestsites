#!/usr/bin/env python3
"""Baut templates/pm-beauty/index.html aus den Teilen in src/ (alphabetisch).

  /*@@REUSE_CSS@@*/   → _reuse.css   (Leiste, Kontakt-Fenster, Formular, Fußzeile … aus dem cellRESET-Template)
  <!--@@COOKIE@@-->   → _cookie.html (DSGVO-Cookie-Hinweis, identisch mit den anderen Templates)

Aufruf: python3 templates/pm-beauty/build.py
"""
from pathlib import Path

d = Path(__file__).parent
parts = sorted((d / 'src').glob('*.html'))
src = '\n'.join(p.read_text() for p in parts)
reuse = (d / '_reuse.css').read_text()
cookie = (d / '_cookie.html').read_text()
assert '/*@@REUSE_CSS@@*/' in src and '<!--@@COOKIE@@-->' in src
out = src.replace('/*@@REUSE_CSS@@*/', reuse).replace('<!--@@COOKIE@@-->', cookie)

def strip_en(html):
    """Entfernt alle <span class="l-en">…</span> inkl. verschachtelter Spans (Daniel, 29.10.2026: erst DE fertig, dann übersetzen)."""
    import re
    out, i = [], 0
    while True:
        j = html.find('<span class="l-en">', i)
        if j < 0: out.append(html[i:]); break
        out.append(html[i:j])
        depth, k = 0, j
        for m in re.finditer(r'<span\b[^>]*>|</span>', html[j:]):
            depth += 1 if m.group(0).startswith('<span') else -1
            if depth == 0: k = j + m.end(); break
        i = k
    return ''.join(out)
out = strip_en(out)
# Sprachschalter ohne Englisch ausblenden
out = out.replace('<div class="lang-switch" role="group" aria-label="Sprache / Language">', '<div class="lang-switch" role="group" aria-label="Sprache / Language" hidden>')
(d / 'index.html').write_text(out)
print('index.html:', len(out.splitlines()), 'Zeilen aus', len(parts), 'Teilen')
