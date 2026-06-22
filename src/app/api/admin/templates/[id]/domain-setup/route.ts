import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users, templates } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { setupDomainRouting, findZone, deleteWorkerRoute } from '@/lib/cloudflare/worker-routes'

async function checkAdmin(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return null
  const userRow = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  })
  return userRow?.isAdmin ? user : null
}

// GET — fetch current domain setup status
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkAdmin(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const tpl = await db.query.templates.findFirst({
    where: eq(templates.id, id),
  })

  if (!tpl) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!tpl.domain) return NextResponse.json({ status: 'no_domain' })

  // If already set up, return active immediately
  if (tpl.cfHostnameStatus === 'active' && tpl.cfHostnameData) {
    const data = tpl.cfHostnameData as { manual?: boolean }
    // For manually configured domains, skip zone verification — trust admin's explicit setup
    if (data.manual) {
      return NextResponse.json({ status: 'active', domain: tpl.domain, manual: true })
    }
    // For auto-configured domains, verify zone still exists
    const zone = await findZone(tpl.domain).catch(() => null)
    if (!zone) {
      return NextResponse.json({ status: 'zone_missing', domain: tpl.domain })
    }
    return NextResponse.json({ status: 'active', domain: tpl.domain, ...(tpl.cfHostnameData as object) })
  }

  // Check if zone exists in Cloudflare
  const zone = await findZone(tpl.domain).catch(() => null)
  if (!zone) {
    return NextResponse.json({ status: 'zone_missing', domain: tpl.domain })
  }

  return NextResponse.json({
    status: tpl.cfHostnameStatus ?? 'none',
    domain: tpl.domain,
    zone_name: zone.name,
    zone_status: zone.status,
  })
}

// POST — set up Worker Route + CNAME automatically
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkAdmin(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const tpl = await db.query.templates.findFirst({
    where: eq(templates.id, id),
  })

  if (!tpl?.domain) return NextResponse.json({ error: 'Domain fehlt.' }, { status: 400 })
  if (tpl.cfHostnameStatus === 'active') {
    return NextResponse.json({ status: 'active', domain: tpl.domain })
  }

  try {
    const result = await setupDomainRouting(tpl.domain)
    const payload = {
      status: 'active',
      domain: tpl.domain,
      zone_id: result.zone.id,
      route_id: result.routeId,
    }
    await db.update(templates)
      .set({
        cfHostnameId: result.routeId,
        cfHostnameStatus: 'active',
        cfHostnameData: payload,
      })
      .where(eq(templates.id, id))

    return NextResponse.json(payload)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

// PATCH — force-mark as active (for manually configured domains)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkAdmin(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  if (!body.forceActive) return NextResponse.json({ error: 'Invalid' }, { status: 400 })

  await db.update(templates)
    .set({
      cfHostnameId: 'manual',
      cfHostnameStatus: 'active',
      cfHostnameData: { status: 'active', manual: true },
    })
    .where(eq(templates.id, id))

  return NextResponse.json({ status: 'active', manual: true })
}

// DELETE — remove Worker Route
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkAdmin(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const tpl = await db.query.templates.findFirst({
    where: eq(templates.id, id),
  })

  if (tpl?.cfHostnameId && tpl?.cfHostnameData) {
    const d = tpl.cfHostnameData as { zone_id?: string }
    if (d.zone_id) {
      await deleteWorkerRoute(d.zone_id, tpl.cfHostnameId).catch(() => {})
    }
    await db.update(templates)
      .set({
        cfHostnameId: null,
        cfHostnameStatus: null,
        cfHostnameData: null,
      })
      .where(eq(templates.id, id))
  }

  return NextResponse.json({ success: true })
}
