import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type Row = {
  id: string
  full_name: string | null
  category: string
  status: string
  submitted_at: Date | null
  created_at: Date
  image_count: number
  video_count: number
  audio_count: number
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  new: { label: 'Neu', color: '#1D4ED8', bg: '#DBEAFE' },
  reviewed: { label: 'Geprüft', color: '#B45309', bg: '#FEF3C7' },
  published: { label: 'Veröffentlicht', color: '#15803D', bg: '#DCFCE7' },
  rejected: { label: 'Abgelehnt', color: '#DC2626', bg: '#FEE2E2' },
}

const CATEGORY_LABELS: Record<string, string> = {
  produkte: '💊 Produkte',
  stoffwechselkur: '🔄 Stoffwechselkur',
  business: '🚀 Business',
}

const FILTERS = [
  { key: '', label: 'Alle' },
  { key: 'new', label: 'Neu' },
  { key: 'reviewed', label: 'Geprüft' },
  { key: 'published', label: 'Veröffentlicht' },
  { key: 'rejected', label: 'Abgelehnt' },
]

const cardStyle = {
  boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
  border: '1px solid #F1F5F9',
} as const

function fmtDate(d: Date | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' +
    new Date(d).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

export default async function ErfahrungsberichteAdminPage({ searchParams }: {
  searchParams: Promise<{ status?: string }>
}) {
  const sp = await searchParams
  const filter = STATUS_META[sp.status ?? ''] ? sp.status! : ''

  const rows = await db.execute<Row>(sql`
    SELECT t.id, t.full_name, t.category, t.status, t.submitted_at, t.created_at,
      COUNT(*) FILTER (WHERE a.status = 'verified' AND a.kind IN ('before_image', 'after_image'))::int AS image_count,
      COUNT(*) FILTER (WHERE a.status = 'verified' AND a.kind = 'video')::int AS video_count,
      COUNT(*) FILTER (WHERE a.status = 'verified' AND a.kind = 'audio')::int AS audio_count
    FROM testimonials t
    LEFT JOIN testimonial_assets a ON a.testimonial_id = t.id
    WHERE t.status <> 'draft'
      ${filter ? sql`AND t.status = ${filter}` : sql``}
    GROUP BY t.id
    ORDER BY t.submitted_at DESC NULLS LAST, t.created_at DESC
  `)

  return (
    <div style={{ maxWidth: 1100 }}>
      <div className="mb-6">
        <Link href="/admin" className="flex items-center gap-2 text-sm mb-5" style={{ color: '#94A3B8' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Zurück zum Dashboard
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Erfahrungsberichte</h1>
        <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
          Eingereicht über <span className="font-mono">/erfahrungsbericht</span>
        </p>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {FILTERS.map(f => {
          const active = filter === f.key
          return (
            <Link
              key={f.key}
              href={f.key ? `/admin/erfahrungsberichte?status=${f.key}` : '/admin/erfahrungsberichte'}
              className="text-xs font-semibold px-3.5 py-2 rounded-full transition-all"
              style={{
                background: active ? '#1a1a1a' : '#fff',
                color: active ? '#fff' : '#6B7280',
                border: active ? '1px solid #1a1a1a' : '1px solid #E5E7EB',
              }}
            >
              {f.label}
            </Link>
          )
        })}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[20px] bg-white p-10 text-center" style={cardStyle}>
          <p className="text-sm font-medium text-gray-900">Noch keine Berichte</p>
          <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
            Teile den Link <span className="font-mono">app.finestsites.io/erfahrungsbericht</span> mit der Community.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map(r => {
            const meta = STATUS_META[r.status] ?? { label: r.status, color: '#64748B', bg: '#F1F5F9' }
            return (
              <Link
                key={r.id}
                href={`/admin/erfahrungsberichte/${r.id}`}
                className="rounded-[18px] bg-white px-5 py-4 flex items-center gap-4 flex-wrap transition-shadow hover:shadow-md"
                style={cardStyle}
              >
                <div className="flex-1 min-w-[180px]">
                  <p className="text-sm font-semibold text-gray-900">{r.full_name ?? '—'}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                    {CATEGORY_LABELS[r.category] ?? r.category} · {fmtDate(r.submitted_at)}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs font-medium" style={{ color: '#64748B' }}>
                  {r.image_count > 0 && <span>📸 {r.image_count}</span>}
                  {r.video_count > 0 && <span>🎬 {r.video_count}</span>}
                  {r.audio_count > 0 && <span>🎙️ {r.audio_count}</span>}
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ color: meta.color, background: meta.bg }}>
                  {meta.label}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
