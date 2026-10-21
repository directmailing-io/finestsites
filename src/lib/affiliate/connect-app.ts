/**
 * Stripe-Connect-Einrichtung aus der App.
 *
 * Problem: Der Web-Rückweg /api/affiliate/connect/return braucht eine Browser-Sitzung (Cookie).
 * Die App öffnet den Stripe-Link aber im Apple-Anmeldefenster (ASWebAuthenticationSession) ohne
 * Sitzung. Lösung: ein signierter, ablaufender State (HMAC über Nutzer + Connect-Konto), den der
 * App-Rückweg /api/app/v1/affiliate/connect/return prüft und dann nach finestsites://affiliate
 * weiterleitet.
 *
 * Das Anlegen des Express-Kontos entspricht 1:1 POST /api/affiliate/connect (dort unverändert).
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getStripe } from '@/lib/stripe/client'

const STATE_TTL_SECONDS = 24 * 60 * 60
const LABEL = 'fs-app-connect-state:v1.'

type StatePayload = { u: string; a: string; e: number; n: string }

function key(): string {
  const s = process.env.BETTER_AUTH_SECRET
  if (!s) throw new Error('BETTER_AUTH_SECRET fehlt')
  return s
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url')
}

function mac(payload: string): string {
  return createHmac('sha256', key()).update(LABEL + payload).digest('base64url')
}

export function signConnectState(userId: string, accountId: string, nowSec = Math.floor(Date.now() / 1000)): string {
  const payload = b64url(JSON.stringify({ u: userId, a: accountId, e: nowSec + STATE_TTL_SECONDS, n: randomBytes(8).toString('hex') } satisfies StatePayload))
  return `${payload}.${mac(payload)}`
}

export function verifyConnectState(state: string | null | undefined, nowSec = Math.floor(Date.now() / 1000)): { userId: string; accountId: string } | null {
  if (!state || state.length > 1024) return null
  const [payload, sig, extra] = state.split('.')
  if (!payload || !sig || extra !== undefined) return null
  const expected = Buffer.from(mac(payload))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    const p = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as StatePayload
    if (typeof p.u !== 'string' || typeof p.a !== 'string' || typeof p.e !== 'number') return null
    if (p.e < nowSec) return null
    if (!/^acct_[A-Za-z0-9]+$/.test(p.a)) return null
    return { userId: p.u, accountId: p.a }
  } catch {
    return null
  }
}

/** Bestehendes Connect-Konto des Nutzers oder neues Express-Konto (wie POST /api/affiliate/connect). */
export async function ensureConnectAccount(userId: string): Promise<string> {
  const profile = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { stripeConnectId: true, email: true, username: true, firstName: true, lastName: true },
  })
  if (!profile) throw new Error('user not found')
  if (profile.stripeConnectId) return profile.stripeConnectId

  const account = await getStripe().accounts.create({
    type: 'express',
    country: 'DE',
    email: profile.email ?? '',
    business_type: 'individual',
    capabilities: { transfers: { requested: true } },
    individual: {
      email: profile.email ?? '',
      ...(profile.firstName ? { first_name: profile.firstName } : {}),
      ...(profile.lastName ? { last_name: profile.lastName } : {}),
    },
    settings: { payouts: { schedule: { interval: 'daily' } } },
    metadata: { user_id: userId, username: profile.username ?? '' },
  })
  await db.update(users).set({ stripeConnectId: account.id }).where(eq(users.id, userId))
  return account.id
}
