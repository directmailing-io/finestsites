/** Entfernt Leerzeichen, Punkte und Bindestriche, schreibt groß. */
export function normalizeVatId(input: string): string {
  return input.toUpperCase().replace(/[\s.\-]/g, '')
}

/**
 * Deutsche Steuernummern bestehen nur aus Ziffern (10–13 Stellen), oft mit
 * Schrägstrichen geschrieben (z. B. 123/456/78901). Häufigste Verwechslung.
 */
export function looksLikeSteuernummer(normalized: string): boolean {
  return /^\d[\d/]{8,15}$/.test(normalized)
}

/** Grobe Formatprüfung für EU-USt-IdNr. (Ländercode + 8–12 Zeichen); Stripe prüft genauer. */
export function isVatIdFormat(normalized: string): boolean {
  return /^[A-Z]{2}[A-Z0-9+*]{8,12}$/.test(normalized)
}
