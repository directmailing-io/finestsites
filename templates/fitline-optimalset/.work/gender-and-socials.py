#!/usr/bin/env python3
"""
Gender + social-links cleanup pass on index.html.

Replaces all gendered terms with {{#if geschlecht=...}} blocks.
Replaces hardcoded Instagram references in:
  - anna-sig signature (line ~7900)
  - footer .footer-contact (line ~8285)
  - footer .footer-social (line ~8288)
…with dynamic conditional blocks driven by the actual configured social
profiles (instagram_url, facebook_url, whatsapp_number, telefon).
"""
from pathlib import Path

ROOT = Path(__file__).parent.parent
SRC = ROOT / "index.html"
html = SRC.read_text(encoding="utf-8")

def f(weib, maen):
    """Helper: produce a conditional German gender block."""
    return f"{{{{#if geschlecht=weiblich}}}}{weib}{{{{/if}}}}{{{{#if geschlecht=maennlich}}}}{maen}{{{{/if}}}}"

# ─── 1. Gendered terms ────────────────────────────────────────────────────────
# Each entry: literal → conditional German variants
GENDER_REPLACEMENTS = [
    # "FitLine Beraterin" → "FitLine Beraterin" / "FitLine Berater"
    ("FitLine Beraterin",
     "FitLine " + f("Beraterin", "Berater")),
    # "Deine persönliche Beraterin" → male/female personal recommender
    ("Deine persönliche Beraterin",
     f("Deine persönliche Beraterin", "Dein persönlicher Berater")),
    # "unabhängige FitLine Beraterin" (in meta og:description after Beraterin replacement) — covered
    # "unabhängige Vertriebspartnerin"
    ("unabhängige Vertriebspartnerin",
     f("unabhängige Vertriebspartnerin", "unabhängiger Vertriebspartner")),
    # "eine Ansprechpartnerin"
    ("eine Ansprechpartnerin",
     f("eine Ansprechpartnerin", "einen Ansprechpartner")),
    # "Unabhängiger Vertriebspartner" appears twice in disclaimer text.
    # In German legal disclaimer convention it's often used as gender-neutral
    # but to be consistent we conditional it.
    ("Unabhängiger Vertriebspartner der PM-International",
     f("Unabhängige Vertriebspartnerin", "Unabhängiger Vertriebspartner") +
     " der PM-International"),
]
for old, new in GENDER_REPLACEMENTS:
    if old not in html:
        print(f"WARN: gender phrase NOT found: '{old[:60]}…'")
        continue
    html = html.replace(old, new)

# ─── 2. Anna-Sig signature block ──────────────────────────────────────────────
old_sig = '''          <a href="https://www.instagram.com/anna.krempel/" target="_blank" rel="noopener" class="anna-sig-ig">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
            @anna.krempel
          </a>'''

new_sig = '''{{#if instagram_url}}<a href="{{instagram_url}}" target="_blank" rel="noopener" class="anna-sig-ig">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
            Instagram
          </a>{{/if}}{{#if facebook_url}}<a href="{{facebook_url}}" target="_blank" rel="noopener" class="anna-sig-ig">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
            Facebook
          </a>{{/if}}{{#if whatsapp_number}}<a href="https://wa.me/{{whatsapp_number}}" target="_blank" rel="noopener" class="anna-sig-ig">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9z"/></svg>
            WhatsApp
          </a>{{/if}}{{#if telefon}}<a href="tel:{{telefon}}" class="anna-sig-ig">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            Anrufen
          </a>{{/if}}'''

if old_sig in html:
    html = html.replace(old_sig, new_sig)
    print("✓ Anna-sig replaced")
else:
    print("WARN: anna-sig block not found")

# ─── 3. Footer .footer-contact (Instagram text link) ─────────────────────────
old_contact = '''        <div class="footer-contact">
          <a href="https://www.instagram.com/anna.krempel/" target="_blank" rel="noopener">@anna.krempel auf Instagram</a>
        </div>'''
new_contact = '''        <div class="footer-contact">
{{#if instagram_url}}          <a href="{{instagram_url}}" target="_blank" rel="noopener">Instagram</a>
{{/if}}{{#if facebook_url}}          <a href="{{facebook_url}}" target="_blank" rel="noopener">Facebook</a>
{{/if}}{{#if whatsapp_number}}          <a href="https://wa.me/{{whatsapp_number}}" target="_blank" rel="noopener">WhatsApp</a>
{{/if}}{{#if telefon}}          <a href="tel:{{telefon}}">{{telefon}}</a>
{{/if}}        </div>'''
if old_contact in html:
    html = html.replace(old_contact, new_contact)
    print("✓ Footer-contact replaced")
else:
    print("WARN: footer-contact block not found")

# ─── 4. Footer .footer-social (icon row) ──────────────────────────────────────
old_social = '''        <div class="footer-social">
          <a href="https://www.instagram.com/anna.krempel/" target="_blank" rel="noopener" aria-label="Instagram">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
          </a>
        </div>'''
new_social = '''        <div class="footer-social">
{{#if instagram_url}}          <a href="{{instagram_url}}" target="_blank" rel="noopener" aria-label="Instagram">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
          </a>
{{/if}}{{#if facebook_url}}          <a href="{{facebook_url}}" target="_blank" rel="noopener" aria-label="Facebook">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
          </a>
{{/if}}{{#if whatsapp_number}}          <a href="https://wa.me/{{whatsapp_number}}" target="_blank" rel="noopener" aria-label="WhatsApp">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9z"/></svg>
          </a>
{{/if}}{{#if telefon}}          <a href="tel:{{telefon}}" aria-label="Anrufen">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          </a>
{{/if}}        </div>'''
if old_social in html:
    html = html.replace(old_social, new_social)
    print("✓ Footer-social replaced")
else:
    print("WARN: footer-social block not found")

SRC.write_text(html, encoding="utf-8")
print(f"\n✅ Done — {SRC} updated")
