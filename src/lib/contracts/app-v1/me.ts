import { z } from 'zod'
import { Uuid } from './common'

/** Social-Profile als volle Adresse (wie im Web-Profil), null = nicht gesetzt. */
export const Socials = z.object({
  instagram: z.string().nullable(),
  tiktok: z.string().nullable(),
  facebook: z.string().nullable(),
  linkedin: z.string().nullable(),
  youtube: z.string().nullable(),
})
export type Socials = z.infer<typeof Socials>

/** Abbestellbare E-Mail-Kategorien (src/lib/email/categories.ts; 'system' ist nie abbestellbar). */
export const EmailCategory = z.enum(['system', 'updates', 'tips', 'offers'])
export type EmailCategory = z.infer<typeof EmailCategory>

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
    phone: z.string().nullable(),
    socials: Socials,
  }),
  /** Abbestellte Mail-Kategorien (leer = alles erlaubt). Ändern über PATCH /api/user/profile { email_opt_out }. */
  emailOptOut: z.array(EmailCategory),
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
    /** Besucher-Chat für dieses Konto freigeschaltet (Bereich „Chats“ anzeigen). */
    visitorChat: z.boolean(),
  }),
})
export type MeResponse = z.infer<typeof MeResponse>
