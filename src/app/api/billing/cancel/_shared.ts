import { NextResponse } from 'next/server'
import { CancellationError } from '@/lib/billing/cancellation'

/** Einheitliche Fehlerantwort für die Kündigungs-Routen */
export function cancellationErrorResponse(err: unknown) {
  if (err instanceof CancellationError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status })
  const msg = err instanceof Error ? err.message : String(err)
  console.error('[billing/cancel]', msg)
  return NextResponse.json({ error: 'Der Zahlungsdienst ist gerade nicht erreichbar. Bitte versuch es gleich noch einmal.' }, { status: 500 })
}
