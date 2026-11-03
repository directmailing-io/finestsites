import Link from 'next/link'
import { getRealUserFromRequest } from '@/lib/auth/server'
import { headers } from 'next/headers'
import { PLANS, type PlanKey } from '@/lib/plans'
import { CANCEL_REASONS, CANCEL_REASON_LABELS } from '@/lib/billing/cancellation-offer'
import {
  OFFER_LABELS, OUTCOME_LABELS, RESULT_LABELS, loadFeedback, loadPendingStates, markSeen, mrrFor, reasonLabel,
} from '@/lib/admin/cancellations'
import { Section, Table, Row, Badge, Bar, num, dateDE } from '../_components/AdminTable'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Kündigungen (neu 03.11.2026, docs/kuendigung/konzept.html Abschnitt 13): statt der Stripe-Liste (nur 100 Abos)
 * die eigene Tabelle cancellation_feedback – Grund, Kommentar, Angebot, Ergebnis – plus laufende Kündigungen
 * und Pausen aus der DB. Keine Mail an Daniel: diese Seite (und der Zähler in der Navigation) ist der Ort dafür.
 */

const PLAN_LABEL: Record<string, string> = { starter: 'Starter', pro: 'Pro', unlimited: 'Unlimited' }
const RANGES = [30, 90, 365] as const
const fmtEur = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const name = (r: { firstName: string | null; lastName: string | null; email: string | null; username: string | null }) =>
  [r.firstName, r.lastName].filter(Boolean).join(' ') || r.username || r.email || '–'
const outcomeTone = (o: string): 'green' | 'amber' | 'red' | 'gray' | 'blue' =>
  o === 'kept' ? 'green' : o === 'paused' ? 'blue' : o === 'canceled' ? 'red' : o === 'started' ? 'amber' : 'gray'

export default async function CancellationsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const sp = await searchParams
  const days = (RANGES as readonly number[]).includes(Number(sp.days)) ? Number(sp.days) : 90

  // Besuch der Seite = „gesehen“ (Zähler in der Navigation zurücksetzen)
  try {
    const h = await headers()
    const req = new Request('http://local/admin/cancellations', { headers: h })
    const me = await getRealUserFromRequest(req)
    await markSeen(me?.id ?? null)
  } catch { /* Zähler ist nur Komfort */ }

  const [rows, pending] = await Promise.all([loadFeedback(days), loadPendingStates()])
  const now = Date.now()
  const last30 = rows.filter(r => now - r.createdAt.getTime() <= 30 * 24 * 60 * 60 * 1000)
  const started = last30.length
  const kept = last30.filter(r => r.outcome === 'kept' || r.outcome === 'paused').length
  const canceled = last30.filter(r => r.outcome === 'canceled').length
  const abandoned = last30.filter(r => r.outcome === 'abandoned').length
  const decided = kept + canceled
  const keepRate = decided ? Math.round((kept / decided) * 100) : null
  const mrrLost = last30.filter(r => r.outcome === 'canceled').reduce((s, r) => s + mrrFor(r.plan, r.billingInterval), 0)
  const mrrKept = last30.filter(r => r.outcome === 'kept' || r.outcome === 'paused').reduce((s, r) => s + mrrFor(r.plan, r.billingInterval), 0)

  const reasonCounts = CANCEL_REASONS.map(r => ({ reason: r, n: rows.filter(x => x.reason === r).length })).sort((a, b) => b.n - a.n)
  const offerCounts = Object.entries(rows.reduce<Record<string, { shown: number; accepted: number }>>((acc, r) => {
    if (r.offerShown === 'none') return acc
    const k = r.offerShown
    acc[k] = acc[k] ?? { shown: 0, accepted: 0 }
    acc[k].shown++
    if (r.offerResult === 'accepted') acc[k].accepted++
    return acc
  }, {})).sort((a, b) => b[1].shown - a[1].shown)

  const mrrAtRisk = pending.cancelling.reduce((s, u) => s + mrrFor(u.plan, u.billingInterval), 0)

  return (
    <div style={{ maxWidth: 1080 }}>
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link href="/admin" className="flex items-center gap-2 text-sm mb-5" style={{ color: '#94A3B8' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Zurück zum Dashboard
          </Link>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Kündigungen</h1>
          <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>Gründe, Angebote und Ergebnisse aus dem Kündigungsflow · laufende Kündigungen und Pausen</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {RANGES.map(d => (
            <Link key={d} href={`/admin/cancellations?days=${d}`} className="px-3 py-1.5 rounded-full font-medium"
              style={{ background: d === days ? '#111827' : '#F3F4F6', color: d === days ? '#fff' : '#374151' }}>
              {d === 365 ? '1 Jahr' : `${d} Tage`}
            </Link>
          ))}
          <a href={`/api/admin/cancellations/export?days=${days}`} className="px-3 py-1.5 rounded-full font-medium" style={{ background: '#F3F4F6', color: '#374151' }}>CSV</a>
        </div>
      </div>

      {/* Kennzahlen (immer 30 Tage) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Kündigungen gestartet (30 Tage)', value: String(started), hint: abandoned ? `${abandoned} ohne Entscheidung abgebrochen` : 'Flow geöffnet und Grund gewählt', color: '#111827' },
          { label: 'Geblieben', value: String(kept), hint: `${last30.filter(r => r.outcome === 'paused').length} pausiert · ${last30.filter(r => r.outcome === 'kept').length} mit Angebot/behalten`, color: '#15803D' },
          { label: 'Haltequote', value: keepRate == null ? '–' : `${keepRate} %`, hint: decided ? `von ${decided} entschiedenen` : 'noch keine Entscheidung', color: keepRate != null && keepRate >= 50 ? '#15803D' : '#111827' },
          { label: 'MRR', value: `−${fmtEur(mrrLost)} €`, hint: `${fmtEur(mrrKept)} € gehalten`, color: mrrLost > 0 ? '#C2410C' : '#111827' },
        ].map(k => (
          <div key={k.label} className="rounded-[20px] p-5 bg-white flex flex-col gap-1"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }}>
            <span className="text-xs font-medium" style={{ color: '#64748B' }}>{k.label}</span>
            <span className="text-3xl font-bold tracking-tight" style={{ color: k.color }}>{k.value}</span>
            <span className="text-[11px]" style={{ color: '#94A3B8' }}>{k.hint}</span>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <Section title="Gründe" hint={`${rows.length} Rückmeldungen in ${days === 365 ? '1 Jahr' : `${days} Tagen`}`}>
          {rows.length === 0 ? (
            <p className="text-sm py-2" style={{ color: '#94A3B8' }}>Noch keine Rückmeldungen.</p>
          ) : (
            <div className="flex flex-col gap-2.5 py-1">
              {reasonCounts.map(r => (
                <div key={r.reason}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-900">{CANCEL_REASON_LABELS[r.reason]}</span>
                    <span style={{ color: '#64748B' }}>{r.n}</span>
                  </div>
                  <Bar pct={rows.length ? (r.n / rows.length) * 100 : 0} color="#7C3AED" />
                </div>
              ))}
            </div>
          )}
        </Section>
        <Section title="Angebote" hint="gezeigt → angenommen">
          {offerCounts.length === 0 ? (
            <p className="text-sm py-2" style={{ color: '#94A3B8' }}>Noch kein Angebot gezeigt.</p>
          ) : (
            <Table head={['Angebot', { label: 'Gezeigt', right: true }, { label: 'Angenommen', right: true }, { label: 'Quote', right: true }]} minWidth={360}>
              {offerCounts.map(([k, v]) => (
                <Row key={k} cells={[OFFER_LABELS[k] ?? k, num(v.shown), num(v.accepted), v.shown ? `${Math.round((v.accepted / v.shown) * 100)} %` : '–']} />
              ))}
            </Table>
          )}
        </Section>
      </div>

      <div className="mb-4">
        <Section title="Rückmeldungen" hint="neueste zuerst · Klick auf den Namen öffnet das Konto">
          {rows.length === 0 ? (
            <p className="text-sm py-2" style={{ color: '#94A3B8' }}>Noch keine Rückmeldungen.</p>
          ) : (
            <div className="divide-y" style={{ borderColor: '#F1F5F9' }}>
              {rows.map(r => (
                <div key={r.id} className="py-3 grid gap-x-4 gap-y-1 items-start" style={{ gridTemplateColumns: '72px 1fr 120px' }}>
                  <div className="text-xs" style={{ color: '#94A3B8' }}>{dateDE(r.createdAt)}</div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/admin/users/${r.userId}`} className="text-sm font-medium text-gray-900 hover:underline truncate">{name(r)}</Link>
                      <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: '#F1F5F9', color: '#475569' }}>
                        {PLAN_LABEL[r.plan ?? ''] ?? r.plan} · {r.billingInterval === 'yearly' ? 'jährl.' : 'monatl.'}
                      </span>
                      {r.tenureDays != null && <span className="text-[11px]" style={{ color: '#94A3B8' }}>{Math.max(1, Math.round(r.tenureDays / 30))} Mon. dabei</span>}
                      {r.discountAtTime && <span className="text-[11px]" style={{ color: '#94A3B8' }}>Rabatt {r.discountAtTime}</span>}
                    </div>
                    <div className="text-sm mt-0.5 text-gray-900">{reasonLabel(r.reason)}</div>
                    {r.comment && <div className="text-sm mt-1 italic" style={{ color: '#475569' }}>„{r.comment}“</div>}
                    <div className="text-xs mt-1" style={{ color: '#64748B' }}>
                      Angebot: {OFFER_LABELS[r.offerShown] ?? r.offerShown}{r.offerResult ? ` · ${RESULT_LABELS[r.offerResult] ?? r.offerResult}` : ''}
                      {r.outcome === 'canceled' && r.periodEnd ? ` · Ende ${dateDE(r.periodEnd)}` : ''}
                    </div>
                  </div>
                  <div className="text-right"><Badge tone={outcomeTone(r.outcome)}>{OUTCOME_LABELS[r.outcome] ?? r.outcome}</Badge></div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Section title="Laufende Kündigungen" hint={pending.cancelling.length ? `${pending.cancelling.length} Abos enden · ${fmtEur(mrrAtRisk)} € MRR` : 'keine'}>
          {pending.cancelling.length === 0 ? (
            <p className="text-sm py-2" style={{ color: '#94A3B8' }}>Alle aktiven Abos laufen weiter.</p>
          ) : (
            <Table head={['Nutzer', 'Tarif', 'Endet am', { label: 'in Tagen', right: true }]} minWidth={420}>
              {pending.cancelling.map(u => {
                const d = u.currentPeriodEnd ? Math.max(0, Math.round((u.currentPeriodEnd.getTime() - now) / 86_400_000)) : null
                return (
                  <Row key={u.id} cells={[
                    <Link key="l" href={`/admin/users/${u.id}`} className="hover:underline">{u.username ? `@${u.username}` : u.email}</Link>,
                    `${PLAN_LABEL[u.plan] ?? u.plan} · ${u.billingInterval === 'yearly' ? 'jährl.' : 'monatl.'}`,
                    u.currentPeriodEnd ? dateDE(u.currentPeriodEnd) : '–',
                    d == null ? '–' : String(d),
                  ]} />
                )
              })}
            </Table>
          )}
        </Section>
        <Section title="Pausen" hint={pending.paused.length ? `${pending.paused.length} eingeplant oder laufend` : 'keine'}>
          {pending.paused.length === 0 ? (
            <p className="text-sm py-2" style={{ color: '#94A3B8' }}>Niemand pausiert gerade.</p>
          ) : (
            <Table head={['Nutzer', 'Tarif', 'Von', 'Bis', 'Status']} minWidth={460}>
              {pending.paused.map(u => (
                <Row key={u.id} cells={[
                  <Link key="l" href={`/admin/users/${u.id}`} className="hover:underline">{u.username ? `@${u.username}` : u.email}</Link>,
                  `${PLAN_LABEL[u.pendingPlan ?? u.plan] ?? u.plan}${u.pendingPlan ? ' (danach)' : ''}`,
                  u.pauseFrom ? dateDE(u.pauseFrom) : '–',
                  u.pauseUntil ? dateDE(u.pauseUntil) : '–',
                  <Badge key="b" tone={u.pauseStartedAt ? 'blue' : 'amber'}>{u.pauseStartedAt ? 'läuft' : 'eingeplant'}</Badge>,
                ]} />
              ))}
            </Table>
          )}
        </Section>
      </div>

      <p className="text-xs mt-6" style={{ color: '#94A3B8' }}>
        Preise für die MRR-Rechnung: {(['starter', 'pro', 'unlimited'] as PlanKey[]).map(p => `${PLANS[p].name} ${PLANS[p].monthly_eur} €`).join(' · ')} (Jahresabo anteilig). Rabatte sind nicht herausgerechnet.
      </p>
    </div>
  )
}
