// GENERIERT von mobile/scripts/sync-contracts.mjs aus src/lib/contracts/app-v1/ – NICHT BEARBEITEN.
// Änderungen immer im Server-Vertrag machen und danach `npm run sync:contracts` ausführen.
import { z } from 'zod'
import { Uuid, Platform } from './common'

/** Expo-Push-Token, z. B. ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx] */
export const ExpoPushToken = z.string().max(200).regex(/^(?:Exponent|Expo)PushToken\[[A-Za-z0-9_-]{10,}\]$/)

/** POST /api/app/v1/push/devices – Gerät anmelden (idempotent über das Token). */
export const RegisterDeviceRequest = z.object({
  token: ExpoPushToken,
  platform: Platform,
  appVersion: z.string().max(32).optional(),
  osVersion: z.string().max(32).optional(),
  deviceModel: z.string().max(80).optional(),
  locale: z.string().max(16).optional(),
})

export const DeviceResponse = z.object({
  id: Uuid,
  platform: Platform,
  enabled: z.boolean(),
})

/** PATCH /api/app/v1/push/devices – z. B. App-Version aktualisieren oder Gerät stummschalten. */
export const UpdateDeviceRequest = z.object({
  token: ExpoPushToken,
  enabled: z.boolean().optional(),
  appVersion: z.string().max(32).optional(),
  osVersion: z.string().max(32).optional(),
  locale: z.string().max(16).optional(),
})

/** DELETE /api/app/v1/push/devices – vor dem Abmelden aufrufen. */
export const DeleteDeviceRequest = z.object({ token: ExpoPushToken })

/** Kategorien für Mitteilungen und Einstellungen. */
export const PushCategory = z.enum(['leads', 'support', 'account', 'partner'])
export type PushCategory = z.infer<typeof PushCategory>

/** `data` jeder Push-Mitteilung (für Deep-Links in der App). Nie Interessenten-Daten. */
export const PushData = z.object({
  type: z.string(),
  url: z.string().optional(),
  siteId: Uuid.optional(),
  submissionId: Uuid.optional(),
  conversationId: Uuid.optional(),
  notificationId: Uuid.optional(),
}).passthrough()
export type PushData = z.infer<typeof PushData>
