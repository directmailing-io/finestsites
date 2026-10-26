/**
 * Sperrliste für Neuigkeiten-Texte (Apple-Regel 3.1.3: keine Preise, Tarifnamen oder Kaufwege in
 * der App – der Sperrbildschirm zählt dazu). Muster übernommen aus `mobile/scripts/check-forbidden-words.sh`
 * (dort `PATTERNS`). Der Admin-Editor warnt nur, er blockiert nicht.
 */
export const NEWS_BLOCKED_PATTERNS: readonly string[] = [
  '€',
  'Tarif buchen',
  'Tarif wählen',
  'upgrade',
  'checkout',
  'gutschein',
  'rabatt',
  'jahresabo',
  'preis',
  'registrier',
  '/billing',
  'abo abschließen',
  'jetzt kaufen',
  'kaufen',
  'Premium',
  'kostenlos',
  'spart ',
  'Starter',
  'Unlimited',
  'aktives Abo',
]

/** Liefert die Muster, die im Text vorkommen (Groß-/Kleinschreibung egal), ohne Dubletten. */
export function findBlockedWords(text: string): string[] {
  if (!text) return []
  const lower = text.toLowerCase()
  const hits: string[] = []
  for (const pat of NEWS_BLOCKED_PATTERNS) {
    if (lower.includes(pat.toLowerCase())) hits.push(pat.trim())
  }
  // „kaufen“ steckt in „jetzt kaufen“ – nur das längere Muster melden
  return hits.filter(h => !hits.some(o => o !== h && o.toLowerCase().includes(h.toLowerCase())))
}
