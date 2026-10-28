import { NextRequest, NextResponse } from 'next/server'
import { blockPurchaseInApp } from '@/lib/app-mode'
import { getUserFromRequest } from '@/lib/auth/server'
import { deletionPendingResponse } from '@/lib/account-deletion/guard'
import { PlanChangeError, cancelPlanChange, paidPublishedSites, schedulePlanChange } from '@/lib/billing/plan-change'

/**
 * Tarifwechsel nach unten zum Laufzeitende (src/lib/billing/plan-change.ts).
 *   GET    → veröffentlichte Premium-Seiten (für die Auswahl „welche bleibt online“)
 *   POST   { plan, keepSiteIds? } → Wechsel einplanen
 *   DELETE → geplanten Wechsel zurückziehen
 * Nur im Browser (Apple 3.1.1: in der App keine Abo-Schnittstellen).
 */
export async function GET(req: NextRequest) {
  const appBlocked = blockPurchaseInApp(req)
  if (appBlocked) return appBlocked
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  return NextResponse.json({ sites: await paidPublishedSites(user.id) })
}

export async function POST(req: NextRequest) {
  const appBlocked = blockPurchaseInApp(req)
  if (appBlocked) return appBlocked
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  const deletionBlock = await deletionPendingResponse(user.id)
  if (deletionBlock) return deletionBlock

  const body = await req.json().catch(() => null) as { plan?: unknown; keepSiteIds?: unknown } | null
  const plan = typeof body?.plan === 'string' ? body.plan : ''
  const keep = Array.isArray(body?.keepSiteIds) ? body!.keepSiteIds.filter((v): v is string => typeof v === 'string').slice(0, 50) : []
  try {
    const pending = await schedulePlanChange(user.id, plan, keep)
    return NextResponse.json({ success: true, pending_change: pending })
  } catch (err) {
    return planChangeErrorResponse(err)
  }
}

export async function DELETE(req: NextRequest) {
  const appBlocked = blockPurchaseInApp(req)
  if (appBlocked) return appBlocked
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  try {
    await cancelPlanChange(user.id)
    return NextResponse.json({ success: true })
  } catch (err) {
    return planChangeErrorResponse(err)
  }
}

function planChangeErrorResponse(err: unknown) {
  if (err instanceof PlanChangeError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status })
  const msg = err instanceof Error ? err.message : String(err)
  console.error('[billing/plan-change]', msg)
  return NextResponse.json({ error: 'Der Zahlungsdienst ist gerade nicht erreichbar. Bitte versuch es gleich noch einmal.' }, { status: 500 })
}
