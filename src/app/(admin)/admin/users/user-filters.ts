import type { UserRow } from './AdminUsersTable'

/**
 * Filter der Admin-Nutzerliste (Daniel 31.10.2026): innerhalb einer Gruppe ODER, zwischen
 * Gruppen UND – „Pro“ + „App installiert“ + „Ohne Rabatt“ = alle Pro-Kunden mit App ohne Rabatt.
 * Alles läuft im Browser auf den bereits geladenen Zeilen (keine weiteren Stripe-Abfragen).
 */
export type FilterState = Record<string, string[]>

export interface FilterOption {
  value: string
  label: string
  test: (u: UserRow) => boolean
}

export interface FilterGroup {
  key: string
  label: string
  options: FilterOption[]
}

const DAY = 86_400_000
const ACTIVE_SUB = ['active', 'trialing', 'past_due']

export const hasSub = (u: UserRow) => ACTIVE_SUB.includes(u.subscriptionStatus ?? '')
export const hasDiscount = (u: UserRow) =>
  hasSub(u) && (!!u.activePromoCode || (u.planPriceCents > 0 && u.billedPriceCents < u.planPriceCents))
const ageDays = (d: Date | string | null) => (d ? (Date.now() - new Date(d).getTime()) / DAY : Infinity)

export function buildFilterGroups(users: UserRow[]): FilterGroup[] {
  const templateTitles = [...new Set(users.flatMap(u => u.templateTitles))].sort((a, b) => a.localeCompare(b, 'de'))

  return [
    {
      key: 'tarif', label: 'Tarif',
      options: [
        { value: 'starter',   label: 'Starter',    test: u => hasSub(u) && u.plan === 'starter' },
        { value: 'pro',       label: 'Pro',        test: u => hasSub(u) && u.plan === 'pro' },
        { value: 'unlimited', label: 'Unlimited',  test: u => hasSub(u) && u.plan === 'unlimited' },
        { value: 'keiner',    label: 'Kein Tarif', test: u => !hasSub(u) },
      ],
    },
    {
      key: 'status', label: 'Abo-Status',
      options: [
        { value: 'aktiv',      label: 'Aktiv',           test: u => u.subscriptionStatus === 'active' && !u.cancelAtPeriodEnd },
        { value: 'trial',      label: 'Trial',           test: u => u.subscriptionStatus === 'trialing' },
        { value: 'ueberfaellig', label: 'Zahlung offen', test: u => u.subscriptionStatus === 'past_due' },
        { value: 'kuendigt',   label: 'Kündigt',         test: u => hasSub(u) && u.cancelAtPeriodEnd },
        { value: 'wechsel',    label: 'Wechselt runter', test: u => !!u.pendingPlan },
        { value: 'gekuendigt', label: 'Gekündigt',       test: u => u.subscriptionStatus === 'canceled' },
        { value: 'nie',        label: 'Nie ein Abo',     test: u => !u.subscriptionStatus },
      ],
    },
    {
      key: 'rabatt', label: 'Rabatt',
      options: [
        { value: 'ohne',   label: 'Ohne Rabatt', test: u => hasSub(u) && !hasDiscount(u) },
        { value: 'mit',    label: 'Mit Rabatt',  test: u => hasDiscount(u) },
        { value: 'gratis', label: 'Kostenlos',   test: u => hasSub(u) && u.planPriceCents > 0 && u.billedPriceCents === 0 },
      ],
    },
    {
      key: 'zahlweise', label: 'Zahlweise',
      options: [
        { value: 'monatlich', label: 'Monatlich', test: u => hasSub(u) && u.billingInterval !== 'yearly' },
        { value: 'jaehrlich', label: 'Jährlich',  test: u => hasSub(u) && u.billingInterval === 'yearly' },
      ],
    },
    {
      key: 'app', label: 'App',
      options: [
        { value: 'ja',      label: 'Installiert',       test: u => u.app.installed },
        { value: 'ios',     label: 'iPhone / iPad',     test: u => u.app.platforms.includes('ios') },
        { value: 'android', label: 'Android',           test: u => u.app.platforms.includes('android') },
        { value: 'nein',    label: 'Nicht installiert', test: u => !u.app.installed },
      ],
    },
    {
      key: 'seiten', label: 'Seiten',
      options: [
        { value: 'online',   label: 'Mind. eine online', test: u => u.siteCount > 0 },
        { value: 'mehrere',  label: 'Mehrere online',    test: u => u.siteCount > 1 },
        { value: 'entwurf',  label: 'Nur Entwürfe',      test: u => u.siteCount === 0 && u.draftCount > 0 },
        { value: 'keine',    label: 'Noch keine Seite',  test: u => u.siteCount === 0 && u.draftCount === 0 },
        { value: 'domain',   label: 'Eigene Domain',     test: u => u.hasCustomDomain },
      ],
    },
    {
      key: 'umsatz', label: 'Umsatz',
      options: [
        { value: 'bezahlt', label: 'Hat schon bezahlt', test: u => u.totalRevenueCents > 0 },
        { value: 'nie',     label: 'Noch nie bezahlt',  test: u => u.totalRevenueCents === 0 },
      ],
    },
    {
      key: 'aktiv', label: 'Zuletzt eingeloggt',
      options: [
        { value: '7',     label: 'Letzte 7 Tage',   test: u => ageDays(u.lastActiveAt) <= 7 },
        { value: '30',    label: 'Letzte 30 Tage',  test: u => ageDays(u.lastActiveAt) <= 30 },
        { value: 'laenger', label: 'Länger her',    test: u => ageDays(u.lastActiveAt) > 30 },
      ],
    },
    {
      key: 'neu', label: 'Registriert',
      options: [
        { value: '7',   label: 'Letzte 7 Tage',  test: u => ageDays(u.createdAt) <= 7 },
        { value: '30',  label: 'Letzte 30 Tage', test: u => ageDays(u.createdAt) <= 30 },
        { value: '90',  label: 'Letzte 90 Tage', test: u => ageDays(u.createdAt) <= 90 },
        { value: 'alt', label: 'Älter',          test: u => ageDays(u.createdAt) > 90 },
      ],
    },
    {
      key: 'konto', label: 'Konto',
      options: [
        { value: 'bestaetigt',   label: 'E-Mail bestätigt',   test: u => u.emailVerified },
        { value: 'unbestaetigt', label: 'E-Mail unbestätigt', test: u => !u.emailVerified && !u.deletedAt },
        { value: 'geworben',     label: 'Geworben',           test: u => !!u.referredBy },
        { value: 'ohne-tp',      label: 'Ohne Teampartner-Nr.', test: u => !u.hasTeamPartnerNumber && !u.deletedAt },
        { value: 'loeschung',    label: 'Löschung angefragt', test: u => !!u.deletionScheduledFor && !u.deletedAt },
        { value: 'geloescht',    label: 'Gelöscht',           test: u => !!u.deletedAt },
      ],
    },
    ...(templateTitles.length > 0 ? [{
      key: 'vorlage', label: 'Vorlage',
      options: templateTitles.map(t => ({ value: t, label: t, test: (u: UserRow) => u.templateTitles.includes(t) })),
    }] : []),
  ]
}

/** Fertige Szenarien – ein Tipp setzt die passende Filterkombination. */
export const PRESETS: { label: string; filters: FilterState }[] = [
  { label: 'Zahlend ohne Rabatt',    filters: { status: ['aktiv', 'kuendigt', 'wechsel'], rabatt: ['ohne'] } },
  { label: 'Pro mit App, ohne Rabatt', filters: { tarif: ['pro'], app: ['ja'], rabatt: ['ohne'] } },
  { label: 'Zahlend, ohne App',      filters: { tarif: ['starter', 'pro', 'unlimited'], app: ['nein'] } },
  { label: 'Kündigt bald',           filters: { status: ['kuendigt'] } },
  { label: 'Zahlung offen',          filters: { status: ['ueberfaellig'] } },
  { label: 'Abo, aber inaktiv',      filters: { tarif: ['starter', 'pro', 'unlimited'], aktiv: ['laenger'] } },
  { label: 'Noch nichts online',     filters: { seiten: ['entwurf', 'keine'], konto: ['bestaetigt'] } },
  { label: 'Neu diese Woche',        filters: { neu: ['7'] } },
]

export function matches(u: UserRow, groups: FilterGroup[], state: FilterState, skipGroup?: string): boolean {
  for (const g of groups) {
    if (g.key === skipGroup) continue
    const sel = state[g.key]
    if (!sel || sel.length === 0) continue
    if (!g.options.some(o => sel.includes(o.value) && o.test(u))) return false
  }
  return true
}

export const activeCount = (state: FilterState) =>
  Object.values(state).reduce((n, v) => n + v.length, 0)

/** URL: ?f=tarif.pro,app.ja (Werte URL-kodiert) */
export function serializeFilters(state: FilterState): string {
  return Object.entries(state)
    .flatMap(([k, vals]) => vals.map(v => `${k}.${encodeURIComponent(v)}`))
    .join(',')
}

export function parseFilters(raw: string | null): FilterState {
  const out: FilterState = {}
  if (!raw) return out
  for (const part of raw.split(',')) {
    const i = part.indexOf('.')
    if (i <= 0) continue
    const k = part.slice(0, i)
    const v = decodeURIComponent(part.slice(i + 1))
    ;(out[k] ??= []).push(v)
  }
  return out
}

export function sameFilters(a: FilterState, b: FilterState): boolean {
  const norm = (s: FilterState) => JSON.stringify(Object.keys(s).filter(k => s[k].length).sort().map(k => [k, [...s[k]].sort()]))
  return norm(a) === norm(b)
}
