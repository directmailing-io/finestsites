import { z } from 'zod'

export const Uuid = z.string().uuid()
/** ISO-8601-Zeitstempel (vom Server immer als String geliefert). */
export const IsoDateTime = z.string().datetime({ offset: true })
export const Cents = z.number().int()
export const Platform = z.enum(['ios', 'android'])
export type Platform = z.infer<typeof Platform>
/** Semver-artige Version „1.2.3“. */
export const SemVer = z.string().regex(/^\d+\.\d+\.\d+$/)
