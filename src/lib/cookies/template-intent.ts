export const FS_TEMPLATE_INTENT_KEY = 'fs_template_intent'

/** Read the template intent cookie (client-side). Returns templateId or null. */
export function getTemplateIntentCookie(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${FS_TEMPLATE_INTENT_KEY}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : null
}

/** Set the template intent cookie (client-side, 7 days). */
export function setTemplateIntentCookie(templateId: string): void {
  if (typeof document === 'undefined') return
  document.cookie = `${FS_TEMPLATE_INTENT_KEY}=${encodeURIComponent(templateId)}; path=/; max-age=604800; SameSite=Lax`
}

/** Clear the template intent cookie (client-side). */
export function clearTemplateIntentCookie(): void {
  if (typeof document === 'undefined') return
  document.cookie = `${FS_TEMPLATE_INTENT_KEY}=; path=/; max-age=0; SameSite=Lax`
}

/** Validate that a template intent value looks like a UUID (basic format check). */
export function isValidTemplateId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}
