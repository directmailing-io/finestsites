import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { getServerSession, getServerUser } from '@/lib/auth/server'
import { listCreditNotes, reservedForPartners } from '@/lib/affiliate/credit-notes-admin'
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
  const [rows, reserved, balance] = await Promise.all([
    listCreditNotes(500),
    reservedForPartners(),
    getPlatformAvailableEur(getStripe()).catch(() => null),
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Stat label="Für Partner reserviert (netto)" value={formatEuro(reserved.netCents)} sub={`${reserved.partners} Partner · ausstehend + verfügbar`} />
        <Stat label="+ USt-Schätzung (regelbesteuert)" value={formatEuro(reserved.vatEstimateCents)} sub={`Gesamt ${formatEuro(reserved.totalCents)}`} />
        <Stat label="Stripe-Guthaben verfügbar (EUR)" value={balance == null ? '–' : formatEuro(balance)}
          sub={balance != null && balance < reserved.totalCents ? 'Reicht nicht für alle Reservierungen' : 'Auszahlungen bleiben manuell'}
          warn={balance != null && balance < reserved.totalCents} />
      </div>

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
                {['Nr.', 'Datum', 'Partner', 'Steuerstatus', 'Netto', 'USt', 'Brutto', 'Transfer', ''].map(h => (
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
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono whitespace-nowrap">{r.transferId ?? '–'}</td>
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
