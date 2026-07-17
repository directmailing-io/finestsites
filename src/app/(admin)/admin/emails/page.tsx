import { db } from '@/lib/db'
import { emailLogs } from '@/lib/db/schema'
import { desc, gte } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const RESEND_MONTHLY_QUOTA = 3000

const TYPE_LABELS: Record<string, string> = {
  welcome: 'Willkommen',
  verification: 'E-Mail bestätigen',
  password_reset: 'Passwort zurücksetzen',
  newsletter: 'Newsletter',
  waitlist_confirm: 'Waitlist Bestätigung',
  waitlist_welcome: 'Waitlist Willkommen',
  waitlist_broadcast: 'Waitlist Broadcast',
  affiliate_payout: 'Affiliate Auszahlung',
  affiliate_referral: 'Affiliate Empfehlung',
  subscription_confirmation: 'Abo-Bestätigung',
  account_canceled: 'Konto gekündigt',
  account_deactivated: 'Konto deaktiviert',
  account_reactivated: 'Konto reaktiviert',
  payment_failed: 'Zahlung fehlgeschlagen',
  payment_warning: 'Zahlungswarnung',
  domain_active: 'Domain aktiv',
}

export default async function AdminEmailsPage() {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [thisMonthLogs, recentLogs] = await Promise.all([
    // All logs this month for summary
    db.select({
      type: emailLogs.type,
      status: emailLogs.status,
    })
      .from(emailLogs)
      .where(gte(emailLogs.sentAt, monthStart)),

    // Last 200 entries for the log table
    db.select()
      .from(emailLogs)
      .orderBy(desc(emailLogs.sentAt))
      .limit(1000),
  ])

  const totalThisMonth = thisMonthLogs.length
  const sentThisMonth = thisMonthLogs.filter(l => l.status === 'sent').length
  const errorThisMonth = thisMonthLogs.filter(l => l.status === 'error').length
  const quotaPercent = Math.round((totalThisMonth / RESEND_MONTHLY_QUOTA) * 100)

  // Group by type
  const byType: Record<string, { sent: number; error: number }> = {}
  for (const log of thisMonthLogs) {
    if (!byType[log.type]) byType[log.type] = { sent: 0, error: 0 }
    if (log.status === 'sent') byType[log.type].sent++
    else byType[log.type].error++
  }
  const typeSorted = Object.entries(byType).sort((a, b) => (b[1].sent + b[1].error) - (a[1].sent + a[1].error))

  const quotaColor = quotaPercent >= 90 ? '#DC2626' : quotaPercent >= 70 ? '#D97706' : '#16A34A'

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-semibold mb-1" style={{ color: '#1a1a1a' }}>E-Mail Log</h1>
      <p className="text-sm mb-8" style={{ color: '#6B7280' }}>
        Alle versendeten E-Mails — {now.toLocaleString('de-DE', { month: 'long', year: 'numeric' })}
      </p>

      {/* Quota card */}
      <div className="rounded-xl border p-6 mb-6" style={{ borderColor: '#E5E7EB', background: '#fff' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium" style={{ color: '#6B7280' }}>Resend Kontingent</p>
            <p className="text-3xl font-bold mt-1" style={{ color: '#1a1a1a' }}>
              {totalThisMonth.toLocaleString('de-DE')}
              <span className="text-base font-normal ml-1" style={{ color: '#6B7280' }}>
                / {RESEND_MONTHLY_QUOTA.toLocaleString('de-DE')} pro Monat
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold" style={{ color: quotaColor }}>{quotaPercent}%</p>
            <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
              {sentThisMonth} gesendet &bull; {errorThisMonth} Fehler
            </p>
          </div>
        </div>
        <div className="h-3 rounded-full overflow-hidden" style={{ background: '#F3F4F6' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.min(quotaPercent, 100)}%`, background: quotaColor }}
          />
        </div>
        {quotaPercent >= 70 && (
          <p className="text-sm mt-3 font-medium" style={{ color: quotaColor }}>
            {quotaPercent >= 90
              ? 'Kontingent fast ausgeschöpft — bitte Resend-Plan upgraden.'
              : 'Kontingent über 70% — im Auge behalten.'}
          </p>
        )}
      </div>

      {/* By type this month */}
      {typeSorted.length > 0 && (
        <div className="rounded-xl border mb-8" style={{ borderColor: '#E5E7EB', background: '#fff' }}>
          <div className="px-6 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <h2 className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>Diesen Monat nach Typ</h2>
          </div>
          <div className="divide-y" style={{ borderColor: '#F3F4F6' }}>
            {typeSorted.map(([type, counts]) => (
              <div key={type} className="flex items-center justify-between px-6 py-3">
                <span className="text-sm" style={{ color: '#374151' }}>
                  {TYPE_LABELS[type] ?? type}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium" style={{ color: '#1a1a1a' }}>{counts.sent}</span>
                  {counts.error > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#FEE2E2', color: '#DC2626' }}>
                      {counts.error} Fehler
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Log table */}
      <div className="rounded-xl border" style={{ borderColor: '#E5E7EB', background: '#fff' }}>
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <h2 className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>Letzte 1.000 E-Mails</h2>
        </div>
        {recentLogs.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm" style={{ color: '#9CA3AF' }}>
            Noch keine E-Mails geloggt.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #F3F4F6' }}>
                  <th className="px-4 py-3 text-left font-medium text-xs" style={{ color: '#6B7280' }}>Zeitpunkt</th>
                  <th className="px-4 py-3 text-left font-medium text-xs" style={{ color: '#6B7280' }}>Typ</th>
                  <th className="px-4 py-3 text-left font-medium text-xs" style={{ color: '#6B7280' }}>Empfänger</th>
                  <th className="px-4 py-3 text-left font-medium text-xs" style={{ color: '#6B7280' }}>Betreff</th>
                  <th className="px-4 py-3 text-left font-medium text-xs" style={{ color: '#6B7280' }}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#F3F4F6' }}>
                {recentLogs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#6B7280' }}>
                      {new Date(log.sentAt).toLocaleString('de-DE', {
                        day: '2-digit', month: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#F3F4F6', color: '#374151' }}>
                        {TYPE_LABELS[log.type] ?? log.type}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: '#374151', maxWidth: '200px' }}>
                      <span className="truncate block">{log.to}</span>
                    </td>
                    <td className="px-4 py-3" style={{ color: '#374151', maxWidth: '260px' }}>
                      <span className="truncate block">{log.subject}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {log.status === 'sent' ? (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#DCFCE7', color: '#16A34A' }}>
                          Gesendet
                        </span>
                      ) : (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full cursor-help"
                          style={{ background: '#FEE2E2', color: '#DC2626' }}
                          title={log.errorMessage ?? ''}
                        >
                          Fehler
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
