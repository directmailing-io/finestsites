import Link from 'next/link'
import { getFinanceSnapshot, type PlanKey } from '@/lib/admin/finance'
import { Section, Table, Row, Badge, Bar, eur, num, dateDE } from '../_components/AdminTable'

export const dynamic = 'force-dynamic'

const monthLabel = (k: string) => {
  const [y, m] = k.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
}
const PLAN_LABEL: Record<PlanKey, string> = { starter: 'Starter', pro: 'Pro', unlimited: 'Unlimited', unbekannt: 'Unbekannt' }
const PLAN_COLOR: Record<PlanKey, string> = { starter: '#3B82F6', pro: '#8B5CF6', unlimited: '#10B981', unbekannt: '#9CA3AF' }
const METHOD = (m: string | null) => m === 'sepa_debit' ? 'SEPA' : m === 'card' ? 'Karte' : m ?? '–'

export default async function FinanzenPage({ searchParams }: { searchParams: Promise<{ fresh?: string }> }) {
  const sp = await searchParams
  const f = await getFinanceSnapshot({ fresh: sp.fresh === '1' })
  const now = new Date()
  const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const cur = f.months.find(m => m.key === curKey)
  const paidNet = f.charges.paid.cents - f.charges.refundedCents
  const totalIfAll = paidNet + f.charges.pending.cents
  const openCents = f.charges.failedOpen.reduce((s, x) => s + x.amountCents, 0)
  const running = f.subs.active + f.subs.pastDue
  const plans: PlanKey[] = ['starter', 'pro', 'unlimited', ...(f.subs.byPlan.unbekannt.month + f.subs.byPlan.unbekannt.year > 0 ? ['unbekannt' as PlanKey] : [])]
  const monthlyN = plans.reduce((s, p) => s + f.subs.byPlan[p].month, 0)
  const yearlyN = plans.reduce((s, p) => s + f.subs.byPlan[p].year, 0)
  const pct = (n: number) => running ? n / running * 100 : 0
  const nm = f.subs.nextMonth
  const pastDueRows = f.subs.rows.filter(r => r.status === 'past_due')
  // Umsatz nächster Monat je Tarif (mit Rabatt)
  const nmByPlan: Record<string, number> = {}
  const nmStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime() / 1000
  const nmEnd = new Date(now.getFullYear(), now.getMonth() + 2, 1).getTime() / 1000
  for (const r of f.subs.rows) {
    if (!(r.status === 'active' || r.status === 'trialing' || r.status === 'past_due') || r.cancelAtPeriodEnd) continue
    if (r.interval === 'month' || (r.currentPeriodEnd && r.currentPeriodEnd >= nmStart && r.currentPeriodEnd < nmEnd)) {
      nmByPlan[r.plan] = (nmByPlan[r.plan] ?? 0) + r.nextChargeCents
    }
  }

  return (
    <div style={{ maxWidth: 1000 }}>
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Finanzen</h1>
          <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
            Direkt aus Stripe · Stand {new Date(f.generatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr · alle Beträge brutto inkl. USt
          </p>
        </div>
        <Link href="/admin/finanzen?fresh=1" className="px-4 py-2 text-sm font-semibold rounded-[12px] bg-white"
          style={{ border: '1px solid #E5E7EB', color: '#111827' }}>Neu laden</Link>
      </div>

      <Section title="Umsatz" hint={`Seit der ersten Zahlung am ${f.charges.firstPaymentAt ? dateDE(f.charges.firstPaymentAt) : '–'}`}>
        <Table head={['', 'Anzahl', 'Gesamt', monthLabel(curKey)]}>
          <Row tone="green" cells={['Bezahlt', num(f.charges.paid.count), eur(paidNet), eur((cur?.paidCents ?? 0) - (cur?.refundedCents ?? 0))]} />
          <Row tone="amber" cells={['SEPA-Lastschrift läuft noch (Bank bestätigt in 3–14 Tagen)', num(f.charges.pending.count), eur(f.charges.pending.cents), eur(cur?.pendingCents ?? 0)]} />
          <Row strong cells={['Summe, wenn alle Lastschriften durchgehen', num(f.charges.paid.count + f.charges.pending.count), eur(totalIfAll), eur((cur?.paidCents ?? 0) - (cur?.refundedCents ?? 0) + (cur?.pendingCents ?? 0))]} />
          <Row muted cells={['davon ohne USt (÷ 1,19, grob)', '', eur(Math.round(totalIfAll / 1.19)), eur(Math.round(((cur?.paidCents ?? 0) + (cur?.pendingCents ?? 0)) / 1.19))]} />
          <Row tone={openCents ? 'red' : undefined} cells={['Offen (fehlgeschlagen, nicht nachgeholt)', num(f.charges.failedOpen.length), eur(openCents), '']} />
          <Row muted cells={['Fehlgeschlagen, aber später bezahlt (kein Ausfall)', num(f.charges.failedRecovered.count), eur(f.charges.failedRecovered.cents), '']} />
          <Row muted cells={['Stripe-Gebühren', '', eur(f.fees.totalCents), '']} />
        </Table>
      </Section>

      <Section title="Geld in Stripe" hint="Nach Gebühren. Platzt eine Lastschrift, zieht Stripe sie wieder ab (plus ca. 3–6 € Gebühr).">
        <Table head={['', 'Betrag']} minWidth={360}>
          <Row tone="green" cells={['Verfügbar, sofort auszahlbar', eur(f.balance.availableCents)]} />
          <Row tone="amber" cells={['Kommt noch (inkl. laufender Lastschriften)', eur(f.balance.pendingCents)]} />
          <Row strong cells={['Guthaben gesamt', eur(f.balance.availableCents + f.balance.pendingCents)]} />
          <Row tone={f.payouts.count ? undefined : 'red'} cells={[
            f.payouts.count ? `Aufs Bankkonto ausgezahlt (${f.payouts.count}×, zuletzt ${dateDE(f.payouts.lastPaidAt!)})` : 'Aufs Bankkonto ausgezahlt – noch nie',
            eur(f.payouts.paidCents)]} />
          {f.payouts.inTransitCents > 0 && <Row cells={['Auszahlung unterwegs', eur(f.payouts.inTransitCents)]} />}
        </Table>
      </Section>

      <Section title="Abos" hint={`${running} zahlende Kunden · Umsatz ${monthLabel(nm.key)} = was dann tatsächlich abgebucht wird, mit Rabatt`}>
        <Table head={['Tarif', 'Monatlich', 'Jährlich', 'Kunden', 'Anteil', `Umsatz ${monthLabel(nm.key).split(' ')[0]}`]} minWidth={640}>
          {plans.map(p => {
            const b = f.subs.byPlan[p], n = b.month + b.year
            return <Row key={p} cells={[
              <span key="l" className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: PLAN_COLOR[p] }} />{PLAN_LABEL[p]}</span>,
              num(b.month), num(b.year), num(n), <Bar key="b" pct={pct(n)} color={PLAN_COLOR[p]} />, eur(nmByPlan[p] ?? 0)]} />
          })}
          <Row strong cells={['Summe', num(monthlyN), num(yearlyN), num(running), '100 %', eur(nm.cents)]} />
          <Row muted cells={['Anteil', `${num(pct(monthlyN))} %`, `${num(pct(yearlyN))} %`, '', '', '']} />
        </Table>
      </Section>

      <Section title="Laufende Lastschriften erklärt"
        hint="Warum Stripe nur wenige Abos als „überfällig“ zeigt, obwohl viele Lastschriften laufen">
        <Table head={['', 'Anzahl', 'Betrag', 'Status in Stripe']} minWidth={620}>
          <Row cells={['Neuanmeldung per SEPA: Abo startet sofort, Geld kommt nach Bankbestätigung', num(f.charges.pendingSplit.activeCount), eur(f.charges.pendingSplit.activeCents), <Badge key="b" tone="green">aktiv</Badge>]} />
          <Row cells={['Upgrade per SEPA: Stripe zeigt „überfällig“, bis die Bank bestätigt', num(f.charges.pendingSplit.pastDueCount), eur(f.charges.pendingSplit.pastDueCents), <Badge key="b" tone="amber">überfällig</Badge>]} />
        </Table>
        <p className="text-xs px-4 py-3" style={{ color: '#64748B', borderTop: '1px solid #F3F4F6' }}>
          Beides ist normal und kein Zahlungsproblem. Die Kunden sehen in der App keinen Warnhinweis, ihre Seiten bleiben online.
          Echte Probleme stehen unten unter „Kunden mit offener Zahlung“ (rot).
        </p>
      </Section>

      {pastDueRows.length > 0 && (
        <Section title="Kunden mit Status „überfällig“">
          <Table head={['Kunde', 'Tarif', 'Betrag', 'Grund']} minWidth={560}>
            {pastDueRows.map(r => (
              <Row key={r.id} cells={[r.email ?? r.customerId, `${PLAN_LABEL[r.plan]} · ${r.interval === 'year' ? 'jährlich' : 'monatlich'}`, eur(r.effectiveCents),
                r.sepaRunning ? <Badge key="b" tone="amber">SEPA läuft noch</Badge> : <Badge key="b" tone="red">Zahlung offen</Badge>]} />
            ))}
          </Table>
        </Section>
      )}

      <Section title="Umsatz pro Monat">
        <Table head={['Monat', 'Bezahlt', 'SEPA läuft', 'Summe']} minWidth={480}>
          {[...f.months].reverse().map(m => {
            const paid = m.paidCents - m.refundedCents
            return <Row key={m.key} cells={[monthLabel(m.key), eur(paid), m.pendingCents ? eur(m.pendingCents) : '–', <b key="s">{eur(paid + m.pendingCents)}</b>]} />
          })}
        </Table>
      </Section>

      <Section title="Offene Zahlungen" hint="Fehlgeschlagen und vom Kunden nicht nachgeholt">
        {f.charges.failedOpen.length === 0 ? (
          <p className="text-sm px-4 py-3" style={{ color: '#15803D' }}>Keine offenen Zahlungen.</p>
        ) : (
          <Table head={['Kunde', 'Datum', 'Art', 'Grund', 'Betrag']} minWidth={600}>
            {f.charges.failedOpen.map(x => (
              <Row key={`${x.customerId}-${x.created}`} tone="red" cells={[x.email ?? x.customerId ?? '–', dateDE(x.created), METHOD(x.method), x.reason ?? '–', eur(x.amountCents)]} />
            ))}
          </Table>
        )}
      </Section>
    </div>
  )
}
