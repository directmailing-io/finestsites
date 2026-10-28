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
(d / 'index.html').write_text(out)
print('index.html:', len(out.splitlines()), 'Zeilen aus', len(parts), 'Teilen')
