/** Was der Worker beim Ausliefern braucht: nur IDs, keine Tokens. Keine Abhängigkeiten (wird im Worker gebündelt). */
export interface PublicTrackingConfig {
  meta?: { pixelId: string; server: boolean }
  google?: { adsId: string; leadLabel: string; contactLabel?: string }
  tiktok?: { pixelId: string; server: boolean }
  /** Welche Ereignisse gemeldet werden (Seitenaufruf immer) */
  events: { contact: boolean; lead: boolean }
}
