import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { formSubmissions } from '@/lib/db/schema'

const WORKER_SECRET = process.env.WORKER_SECRET
function checkSecret(req: NextRequest): boolean {
  if (!WORKER_SECRET) return true
  return req.headers.get('x-worker-secret') === WORKER_SECRET
}

// Saves a form submission from the Cloudflare Worker.
// Called instead of posting directly to Supabase.
export async function POST(req: NextRequest) {
  if (!checkSecret(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json() as {
      userSiteId: string
      formName: string
      data: Record<string, string>
      submitterIpHash?: string | null
      isSpam?: boolean
    }

    if (!body.userSiteId || !body.formName) {
      return NextResponse.json({ error: 'userSiteId and formName required' }, { status: 400 })
    }

    const [inserted] = await db
      .insert(formSubmissions)
      .values({
        userSiteId: body.userSiteId,
        formName: body.formName,
        data: body.data ?? {},
        submitterIpHash: body.submitterIpHash ?? null,
        isSpam: body.isSpam ?? false,
      })
      .returning({ id: formSubmissions.id })

    return NextResponse.json({ success: true, id: inserted.id })
  } catch {
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
