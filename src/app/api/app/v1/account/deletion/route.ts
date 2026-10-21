/**
 * Konto löschen in der App (Apple 5.1.1(v): ohne Umweg über den Support):
 *   GET    → DeletionStatusResponse
 *   POST   { password, balanceChoice?, waiverConfirmed? } → DeletionRequestResponse (alle Sitzungen enden)
 *   DELETE → DeletionCancelResponse (Löschung abbrechen nach erneuter Anmeldung)
 * Ablauf und Regeln: src/lib/account-deletion/service.ts
 */
import { handleDeletionDelete, handleDeletionGet, handleDeletionPost } from '@/lib/account-deletion/routes'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const GET = (req: Request) => handleDeletionGet(req)
export const POST = (req: Request) => handleDeletionPost(req, 'app')
export const DELETE = (req: Request) => handleDeletionDelete(req)
