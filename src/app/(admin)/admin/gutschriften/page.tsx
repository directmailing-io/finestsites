import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { getServerSession, getServerUser } from '@/lib/auth/server'
import { listCreditNotes, reservedForPartners, partnersWithoutSubscription, referralDiscountFlags } from '@/lib/affiliate/credit-notes-admin'
import { methodLabelAdmin } from '@/lib/affiliate/payout-mode'
import { getStripe } from '@/lib/stripe/client'
import { getPlatformAvailableEur } from '@/lib/affiliate/payout'
import { formatEuro, formatDateDE, TAX_STATUS_LABEL, isTaxStatus } from '@/lib/affiliate/tax'

// Zugriff: (admin)/layout.tsx prüft users.is_admin – zusätzlich hier selbst, weil die Seite
// Steuerdaten aller Partner zeigt: nur der ECHT eingeloggte Admin (Sitzung, nicht die
// Impersonation-Identität) und nur, solange keine Impersonation aktiv ist.
export const dynamic = 'force-dynamic'

async function requireRealAdmin(): Promise<void> {
  const session = await getServerSession()
  const real = session?.user
  if (!real) redirect('/login')
  const effective = await getServerUser()
  if (!effective || effective.id !== real.id) redirect('/sites')
  const profile = await db.query.users.findFirst({ where: eq(users.id, real.id), columns: { isAdmin: true } })
  if (!profile?.isAdmin) redirect('/sites')
}

export default async function AdminCreditNotesPage() {
  await requireRealAdmin()
  const [rows, reserved, balance, noSub, discountFlags] = await Promise.all([
    listCreditNotes(500),
    reservedForPartners(),
    getPlatformAvailableEur(getStripe()).catch(() => null),
    partnersWithoutSubscription().catch(() => []),
    referralDiscountFlags(),
  ])
  const years = [...new Set(rows.map(r => r.number.slice(3, 7)))].sort().reverse()
  const pendingPdfs = rows.filter(r => !r.pdfReady).length

  return (
    <div style={{ maxWidth: 1100 }}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Gutschriften</h1>
        <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
          Alle Partner-Gutschriften (§ 14 Abs. 2 Satz 2 UStG) mit Download und CSV für die Steuerberatung
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Für Überweisungen reserviert (netto)" value={formatEuro(reserved.netCents)} sub={`${reserved.partners} Partner · Überweisung oder ohne Abo`} />
        <Stat label="+ USt-Schätzung (regelbesteuert)" value={formatEuro(reserved.vatEstimateCents)} sub={`Gesamt ${formatEuro(reserved.totalCents)}`} />
        <Stat label="Wird verrechnet (kein Geldabfluss)" value={formatEuro(reserved.credit.totalCents)}
          sub={`${reserved.credit.partners} Partner · netto ${formatEuro(reserved.credit.netCents)} + USt ${formatEuro(reserved.credit.vatEstimateCents)}`} />
        <Stat label="Stripe-Guthaben verfügbar (EUR)" value={balance == null ? '–' : formatEuro(balance)}
          sub={balance != null && balance < reserved.totalCents ? 'Reicht nicht für alle Überweisungen' : 'Auszahlungen bleiben manuell'}
          warn={balance != null && balance < reserved.totalCents} />
      </div>

      {noSub.length > 0 && (
        <div className="rounded-2xl mb-6 overflow-x-auto" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
          <div className="px-4 pt-4 pb-2">
            <p className="text-sm font-semibold" style={{ color: '#92400E' }}>Partner ohne Abo mit offenem Guthaben ({noSub.length})</p>
            <p className="text-xs mt-0.5" style={{ color: '#B45309' }}>
              Wollen verrechnen, haben aber kein aktives Abo. Mit Auszahlungskonto wird ab 10 € überwiesen, sonst bleibt das Guthaben stehen (Auszahlung auf Wunsch, AGB § 16).
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: '#92400E' }}>
                {['Partner', 'Abo-Status', 'Auszahlungskonto', 'Offen (netto)'].map(h => (
                  <th key={h} className={`${h.startsWith('Offen') ? 'text-right' : 'text-left'} font-semibold text-xs px-4 py-2 whitespace-nowrap`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {noSub.map(p => (
                <tr key={p.id} style={{ borderTop: '1px solid #FDE68A' }}>
                  <td className="px-4 py-2.5 text-gray-800">{p.username ?? '–'}{p.email && <span className="block text-xs text-gray-500">{p.email}</span>}</td>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{p.subscriptionStatus ?? 'kein Abo'}</td>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{p.hasConnect ? 'eingerichtet' : 'fehlt'}</td>
                  <td className="px-4 py-2.5 tabular-nums text-right font-semibold whitespace-nowrap">{formatEuro(p.openNetCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <a href="/api/admin/affiliate/credit-notes/export" className="text-sm font-semibold px-4 py-2 rounded-xl" style={{ background: '#1a1a1a', color: '#fff' }}>
          CSV (alle)
        </a>
        {years.map(y => (
          <a key={y} href={`/api/admin/affiliate/credit-notes/export?year=${y}`} className="text-sm font-semibold px-4 py-2 rounded-xl" style={{ background: '#F3F4F6', color: '#374151' }}>
            CSV {y}
          </a>
        ))}
        {pendingPdfs > 0 && (
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: '#FFF7ED', color: '#C2410C' }}>
            {pendingPdfs} PDF{pendingPdfs === 1 ? '' : 's'} noch offen (wird automatisch nachgeholt)
          </span>
        )}
      </div>

      <div className="rounded-2xl overflow-x-auto" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-500 p-6">Noch keine Gutschriften.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#F8FAFC', color: '#64748B' }}>
                {['Nr.', 'Datum', 'Partner', 'Steuerstatus', 'Netto', 'USt', 'Brutto', 'Methode', 'Stripe', ''].map(h => (
                  <th key={h} className={`${['Netto', 'USt', 'Brutto'].includes(h) ? 'text-right' : 'text-left'} font-semibold text-xs px-4 py-3 whitespace-nowrap`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                  <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{r.number}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.date ? formatDateDE(r.date) : '–'}</td>
                  <td className="px-4 py-3 text-gray-800">
                    {r.partnerName || '–'}
                    {r.username && <span className="block text-xs text-gray-400">{r.username}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{isTaxStatus(r.taxStatus) ? TAX_STATUS_LABEL[r.taxStatus] : (r.taxStatus ?? '–')}</td>
                  <td className="px-4 py-3 tabular-nums text-right whitespace-nowrap">{formatEuro(r.netCents)}</td>
                  <td className="px-4 py-3 tabular-nums text-right whitespace-nowrap">{formatEuro(r.vatCents)}</td>
                  <td className="px-4 py-3 tabular-nums text-right font-semibold whitespace-nowrap">{formatEuro(r.grossCents)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={r.method === 'credit' ? { background: '#EFF6FF', color: '#1D4ED8' } : { background: '#F0FDF4', color: '#15803D' }}>
                      {methodLabelAdmin(r.method)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono whitespace-nowrap">{r.stripeRef ?? '–'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <a href={`/api/affiliate/credit-notes/${r.id}`} target="_blank" rel="noopener" className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                      style={{ background: r.pdfReady ? '#F3F4F6' : '#FFF7ED', color: r.pdfReady ? '#374151' : '#C2410C' }}
                      title={r.pdfError ?? undefined}>
                      {r.pdfReady ? 'PDF' : 'PDF erzeugen'}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {discountFlags && (
        <div className="rounded-2xl mt-6 p-4" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
          <p className="text-sm font-semibold text-gray-900">Empfehlungsrabatt-Markierung ({discountFlags.length}{discountFlags.length === 100 ? '+' : ''})</p>
          <p className="text-xs mt-0.5 mb-3" style={{ color: '#94A3B8' }}>users.referral_discount_flag (gesetzt, nicht leer/false)</p>
          {discountFlags.length === 0 ? (
            <p className="text-sm text-gray-500">Keine Nutzer markiert.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {discountFlags.map(f => (
                <span key={f.id} className="text-xs px-2.5 py-1 rounded-full" style={{ background: '#F3F4F6', color: '#374151' }}>
                  {f.username ?? f.id.slice(0, 8)} · {f.flag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: warn ? '#FEF2F2' : '#fff', border: `1px solid ${warn ? '#FECACA' : '#E5E7EB'}` }}>
      <p className="text-xs font-semibold" style={{ color: '#94A3B8' }}>{label}</p>
      <p className="text-xl font-bold tabular-nums text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: warn ? '#991B1B' : '#94A3B8' }}>{sub}</p>}
    </div>
  )
}
