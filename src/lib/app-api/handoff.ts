/**
 * Positivliste für `next` der Editor-Übergabe (/api/app/v1/editor-handoff).
 * Rein, ohne Abhängigkeiten – getestet in scripts/app-api-contract-test.ts.
 */

export const DEFAULT_HANDOFF_NEXT = '/sites'

const ALLOWED_PATHS: RegExp[] = [
  /^\/sites$/,
  /^\/sites\/[A-Za-z0-9-]+(?:\/(?:edit|submissions))?$/, // /sites/<id>, /sites/<id>/edit, /sites/<id>/submissions, /sites/new
  /^\/sites\/library(?:\/[A-Za-z0-9-]+)?$/,
  /^\/affiliate$/,
  /^\/onboarding\/(?:username|consent)$/,
]
// Nur diese Einstellungs-Reiter (nie „Zahlung & Plan“ oder „Rechnungen“)
const ALLOWED_SETTINGS_TABS = new Set(['werbung'])
const ALLOWED_QUERY_KEYS = new Set(['tab', 'site', 'template', 'connect'])
const BASE = 'http://handoff.invalid'

/** Prüft `next` und gibt einen sicheren relativen Pfad zurück (sonst /sites). */
export function safeHandoffNext(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_HANDOFF_NEXT
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\') || /%2f|%5c|%00|[\u0000-\u001f]/i.test(raw)) return DEFAULT_HANDOFF_NEXT
  let u: URL
  try { u = new URL(raw, BASE) } catch { return DEFAULT_HANDOFF_NEXT }
  if (u.origin !== BASE) return DEFAULT_HANDOFF_NEXT
  const path = u.pathname
  for (const key of u.searchParams.keys()) if (!ALLOWED_QUERY_KEYS.has(key)) return DEFAULT_HANDOFF_NEXT
  if (path === '/settings') {
    const tab = u.searchParams.get('tab')
    return tab && ALLOWED_SETTINGS_TABS.has(tab) ? `/settings?tab=${tab}` : DEFAULT_HANDOFF_NEXT
  }
  if (!ALLOWED_PATHS.some(re => re.test(path))) return DEFAULT_HANDOFF_NEXT
  if (u.searchParams.has('tab')) return DEFAULT_HANDOFF_NEXT
  const qs = u.searchParams.toString()
  return qs ? `${path}?${qs}` : path
}
