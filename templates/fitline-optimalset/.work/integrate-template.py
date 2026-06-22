#!/usr/bin/env python3
"""
One-shot script: turn index.html into a FinestSites template.

What it does:
  1. Replace "Anna Krempel" → "{{vorname}} {{nachname}}"
  2. Replace stand-alone "Anna" mentions → "{{vorname}}" (Über Anna, Hi ich bin Anna)
  3. Replace anna-krempel.jpg → {{profilbild}} (general) and {{about_bild}} (about-me img only)
  4. Inject hero variant switching (v1 hotspots | v2 kitchen | v3 woman)
  5. Wrap 3 optional sections with {{#if zeige_…}}
  6. Replace 3 shop URLs with placeholders
  7. Replace personal quote with {{eigenes_zitat}}
  8. Replace about-me 4 paragraphs with rich-text {{about_me_html}}
  9. Replace Instagram link with conditional + add Facebook/WhatsApp/Phone
 10. Update form action to use site email notification

Run from template directory.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
SRC  = ROOT / "index.html"
OUT  = ROOT / "index.html"

html = SRC.read_text(encoding="utf-8")
original_len = len(html)

# ─── 1. Bulk name replacements ────────────────────────────────────────────────
# These are all visible text occurrences. "Anna Krempel" → "{{vorname}} {{nachname}}"
html = html.replace("Anna Krempel", "{{vorname}} {{nachname}}")

# "Hi, ich bin Anna." → "Hi, ich bin {{vorname}}."
html = html.replace("Hi, ich bin Anna.", "Hi, ich bin {{vorname}}.")

# "Über Anna" → "Über {{vorname}}" (3 nav occurrences)
html = html.replace("Über Anna", "Über {{vorname}}")

# OG site name typo fix (was originally a static phrase including the name)
# Already covered by Anna Krempel replacement.

# ─── 2. Profile image replacements ────────────────────────────────────────────
# Use {{about_bild}} ONLY for the about-me section image.
# All other usages get {{profilbild}}.

# About-me section img is on line ~7656 — it has class context "about-photo"
# It uses 'class="about-photo"' on the parent div.
html = re.sub(
    r'(<div class="about-photo reveal">\s*)<img src="assets/anna-krempel\.jpg" alt="[^"]*" loading="lazy">',
    r'\1<img src="{{about_bild}}" alt="{{vorname}} {{nachname}}" loading="lazy">',
    html,
    count=1,
)

# All remaining anna-krempel.jpg → {{profilbild}}
html = html.replace("assets/anna-krempel.jpg", "{{profilbild}}")

# ─── 3. Hero variant switching ────────────────────────────────────────────────
# Original v1 hero (in index.html) is one big block: image + 4 hotspots inside .hero-bg,
# then text-veil + hero-content.
# Replace JUST the contents of .hero-bg with three conditional blocks.

# Build the new .hero-bg content
hero_bg_replacement = """  <div class="hero-bg">
{{#if hero_variant=v1}}
    <img src="assets/hero.webp" alt="Glas mit angerührtem PowerCocktail und frischen Lebensmitteln" loading="eager" fetchpriority="high" decoding="async">

  <!-- Hotspot 1: Joghurt-Drink (Mason Jar links) -->
  <button class="hero-hotspot hotspot-jo" aria-label="Mehr zum Joghurt-Drink" data-tooltip="jo">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
  </button>
  <div class="hero-tooltip tooltip-jo">
    <div class="hero-tooltip-times">
      <span class="hero-tooltip-chip">Für die Verdauung</span>
      <span class="hero-tooltip-chip">Probiotisch</span>
    </div>
    <h4>Dein Probiotic-Joghurt</h4>
    <p>Mit Milchsäurekulturen für den Darmaufbau. Schmeckt cremig und macht satt.</p>
  </div>

  <!-- Hotspot 2: Restorate -->
  <button class="hero-hotspot hotspot-rt" aria-label="Mehr zum Restorate" data-tooltip="rt">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
  </button>
  <div class="hero-tooltip tooltip-rt">
    <div class="hero-tooltip-times">
      <span class="hero-tooltip-chip">Für die Nacht</span>
      <span class="hero-tooltip-chip">Erholung</span>
    </div>
    <h4>Dein Gute-Nacht-Drink</h4>
    <p>Kurz vor dem Schlafen für eine bessere Regeneration. Mit Magnesium, Kalzium und neun Vitaminen für die Nacht.</p>
  </div>

  <!-- Hotspot 3: Activize -->
  <button class="hero-hotspot hotspot-av" aria-label="Mehr zum Activize" data-tooltip="av">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
  </button>
  <div class="hero-tooltip tooltip-av">
    <div class="hero-tooltip-times">
      <span class="hero-tooltip-chip">Für deinen Kick</span>
      <span class="hero-tooltip-chip">Zuckerfrei</span>
      <span class="hero-tooltip-chip">Mit Guarana</span>
    </div>
    <h4>Dein Booster</h4>
    <p>Wenn der Akku leer ist. Mit Guarana und B-Vitaminen, ganz ohne Zucker.</p>
  </div>

  <!-- Hotspot 4: PowerCocktail -->
  <button class="hero-hotspot hotspot-pc" aria-label="Mehr zum PowerCocktail" data-tooltip="pc">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
  </button>
  <div class="hero-tooltip tooltip-pc">
    <div class="hero-tooltip-times">
      <span class="hero-tooltip-chip">Für jeden Tag</span>
      <span class="hero-tooltip-chip">Alles drin</span>
    </div>
    <h4>Dein Nährstoff-Cocktail</h4>
    <p>Dein Start in den Tag. Vitamine, Mineralstoffe und alles Wichtige in einem Glas.</p>
  </div>
{{/if}}
{{#if hero_variant=v2}}
    <img src="assets/hero-kitchen3.jpg" alt="Familie genießt gemeinsam ihren Morgendrink" loading="eager" fetchpriority="high" decoding="async">
{{/if}}
{{#if hero_variant=v3}}
    <img src="assets/hero-woman2.jpg" alt="Frau genießt ihren morgendlichen PowerCocktail" loading="eager" fetchpriority="high" decoding="async">
{{/if}}
  </div>"""

# Find and replace the original .hero-bg block (from `<div class="hero-bg">` to the closing `</div>` before `.hero-text-veil`)
pattern = re.compile(
    r'  <div class="hero-bg">\s*\n.*?\n  </div>\s*\n  <div class="hero-text-veil"></div>',
    re.DOTALL,
)
match = pattern.search(html)
if not match:
    print("ERROR: hero-bg block not found", file=sys.stderr)
    sys.exit(1)
html = html[:match.start()] + hero_bg_replacement + '\n  <div class="hero-text-veil"></div>' + html[match.end():]

# ─── 4. Wrap 3 toggleable sections with {{#if}} ───────────────────────────────
# Sections by class:
#   .section.replacement  (NOT .replacement-v2)   → zeige_was_ersetzt
#   .section.replacement.replacement-v2           → zeige_mit_optimalset
#   .section.comparison                           → zeige_vergleich

# Use regex to wrap each
def wrap_section(html_src, opening_marker, flag_key, end_marker_after=None):
    """Find <section> with given opening tag, wrap from <section> to its matching </section> + adjacent close."""
    idx = html_src.find(opening_marker)
    if idx == -1:
        print(f"WARN: section not found for marker '{opening_marker}'", file=sys.stderr)
        return html_src
    # Find matching </section>
    end_idx = html_src.find("</section>", idx)
    if end_idx == -1:
        return html_src
    end_close = end_idx + len("</section>")
    # Wrap
    before = html_src[:idx]
    section = html_src[idx:end_close]
    after = html_src[end_close:]
    return before + "{{#if " + flag_key + "}}\n" + section + "\n{{/if}}" + after

html = wrap_section(html, '<section class="section replacement">', 'zeige_was_ersetzt')
html = wrap_section(html, '<section class="section replacement replacement-v2">', 'zeige_mit_optimalset')
html = wrap_section(html, '<section class="section comparison">', 'zeige_vergleich')

# ─── 5. Shop URLs ─────────────────────────────────────────────────────────────
html = html.replace("https://www.fitline.com/de/de-de/products/9700731", "{{shop_optimalset}}")
html = html.replace("https://www.fitline.com/de/de-de/products/0708054", "{{shop_activize}}")
html = html.replace("https://www.fitline.com/de/de-de/products/9709001", "{{shop_joghurt}}")

# ─── 6. Personal quote ────────────────────────────────────────────────────────
html = html.replace(
    '"Seit 2019 Teil meines Alltags. Meine Empfehlung kommt aus Überzeugung, nicht aus dem Hochglanzprospekt."',
    "{{eigenes_zitat}}",
)

# ─── 7. About-me 4 paragraphs → single rich-text placeholder ──────────────────
# The about-me intro paragraphs live between <span class="section-eyebrow">…</span><h2…> and the <div class="about-meta…">
# We replace from "<p class="reveal">Ende 2019…" through the last </p> before about-meta.

about_pattern = re.compile(
    r'(<h2 class="reveal">Hi, ich bin \{\{vorname\}\}\.</h2>\s*\n)'
    r'.*?'
    r'(\s*<div class="about-meta reveal">)',
    re.DOTALL,
)
about_replacement = (
    r'\1'
    '      <div class="about-me-richtext reveal">{{about_me_html}}</div>'
    r'\2'
)
new_html, n = about_pattern.subn(about_replacement, html, count=1)
if n == 0:
    print("WARN: about-me paragraphs not replaced", file=sys.stderr)
else:
    html = new_html

# ─── 8. Instagram link + add other contact methods ────────────────────────────
# Wrap the Instagram <div class="about-meta-item"> in a conditional + add Facebook/WhatsApp/Phone after.
ig_pattern = re.compile(
    r'(<div class="about-meta reveal">\s*\n)'
    r'\s*<div class="about-meta-item">\s*\n'
    r'\s*<svg[^>]*>.*?</svg>\s*\n'
    r'\s*<a href="https://www\.instagram\.com/anna\.krempel/" target="_blank" rel="noopener" style="color:inherit;">[^<]*</a>\s*\n'
    r'\s*</div>',
    re.DOTALL,
)
ig_replacement = (
    r'\1'
    '{{#if instagram_url}}\n'
    '        <a href="{{instagram_url}}" target="_blank" rel="noopener" class="about-meta-item" style="color:inherit;text-decoration:none;display:flex;align-items:center;gap:6px;">\n'
    '          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>\n'
    '          Instagram\n'
    '        </a>\n'
    '{{/if}}\n'
    '{{#if facebook_url}}\n'
    '        <a href="{{facebook_url}}" target="_blank" rel="noopener" class="about-meta-item" style="color:inherit;text-decoration:none;display:flex;align-items:center;gap:6px;">\n'
    '          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>\n'
    '          Facebook\n'
    '        </a>\n'
    '{{/if}}\n'
    '{{#if whatsapp_number}}\n'
    '        <a href="https://wa.me/{{whatsapp_number}}" target="_blank" rel="noopener" class="about-meta-item" style="color:inherit;text-decoration:none;display:flex;align-items:center;gap:6px;">\n'
    '          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9z"/><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1"/></svg>\n'
    '          WhatsApp\n'
    '        </a>\n'
    '{{/if}}\n'
    '{{#if telefon}}\n'
    '        <a href="tel:{{telefon}}" class="about-meta-item" style="color:inherit;text-decoration:none;display:flex;align-items:center;gap:6px;">\n'
    '          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>\n'
    '          {{telefon}}\n'
    '        </a>\n'
    '{{/if}}'
)
new_html, n = ig_pattern.subn(ig_replacement, html, count=1)
if n == 0:
    print("WARN: instagram link not replaced", file=sys.stderr)
else:
    html = new_html

# ─── 9. Form: add hidden email field for notifications ────────────────────────
# FinestSites form handler reads owner email from site settings, but it's also
# useful for the form to carry the recipient email so the worker can route correctly.
# Skip if user prefers default routing. The {{email_benachrichtigung}} value goes into a hidden field.

# Find the contact form opening — there is a unified <form> for the contact section.
# Add a hidden recipient field after <form action="/.finestsites/forms/kontakt"…>
form_pattern = re.compile(r'(<form[^>]*action="/\.finestsites/forms/[^"]+"[^>]*>)', re.DOTALL)
form_replacement = r'\1\n      <input type="hidden" name="_recipient" value="{{email_benachrichtigung}}">'
html, n = form_pattern.subn(form_replacement, html, count=2)  # contact form may appear twice (beratung + bestellung tabs)
if n == 0:
    print("WARN: form not patched", file=sys.stderr)

# ─── Done ────────────────────────────────────────────────────────────────────
OUT.write_text(html, encoding="utf-8")
delta = len(html) - original_len
print(f"OK — wrote {OUT}  ({delta:+d} bytes vs original)")
