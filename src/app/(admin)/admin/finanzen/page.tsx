import Link from 'next/link'
import { getFinanceSnapshot, type PlanKey } from '@/lib/admin/finance'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

const eur = (cents: number) => (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const date = (ts: number) => new Date(ts * 1000).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
const monthLabel = (k: string) => {
  const [y, m] = k.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
}
const PLAN_LABEL: Record<PlanKey, string> = { starter: 'Starter', pro: 'Pro', unlimited: 'Unlimited', unbekannt: 'Unbekannt' }
const STATUS_LABEL: Record<string, string> = {
  active: 'Aktiv', trialing: 'Testphase', past_due: 'Überfällig', canceled: 'Beendet',
  unpaid: 'Unbezahlt', incomplete: 'Unvollständig', incomplete_expired: 'Abgebrochen', paused: 'Pausiert',
}

const card = { boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'green' | 'amber' | 'red' }) {
  const color = tone === 'green' ? '#16A34A' : tone === 'amber' ? '#D97706' : tone === 'red' ? '#DC2626' : '#111827'
  return (
    <div className="rounded-[20px] bg-white p-5" style={card}>
      <p className="text-[11px] font-medium uppercase tracking-wide mb-2" style={{ color: '#94A3B8' }}>{label}</p>
      <p className="text-2xl font-bold tracking-tight" style={{ color }}>{value}</p>
      {sub && <p className="text-xs mt-1.5" style={{ color: '#94A3B8' }}>{sub}</p>}
    </div>
  )
}

export default async function FinanzenPage({ searchParams }: { searchParams: Promise<{ fresh?: string }> }) {
  const sp = await searchParams
  const [f, [growth]] = await Promise.all([
    getFinanceSnapshot({ fresh: sp.fresh === '1' }),
    db.select({
      total: sql<number>`count(*)::int`,
      first: sql<Date>`min(${users.createdAt})`,
      d7: sql<number>`count(*) filter (where ${users.createdAt} >= now() - interval '7 days')::int`,
      d30: sql<number>`count(*) filter (where ${users.createdAt} >= now() - interval '30 days')::int`,
      today: sql<number>`count(*) filter (where ${users.createdAt} >= date_trunc('day', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin')::int`,
    }).from(users),
  ])
  const daysSinceStart = Math.max(1, Math.ceil((Date.now() - new Date(growth.first).getTime()) / 86_400_000))
  const totalIfAll = f.charges.paid.cents + f.charges.pending.cents - f.charges.refundedCents
  const now = new Date()
  const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const cur = f.months.find(m => m.key === curKey)
  const yearRows = f.months.filter(m => m.key.startsWith(String(now.getFullYear())))
  const ytdPaid = yearRows.reduce((s, m) => s + m.paidCents - m.refundedCents, 0)
  const ytdPending = yearRows.reduce((s, m) => s + m.pendingCents, 0)
  const maxMonth = Math.max(...f.months.map(m => m.paidCents + m.pendingCents), 1)
  const running = f.subs.active + f.subs.pastDue
  const plans: PlanKey[] = ['starter', 'pro', 'unlimited', ...(f.subs.byPlan.unbekannt.month + f.subs.byPlan.unbekannt.year > 0 ? ['unbekannt' as PlanKey] : [])]
  const monthlyN = plans.reduce((s, p) => s + f.subs.byPlan[p].month, 0)
  const yearlyN = plans.reduce((s, p) => s + f.subs.byPlan[p].year, 0)
  const pct = (n: number) => running ? Math.round(n / running * 100) : 0
  const PLAN_COLOR: Record<PlanKey, string> = { starter: '#3B82F6', pro: '#8B5CF6', unlimited: '#10B981', unbekannt: '#9CA3AF' }
  const pastDueRows = f.subs.rows.filter(r => r.status === 'past_due')
  const nm = f.subs.nextMonth

  return (
    <div style={{ maxWidth: 1080 }}>
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Finanzen</h1>
          <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
            Alle Zahlen direkt aus Stripe · Stand {new Date(f.generatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr · Beträge brutto inkl. USt
          </p>
        </div>
        <Link href="/admin/finanzen?fresh=1" className="px-4 py-2 text-sm font-semibold rounded-[12px] bg-white" style={{ ...card, color: '#111827' }}>
          Neu laden
        </Link>
      </div>

      {/* ── Umsatz ─────────────────────────────────────────────────────── */}
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Umsatz seit Start ({f.charges.firstPaymentAt ? date(f.charges.firstPaymentAt) : '–'})</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <Kpi label="Bezahlt" value={eur(f.charges.paid.cents - f.charges.refundedCents)} sub={`${f.charges.paid.count} Zahlungen${f.charges.refundedCents ? ` · ${eur(f.charges.refundedCents)} erstattet` : ''}`} tone="green" />
        <Kpi label="SEPA in Bearbeitung" value={eur(f.charges.pending.cents)} sub={`${f.charges.pending.count} Lastschriften laufen noch`} tone="amber" />
        <Kpi label="Summe, wenn alle SEPA durchgehen" value={eur(totalIfAll)} sub={`ohne USt ≈ ${eur(Math.round(totalIfAll / 1.19))}`} />
        <Kpi label="Offen / fehlgeschlagen" value={eur(f.charges.failedOpen.reduce((s, x) => s + x.amountCents, 0))}
          sub={`${f.charges.failedOpen.length} offen · ${f.charges.failedRecovered.count} später bezahlt (${eur(f.charges.failedRecovered.cents)})`}
          tone={f.charges.failedOpen.length ? 'red' : undefined} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Kpi label={`Dieser Monat bezahlt`} value={eur((cur?.paidCents ?? 0) - (cur?.refundedCents ?? 0))} sub={`${cur?.paidCount ?? 0} Zahlungen`} />
        <Kpi label="Dieser Monat SEPA offen" value={eur(cur?.pendingCents ?? 0)} sub={`${cur?.pendingCount ?? 0} Lastschriften`} />
        <Kpi label={`Jahr ${now.getFullYear()} bezahlt`} value={eur(ytdPaid)} sub={ytdPending ? `+ ${eur(ytdPending)} SEPA in Bearbeitung` : undefined} />
        <Kpi label="Stripe-Gebühren gesamt" value={eur(f.fees.totalCents)} sub={totalIfAll ? `${(f.fees.totalCents / totalIfAll * 100).toFixed(1)} % vom Umsatz` : undefined} />
      </div>

      {/* ── Geld in Stripe ─────────────────────────────────────────────── */}
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Geld in Stripe (nach Gebühren)</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-2">
        <Kpi label="Verfügbar" value={eur(f.balance.availableCents)} sub="sofort auszahlbar" tone="green" />
        <Kpi label="Kommt noch" value={eur(f.balance.pendingCents)} sub="inkl. SEPA in Bearbeitung" tone="amber" />
        <Kpi label="Guthaben gesamt" value={eur(f.balance.availableCents + f.balance.pendingCents)} />
        <Kpi label="Aufs Bankkonto ausgezahlt" value={eur(f.payouts.paidCents)}
          sub={f.payouts.count ? `${f.payouts.count} Auszahlungen · zuletzt ${date(f.payouts.lastPaidAt!)}${f.payouts.inTransitCents ? ` · ${eur(f.payouts.inTransitCents)} unterwegs` : ''}` : 'noch keine Auszahlung'}
          tone={f.payouts.count ? undefined : 'red'} />
      </div>
      <p className="text-xs mb-8" style={{ color: '#94A3B8' }}>Platzt eine SEPA-Lastschrift, zieht Stripe den Betrag wieder ab (plus ca. 3 bis 6 € Gebühr).</p>

      {/* ── Abos ───────────────────────────────────────────────────────── */}
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Abos</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <Kpi label="Zahlende Kunden" value={String(running)}
          sub={f.subs.pastDue ? `davon ${f.subs.pastDue} mit offener Zahlung (${f.subs.pastDueSepaRunning} davon: SEPA läuft noch)` : 'alle Zahlungen in Ordnung'} />
        <Kpi label={`Umsatz ${monthLabel(nm.key)} (mit Rabatt)`} value={eur(nm.cents)}
          sub={`${nm.monthlyCount} Monatsabos ${eur(nm.monthlyCents)} · ${nm.yearlyCount} Jahresabos ${eur(nm.yearlyCents)}`} tone="green" />
        <Kpi label="Neue Nutzer pro Tag" value={(growth.d30 / 30).toLocaleString('de-DE', { maximumFractionDigits: 1 })}
          sub={`Ø letzte 30 Tage · 7 Tage: ${(growth.d7 / 7).toLocaleString('de-DE', { maximumFractionDigits: 1 })}/Tag · seit Start: ${(growth.total / daysSinceStart).toLocaleString('de-DE', { maximumFractionDigits: 1 })}/Tag · heute ${growth.today}`} />
        <Kpi label="Gekündigt zum Periodenende" value={String(f.subs.cancelingAtPeriodEnd)}
          sub={f.subs.mrrAtRiskCents ? `− ${eur(f.subs.mrrAtRiskCents)} pro Monat` : 'keine Kündigungen'} tone={f.subs.cancelingAtPeriodEnd ? 'amber' : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        {/* Laufzeit */}
        <div className="rounded-[20px] bg-white p-5" style={card}>
          <p className="text-[11px] font-medium uppercase tracking-wide mb-3" style={{ color: '#94A3B8' }}>Monatlich oder jährlich</p>
          <div className="flex h-3 rounded-full overflow-hidden gap-px mb-4">
            <div style={{ width: `${pct(monthlyN)}%`, background: '#0EA5E9' }} />
            <div style={{ width: `${pct(yearlyN)}%`, background: '#F59E0B' }} />
          </div>
          {[['Monatlich', monthlyN, '#0EA5E9'], ['Jährlich', yearlyN, '#F59E0B']].map(([l, n, c]) => (
            <div key={l as string} className="flex items-center justify-between py-1.5">
              <span className="flex items-center gap-2 text-sm text-gray-700"><span className="w-2.5 h-2.5 rounded-full" style={{ background: c as string }} />{l}</span>
              <span className="text-sm"><b className="text-gray-900 text-base">{pct(n as number)} %</b> <span style={{ color: '#94A3B8' }}>· {n} Kunden</span></span>
            </div>
          ))}
        </div>
        {/* Tarife */}
        <div className="rounded-[20px] bg-white p-5" style={card}>
          <p className="text-[11px] font-medium uppercase tracking-wide mb-3" style={{ color: '#94A3B8' }}>Welcher Tarif</p>
          <div className="flex h-3 rounded-full overflow-hidden gap-px mb-4">
            {plans.map(p => <div key={p} style={{ width: `${pct(f.subs.byPlan[p].month + f.subs.byPlan[p].year)}%`, background: PLAN_COLOR[p] }} />)}
          </div>
          {plans.map(p => {
            const b = f.subs.byPlan[p], n = b.month + b.year
            return (
              <div key={p} className="flex items-center justify-between py-1.5">
                <span className="flex items-center gap-2 text-sm text-gray-700"><span className="w-2.5 h-2.5 rounded-full" style={{ background: PLAN_COLOR[p] }} />{PLAN_LABEL[p]}</span>
                <span className="text-sm"><b className="text-gray-900 text-base">{pct(n)} %</b> <span style={{ color: '#94A3B8' }}>· {n} Kunden ({b.month} mtl. / {b.year} jährl.)</span></span>
              </div>
            )
          })}
        </div>
      </div>

      {pastDueRows.length > 0 && (
        <div className="rounded-[20px] bg-white p-5 mb-8" style={card}>
          <p className="text-[11px] font-medium uppercase tracking-wide mb-2" style={{ color: '#94A3B8' }}>Kunden mit offener Zahlung</p>
          <p className="text-xs mb-3" style={{ color: '#94A3B8' }}>
            Stripe markiert ein Abo als „überfällig“, solange eine Rechnung nicht bezahlt ist. Bei SEPA ist das auch während der Bearbeitung so (bis zu 14 Tage). Die Seiten bleiben online.
          </p>
          {pastDueRows.map(r => (
            <div key={r.id} className="flex items-center justify-between gap-3 text-sm py-1.5 flex-wrap" style={{ borderTop: '1px solid #F8FAFC' }}>
              <span className="text-gray-900">{r.email ?? r.customerId}</span>
              <span style={{ color: '#94A3B8' }}>{PLAN_LABEL[r.plan]} · {r.interval === 'year' ? 'jährlich' : 'monatlich'} · {eur(r.effectiveCents)}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={r.sepaRunning ? { background: '#FEF3C7', color: '#92400E' } : { background: '#FEE2E2', color: '#B91C1C' }}>
                {r.sepaRunning ? 'SEPA läuft noch' : 'Zahlung offen'}
              </span>
            </div>
          ))}
        </div>
      )}
      {pastDueRows.length === 0 && <div className="mb-8" />}

      {/* ── Monate ─────────────────────────────────────────────────────── */}
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Umsatz pro Monat</h2>
      <div className="rounded-[20px] bg-white p-5 mb-8 overflow-x-auto" style={card}>
        <table className="w-full text-sm" style={{ minWidth: 560 }}>
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide" style={{ color: '#94A3B8' }}>
              <th className="pb-2 font-medium">Monat</th><th className="pb-2 font-medium text-right">Bezahlt</th>
              <th className="pb-2 font-medium text-right">SEPA offen</th><th className="pb-2 font-medium text-right">Summe</th>
              <th className="pb-2 font-medium" style={{ width: '32%' }}></th>
            </tr>
          </thead>
          <tbody>
            {[...f.months].reverse().map(m => {
              const paid = m.paidCents - m.refundedCents, sum = paid + m.pendingCents
              return (
                <tr key={m.key} style={{ borderTop: '1px solid #F1F5F9' }}>
                  <td className="py-2.5 text-gray-900">{monthLabel(m.key)}</td>
                  <td className="py-2.5 text-right">{eur(paid)}</td>
                  <td className="py-2.5 text-right" style={{ color: m.pendingCents ? '#D97706' : '#CBD5E1' }}>{eur(m.pendingCents)}</td>
                  <td className="py-2.5 text-right font-semibold">{eur(sum)}</td>
                  <td className="py-2.5 pl-4">
                    <div className="flex h-2 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
                      <div style={{ width: `${paid / maxMonth * 100}%`, background: '#16A34A' }} />
                      <div style={{ width: `${m.pendingCents / maxMonth * 100}%`, background: '#FBBF24' }} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Offene Zahlungen ───────────────────────────────────────────── */}
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Offene Zahlungen (fehlgeschlagen, nicht nachgeholt)</h2>
      <div className="rounded-[20px] bg-white p-5 mb-8" style={card}>
        {f.charges.failedOpen.length === 0 ? (
          <p className="text-sm" style={{ color: '#16A34A' }}>Keine offenen Zahlungen. Alle fehlgeschlagenen Versuche wurden später bezahlt.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {f.charges.failedOpen.map(x => (
              <div key={`${x.customerId}-${x.created}`} className="flex items-center justify-between gap-3 text-sm flex-wrap">
                <span className="text-gray-900">{x.email ?? x.customerId ?? 'unbekannt'}</span>
                <span style={{ color: '#94A3B8' }}>{date(x.created)} · {x.method === 'sepa_debit' ? 'SEPA' : x.method === 'card' ? 'Karte' : x.method} · {x.reason}</span>
                <span className="font-semibold" style={{ color: '#DC2626' }}>{eur(x.amountCents)}</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs mt-3" style={{ color: '#94A3B8' }}>
          Als „später bezahlt“ gilt ein Fehlschlag, wenn derselbe Kunde danach erfolgreich gezahlt hat oder eine SEPA-Lastschrift läuft.
        </p>
      </div>
    </div>
  )
}
