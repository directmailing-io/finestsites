import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

// TEMPORARY DEBUG ENDPOINT - remove after diagnosis
export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') ?? '(none)'
  const xFwdHost = req.headers.get('x-forwarded-host') ?? '(none)'
  const xFwdProto = req.headers.get('x-forwarded-proto') ?? '(none)'

  let session = null
  let sessionError = null
  try {
    session = await auth.api.getSession({ headers: req.headers })
  } catch (e) {
    sessionError = String(e)
  }

  return NextResponse.json({
    cookieHeader: cookieHeader.substring(0, 200),
    xFwdHost,
    xFwdProto,
    session,
    sessionError,
  })
}
