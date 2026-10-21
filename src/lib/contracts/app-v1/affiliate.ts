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
