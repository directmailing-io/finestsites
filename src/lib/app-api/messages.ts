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
  NOT_SELF: 'Das kann nur der Kontoinhaber selbst ändern.',
  HANDOFF_INVALID: 'Der Link ist abgelaufen. Bitte öffne den Editor erneut.',
  INVALID_PASSWORD: 'Das Passwort stimmt nicht.',
  BALANCE_CHOICE_REQUIRED: 'Bitte wähle, was mit deinem Partner-Guthaben passieren soll.',
  PERIOD_END_NOT_AVAILABLE: 'Löschen zum Laufzeitende geht nur mit einem laufenden Abo. Bitte wähle „sofort“.',
  DELETION_NOT_ALLOWED: 'Dieses Konto kann hier nicht gelöscht werden.',
  DELETION_ALREADY_REQUESTED: 'Die Löschung ist bereits vorgemerkt.',
  NO_DELETION_PENDING: 'Für dein Konto ist keine Löschung vorgemerkt.',
  ACCOUNT_DELETION_PENDING: 'Dein Konto wird gelöscht. Brich die Löschung ab, um es wieder zu nutzen.',
}

export function appMessage(code: AppErrorCode): string {
  return APP_MESSAGES[code]
}
