/**
 * Konto löschen (Web): GET Status, POST Löschung anfragen (Passwort), DELETE Löschung abbrechen.
 * Gleiche Formen und Fehlercodes wie /api/app/v1/account/deletion (src/lib/account-deletion/routes.ts).
 */
import { handleDeletionDelete, handleDeletionGet, handleDeletionPost } from '@/lib/account-deletion/routes'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const GET = (req: Request) => handleDeletionGet(req)
export const POST = (req: Request) => handleDeletionPost(req, 'web')
export const DELETE = (req: Request) => handleDeletionDelete(req)
