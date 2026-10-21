'use client'
/**
 * Einstellungen → „Konto & FAQ“ → Konto löschen (gleicher Ablauf wie in der App):
 * Passwort, ausdrückliche Bestätigung, bei Partner-Guthaben Auszahlung oder Verzicht, 14 Tage Bedenkzeit.
 * Nach dem Absenden sind alle Sitzungen beendet → weiter zur Anmeldung.
 */
import { useEffect, useState } from 'react'
import type { DeletionStatusResponse, BalanceChoice } from '@/lib/contracts/app-v1/account-deletion'

const eur = (cents: number) => (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
const day = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })

const ERRORS: Record<string, string> = {
  INVALID_PASSWORD: 'Das Passwort stimmt nicht.',
  BALANCE_CHOICE_REQUIRED: 'Bitte wähle, was mit deinem Partner-Guthaben passieren soll.',
  DELETION_NOT_ALLOWED: 'Dieses Konto kann hier nicht gelöscht werden.',
  DELETION_ALREADY_REQUESTED: 'Die Löschung ist bereits vorgemerkt.',
  RATE_LIMITED: 'Zu viele Versuche. Bitte warte eine Minute.',
  FORBIDDEN: 'Im Admin-Zugriff kann das Konto nicht gelöscht werden.',
}

export default function AccountDeletionSection() {
  const [info, setInfo] = useState<DeletionStatusResponse | null>(null)
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [choice, setChoice] = useState<BalanceChoice | null>(null)
  const [waiver, setWaiver] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/account/deletion', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => setInfo(d))
      .catch(() => setInfo(null))
  }, [])

  const balance = info?.partnerBalance.totalCents ?? 0
  const needsChoice = balance > 0
  const canSubmit = !!password && confirmed && (!needsChoice || choice === 'payout' || (choice === 'waive' && waiver))

  async function submit() {
    if (!canSubmit) return
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/account/deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, balanceChoice: needsChoice ? choice : null, waiverConfirmed: choice === 'waive' ? waiver : undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(ERRORS[data?.code] ?? 'Das hat nicht geklappt. Bitte versuch es nochmal.')
        setLoading(false)
        return
      }
      // Alle Sitzungen sind beendet → Anmeldung zeigt danach „Konto wird gelöscht am …“
      window.location.href = `/login?deletion=${encodeURIComponent(data.scheduledFor ?? '')}`
    } catch {
      setError('Verbindungsfehler. Bitte prüfe deine Internetverbindung.')
      setLoading(false)
    }
  }

  if (info && !info.canDelete) {
    return (
      <p className="text-sm px-4 py-3 rounded-2xl w-full sm:max-w-md" style={{ background: '#F8FAFC', color: '#64748B', border: '1px solid #E5E7EB' }}>
        Das Admin-Konto kann nicht über diese Seite gelöscht werden.
      </p>
    )
  }

  return (
    <div className="w-full sm:max-w-md flex flex-col gap-4">
      <p className="text-sm leading-relaxed" style={{ color: '#64748B' }}>
        Deine Webseiten gehen sofort offline und dein Abo endet sofort. Du hast {info?.graceDays ?? 14} Tage Bedenkzeit, danach
        löschen wir dein Konto endgültig.
      </p>
      <button type="button" onClick={() => setOpen(true)}
        className="self-start px-5 py-3 text-sm font-bold rounded-xl transition-colors hover:bg-red-50"
        style={{ color: '#DC2626', border: '1.5px solid #FECACA', background: '#fff' }}>
        Konto löschen …
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-3xl p-7 max-w-md w-full flex flex-col gap-5 my-auto"
            role="dialog" aria-modal="true" aria-labelledby="delete-title"
            style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.20)' }}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: '#FEF2F2' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="1.75">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 id="delete-title" className="font-bold text-gray-900 text-lg tracking-tight">Konto wirklich löschen?</h3>
                <p className="text-sm mt-1.5 leading-relaxed" style={{ color: '#64748B' }}>Bitte lies kurz, was passiert:</p>
              </div>
            </div>

            <ul className="flex flex-col gap-2 text-sm leading-relaxed" style={{ color: '#374151' }}>
              {[
                'Deine Webseiten gehen sofort offline.',
                'Dein Abo endet sofort. Es wird nichts mehr abgebucht, bereits bezahlte Zeit wird nicht erstattet.',
                `Du hast ${info?.graceDays ?? 14} Tage Bedenkzeit. In dieser Zeit kannst du die Löschung nach dem Anmelden abbrechen.`,
                'Danach löschen wir dein Konto, deine Seiten, Anfragen und Bilder endgültig. Eigene Domains werden getrennt.',
                'Deinen Benutzernamen vergeben wir nicht neu.',
                'Gutschriften und Provisionsbuchungen müssen wir gesetzlich aufbewahren (8 bzw. 10 Jahre).',
              ].map(t => (
                <li key={t} className="flex gap-2.5"><span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#94A3B8' }} />{t}</li>
              ))}
            </ul>

            {needsChoice && info && (
              <div className="flex flex-col gap-2.5">
                <p className="text-sm font-semibold text-gray-900">Dein Partner-Guthaben: {eur(balance)}</p>
                <ChoiceCard selected={choice === 'payout'} onSelect={() => setChoice('payout')} title="Guthaben auszahlen"
                  text={(info.partnerBalance.hasPayoutAccount && info.partnerBalance.taxProfileComplete
                    ? 'Wir überweisen dein Guthaben auf dein Auszahlungskonto, auch unter 10 €. Noch nicht verfügbare Provisionen folgen nach ihrer Haltefrist.'
                    : 'Dir fehlt noch ein Auszahlungskonto oder die Angaben für die Abrechnung. Richte beides bis zur Löschung im Partnerprogramm ein. Sonst zahlen wir auf Anfrage an info@finestsites.io aus (bis zur Verjährung nach 3 Jahren).')
                    + (info.partnerBalance.customerCreditCents > 0 ? ` Schon gutgeschriebenes Guthaben (${eur(info.partnerBalance.customerCreditCents)}) zahlen wir auf Anfrage aus.` : '')} />
                <ChoiceCard selected={choice === 'waive'} onSelect={() => setChoice('waive')} title="Ich verzichte auf mein Guthaben"
                  text="Das Guthaben verfällt mit der Löschung." />
                {choice === 'waive' && (
                  <label className="flex gap-3 items-start text-sm px-4 py-3 rounded-2xl cursor-pointer" style={{ background: '#FEF2F2', color: '#7F1D1D' }}>
                    <input type="checkbox" checked={waiver} onChange={e => setWaiver(e.target.checked)} className="mt-0.5 w-4 h-4 accent-red-600" />
                    <span>{info.partnerBalance.waiverText}</span>
                  </label>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="delete-password" className="text-sm font-semibold text-gray-700">Passwort zur Bestätigung</label>
              <input id="delete-password" type="password" autoComplete="current-password" value={password}
                onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                className="w-full px-4 py-3 text-[15px] rounded-2xl outline-none transition-all bg-white"
                style={{ border: '1.5px solid #E5E7EB' }}
                onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
                onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
            </div>

            <label className="flex gap-3 items-start text-sm px-4 py-3 rounded-2xl cursor-pointer" style={{ background: '#F8FAFC', color: '#374151' }}>
              <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-0.5 w-4 h-4 accent-gray-900" />
              <span>Ich möchte mein FinestSites-Konto löschen. Mir ist klar, dass meine Seiten sofort offline gehen und mein Abo endet.</span>
            </label>

            {error && (
              <p className="text-sm font-medium px-4 py-3 rounded-2xl" style={{ background: '#FEF2F2', color: '#DC2626' }}>{error}</p>
            )}

            <div className="flex gap-3">
              <button type="button" onClick={() => { setOpen(false); setError('') }} disabled={loading}
                className="flex-1 px-4 py-3 text-sm font-semibold rounded-xl transition-colors hover:bg-gray-200 disabled:opacity-60"
                style={{ background: '#F3F4F6', color: '#374151' }}>
                Behalten
              </button>
              <button type="button" onClick={submit} disabled={!canSubmit || loading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white rounded-xl transition-opacity disabled:opacity-50"
                style={{ background: '#DC2626' }}>
                {loading && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
                Konto löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ChoiceCard({ selected, onSelect, title, text }: { selected: boolean; onSelect: () => void; title: string; text: string }) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onSelect}
      className="text-left flex gap-3 px-4 py-3 rounded-2xl transition-colors bg-white"
      style={{ border: selected ? '2px solid #111827' : '1.5px solid #E5E7EB' }}>
      <span className="mt-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0"
        style={{ border: `2px solid ${selected ? '#111827' : '#D1D5DB'}` }}>
        {selected && <span className="w-2 h-2 rounded-full" style={{ background: '#111827' }} />}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-gray-900">{title}</span>
        <span className="text-xs leading-relaxed" style={{ color: '#64748B' }}>{text}</span>
      </span>
    </button>
  )
}

/** Vollbild während der Bedenkzeit (Dashboard-Layout): Datum + „Löschung abbrechen“. */
export function DeletionPendingScreen({ scheduledFor }: { scheduledFor: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function cancel() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/account/deletion', { method: 'DELETE' })
      if (!res.ok && res.status !== 409) throw new Error()
      setDone(true)
      window.location.href = '/sites'
    } catch {
      setError('Das hat nicht geklappt. Bitte versuch es nochmal oder schreib an info@finestsites.io.')
      setLoading(false)
    }
  }

  async function logout() {
    await fetch('/api/auth/sign-out', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {})
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: 'var(--background)' }}>
      <div className="bg-white rounded-3xl p-8 max-w-md w-full flex flex-col gap-5"
        style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: '#FEF2F2' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="1.75">
            <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Konto wird gelöscht am {day(scheduledFor)}</h1>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: '#64748B' }}>
            Deine Webseiten sind offline und dein Abo ist beendet. Bis zu diesem Tag kannst du die Löschung abbrechen.
          </p>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: '#64748B' }}>
            Nach dem Abbrechen bleiben deine Seiten zunächst offline. Du kannst sie danach selbst wieder veröffentlichen.
            Dein früheres Abo läuft nicht von selbst weiter.
          </p>
        </div>
        {error && <p className="text-sm font-medium px-4 py-3 rounded-2xl" style={{ background: '#FEF2F2', color: '#DC2626' }}>{error}</p>}
        <button type="button" onClick={cancel} disabled={loading || done}
          className="flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold text-white rounded-xl transition-opacity hover:opacity-90 disabled:opacity-70"
          style={{ background: '#1a1a1a' }}>
          {loading && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
          Löschung abbrechen
        </button>
        <button type="button" onClick={logout}
          className="px-5 py-3 text-sm font-semibold rounded-xl transition-colors hover:bg-gray-200"
          style={{ background: '#F3F4F6', color: '#374151' }}>
          Abmelden
        </button>
      </div>
    </div>
  )
}
