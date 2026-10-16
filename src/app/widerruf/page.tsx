import { redirect } from 'next/navigation'

// Seit 16.10.2026 nur noch Verträge mit Unternehmern (AGB § 1 Abs. 3) → kein
// Verbraucher-Widerrufsrecht mehr. Alte Links landen in den AGB.
export default function WiderrufsbelehrungPage() {
  redirect('/agb')
}
