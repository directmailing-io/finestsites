// GENERIERT von mobile/scripts/sync-contracts.mjs aus src/lib/contracts/app-v1/ – NICHT BEARBEITEN.
// Änderungen immer im Server-Vertrag machen und danach `npm run sync:contracts` ausführen.
import { z } from 'zod'

/**
 * UUID im Postgres-Format (8-4-4-4-12 Hex). Bewusst nicht z.string().uuid(): das verlangt
 * RFC-Version/-Variante, Postgres speichert aber jede UUID (z. B. feste IDs aus Seeds/Migrationen).
 */
export const Uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
/** ISO-8601-Zeitstempel (vom Server immer als String geliefert). */
export const IsoDateTime = z.string().datetime({ offset: true })
export const Cents = z.number().int()
export const Platform = z.enum(['ios', 'android'])
export type Platform = z.infer<typeof Platform>
/** Semver-artige Version „1.2.3“. */
export const SemVer = z.string().regex(/^\d+\.\d+\.\d+$/)
