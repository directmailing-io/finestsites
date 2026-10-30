/**
 * Echte Vorschaubilder der Webseiten (Karte im Dashboard, Web + App).
 * Aufgenommen von scripts/site-thumbnails.ts, abgelegt in R2 unter site-thumbs/<userId>/<siteId>-<ms>.webp
 * und ausgeliefert über /api/media/… (Adresse ändert sich mit jedem Bild → darf dauerhaft gecacht werden).
 */
import { deleteFromR2 } from '@/lib/r2/client'

export const SITE_THUMB_PREFIX = 'site-thumbs/'

export function siteThumbKey(userId: string, siteId: string, at: number): string {
  return `${SITE_THUMB_PREFIX}${userId}/${siteId}-${at}.webp`
}

/** R2-Schlüssel aus der gespeicherten Adresse (…/api/media/site-thumbs/…); fremde Adressen → null. */
export function siteThumbKeyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const i = url.indexOf(`/api/media/${SITE_THUMB_PREFIX}`)
  return i < 0 ? null : url.slice(i + '/api/media/'.length)
}

/** Bild einer gelöschten Seite entfernen; Fehler sind egal (Kontolöschung räumt den Ordner ohnehin). */
export async function deleteSiteThumb(url: string | null | undefined): Promise<void> {
  const key = siteThumbKeyFromUrl(url)
  if (key) await deleteFromR2(key).catch(() => {})
}
