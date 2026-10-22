// GENERIERT von mobile/scripts/sync-contracts.mjs aus src/lib/contracts/app-v1/ – NICHT BEARBEITEN.
// Änderungen immer im Server-Vertrag machen und danach `npm run sync:contracts` ausführen.
import { z } from 'zod'

const Hour = z.number().int().min(0).max(23)

export const NotificationPreferences = z.object({
  leads: z.boolean(),
  support: z.boolean(),
  account: z.boolean(),
  partner: z.boolean(),
  /** Besucher-Chat (nur sichtbar, wenn der Chat für das Konto freigeschaltet ist). */
  chat: z.boolean().default(true),
  quietHours: z.object({
    enabled: z.boolean(),
    /** Beginn der Nachtruhe (Stunde, Ortszeit), Standard 21 */
    start: Hour,
    /** Ende der Nachtruhe (Stunde, Ortszeit), Standard 8 */
    end: Hour,
  }),
  timezone: z.string().min(1).max(64),
})
export type NotificationPreferences = z.infer<typeof NotificationPreferences>

/** GET /api/app/v1/notification-preferences */
export const NotificationPreferencesResponse = NotificationPreferences

/** PUT /api/app/v1/notification-preferences – Teilupdate erlaubt. */
export const UpdateNotificationPreferencesRequest = z.object({
  leads: z.boolean().optional(),
  support: z.boolean().optional(),
  account: z.boolean().optional(),
  partner: z.boolean().optional(),
  chat: z.boolean().optional(),
  quietHours: z.object({
    enabled: z.boolean().optional(),
    start: Hour.optional(),
    end: Hour.optional(),
  }).strict().optional(),
  timezone: z.string().min(1).max(64).optional(),
}).strict()
