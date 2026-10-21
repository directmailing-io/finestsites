import { z } from 'zod'
import { Uuid } from './common'

/** GET /api/app/v1/me – Profil, Ersteinrichtung, neutraler Konto-Status (keine Preise). */
export const MeResponse = z.object({
  user: z.object({
    id: Uuid,
    email: z.string(),
    username: z.string().nullable(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    companyName: z.string().nullable(),
    teamPartnerNumber: z.string().nullable(),
    profileImageUrl: z.string().nullable(),
    emailVerified: z.boolean(),
    isInternal: z.boolean(),
  }),
  onboarding: z.object({
    usernameSet: z.boolean(),
    consentGiven: z.boolean(),
    complete: z.boolean(),
  }),
  account: z.object({
    sitesOnline: z.number().int().nonnegative(),
    sitesTotal: z.number().int().nonnegative(),
    /** Offene Zahlung – die App zeigt nur einen neutralen Hinweis, nie einen Zahl-Link. */
    paymentIssue: z.boolean(),
    /** Nur der Name („Pro“), nur zur Anzeige; null ohne laufenden Tarif. */
    planLabel: z.string().nullable(),
    /** Belegte/erlaubte Online-Webseiten; limit null = unbegrenzt; quota null ohne Tarif. */
    quota: z.object({
      used: z.number().int().nonnegative(),
      limit: z.number().int().positive().nullable(),
    }).nullable(),
  }),
  features: z.object({
    partnerProgram: z.boolean(),
  }),
})
export type MeResponse = z.infer<typeof MeResponse>
