#!/usr/bin/env python3
"""
Inject theme switching into index.html.

Strategy:
  1. Add new CSS variables for the colors that need rgba() variants
     (so we can use rgba(var(--primary-rgb), 0.X) everywhere instead of hardcoding).
  2. Replace all hardcoded GREEN color literals in the CSS with CSS variables.
  3. Inject conditional :root override blocks for red + orange themes.
  4. Make <meta name="theme-color"> conditional.
"""
import re
from pathlib import Path

ROOT = Path(__file__).parent.parent
SRC = ROOT / "index.html"
html = SRC.read_text(encoding="utf-8")

# ─── 1. Hardcoded color → CSS variable replacements (green theme) ──────────────
# Both spaced and non-spaced rgba variants exist; cover both.
REPLACEMENTS = [
    # Primary green: #2F8650 = rgb(47, 134, 80)
    (r"rgba\(47, ?134, ?80, ?", "rgba(var(--primary-rgb), "),
    (r"#2F8650\b", "var(--primary)"),
    # Primary deep: #1F6037 = rgb(31, 96, 55)
    (r"rgba\(31, ?96, ?55, ?", "rgba(var(--primary-deep-rgb), "),
    (r"#1F6037\b", "var(--primary-deep)"),
    # Primary soft: #B8E3C7 = rgb(184, 227, 199)
    (r"rgba\(184, ?227, ?199, ?", "rgba(var(--primary-soft-rgb), "),
    (r"#B8E3C7\b", "var(--primary-soft)"),
    # Slight green tone variants seen in NTC SVG (51, 137, 80 / 178, 226, 198)
    (r"rgba\(51, ?137, ?80, ?", "rgba(var(--primary-rgb), "),
    (r"rgba\(178, ?226, ?198, ?", "rgba(var(--primary-soft-rgb), "),
    # Dark footer/modal gradient: #1C4030, #11281A, #080F0A
    (r"#1C4030\b", "var(--primary-dark-1)"),
    (r"#11281A\b", "var(--primary-dark-2)"),
    (r"#080F0A\b", "var(--primary-dark-3)"),
]

count = 0
for pat, rep in REPLACEMENTS:
    new_html, n = re.subn(pat, rep, html)
    if n:
        count += n
        html = new_html
print(f"✓ Replaced {count} hardcoded color tokens with CSS variables")

# ─── 2. Add new variables to :root ────────────────────────────────────────────
old_root = """  --primary: #2F8650;
  --primary-deep: #1F6037;
  --primary-soft: #B8E3C7;
  --accent: #338950;"""
new_root = """  --primary: #2F8650;
  --primary-rgb: 47, 134, 80;
  --primary-deep: #1F6037;
  --primary-deep-rgb: 31, 96, 55;
  --primary-soft: #B8E3C7;
  --primary-soft-rgb: 184, 227, 199;
  --accent: #338950;
  --primary-dark-1: #1C4030;
  --primary-dark-2: #11281A;
  --primary-dark-3: #080F0A;"""
if old_root in html:
    html = html.replace(old_root, new_root)
    print("✓ Added RGB + dark variables to :root")
else:
    print("ERROR: :root block not found exactly as expected")

# ─── 3. Add conditional theme override blocks at end of :root → after closing } ─
override_blocks = """
{{#if farbthema=rot}}
:root {
  --primary: #C0392B;
  --primary-rgb: 192, 57, 43;
  --primary-deep: #8B2315;
  --primary-deep-rgb: 139, 35, 21;
  --primary-soft: #F5C4BC;
  --primary-soft-rgb: 245, 196, 188;
  --accent: #C0392B;
  --bg: #FDF5F3;
  --surface-warm: #F9EAE7;
  --border: #EDD5D0;
  --primary-dark-1: #3D0A0A;
  --primary-dark-2: #230808;
  --primary-dark-3: #0F0303;
}
{{/if}}
{{#if farbthema=orange}}
:root {
  --primary: #D4851C;
  --primary-rgb: 212, 133, 28;
  --primary-deep: #A8640E;
  --primary-deep-rgb: 168, 100, 14;
  --primary-soft: #F5C870;
  --primary-soft-rgb: 245, 200, 112;
  --accent: #D4851C;
  --primary-dark-1: #3D2A0A;
  --primary-dark-2: #231808;
  --primary-dark-3: #0F0B03;
}
{{/if}}"""

# Find the :root { ... } block end. Locate `--max-narrow: 820px;` then closing `}`
marker = "  --max-narrow: 820px;\n}"
if marker in html:
    html = html.replace(marker, marker + override_blocks)
    print("✓ Injected conditional theme override blocks")
else:
    print("ERROR: end of :root block not found")

# ─── 4. Theme-color meta tag conditional ──────────────────────────────────────
old_meta = '<meta name="theme-color" content="#1F6037">'
new_meta = """<meta name="theme-color" content="{{#if farbthema=rot}}#8B2315{{/if}}{{#if farbthema=orange}}#A8640E{{/if}}{{#unless farbthema=rot}}{{#unless farbthema=orange}}#1F6037{{/unless}}{{/unless}}">"""
if old_meta in html:
    html = html.replace(old_meta, new_meta)
    print("✓ Made theme-color meta tag conditional")

# Write
SRC.write_text(html, encoding="utf-8")
print(f"\n✅ {SRC} updated")
