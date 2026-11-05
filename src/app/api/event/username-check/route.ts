import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getClientIp, rateLimit } from '@/lib/security/request'
import { RESERVED_USERNAMES, sanitizeUsername, isValidUsername, USERNAME_RULE_TEXT } from '@/lib/username'

/**
 * Live-Prüfung des Benutzernamens auf der Event-Danke-Seite (GET ?u=…): gültig, reserviert, vergeben?
 * Benutzernamen sind ohnehin öffentlich (Subdomain der Kundenseiten), darum ohne Login; Ratenbegrenzung
 * gegen Massenabfragen. Dieselben Regeln wie beim Speichern (src/lib/username.ts).
 */
export async function GET(req: NextRequest) {
  if (!rateLimit('event-username-check', getClientIp(req), 60, 60 * 1000)) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte warte kurz.' }, { status: 429 })
  }
  const username = sanitizeUsername(req.nextUrl.searchParams.get('u') ?? '')
  if (!isValidUsername(username)) {
    return NextResponse.json({ username, available: false, error: USERNAME_RULE_TEXT })
  }
  if (RESERVED_USERNAMES.has(username)) {
    return NextResponse.json({ username, available: false, error: 'Dieser Benutzername ist reserviert. Bitte wähle einen anderen.' })
  }
  const taken = await db.query.users.findFirst({ where: eq(users.username, username), columns: { id: true } })
  if (taken) {
    return NextResponse.json({ username, available: false, error: 'Dieser Benutzername ist schon vergeben. Bitte wähle einen anderen, zum Beispiel mit Nachnamen.' })
  }
  return NextResponse.json({ username, available: true })
}
