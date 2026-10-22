/**
 * Nachrichtenfilter des Besucher-Chats – gilt für Besucher UND Betreiber (Apple 1.2 / Google UGC).
 *
 *   - Länge 1 … 2000 Zeichen (nach Trimmen), Steuerzeichen entfernt
 *   - höchstens 3 Links
 *   - kleine, gepflegte Sperrliste grober Beleidigungen/Drohungen (DE/EN)
 *   - dieselbe Nachricht 3× hintereinander vom selben Absender
 *
 * Abgelehnt wird immer mit derselben neutralen Meldung (kein Hinweis auf die Regel).
 */

export const CHAT_MAX_LENGTH = 2000
export const CHAT_MAX_LINKS = 3
export const CHAT_REJECT_MESSAGE = 'Diese Nachricht kann nicht gesendet werden.'

export type FilterResult =
  | { ok: true; body: string }
  | { ok: false; reason: 'empty' | 'too_long' | 'too_many_links' | 'blocked_term' | 'repeated' }

const LINK_RE = /(https?:\/\/|www\.)[^\s<>"']+/gi

/**
 * Grobe Beleidigungen und Drohungen. Bewusst kurz: nur Begriffe, die in einem Gespräch zwischen
 * Besucher und Betreiber praktisch nie legitim vorkommen. Wortgrenzen, Groß-/Kleinschreibung egal.
 */
const BLOCKED_PATTERNS: RegExp[] = [
  // Deutsch – Beleidigungen
  /\bhurensohn\b/i, /\bhurensöhne\b/i, /\bwichser\b/i, /\bfotze\b/i, /\bmissgeburt\b/i,
  /\bdrecksau\b/i, /\bschlampe\b/i, /\bnutte\b/i, /\bfick\s+dich\b/i, /\bfickt\s+euch\b/i,
  /\bverpiss\s+dich\b/i, /\bhalt'?s?\s+maul\b/i, /\bkanake\b/i, /\bkanaken\b/i,
  // Deutsch – Drohungen
  /\bich\s+bring(e)?\s+dich\s+um\b/i, /\bich\s+töte\s+dich\b/i, /\bich\s+schlag(e)?\s+dich\s+tot\b/i,
  /\bdu\s+bist\s+tot\b/i, /\bich\s+weiß\s+wo\s+du\s+wohnst\b/i, /\bich\s+finde\s+dich\b/i,
  // Englisch – Beleidigungen
  /\bmotherfucker\b/i, /\bfuck\s+you\b/i, /\bcunt\b/i, /\bnigg(a|er)s?\b/i, /\bfaggot\b/i,
  /\bretard(ed)?\b/i, /\bwhore\b/i, /\bslut\b/i, /\bbitch\b/i,
  // Englisch – Drohungen
  /\bi('ll|\s+will)\s+kill\s+you\b/i, /\bkill\s+yourself\b/i, /\bgo\s+die\b/i, /\bi\s+know\s+where\s+you\s+live\b/i,
  // Extremismus
  /\bheil\s+hitler\b/i, /\bsieg\s+heil\b/i,
]

/** Steuerzeichen (außer Umbruch/Tab) raus, Zeilenenden vereinheitlichen, trimmen. */
export function normalizeBody(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
}

export function countLinks(body: string): number {
  return (body.match(LINK_RE) ?? []).length
}

export function containsBlockedTerm(body: string): boolean {
  const flat = body.replace(/\s+/g, ' ')
  return BLOCKED_PATTERNS.some(re => re.test(flat))
}

/** Für den Wiederholungsvergleich: Kleinbuchstaben, Leerraum und Satzzeichen zusammengefasst. */
export function repetitionKey(body: string): string {
  return body.toLowerCase().replace(/[\s.,!?;:…\-–—]+/g, ' ').trim()
}

/**
 * Prüft eine Nachricht. `recentSameSender` = die letzten Nachrichten desselben Absenders in diesem
 * Gespräch (neueste zuerst, mindestens die letzten 2 reichen).
 */
export function checkChatMessage(raw: string, recentSameSender: string[] = []): FilterResult {
  const body = normalizeBody(raw ?? '')
  if (!body) return { ok: false, reason: 'empty' }
  if (body.length > CHAT_MAX_LENGTH) return { ok: false, reason: 'too_long' }
  if (countLinks(body) > CHAT_MAX_LINKS) return { ok: false, reason: 'too_many_links' }
  if (containsBlockedTerm(body)) return { ok: false, reason: 'blocked_term' }
  const key = repetitionKey(body)
  const lastTwo = recentSameSender.slice(0, 2)
  if (lastTwo.length >= 2 && lastTwo.every(b => repetitionKey(b) === key)) return { ok: false, reason: 'repeated' }
  return { ok: true, body }
}
