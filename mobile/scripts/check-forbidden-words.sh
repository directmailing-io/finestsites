#!/usr/bin/env bash
# Kauf-Wörter-Prüfung für die App (Apple 3.1.1 / 3.1.3(f)): In der App darf nichts auf einen
# Kauf zeigen. Sucht in mobile/src nach verbotenen Wörtern und bricht mit Fehler ab.
#
# Ausnahmen:
#   1. ALLOW-Liste unten (Datei + Muster), z. B. die Sperrliste der WebView selbst
#   2. eine Zeile mit dem Kommentar  forbidden-words: allow  (sparsam verwenden, begründen)
# Euro-Beträge (€) entstehen nur über euros() in src/lib/format.ts (Partner-Provisionen);
# ein wörtliches „€“ im Quelltext ist deshalb immer ein Fehler.
set -euo pipefail
cd "$(dirname "$0")/.."

PATTERNS=(
  '€'
  'Tarif buchen'
  'Tarif wählen'
  'upgrade'
  'checkout'
  'gutschein'
  'rabatt'
  'jahresabo'
  'preis'
  'registrier'
  '/billing'
  'abo abschließen'
  'jetzt kaufen'
  'kaufen'
  'Premium'
  'kostenlos'
  'spart '
  'Starter'
  'Unlimited'
  'aktives Abo'
)

# Datei:Muster (Muster wie oben, klein geschrieben)
ALLOW=(
  'src/features/web/guard.ts:/billing'     # Sperrliste der WebView
  'src/features/web/guard.ts:checkout'     # Sperrliste der WebView (checkout.stripe.com)
  'src/features/web/guard.ts:preis'        # Sperrliste der WebView (/preise)
  'src/features/web/guard.ts:registrier'   # Sperrliste der WebView (/register)
)

fail=0
for pat in "${PATTERNS[@]}"; do
  # -i: Groß/klein egal, -n: Zeilennummer, -r: rekursiv
  while IFS= read -r hit; do
    [ -z "$hit" ] && continue
    file="${hit%%:*}"
    line="${hit#*:}"
    case "$line" in *'forbidden-words: allow'*) continue ;; esac
    allowed=0
    lower_pat=$(printf '%s' "$pat" | tr '[:upper:]' '[:lower:]')
    for a in "${ALLOW[@]}"; do
      a_file="${a%%:*}"
      a_pat="${a#*:}"
      if [ "$file" = "$a_file" ] && [ "$a_pat" = "$lower_pat" ]; then allowed=1; fi
    done
    if [ $allowed -eq 0 ]; then
      echo "VERBOTEN [$pat] $hit"
      fail=1
    fi
  done < <(grep -rinF --include='*.ts' --include='*.tsx' -- "$pat" src || true)
done

# Der Empfehlungslink darf nie in der App geöffnet werden
if grep -rn --include='*.tsx' --include='*.ts' -E 'openInBrowser\((a\.link|.*affiliate.*link)' src >/dev/null; then
  echo "VERBOTEN: Empfehlungslink wird in der App geöffnet"
  grep -rn --include='*.tsx' --include='*.ts' -E 'openInBrowser\((a\.link|.*affiliate.*link)' src
  fail=1
fi

if [ $fail -ne 0 ]; then
  echo ""
  echo "Kauf-Wörter-Prüfung: FEHLGESCHLAGEN"
  exit 1
fi
echo "Kauf-Wörter-Prüfung: ok (${#PATTERNS[@]} Muster, keine Treffer außerhalb der Ausnahmen)"
