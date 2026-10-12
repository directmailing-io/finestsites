import { db } from '@/lib/db'
import { users, userSites, templates } from '@/lib/db/schema'
import { eq, sql, count, desc } from 'drizzle-orm'
import Link from 'next/link'
import { getFinanceSnapshot, type PlanKey } from '@/lib/admin/finance'
import { Section, Table, Row, Badge, Bar, eur, num, dateDE } from './_components/AdminTable'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Admin-Übersicht (neu 12.10.2026): ruhige Tabellen statt Karten.
 * Geld und Abos kommen aus Stripe (lib/admin/finance.ts), Nutzer/Seiten/Affiliates aus der DB.
 */

const PLAN_LABEL: Record<string, string> = { starter: 'Starter', pro: 'Pro', unlimited: 'Unlimited', unbekannt: 'Unbekannt' }
const PLAN_COLOR: Record<string, string> = { starter: '#3B82F6', pro: '#8B5CF6', unlimited: '#10B981', unbekannt: '#9CA3AF' }
const METHOD = (m: string | null) => m === 'sepa_debit' ? 'SEPA' : m === 'card' ? 'Karte' : m ?? '–'
const TEMPLATE_COLORS = ['#0F766E', '#7C3AED', '#2563EB', '#EA580C', '#DB2777', '#64748B', '#CA8A04', '#059669']

const link = (href: string, label = 'Alle ansehen →') =>
  <Link href={href} className="text-xs font-medium" style={{ color: '#2563EB' }}>{label}</Link>

type UpgradeRow = { id: string; user_id: string; plan: string; prev_plan: string; created_at: Date; email: string | null; username: string | null }
type AffRow = { id: string; username: string; referred: number; paying: number; commission_cents: number; paid_cents: number }
type DayRow = { day: string; n: number }
/** db.execute liefert je nach Treiber { rows } oder direkt ein Array */
const rowsOf = <T,>(r: unknown): T[] => ((r as { rows?: T[] }).rows ?? (r as T[]))

export default async function AdminPage() {
  const now = new Date()

  const [fin, [userStats], [{ total: publishedSites }], signupsRes, templateStats, affRes, upgradesRes, recentUsers] = await Promise.all([
    getFinanceSnapshot().catch(() => null),

    db.select({
      total: sql<number>`count(*)::int`,
      first: sql<Date>`min(${users.createdAt})`,
      d7: sql<number>`count(*) filter (where ${users.createdAt} >= now() - interval '7 days')::int`,
      d30: sql<number>`count(*) filter (where ${users.createdAt} >= now() - interval '30 days')::int`,
      today: sql<number>`count(*) filter (where (${users.createdAt} at time zone 'Europe/Berlin')::date = (now() at time zone 'Europe/Berlin')::date)::int`,
      withSite: sql<number>`count(*) filter (where exists (select 1 from user_sites s where s.user_id = ${users.id} and s.status = 'published'))::int`,
    }).from(users),

    db.select({ total: count() }).from(userSites).where(eq(userSites.status, 'published')),

    db.execute(sql`
      select to_char((created_at at time zone 'Europe/Berlin')::date, 'YYYY-MM-DD') as day, count(*)::int as n
      from users where created_at >= now() - interval '14 days'
      group by 1 order by 1`),

    db.select({
      id: templates.id, title: templates.title,
      live: sql<number>`(count(${userSites.id}) filter (where ${userSites.status} = 'published'))::int`,
      drafts: sql<number>`(count(${userSites.id}) filter (where ${userSites.status} = 'draft'))::int`,
    }).from(templates)
      .leftJoin(userSites, eq(userSites.templateId, templates.id))
      .where(eq(templates.status, 'published'))
      .groupBy(templates.id, templates.title)
      .orderBy(desc(sql`count(${userSites.id}) filter (where ${userSites.status} = 'published')`)),

    db.execute(sql`
      select r.id, r.username,
        count(u.id)::int as referred,
        (count(u.id) filter (where u.subscription_status in ('active','past_due','trialing')))::int as paying,
        coalesce((select sum(c.commission_amount) from affiliate_commissions c where c.referrer_id = r.id), 0)::int as commission_cents,
        coalesce((select sum(c.commission_amount) from affiliate_commissions c where c.referrer_id = r.id and c.status = 'paid'), 0)::int as paid_cents
      from users r join users u on u.referred_by_username = r.username
      group by r.id, r.username
      order by paying desc, referred desc
      limit 8`),

    db.execute(sql`
      with ranked as (
        select se.id, se.user_id, se.event_type, se.plan, se.created_at,
          lag(se.plan) over (partition by se.user_id order by se.created_at) as prev_plan,
          u.email, u.username
        from subscription_events se left join users u on u.id = se.user_id
        where se.plan is not null and se.event_type in ('subscription_created', 'subscription_updated')
      )
      select * from ranked
      where event_type = 'subscription_updated' and prev_plan is not null and plan <> prev_plan
        and (case plan when 'starter' then 1 when 'pro' then 2 when 'unlimited' then 3 else 0 end)
          > (case prev_plan when 'starter' then 1 when 'pro' then 2 when 'unlimited' then 3 else 0 end)
      order by created_at desc limit 6`),

    db.select({
      id: users.id, email: users.email, username: users.username, plan: users.plan,
      subscriptionStatus: users.subscriptionStatus, createdAt: users.createdAt,
    }).from(users).orderBy(desc(users.createdAt)).limit(8),
  ])

  const upgrades = rowsOf<UpgradeRow>(upgradesRes)
  const affRows = rowsOf<AffRow>(affRes)
  const dayRows = rowsOf<DayRow>(signupsRes)

  // ── Kennzahlen ──────────────────────────────────────────────────────────
  const paying = fin ? fin.subs.active + fin.subs.pastDue : 0
  const daysSinceStart = Math.max(1, Math.ceil((Date.now() - new Date(userStats.first).getTime()) / 86_400_000))
  const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const cur = fin?.months.find(m => m.key === curKey)
  const curPaid = (cur?.paidCents ?? 0) - (cur?.refundedCents ?? 0)
  const monthName = now.toLocaleDateString('de-DE', { month: 'long' })
  const nm = fin?.subs.nextMonth
  const nmLabel = nm ? new Date(Number(nm.key.slice(0, 4)), Number(nm.key.slice(5)) - 1, 1).toLocaleDateString('de-DE', { month: 'long' }) : ''
  const openCents = fin?.charges.failedOpen.reduce((s, x) => s + x.amountCents, 0) ?? 0

  const plans: PlanKey[] = ['starter', 'pro', 'unlimited']
  const monthlyN = fin ? plans.reduce((s, p) => s + fin.subs.byPlan[p].month, 0) : 0
  const yearlyN = fin ? plans.reduce((s, p) => s + fin.subs.byPlan[p].year, 0) : 0
  const pct = (n: number) => paying ? n / paying * 100 : 0
  const nmStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime() / 1000
  const nmEnd = new Date(now.getFullYear(), now.getMonth() + 2, 1).getTime() / 1000
  const nmByPlan = (p: PlanKey) => (fin?.subs.rows ?? [])
    .filter(r => r.plan === p && (r.status === 'active' || r.status === 'trialing' || r.status === 'past_due') && !r.cancelAtPeriodEnd
      && (r.interval === 'month' || (r.currentPeriodEnd != null && r.currentPeriodEnd >= nmStart && r.currentPeriodEnd < nmEnd)))
    .reduce((s, r) => s + r.nextChargeCents, 0)

  // Anmeldungen 14 Tage (lückenlos, deutsche Zeit)
  const days: { key: string; label: string; n: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000)
    const key = d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' })
    days.push({ key, label: d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' }), n: dayRows.find(r => r.day === key)?.n ?? 0 })
  }
  const maxDay = Math.max(1, ...days.map(d => d.n))
  const totalLive = templateStats.reduce((s, t) => s + t.live, 0) || 1

  return (
    <div style={{ maxWidth: 1080 }}>
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Übersicht</h1>
          <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
            {now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {fin && <> · Stripe-Stand {new Date(fin.generatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })} Uhr</>}
          </p>
        </div>
        <Link href="/admin/templates/new" className="px-4 py-2.5 text-sm font-semibold text-white rounded-[12px]" style={{ background: '#111827' }}>
          + Template
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-4">
        <Section title="Kunden & Wachstum">
          <Table head={['', 'Wert']} minWidth={320}>
            <Row strong cells={['Zahlende Kunden', num(paying)]} />
            <Row cells={['Registrierte Nutzer', num(userStats.total)]} />
            <Row cells={['davon mit veröffentlichter Seite', num(userStats.withSite)]} />
            <Row cells={['Zahlquote (zahlend / registriert)', `${num(userStats.total ? paying / userStats.total * 100 : 0)} %`]} />
            <Row cells={['Neue Nutzer pro Tag, Ø 30 Tage', num(userStats.d30 / 30, 1)]} />
            <Row cells={['Neue Nutzer pro Tag, Ø 7 Tage', num(userStats.d7 / 7, 1)]} />
            <Row cells={['Neue zahlende Kunden pro Tag, Ø 30 Tage', fin ? num(fin.subs.newPaying.d30 / 30, 1) : '–']} />
            <Row muted cells={['Heute neu · Ø pro Tag seit Start', `${num(userStats.today)} · ${num(userStats.total / daysSinceStart, 1)}`]} />
            <Row cells={['Veröffentlichte Seiten', num(publishedSites)]} />
            <Row tone={fin?.subs.cancelingAtPeriodEnd ? 'amber' : undefined} cells={['Gekündigt zum Periodenende', num(fin?.subs.cancelingAtPeriodEnd ?? 0)]} />
          </Table>
        </Section>

        <Section title="Geld" action={link('/admin/finanzen', 'Finanzen →')}>
          <Table head={['', 'Betrag']} minWidth={320}>
            <Row tone="green" cells={[`Bezahlt im ${monthName}`, eur(curPaid)]} />
            <Row tone="amber" cells={['+ SEPA-Lastschriften laufen noch', eur(cur?.pendingCents ?? 0)]} />
            <Row strong cells={[`Summe ${monthName}`, eur(curPaid + (cur?.pendingCents ?? 0))]} />
            <Row cells={[`Erwartet im ${nmLabel} (mit Rabatt)`, nm ? eur(nm.cents) : '–']} />
            <Row muted cells={['davon Monats- / Jahresabos', nm ? `${nm.monthlyCount} / ${nm.yearlyCount}` : '–']} />
            <Row cells={['Umsatz seit Start (inkl. laufender SEPA)', fin ? eur(fin.charges.paid.cents - fin.charges.refundedCents + fin.charges.pending.cents) : '–']} />
            <Row tone="green" cells={['In Stripe verfügbar', fin ? eur(fin.balance.availableCents) : '–']} />
            <Row cells={['In Stripe, kommt noch', fin ? eur(fin.balance.pendingCents) : '–']} />
            <Row tone={openCents ? 'red' : undefined} cells={['Offene Zahlungen', fin ? `${fin.charges.failedOpen.length} · ${eur(openCents)}` : '–']} />
          </Table>
        </Section>
      </div>

      <Section title="Tarif-Verteilung" hint={`${num(paying)} zahlende Kunden · Umsatz ${nmLabel} = was dann tatsächlich abgebucht wird, mit Rabatt`}>
        {fin ? (
          <Table head={['Tarif', 'Monatlich', 'Jährlich', 'Kunden', 'Anteil', `Umsatz ${nmLabel}`]} minWidth={640}>
            {plans.map(p => {
              const b = fin.subs.byPlan[p], n = b.month + b.year
              return <Row key={p} cells={[
                <span key="l" className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: PLAN_COLOR[p] }} />{PLAN_LABEL[p]}</span>,
                num(b.month), num(b.year), num(n), <Bar key="b" pct={pct(n)} color={PLAN_COLOR[p]} />, eur(nmByPlan(p))]} />
            })}
            <Row strong cells={['Summe', num(monthlyN), num(yearlyN), num(paying), '100 %', eur(nm?.cents ?? 0)]} />
            <Row muted cells={['Anteil monatlich / jährlich', `${num(pct(monthlyN))} %`, `${num(pct(yearlyN))} %`, '', '', '']} />
          </Table>
        ) : <p className="text-sm px-4 py-3" style={{ color: '#B91C1C' }}>Stripe gerade nicht erreichbar.</p>}
      </Section>

      <Section title="Neue Nutzer pro Tag" hint="Letzte 14 Tage">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-end gap-1.5" style={{ height: 96 }}>
            {days.map(d => (
              <div key={d.key} className="flex-1 flex flex-col items-center justify-end h-full" title={`${d.label}: ${d.n}`}>
                <span className="text-[10px] mb-1 font-semibold" style={{ color: d.n ? '#334155' : '#CBD5E1' }}>{d.n}</span>
                <div className="w-full rounded-t-[4px]" style={{ height: `${Math.max(3, d.n / maxDay * 70)}px`, background: d.n ? '#3B82F6' : '#E2E8F0' }} />
              </div>
            ))}
          </div>
          <div className="flex gap-1.5 mt-1.5">
            {days.map(d => <span key={d.key} className="flex-1 text-center text-[9.5px]" style={{ color: '#94A3B8' }}>{d.label}</span>)}
          </div>
        </div>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-4">
        <Section title="Beliebteste Seiten" action={link('/admin/sites')}>
          <Table head={['Template', 'Live', 'Entwürfe', 'Anteil']} minWidth={420}>
            {templateStats.map((t, i) => (
              <Row key={t.id} cells={[t.title, num(t.live), num(t.drafts), <Bar key="b" pct={t.live / totalLive * 100} color={TEMPLATE_COLORS[i % TEMPLATE_COLORS.length]} />]} />
            ))}
          </Table>
        </Section>

        <Section title="Top Affiliates" action={link('/admin/affiliate')}>
          {affRows.length === 0 ? <p className="text-sm px-4 py-3" style={{ color: '#94A3B8' }}>Noch keine Empfehlungen.</p> : (
            <Table head={['Partner', 'Geworben', 'Zahlend', 'Provision']} minWidth={420}>
              {affRows.map(a => (
                <Row key={a.id} cells={[
                  <Link key="l" href={`/admin/users/${a.id}`} className="hover:underline">@{a.username}</Link>,
                  num(a.referred), num(a.paying),
                  a.commission_cents ? `${eur(a.commission_cents)}${a.paid_cents >= a.commission_cents ? '' : ' (offen)'}` : '–']} />
              ))}
            </Table>
          )}
        </Section>
      </div>

      <Section title="Letzte Zahlungen" action={link('/admin/transactions')}>
        {fin ? (
          <Table head={['Kunde', 'Datum', 'Art', 'Status', 'Betrag']} minWidth={600}>
            {fin.charges.recent.slice(0, 10).map((c, i) => (
              <Row key={i} cells={[c.email ?? '–', dateDE(c.created), METHOD(c.method),
                c.status === 'succeeded' ? <Badge key="b" tone="green">{c.refundedCents ? 'erstattet' : 'bezahlt'}</Badge>
                  : c.status === 'pending' ? <Badge key="b" tone="amber">SEPA läuft</Badge>
                  : <Badge key="b" tone="red">fehlgeschlagen</Badge>,
                eur(c.amountCents)]} />
            ))}
          </Table>
        ) : <p className="text-sm px-4 py-3" style={{ color: '#B91C1C' }}>Stripe gerade nicht erreichbar.</p>}
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-4">
        <Section title="Letzte Upgrades" action={link('/admin/upgrades')}>
          {upgrades.length === 0 ? <p className="text-sm px-4 py-3" style={{ color: '#94A3B8' }}>Noch keine Upgrades.</p> : (
            <Table head={['Nutzer', 'Datum', 'Wechsel']} minWidth={420}>
              {upgrades.map(u => (
                <Row key={u.id} cells={[
                  <Link key="l" href={`/admin/users/${u.user_id}`} className="hover:underline">{u.username ? `@${u.username}` : u.email}</Link>,
                  dateDE(new Date(u.created_at)),
                  `${PLAN_LABEL[u.prev_plan] ?? u.prev_plan} → ${PLAN_LABEL[u.plan] ?? u.plan}`]} />
              ))}
            </Table>
          )}
        </Section>

        <Section title="Neueste Nutzer" action={link('/admin/users')}>
          <Table head={['Nutzer', 'Datum', 'Status']} minWidth={420}>
            {recentUsers.map(u => {
              const payingNow = u.subscriptionStatus === 'active' || u.subscriptionStatus === 'past_due' || u.subscriptionStatus === 'trialing'
              return (
                <Row key={u.id} cells={[
                  <Link key="l" href={`/admin/users/${u.id}`} className="hover:underline">{u.username ? `@${u.username}` : u.email}</Link>,
                  dateDE(u.createdAt),
                  payingNow ? <Badge key="b" tone="violet">{PLAN_LABEL[u.plan] ?? u.plan}</Badge> : <Badge key="b">ohne Abo</Badge>]} />
              )
            })}
          </Table>
        </Section>
      </div>
    </div>
  )
}
