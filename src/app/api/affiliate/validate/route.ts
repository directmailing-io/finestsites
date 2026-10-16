import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getClientIp, rateLimit } from '@/lib/security/request'
import { getUserFromRequest } from '@/lib/auth/server'

// GET /api/affiliate/validate?code=<username>
// Only accepts exact username match (case-insensitive). Names are not accepted.
// Öffentlich (Registrierung, ?ref=-Links) → Rate-Limit gegen Durchprobieren von
// Benutzernamen; Antwort enthält nur, was die Registrierung anzeigt (Vorname).
export async function GET(req: NextRequest) {
  // max. 30 Prüfungen je IP und Minute (pro Instanz)
  if (!rateLimit('affiliate-validate', getClientIp(req), 30, 60 * 1000)) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte versuch es gleich noch einmal.' }, { status: 429 })
  }

  const code = req.nextUrl.searchParams.get('code')?.trim().toLowerCase()
  if (!code) return NextResponse.json({ error: 'Code fehlt' }, { status: 400 })
  // Grobe Formatprüfung (großzügig für Alt-Benutzernamen) – spart DB-Abfragen für Müll
  if (code.length > 64 || !/^[a-z0-9][a-z0-9._-]*$/.test(code)) {
    return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  }

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.username, code),
      columns: { id: true, username: true, firstName: true },
    })

    if (!user) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

    // Eigener Benutzername ist kein gültiger Partnercode (keine Selbstempfehlung)
    const me = await getUserFromRequest(req).catch(() => null)
    if (me?.id === user.id) {
      return NextResponse.json({ error: 'Deinen eigenen Partnercode kannst du nicht verwenden.', own_code: true }, { status: 404 })
    }

    return NextResponse.json({ valid: true, username: user.username, firstName: user.firstName ?? null })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
