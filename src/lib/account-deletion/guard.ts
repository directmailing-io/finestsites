/**
 * Sperre für Aktionen während der Bedenkzeit einer Kontolöschung (und für gelöschte Konten):
 * Veröffentlichen, neue Seite anlegen, Tarif kaufen/ändern/fortsetzen.
 * Antwort { error, code: 'ACCOUNT_DELETION_PENDING' } mit Status 423 – Web und App gleich.
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { appMessage } from '@/lib/app-api/messages'

export async function deletionPendingResponse(userId: string): Promise<NextResponse | null> {
  const u = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { deletionRequestedAt: true, deletedAt: true },
  })
  if (!u?.deletionRequestedAt && !u?.deletedAt) return null
  return NextResponse.json(
    { error: appMessage('ACCOUNT_DELETION_PENDING'), code: 'ACCOUNT_DELETION_PENDING' },
    { status: 423 },
  )
}
