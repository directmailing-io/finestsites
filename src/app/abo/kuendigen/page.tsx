'use client'
/**
 * Ein-Klick-Kündigung aus der bestellten Erinnerungsmail (Jahresabo, Variante E im Konzept vom 03.11.2026).
 * Der signierte Token aus der Mail bindet die Seite an genau ein Konto. Ein Knopf, keine Rückfrage, kein Login.
 */
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Logo } from '@/components/shared/Logo'

function Inner() {
  const params = useSearchParams()
  const token = params.get('token') ?? ''
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>(token ? 'idle' : 'error')
  const [message, setMessage] = useState(token ? '' : 'Der Link ist abgelaufen oder ungültig.')
  const [periodEnd, setPeriodEnd] = useState<string | null>(null)

  async function cancel() {
    setState('loading')
    const res = await fetch('/api/billing/cancel/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setState('error'); setMessage(data.error ?? 'Das hat gerade nicht geklappt.'); return }
    setPeriodEnd(data.period_end ? new Date(data.period_end).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : null)
    setState('done')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#F8FAFC' }}>
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6"><Logo variant="black" height={24} /></div>
        <div className="bg-white rounded-3xl p-7" style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.08)', border: '1px solid #E5E7EB' }}>
          {state === 'done' ? (
            <>
              <h1 className="text-lg font-bold text-gray-900 tracking-tight">Erledigt, dein Abo ist gekündigt.</h1>
              <p className="text-sm mt-2 leading-relaxed" style={{ color: '#64748B' }}>
                {periodEnd ? <>Bis zum <strong className="text-gray-900">{periodEnd}</strong> bleibt alles online. Danach gehen deine Premium-Seiten offline, deine Linkseite bleibt.</> : 'Bis zum Ende deiner bezahlten Laufzeit bleibt alles online.'} Du bekommst eine Bestätigung per Mail.
              </p>
              <p className="text-sm mt-3 leading-relaxed" style={{ color: '#64748B' }}>Falls du es dir anders überlegst: In den Einstellungen kannst du die Kündigung bis zum Laufzeitende zurückziehen.</p>
            </>
          ) : state === 'error' ? (
            <>
              <h1 className="text-lg font-bold text-gray-900 tracking-tight">Das hat nicht geklappt.</h1>
              <p className="text-sm mt-2 leading-relaxed" style={{ color: '#64748B' }}>{message} Du kannst dein Abo jederzeit unter Einstellungen → Zahlung &amp; Plan kündigen.</p>
              <a href="/settings?tab=zahlung" className="inline-block mt-5 text-sm font-semibold underline underline-offset-2 text-gray-900">Zu den Einstellungen</a>
            </>
          ) : (
            <>
              <h1 className="text-lg font-bold text-gray-900 tracking-tight">Dein Abo zur Verlängerung kündigen?</h1>
              <p className="text-sm mt-2 leading-relaxed" style={{ color: '#64748B' }}>
                Du hast dir diese Erinnerung bestellt. Mit einem Klick endet dein Jahresabo zum Verlängerungsdatum. Bis dahin bleibt alles online, es wird nichts mehr abgebucht.
              </p>
              <button onClick={cancel} disabled={state === 'loading'}
                className="mt-6 w-full px-4 py-3 text-sm font-semibold text-white rounded-xl transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: '#111827' }}>
                {state === 'loading' ? 'Bitte warten …' : 'Zur Verlängerung kündigen'}
              </button>
              <a href="/settings?tab=zahlung" className="block text-center mt-4 text-sm underline underline-offset-2" style={{ color: '#6B7280' }}>Lieber weitermachen</a>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function RenewalCancelPage() {
  return <Suspense fallback={null}><Inner /></Suspense>
}
