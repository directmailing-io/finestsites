/**
 * Partnerprogramm in der App – neutrale Fassung (Apple 3.1.1/3.1.3(f)):
 * KEINE Rabatte für Empfohlene, KEINE Tarifnamen, KEIN „aktives Abo“, kein Kauf-Hinweis.
 * Empfehlungen nur mit Status aktiv/pausiert. Texte kommen vom Server (`texts`).
 */
import { z } from 'zod'
import { Uuid, IsoDateTime, Cents } from './common'

export const CommissionStatus = z.enum(['pending', 'available', 'paid', 'reversed'])
export const ReferralStatus = z.enum(['active', 'paused'])
export const PayoutMode = z.enum(['credit', 'payout'])
export const ConnectStatus = z.enum(['none', 'pending', 'ready'])

export const AffiliateResponse = z.object({
  link: z.string().url(),
  code: z.string(),
  texts: z.object({
    title: z.string(),
    description: z.string(),
    holdInfo: z.string(),
  }),
  commissionPercent: z.number(),
  earnings: z.object({
    currency: z.literal('EUR'),
    availableCents: Cents,
    pendingCents: Cents,
    paidCents: Cents,
  }),
  payout: z.object({
    mode: PayoutMode,
    connectStatus: ConnectStatus,
    bankLast4: z.string().nullable(),
    minPayoutCents: Cents,
  }),
  taxProfileComplete: z.boolean(),
  history: z.object({
    commissions: z.array(z.object({
      id: Uuid,
      amountCents: Cents,
      status: CommissionStatus,
      createdAt: IsoDateTime,
      availableAt: IsoDateTime,
      paidAt: IsoDateTime.nullable(),
    })),
    payouts: z.array(z.object({
      id: Uuid,
      amountCents: Cents,
      method: z.enum(['credit', 'transfer']),
      status: z.enum(['processing', 'paid', 'failed']),
      paidAt: IsoDateTime.nullable(),
      creditNote: z.object({ id: Uuid, number: z.string(), ready: z.boolean() }).nullable(),
    })),
  }),
  referrals: z.object({
    count: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
    paused: z.number().int().nonnegative(),
    items: z.array(z.object({
      displayName: z.string(),
      status: ReferralStatus,
      joinedAt: IsoDateTime,
    })),
  }),
})
export type AffiliateResponse = z.infer<typeof AffiliateResponse>

/** POST /api/app/v1/affiliate/connect → Stripe-Link (im Apple-Anmeldefenster öffnen, nie im App-Rahmen). */
export const AffiliateConnectResponse = z.object({
  url: z.string().url(),
  /** Rücksprung, auf den die App im Anmeldefenster wartet (finestsites://affiliate?connect=…). */
  callbackScheme: z.literal('finestsites'),
})

/** Ergebnis im Rücksprung finestsites://affiliate?connect=… */
export const ConnectReturnResult = z.enum(['done', 'pending', 'refresh', 'error'])

// ── Auszahlungsart ────────────────────────────────────────────────────────────

/**
 * GET /api/app/v1/affiliate/payout-mode
 * PUT /api/app/v1/affiliate/payout-mode { mode }
 * 'credit' = „Mit meinem Konto verrechnen“, 'payout' = „Aufs Bankkonto auszahlen“.
 * Bewusst ohne Abo-Status und ohne Kundenguthaben (kein Kauf-Bezug in der App).
 */
export const PayoutModeResponse = z.object({
  mode: PayoutMode,
  /** false, wenn der Support gerade im Konto ist („Anmelden als“): nur der Partner selbst darf umstellen. */
  canChange: z.boolean(),
  connectStatus: ConnectStatus,
})
export type PayoutModeResponse = z.infer<typeof PayoutModeResponse>

export const UpdatePayoutModeRequest = z.object({ mode: PayoutMode }).strict()

// ── Steuerprofil ──────────────────────────────────────────────────────────────

export const TaxStatus = z.enum(['kleinunternehmer', 'regelbesteuert'])
export type TaxStatus = z.infer<typeof TaxStatus>

/** GET /api/app/v1/affiliate/tax-profile */
export const TaxProfileResponse = z.object({
  profile: z.object({
    taxStatus: TaxStatus,
    fullName: z.string(),
    street: z.string(),
    zip: z.string(),
    city: z.string(),
    country: z.string(),
    /** Steuernummer ODER USt-IdNr. (ein Feld, wird automatisch erkannt) */
    taxId: z.string(),
    entrepreneurConfirmed: z.boolean(),
    consentAt: IsoDateTime.nullable(),
    consentVersion: z.string().nullable(),
    updatedAt: IsoDateTime.nullable(),
  }).nullable(),
  complete: z.boolean(),
})
export type TaxProfileResponse = z.infer<typeof TaxProfileResponse>

/**
 * PUT /api/app/v1/affiliate/tax-profile – gleiche Prüfung wie im Web (src/lib/affiliate/tax.ts).
 * Fehler: 400 VALIDATION_FAILED mit `fields` (Schlüssel wie im Web: taxStatus, fullName, street,
 * zip, city, taxId, entrepreneurConfirmed, consent). Erfolg: TaxProfileResponse.
 */
export const UpdateTaxProfileRequest = z.object({
  taxStatus: z.string().max(40).nullable(),
  fullName: z.string().max(200),
  street: z.string().max(200),
  zip: z.string().max(10),
  city: z.string().max(200),
  taxId: z.string().max(40),
  entrepreneurConfirmed: z.boolean(),
  consent: z.boolean(),
}).strict()
export type UpdateTaxProfileRequest = z.infer<typeof UpdateTaxProfileRequest>

// ── Auszahlung anstoßen ───────────────────────────────────────────────────────

/**
 * POST /api/app/v1/affiliate/payout – Ergebnis immer als Code (200), die App hat eigene Texte.
 * Interne Konten (Apple-Demo) lösen nie eine echte Auszahlung aus → 'unavailable'.
 */
export const PayoutResultStatus = z.enum([
  'paid',
  'nothing_to_pay',
  'below_minimum',
  'negative_balance',
  'already_paid_this_month',
  /** läuft / wird vorbereitet (verrät nie interne Gründe) */
  'processing',
  'mode_credit',
  'no_connect',
  'not_verified',
  'tax_profile_missing',
  'unavailable',
  'failed',
])
export type PayoutResultStatus = z.infer<typeof PayoutResultStatus>

export const PayoutResponse = z.object({
  status: PayoutResultStatus,
  /** Ausgezahlter Betrag (paid) bzw. aktuelles Guthaben (below_minimum), sonst null. */
  amountCents: Cents.nullable(),
  minPayoutCents: Cents,
  creditNoteNumber: z.string().nullable(),
})
export type PayoutResponse = z.infer<typeof PayoutResponse>

// ── Gutschriften ──────────────────────────────────────────────────────────────

export const CreditNote = z.object({
  id: Uuid,
  number: z.string(),
  date: IsoDateTime.nullable(),
  amountCents: Cents,
  /** PDF abrufbar unter GET /api/app/v1/affiliate/credit-notes/{id} */
  ready: z.boolean(),
  method: z.enum(['credit', 'transfer']),
})
export type CreditNote = z.infer<typeof CreditNote>

/** GET /api/app/v1/affiliate/credit-notes */
export const CreditNotesResponse = z.object({ items: z.array(CreditNote) })
export type CreditNotesResponse = z.infer<typeof CreditNotesResponse>
