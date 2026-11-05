import type Stripe from 'stripe'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { hashPassword } from 'better-auth/crypto'
import { and, eq, gt } from 'drizzle-orm'
import { db } from '@/lib/db'
import { accounts, subscriptionEvents, users, verifications } from '@/lib/db/schema'
import { getPlanByPriceId, type BillingInterval, type PlanKey } from '@/lib/plans'
import { recoveryCleared } from '@/lib/billing/payment-recovery'

/**
 * Konto aus einem Event-Kauf („Angebot sichern“, Checkout ohne vorheriges Konto).
 *
 * Es wird KEINE Mail verschickt: BetterAuths signUpEmail würde bei requireEmailVerification die
 * Bestätigungsmail auslösen, deshalb legen wir Nutzer + Zugangsdaten direkt an. Die Adresse gilt
 * als bestätigt, weil Stripe sie im Checkout geprüft hat. Das Passwort setzt die Person auf der
 * Danke-Seite (Schlüssel = Stripe-Session-ID, gültig 7 Tage, einmal einlösbar); bis dahin steht
 * ein zufälliges Passwort im Konto, damit „Passwort vergessen“ jederzeit funktioniert.
 *
 * Idempotent: Webhook und Danke-Seite rufen dieselbe Funktion, wer zuerst kommt, legt an.
 */
export const EVENT_PASSWORD_TTL_MS = 7 * 24 * 60 * 60 * 1000

function tokenHash(sessionId: string): string {
  return createHash('sha256').update(sessionId).digest('hex')
}

function passwordIdentifier(userId: string): string {
  return `event-password:${userId}`
}

function periodEnd(sub: Stripe.Subscription): Date | null {
  const itemTs = (sub.items.data[0] as unknown as { current_period_end?: number })?.current_period_end
  const rootTs = (sub as unknown as { current_period_end?: number }).current_period_end
  const ts = itemTs ?? rootTs
  return ts ? new Date(ts * 1000) : null
}

export function isEventSignupSession(session: Stripe.Checkout.Session): boolean {
  return session.metadata?.event_signup === '1' && !!session.metadata?.event_slug
}

export function sessionEmail(session: Stripe.Checkout.Session): string | null {
  const raw = session.customer_details?.email ?? session.customer_email ?? session.metadata?.email ?? null
  return raw ? raw.toLowerCase().trim() : null
}

/**
 * Legt das Konto zur Session an (falls es die Adresse noch nicht gibt) und hängt das Abo dran.
 * Gibt die Nutzer-ID zurück; null, wenn die Session kein abgeschlossener Event-Kauf ist.
 */
export async function ensureEventSignupUser(
  session: Stripe.Checkout.Session,
  subscription: Stripe.Subscription,
): Promise<{ userId: string; created: boolean } | null> {
  if (!isEventSignupSession(session)) return null
  if (session.status !== 'complete') return null
  const email = sessionEmail(session)
  if (!email) return null

  const priceId = subscription.items.data[0]?.price.id ?? ''
  const plan: PlanKey = getPlanByPriceId()[priceId] ?? ((session.metadata?.plan as PlanKey) || 'starter')
  const interval: BillingInterval = subscription.items.data[0]?.price.recurring?.interval === 'year' ? 'yearly' : 'monthly'
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null
  const firstName = (session.metadata?.first_name ?? '').trim() || null

  const existing = await db.query.users.findFirst({ where: eq(users.email, email), columns: { id: true, stripeSubscriptionId: true } })
  if (existing) {
    // Konto gab es schon (z. B. zweiter Aufruf, oder die Person hatte sich früher nur registriert):
    // Abo übernehmen, sofern noch keines dran hängt oder es dasselbe ist.
    if (!existing.stripeSubscriptionId || existing.stripeSubscriptionId === subscription.id) {
      await db.update(users).set({
        plan,
        billingInterval: interval,
        subscriptionStatus: subscription.status,
        stripeSubscriptionId: subscription.id,
        currentPeriodEnd: periodEnd(subscription),
        ...(customerId ? { stripeCustomerId: customerId } : {}),
        ...recoveryCleared,
        deactivatedAt: null,
      }).where(eq(users.id, existing.id))
    }
    return { userId: existing.id, created: false }
  }

  const userId = randomUUID()
  const randomPassword = randomBytes(32).toString('base64url')
  const passwordHash = await hashPassword(randomPassword)
  try {
    await db.transaction(async tx => {
      await tx.insert(users).values({
        id: userId,
        email,
        name: firstName ?? '',
        firstName,
        emailVerified: true,
        plan,
        billingInterval: interval,
        subscriptionStatus: subscription.status,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: customerId,
        currentPeriodEnd: periodEnd(subscription),
      })
      await tx.insert(accounts).values({
        id: randomUUID(),
        accountId: userId,
        providerId: 'credential',
        userId,
        password: passwordHash,
      })
      await tx.insert(verifications).values({
        id: randomUUID(),
        identifier: passwordIdentifier(userId),
        value: tokenHash(session.id),
        expiresAt: new Date(Date.now() + EVENT_PASSWORD_TTL_MS),
      })
      await tx.insert(subscriptionEvents).values({
        userId,
        eventType: 'event_signup',
        plan,
        billingInterval: interval,
        stripeEventId: `event-signup:${session.id}`,
        stripeSubscriptionId: subscription.id,
        metadata: { event_slug: session.metadata?.event_slug ?? null, first_name: firstName, promo: session.metadata?.promo_code ?? null },
      })
    })
  } catch (err) {
    // Rennen zwischen Webhook und Danke-Seite: der andere Pfad hat das Konto gerade angelegt
    const again = await db.query.users.findFirst({ where: eq(users.email, email), columns: { id: true } })
    if (again) return { userId: again.id, created: false }
    throw err
  }
  return { userId, created: true }
}

/** Darf zu dieser Session noch ein Passwort gesetzt werden? (Schlüssel vorhanden, nicht abgelaufen) */
export async function eventPasswordPending(userId: string, sessionId: string): Promise<boolean> {
  const row = await db.query.verifications.findFirst({
    where: and(
      eq(verifications.identifier, passwordIdentifier(userId)),
      eq(verifications.value, tokenHash(sessionId)),
      gt(verifications.expiresAt, new Date()),
    ),
    columns: { id: true },
  })
  return !!row
}

/**
 * Setzt das Passwort für das Konto zur Session und verbraucht den Schlüssel.
 * false = Schlüssel ungültig/abgelaufen/verbraucht.
 */
export interface EventProfile { username: string; firstName: string; lastName: string }

export type SetEventPasswordResult = 'ok' | 'invalid' | 'username_taken'

/**
 * Passwort (und auf Wunsch Benutzername + Name) auf der Danke-Seite festlegen. Schlüssel = Stripe-Session-ID,
 * einmal einlösbar. Benutzername wird direkt gesetzt (kein Onboarding-Umweg, keine Willkommensmail);
 * ist er schon vergeben, bleibt der Schlüssel gültig und die Person kann einen anderen wählen.
 */
export async function setEventPassword(userId: string, sessionId: string, password: string, profile?: EventProfile): Promise<SetEventPasswordResult> {
  const row = await db.query.verifications.findFirst({
    where: and(
      eq(verifications.identifier, passwordIdentifier(userId)),
      eq(verifications.value, tokenHash(sessionId)),
      gt(verifications.expiresAt, new Date()),
    ),
    columns: { id: true },
  })
  if (!row) return 'invalid'
  const hash = await hashPassword(password)
  try {
    await db.transaction(async tx => {
      if (profile) {
        const current = await tx.query.users.findFirst({ where: eq(users.id, userId), columns: { username: true } })
        const name = `${profile.firstName} ${profile.lastName}`.trim()
        await tx.update(users).set({
          // Benutzername nur, wenn noch keiner gesetzt ist (z. B. zweiter Versuch nach Abbruch)
          ...(current?.username ? {} : { username: profile.username, usernameSetAt: new Date() }),
          firstName: profile.firstName || null,
          lastName: profile.lastName || null,
          ...(name ? { name } : {}),
          updatedAt: new Date(),
        }).where(eq(users.id, userId))
      }
      const updated = await tx.update(accounts)
        .set({ password: hash, updatedAt: new Date() })
        .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'credential')))
        .returning({ id: accounts.id })
      if (updated.length === 0) {
        await tx.insert(accounts).values({ id: randomUUID(), accountId: userId, providerId: 'credential', userId, password: hash })
      }
      await tx.delete(verifications).where(eq(verifications.id, row.id))
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (profile && (msg.includes('23505') || msg.includes('unique'))) return 'username_taken'
    throw e
  }
  return 'ok'
}
