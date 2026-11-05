/**
 * Mail-Kategorien: jede E-Mail, die FinestSites verschickt, gehört genau zu einer Kategorie.
 * Nutzer können in den Einstellungen alle Kategorien außer "system" abbestellen. Der Versand
 * (sendEmail / sendCategoryMail) prüft das zentral, damit es keine Stelle gibt, die es vergisst.
 *
 * Diese Datei ist bewusst ohne Server-Abhängigkeiten, damit Client-Komponenten sie importieren können.
 */

export type EmailCategory = 'system' | 'updates' | 'tips' | 'offers'

export interface EmailCategoryDef {
  key: EmailCategory
  /** Name, so wie der Nutzer ihn in den Einstellungen sieht */
  label: string
  /** Ein Satz in Laiensprache, was in dieser Kategorie kommt */
  description: string
  /** true = kann nicht abbestellt werden (Vertrag, Zahlung, Sicherheit) */
  locked: boolean
}

export const EMAIL_CATEGORIES: EmailCategoryDef[] = [
  {
    key: 'system',
    label: 'Konto und Zahlung',
    description: 'Rechnungen, Zahlungen, Passwort, Status deiner Seite. Kommt immer, damit dein Konto sicher läuft.',
    locked: true,
  },
  {
    key: 'updates',
    label: 'Neues bei FinestSites',
    description: 'Neue Vorlagen, neue Funktionen und Verbesserungen.',
    locked: false,
  },
  {
    key: 'tips',
    label: 'Tipps und Anleitungen',
    description: 'Ideen, wie du mehr aus deiner Seite holst, Schritt für Schritt erklärt.',
    locked: false,
  },
  {
    key: 'offers',
    label: 'Angebote und Aktionen',
    description: 'Rabatte, Aktionen und Erinnerungen, bevor ein Angebot endet.',
    locked: false,
  },
]

export const EMAIL_CATEGORY_KEYS = EMAIL_CATEGORIES.map(c => c.key) as EmailCategory[]
/** Kategorien, die ein Nutzer abbestellen darf */
export const OPTIONAL_EMAIL_CATEGORIES = EMAIL_CATEGORIES.filter(c => !c.locked).map(c => c.key) as EmailCategory[]

export function isEmailCategory(v: unknown): v is EmailCategory {
  return typeof v === 'string' && (EMAIL_CATEGORY_KEYS as string[]).includes(v)
}

export function emailCategoryLabel(key: string | null | undefined): string {
  return EMAIL_CATEGORIES.find(c => c.key === key)?.label ?? (key ?? '')
}

/** Bereinigt eine Opt-out-Liste: nur gültige, abbestellbare Kategorien, ohne Dubletten */
export function normalizeOptOut(list: unknown): EmailCategory[] {
  if (!Array.isArray(list)) return []
  const out: EmailCategory[] = []
  for (const v of list) {
    if (isEmailCategory(v) && !EMAIL_CATEGORIES.find(c => c.key === v)?.locked && !out.includes(v)) out.push(v)
  }
  return out
}

/** Darf diese Kategorie an einen Nutzer mit dieser Opt-out-Liste gehen? */
export function isEmailCategoryAllowed(optOut: readonly string[] | null | undefined, category: EmailCategory): boolean {
  if (category === 'system') return true
  return !(optOut ?? []).includes(category)
}

/**
 * Feste Zuordnung der bekannten Mail-Typen (email_logs.type) zu Kategorien.
 * Alles, was hier nicht steht, gilt als "system" (sicherer Standard: lieber eine Pflichtmail
 * zu viel als eine Rechnung zu wenig). Newsletter bekommen ihre Kategorie beim Versand.
 */
export const EMAIL_TYPE_CATEGORY: Record<string, EmailCategory> = {
  welcome: 'system',
  verification: 'system',
  password_reset: 'system',
  subscription_confirmation: 'system',
  account_canceled: 'system',
  plan_change_scheduled: 'system',
  plan_change_done: 'system',
  account_deactivated: 'system',
  account_reactivated: 'system',
  payment_failed: 'system',
  payment_reminder: 'system',
  sites_offline: 'system',
  payment_fallback: 'system',
  upcoming_debit: 'system',
  domain_active: 'system',
  tracking_first_lead: 'system',
  affiliate_payout: 'system',
  affiliate_referral: 'system',
  testimonial_thanks: 'system',
  testimonial_admin_notify: 'system',
  impersonation_request: 'system',
  account_deletion_requested: 'system',
  account_deletion_cancelled: 'system',
  account_deletion_completed: 'system',
  account_deletion_admin: 'system',
  waitlist_confirm: 'system',
  waitlist_welcome: 'system',
  waitlist_broadcast: 'updates',
  newsletter: 'updates',
  product_update: 'updates',
  tip: 'tips',
  offer: 'offers',
  campaign_reminder: 'offers',
  campaign_last_hour: 'offers',
}
