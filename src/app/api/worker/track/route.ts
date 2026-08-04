/**
 * POST /api/worker/track
 *
 * Internal endpoint called exclusively by the Cloudflare Worker to record
 * visitor analytics events (pageviews, clicks, durations) for user sites.
 * NOT intended for browser clients. Protected by WORKER_SECRET.
 *
 * Why this indirection exists: The Worker runs in the CF edge environment and
 * has no direct database connection. Rather than exposing DB credentials to the
 * Worker, all writes go through this app-side endpoint which has full access to
 * the PostgreSQL database via the standard Drizzle ORM connection pool.
 *
 * Events arrive in batches (max 25). Individual invalid events are silently
 * dropped rather than failing the whole batch — the Worker input ultimately
 * originates from visitor requests and must not be able to poison the batch.
 * occurred_at is set by the DB (now()), client timestamps are ignored.
 *
 * Request body:
 *   {
 *     events: [{
 *       siteId:       string (uuid)
 *       templateId:   string (uuid)
 *       eventType:    'pageview' | 'click' | 'duration'
 *       visitorHash:  string | null
 *       host:         string
 *       path:         string
 *       source:       string | null
 *       referrerHost: string | null
 *       utmSource:    string | null
 *       utmMedium:    string | null
 *       utmCampaign:  string | null
 *       device:       string | null
 *       browser:      string | null
 *       os:           string | null
 *       country:      string | null
 *       meta:         object | null
 *     }]
 *   }
 *
 * Response (200):
 *   { ok: true, inserted: number }
 *
 * Security: requests without the correct x-worker-secret header are rejected.
 * In development (WORKER_SECRET unset) all requests are allowed through.
 */

import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { siteEvents } from '@/lib/db/schema'

const WORKER_SECRET = process.env.WORKER_SECRET

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EVENT_TYPES = new Set(['pageview', 'click', 'duration'])
const MAX_BATCH = 25

function checkSecret(req: NextRequest): boolean {
  if (!WORKER_SECRET) return true
  const incoming = req.headers.get('x-worker-secret') ?? ''
  const a = Buffer.from(incoming)
  const b = Buffer.from(WORKER_SECRET)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function str(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string' || value.length === 0) return null
  return value.slice(0, maxLength)
}

type IncomingEvent = Record<string, unknown>

function sanitizeEvent(raw: unknown): typeof siteEvents.$inferInsert | null {
  if (typeof raw !== 'object' || raw === null) return null
  const e = raw as IncomingEvent

  if (typeof e.siteId !== 'string' || !UUID_REGEX.test(e.siteId)) return null
  if (typeof e.templateId !== 'string' || !UUID_REGEX.test(e.templateId)) return null
  if (typeof e.eventType !== 'string' || !EVENT_TYPES.has(e.eventType)) return null

  const host = str(e.host, 200)
  if (!host) return null

  return {
    siteId: e.siteId,
    templateId: e.templateId,
    eventType: e.eventType,
    visitorHash: str(e.visitorHash, 64),
    host,
    path: str(e.path, 200) ?? '/',
    source: str(e.source, 32),
    referrerHost: str(e.referrerHost, 200),
    utmSource: str(e.utmSource, 200),
    utmMedium: str(e.utmMedium, 200),
    utmCampaign: str(e.utmCampaign, 200),
    device: str(e.device, 16),
    browser: str(e.browser, 32),
    os: str(e.os, 32),
    country: str(e.country, 8),
    meta: typeof e.meta === 'object' && e.meta !== null ? e.meta : null,
  }
}

export async function POST(req: NextRequest) {
  if (!checkSecret(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json() as { events?: unknown }

    if (!Array.isArray(body.events) || body.events.length > MAX_BATCH) {
      return NextResponse.json({ error: 'events must be an array of at most 25 entries' }, { status: 400 })
    }

    const valid = body.events
      .map(sanitizeEvent)
      .filter((e): e is NonNullable<typeof e> => e !== null)

    if (valid.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0 })
    }

    await db.insert(siteEvents).values(valid)

    return NextResponse.json({ ok: true, inserted: valid.length })
  } catch (err) {
    console.error('[worker/track]', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
