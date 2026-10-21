/**
 * Neutrale Rückfall-Texte je Fehlercode (die App zeigt bevorzugt eigene Texte zum Code).
 * Keine Tarif-, Preis- oder Kauf-Begriffe (Apple 3.1.1) – geprüft in scripts/app-api-contract-test.ts.
 * Rein, ohne Abhängigkeiten.
 */
import type { AppErrorCode } from '@/lib/contracts/app-v1/errors'

export const APP_MESSAGES: Record<AppErrorCode, string> = {
  UNAUTHORIZED: 'Bitte melde dich an.',
  FORBIDDEN: 'Keine Berechtigung.',
  NOT_FOUND: 'Nicht gefunden.',
  VALIDATION_FAILED: 'Die Angaben sind unvollständig oder ungültig.',
  RATE_LIMITED: 'Zu viele Anfragen. Bitte warte kurz.',
  INTERNAL: 'Etwas ist schiefgelaufen. Bitte versuch es später nochmal.',
  FEATURE_DISABLED: 'Dieser Bereich ist gerade nicht verfügbar.',
  UPGRADE_REQUIRED: 'Bitte aktualisiere die App.',
  APP_PURCHASE_DISABLED: 'In der App nicht verfügbar.',
  SUBSCRIPTION_REQUIRED: 'Diese Vorlage ist in deinem Konto noch nicht freigeschaltet. Dein Entwurf ist gespeichert.',
  PLAN_LIMIT_REACHED: 'In deinem Konto sind alle Webseiten schon online.',
  PAYMENT_PENDING: 'Deine Webseiten sind gerade offline. Sobald alles geklärt ist, gehen sie automatisch wieder online.',
  CONSENT_REQUIRED: 'Bitte bestätige zuerst die Nutzungsbedingungen.',
  IMPRESSUM_REQUIRED: 'Bitte fülle zuerst dein Impressum aus.',
  COMPLIANCE_BLOCKED: 'Bitte lass deinen Text im Editor prüfen.',
  COMPLIANCE_REQUIRED: 'Bitte lass deinen Text im Editor prüfen.',
  AFFILIATE_NOT_AVAILABLE: 'Dieser Bereich ist für dein Konto nicht verfügbar.',
  CONNECT_UNAVAILABLE: 'Das Auszahlungskonto kann gerade nicht eingerichtet werden. Bitte versuch es später nochmal.',
  HANDOFF_INVALID: 'Der Link ist abgelaufen. Bitte öffne den Editor erneut.',
}

export function appMessage(code: AppErrorCode): string {
  return APP_MESSAGES[code]
}
