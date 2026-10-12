import type { ReactNode } from 'react'

/** Gemeinsame, ruhige Tabellen-Bausteine für Dashboard und Finanzen (Server-Komponenten). */

export const eur = (cents: number) =>
  (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
export const num = (n: number, digits = 0) => n.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits })
export const dateDE = (d: Date | number) =>
  (typeof d === 'number' ? new Date(d * 1000) : d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })

export function Section({ title, hint, action, children }: { title: string; hint?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-6">
      <div className="flex items-end justify-between gap-3 mb-2 px-1">
        <div>
          <h2 className="text-[15px] font-semibold text-gray-900">{title}</h2>
          {hint && <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{hint}</p>}
        </div>
        {action}
      </div>
      <div className="rounded-[16px] bg-white overflow-x-auto" style={{ border: '1px solid #EEF0F3', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {children}
      </div>
    </section>
  )
}

export function Table({ head, children, minWidth = 520 }: { head: (string | { label: string; right?: boolean })[]; children: ReactNode; minWidth?: number }) {
  return (
    <table className="w-full text-sm" style={{ minWidth, borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ background: '#F8FAFC' }}>
          {head.map((h, i) => {
            const label = typeof h === 'string' ? h : h.label
            const right = typeof h === 'string' ? i > 0 : !!h.right
            return (
              <th key={i} className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide ${right ? 'text-right' : 'text-left'}`}
                style={{ color: '#94A3B8', borderBottom: '1px solid #EEF0F3' }}>{label}</th>
            )
          })}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  )
}

export function Row({ cells, strong, muted, tone }: {
  cells: ReactNode[]; strong?: boolean; muted?: boolean; tone?: 'green' | 'amber' | 'red'
}) {
  const color = tone === 'green' ? '#15803D' : tone === 'amber' ? '#B45309' : tone === 'red' ? '#B91C1C' : undefined
  return (
    <tr style={{ borderTop: strong ? '1.5px solid #E5E7EB' : '1px solid #F3F4F6' }}>
      {cells.map((c, i) => (
        <td key={i} className={`px-4 py-2.5 ${i > 0 ? 'text-right' : 'text-left'} ${strong ? 'font-semibold' : ''}`}
          style={{ color: muted ? '#94A3B8' : i > 0 && color ? color : '#111827', whiteSpace: i > 0 ? 'nowrap' : undefined }}>
          {c}
        </td>
      ))}
    </tr>
  )
}

export function Badge({ children, tone = 'gray' }: { children: ReactNode; tone?: 'green' | 'amber' | 'red' | 'gray' | 'violet' | 'blue' }) {
  const t = {
    green: ['#DCFCE7', '#166534'], amber: ['#FEF3C7', '#92400E'], red: ['#FEE2E2', '#991B1B'],
    gray: ['#F1F5F9', '#475569'], violet: ['#EDE9FE', '#5B21B6'], blue: ['#DBEAFE', '#1E40AF'],
  }[tone]
  return <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: t[0], color: t[1] }}>{children}</span>
}

/** Kleiner Anteilsbalken für Tabellenzellen. */
export function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <span className="inline-flex items-center gap-2 justify-end w-full">
      <span className="inline-block h-1.5 rounded-full overflow-hidden" style={{ width: 70, background: '#F1F5F9' }}>
        <span className="block h-full" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />
      </span>
      <span style={{ minWidth: 34, display: 'inline-block' }}>{num(pct)} %</span>
    </span>
  )
}
