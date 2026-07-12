/**
 * Content consent configuration.
 * WICHTIG: Text für v1 darf NIEMALS nachträglich verändert werden.
 * Neue Version → neues Key + neuer Text unten anhängen.
 * Der Hash wird aus diesem Text berechnet und in der DB gespeichert,
 * damit im Streitfall bewiesen werden kann, was der User exakt bestätigt hat.
 */

export const CONSENT_CURRENT_VERSION = 'v1'

export const CONSENT_TEXTS: Record<string, string> = {
  v1: `Ich bestätige folgendes, bevor ich meine Website veröffentliche:

1. Fotos und Bilder: Alle Bilder, die ich hochlade, darf ich verwenden. Ich habe die Rechte daran oder eine ausdrückliche Erlaubnis des Inhabers.

2. Keine Heilsaussagen: Ich mache keine Versprechen, dass Produkte Krankheiten heilen, lindern oder verhindern. Das ist in Deutschland gesetzlich verboten (Heilmittelwerbegesetz).

3. Wahrheitsgemäße Angaben: Alle Texte auf meiner Website sind korrekt und verstoßen nicht gegen geltende Gesetze.

4. Eigene Verantwortung: Ich übernehme die volle Verantwortung für meine Inhalte. FinestSites prüft Inhalte nach bestem Wissen und Gewissen, kann das aber nicht vollständig garantieren.

Mit dieser Bestätigung erkläre ich mich außerdem mit den Nutzungsbedingungen von FinestSites einverstanden.`,
}

/**
 * Computes a SHA-256 hex hash of the consent text.
 * Works in both Node.js (server) and browser environments.
 */
export async function hashConsentText(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text)
  const hashBuf = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export function getCurrentConsentText(): string {
  return CONSENT_TEXTS[CONSENT_CURRENT_VERSION]
}
