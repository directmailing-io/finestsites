// GENERIERT von mobile/scripts/sync-contracts.mjs aus src/lib/contracts/app-v1/ – NICHT BEARBEITEN.
// Änderungen immer im Server-Vertrag machen und danach `npm run sync:contracts` ausführen.
/**
 * Support-Zugriff („Anmelden als“) aus Sicht des Kontoinhabers in der App.
 * Das Web nutzt einen Server-Stream (/api/impersonate/stream); die App fragt per GET nach.
 */
import { z } from 'zod'
import { IsoDateTime } from './common'

export const ImpersonationStatus = z.enum(['pending', 'approved', 'active', 'ended', 'rejected', 'expired'])
export type ImpersonationStatus = z.infer<typeof ImpersonationStatus>

export const ImpersonationRequest = z.object({
  token: z.string(),
  status: ImpersonationStatus,
  adminName: z.string(),
  expiresAt: IsoDateTime,
})
export type ImpersonationRequest = z.infer<typeof ImpersonationRequest>

/**
 * GET /api/app/v1/impersonation            → neueste offene Anfrage (pending/approved/active) oder null
 * GET /api/app/v1/impersonation?token=…    → Stand genau dieser Anfrage; unbekannt/abgelaufen = null
 */
export const ImpersonationQuery = z.object({ token: z.string().min(1).max(200).optional() })

export const ImpersonationResponse = z.object({
  request: ImpersonationRequest.nullable(),
})
export type ImpersonationResponse = z.infer<typeof ImpersonationResponse>

/** POST /api/app/v1/impersonation – Freigabe erteilen oder ablehnen. */
export const ImpersonationDecisionRequest = z.object({
  token: z.string().min(1).max(200),
  action: z.enum(['approve', 'deny']),
}).strict()

export const ImpersonationDecisionResponse = z.object({ status: ImpersonationStatus })
export type ImpersonationDecisionResponse = z.infer<typeof ImpersonationDecisionResponse>
