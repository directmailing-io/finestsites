import { monthsSince } from '@/lib/admin/belege'
import BelegeMonths from './BelegeMonths'

export const dynamic = 'force-dynamic'

// Erster Monat mit Stripe-Rechnungen; ältere Monate wären leer
const FIRST_MONTH = '2026-01'

export default function AdminBelegePage() {
  const months = monthsSince(FIRST_MONTH)
  return (
    <div style={{ maxWidth: 1000 }}>
      <div className="mb-5 sm:mb-6">
        <h1 className="text-[22px] sm:text-2xl font-semibold text-gray-900 tracking-tight">Belege</h1>
        <p className="text-[13px] sm:text-sm mt-1" style={{ color: '#94A3B8' }}>
          Rechnungen, Gutschriften und Stripe-Auszahlungen je Monat · ZIP für die Steuerberatung
        </p>
      </div>
      <BelegeMonths months={months} />
    </div>
  )
}
