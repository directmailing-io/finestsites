/**
 * Benutzername-Regeln, gemeinsam für das Onboarding (/api/onboarding/set-username) und die
 * Danke-Seite nach dem Event-Kauf (/api/event/set-password). Der Benutzername ist die Subdomain
 * der Kundenseiten (z. B. sabine-mueller.dailyoptimal.de), darum nur a–z und Bindestrich.
 */
export function sanitizeUsername(val: string): string {
  return val
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z-]/g, '')
    .replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-')
    .slice(0, 30)
}

export function isValidUsername(u: string): boolean {
  return /^[a-z][a-z-]*[a-z]$/.test(u) && u.length >= 3
}

// Blocked as subdomains: infrastructure hosts (custom = CF-for-SaaS fallback
// origin!) and names that would look official enough for phishing.
export const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'www', 'api', 'app', 'mail', 'email', 'smtp',
  'imap', 'pop', 'ftp', 'custom', 'cdn', 'assets', 'static', 'login',
  'signin', 'signup', 'register', 'auth', 'account', 'accounts', 'dashboard',
  'console', 'portal', 'manage', 'support', 'help', 'hilfe', 'info', 'kontakt',
  'contact', 'billing', 'payment', 'pay', 'checkout', 'shop', 'store',
  'status', 'blog', 'news', 'dev', 'staging', 'test', 'beta', 'preview',
  'root', 'system', 'security', 'abuse', 'postmaster', 'webmaster', 'noreply',
  'no-reply', 'finestsites', 'official', 'verify', 'verification', 'demo',
])

export const USERNAME_RULE_TEXT = 'Mindestens 3 Buchstaben a–z, Bindestriche erlaubt.'
