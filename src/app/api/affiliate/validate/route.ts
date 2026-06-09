import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/affiliate/validate?code=username
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')?.toLowerCase().trim()
  if (!code) return NextResponse.json({ error: 'Code fehlt' }, { status: 400 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('users')
    .select('username')
    .eq('username', code)
    .single()

  if (!data) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  return NextResponse.json({ valid: true, username: data.username })
}
