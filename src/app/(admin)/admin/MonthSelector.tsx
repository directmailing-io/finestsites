'use client'

import { useRouter } from 'next/navigation'

export default function MonthSelector({
  selected,
  months,
}: {
  selected: string
  months: { value: string; label: string }[]
}) {
  const router = useRouter()
  return (
    <select
      value={selected}
      onChange={e => router.push(`/admin?month=${e.target.value}`)}
      className="text-sm rounded-[10px] px-3 py-1.5 focus:outline-none cursor-pointer"
      style={{ border: '1px solid #E5E7EB', color: '#374151', background: '#fff' }}
    >
      {months.map(m => (
        <option key={m.value} value={m.value}>{m.label}</option>
      ))}
    </select>
  )
}
