import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { checkCompliance } from '@/lib/compliance/check'

type CheckResponse =
  | { ok: true; changed_input: boolean }
  | { ok: false; issues: Array<{ quote: string; reason: string }>; suggested_html: string }

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY nicht konfiguriert' }, { status: 500 })
  }

  let html: string
  let approvedHtml: string
  try {
    const body = await req.json()
    html = (body.html ?? '').toString().trim()
    approvedHtml = (body.approved_html ?? '').toString().trim().slice(0, 8000)
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 })
  }

  if (!html || html.length < 10) {
    return NextResponse.json({ error: 'Text zu kurz' }, { status: 400 })
  }
  if (html.length > 8000) {
    return NextResponse.json({ error: 'Text zu lang (max. 8000 Zeichen)' }, { status: 400 })
  }

  try {
    const result = await checkCompliance(html, approvedHtml, apiKey)
    if (result.ok) {
      return NextResponse.json<CheckResponse>({ ok: true, changed_input: false })
    }
    return NextResponse.json<CheckResponse>({
      ok: false,
      issues: result.issues,
      suggested_html: result.suggested_html,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('[check-compliance] error:', message)
    return NextResponse.json({ error: 'KI-Prüfung fehlgeschlagen' }, { status: 502 })
  }
}
