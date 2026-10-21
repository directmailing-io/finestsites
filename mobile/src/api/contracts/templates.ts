// GENERIERT von mobile/scripts/sync-contracts.mjs aus src/lib/contracts/app-v1/ – NICHT BEARBEITEN.
// Änderungen immer im Server-Vertrag machen und danach `npm run sync:contracts` ausführen.
/**
 * GET /api/templates für native App-Anfragen (Header X-FS-Client): dieselbe Liste wie im
 * Web, aber OHNE Preis-/Tarif-Signale (kein is_free, kein Schema, keine Tarif-Abzeichen).
 * Abzeichen nur 'brandneu' (reiner Neuheits-Hinweis), alles andere → null.
 * Browser bekommen weiterhin exakt die bisherige Antwort.
 */
import { z } from 'zod'
import { Uuid } from './common'

export const AppTemplateBadge = z.enum(['brandneu'])

export const AppTemplate = z.object({
  id: Uuid,
  title: z.string(),
  description: z.string().nullable(),
  domain: z.string(),
  preview_images: z.array(z.string()).nullable(),
  badge: AppTemplateBadge.nullable(),
  is_coming_soon: z.boolean(),
}).strict()
export type AppTemplate = z.infer<typeof AppTemplate>

export const AppTemplatesResponse = z.array(AppTemplate)
