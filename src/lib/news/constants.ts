/**
 * Konstanten der Neuigkeiten ohne Server-Abhängigkeiten (für Dienst UND Browser-Komponenten).
 * Startkarte (Dashboard-Web, App-Start) nur für Neuigkeiten, die höchstens so viele Tage alt sind –
 * ein neues Konto soll keine alte Karte sehen. Server (overviewFor) und Web-Karte (GET /api/news) nutzen denselben Wert.
 */
export const NEWS_CARD_MAX_AGE_DAYS = 14

/** Für die Web-Startkarte: Veröffentlichung liegt höchstens NEWS_CARD_MAX_AGE_DAYS zurück. */
export function isRecentEnoughForCard(publishedAt: string, now: Date = new Date()): boolean {
  const t = Date.parse(publishedAt)
  return !Number.isNaN(t) && now.getTime() - t < NEWS_CARD_MAX_AGE_DAYS * 86400_000
}
