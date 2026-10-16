/**
 * Datensparsamkeit im Partnerprogramm: Partner sehen von ihren geworbenen Kunden
 * nur Vorname, Tarif und Status – nie die vollständige E-Mail-Adresse.
 * Reine Funktionen (keine Abhängigkeiten), damit sie überall und in Tests nutzbar sind.
 */

/** "max.mustermann@web.de" → "ma***@web.de"; ungültige Eingaben → "–". */
export function maskEmail(email: string | null | undefined): string {
  const e = (email ?? '').trim()
  const at = e.lastIndexOf('@')
  if (at < 1 || at === e.length - 1) return '–'
  const local = e.slice(0, at)
  const domain = e.slice(at + 1)
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2)
  return `${visible}***@${domain}`
}

/** Anzeigename für Partner: Vorname, sonst maskierte E-Mail. */
export function refereeDisplayName(firstName: string | null | undefined, email: string | null | undefined): string {
  const fn = (firstName ?? '').trim()
  return fn || maskEmail(email)
}
