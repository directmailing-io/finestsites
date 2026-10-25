/**
 * Sperre für Aktionen während einer vorgemerkten Kontolöschung (und für gelöschte Konten).
 * Antwort { error, code: 'ACCOUNT_DELETION_PENDING' } mit Status 423 – Web und App gleich.
 *
 * Weg 'now' (Seiten offline, Abo beendet): Veröffentlichen, neue Seite anlegen, Tarif kaufen/ändern/fortsetzen gesperrt.
 * Weg 'period_end' (Abo läuft bis zum Laufzeitende weiter): Konto bleibt voll nutzbar – nur der Tarifkauf
 * (checkout/upgrade/reactivate) bleibt gesperrt. Diese Routen rufen die Sperre ohne `allowPeriodEnd` auf.
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { appMessage } from '@/lib/app-api/messages'

export async function deletionPendingResponse(
  userId: string,
  opts: { allowPeriodEnd?: boolean } = {},
): Promise<NextResponse | null> {
  const u = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { deletionRequestedAt: true, deletionMode: true, deletedAt: true },
  })
  if (!u?.deletionRequestedAt && !u?.deletedAt) return null
  if (opts.allowPeriodEnd && !u.deletedAt && u.deletionMode === 'period_end') return null
  return NextResponse.json(
    { error: appMessage('ACCOUNT_DELETION_PENDING'), code: 'ACCOUNT_DELETION_PENDING' },
    { status: 423 },
  )
}
