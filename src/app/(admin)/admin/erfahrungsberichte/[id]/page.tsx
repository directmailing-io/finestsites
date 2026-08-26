import { db } from '@/lib/db'
import { testimonials, testimonialAssets } from '@/lib/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { getPresignedDownloadUrl } from '@/lib/r2/client'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { StatusActions } from './StatusActions'

export const dynamic = 'force-dynamic'

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Entwurf', color: '#64748B', bg: '#F1F5F9' },
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

const TEXT_SOURCE_LABELS: Record<string, string> = {
  typed: 'Getippt',
  dictated: 'Eingesprochen',
  mixed: 'Eingesprochen + getippt',
}

const cardStyle = {
  boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
  border: '1px solid #F1F5F9',
} as const

function fmtDate(d: Date | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' +
    new Date(d).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr'
}

function DownloadLink({ assetId, label }: { assetId: string; label?: string }) {
  return (
    <a
      href={`/api/admin/erfahrungsberichte/assets/${assetId}/download`}
      className="inline-flex items-center gap-1.5 text-xs font-semibold"
      style={{ color: '#1D4ED8' }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
      </svg>
      {label ?? 'Download'}
    </a>
  )
}

function Gallery({ title, items }: {
  title: string
  items: { assetId: string; url: string }[]
}) {
  if (items.length === 0) return null
  return (
    <div className="rounded-[20px] p-5 bg-white" style={cardStyle}>
      <span className="text-sm font-semibold text-gray-900 block mb-4">{title}</span>
      <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
        {items.map(item => (
          <div key={item.assetId} className="flex flex-col gap-1.5">
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="block rounded-[14px] overflow-hidden" style={{ aspectRatio: '1', background: '#F8FAFC' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt="" className="w-full h-full object-cover" />
            </a>
            <DownloadLink assetId={item.assetId} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default async function ErfahrungsberichtDetailPage({ params }: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const t = await db.query.testimonials.findFirst({ where: eq(testimonials.id, id) })
  if (!t) notFound()

  const assets = await db.query.testimonialAssets.findMany({
    where: and(eq(testimonialAssets.testimonialId, id), eq(testimonialAssets.status, 'verified')),
    orderBy: [asc(testimonialAssets.sortOrder), asc(testimonialAssets.createdAt)],
  })

  const withUrls = await Promise.all(assets.map(async a => ({
    ...a,
    url: await getPresignedDownloadUrl(a.r2Key, 900),
  })))

  const before = withUrls.filter(a => a.kind === 'before_image').map(a => ({ assetId: a.id, url: a.url }))
  const after = withUrls.filter(a => a.kind === 'after_image').map(a => ({ assetId: a.id, url: a.url }))
  const video = withUrls.find(a => a.kind === 'video')
  const audio = withUrls.find(a => a.kind === 'audio')

  const meta = STATUS_META[t.status] ?? { label: t.status, color: '#64748B', bg: '#F1F5F9' }
  const displayPreview = t.displayNameMode === 'abbreviated' && t.fullName
    ? `${t.fullName.split(/\s+/)[0]} ${(t.fullName.split(/\s+/).pop() ?? '')[0]?.toUpperCase() ?? ''}.`
    : t.fullName

  return (
    <div style={{ maxWidth: 900 }}>
      <div className="mb-6">
        <Link href="/admin/erfahrungsberichte" className="flex items-center gap-2 text-sm mb-5" style={{ color: '#94A3B8' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Alle Erfahrungsberichte
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">{t.fullName ?? 'Ohne Namen'}</h1>
              <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ color: meta.color, background: meta.bg }}>
                {meta.label}
              </span>
            </div>
            <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
              {CATEGORY_LABELS[t.category] ?? t.category} · Eingereicht: {fmtDate(t.submittedAt)}
            </p>
          </div>
          <a
            href={`/api/admin/erfahrungsberichte/${t.id}/zip`}
            className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-full"
            style={{ background: '#1a1a1a', color: '#fff' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            Alles als ZIP
          </a>
        </div>
        <div className="mt-4">
          <StatusActions id={t.id} status={t.status} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {/* Text */}
        <div className="rounded-[20px] p-5 bg-white" style={cardStyle}>
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-sm font-semibold text-gray-900">Bericht</span>
            <span className="text-xs" style={{ color: '#94A3B8' }}>
              {TEXT_SOURCE_LABELS[t.textSource ?? ''] ?? '—'}
            </span>
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#1F2937' }}>
            {t.text || '—'}
          </p>
        </div>

        <Gallery title={`Vorher-Fotos (${before.length})`} items={before} />
        <Gallery title={`Nachher-Fotos (${after.length})`} items={after} />

        {video && (
          <div className="rounded-[20px] p-5 bg-white" style={cardStyle}>
            <div className="flex items-baseline justify-between mb-4">
              <span className="text-sm font-semibold text-gray-900">Video</span>
              <DownloadLink assetId={video.id} label="Video herunterladen" />
            </div>
            <video src={video.url} controls playsInline className="w-full rounded-[14px]" style={{ maxHeight: 420, background: '#000' }} />
          </div>
        )}

        {audio && (
          <div className="rounded-[20px] p-5 bg-white" style={cardStyle}>
            <div className="flex items-baseline justify-between mb-4">
              <span className="text-sm font-semibold text-gray-900">Diktat-Audio (O-Ton)</span>
              <DownloadLink assetId={audio.id} label="Audio herunterladen" />
            </div>
            <audio src={audio.url} controls className="w-full" />
          </div>
        )}

        {/* Personendaten */}
        <div className="rounded-[20px] p-5 bg-white" style={cardStyle}>
          <span className="text-sm font-semibold text-gray-900 block mb-4">Person</span>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
            {[
              ['Anzeige auf der Seite', displayPreview ?? '—'],
              ['E-Mail', t.email ?? '—'],
              ['Alter', t.age != null ? String(t.age) : '—'],
              ['Instagram', t.instagram ?? '—'],
              ['TikTok', t.tiktok ?? '—'],
              ['Facebook', t.facebook ?? '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[11px] font-medium mb-0.5" style={{ color: '#94A3B8' }}>{label}</dt>
                <dd className="text-sm font-medium break-words" style={{ color: '#1F2937' }}>{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Einwilligungs-Nachweis */}
        <div className="rounded-[20px] p-5 bg-white" style={cardStyle}>
          <span className="text-sm font-semibold text-gray-900 block mb-4">Einwilligung (Nachweis)</span>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
            {[
              ['Version', t.consentVersion ?? '—'],
              ['Zeitpunkt', fmtDate(t.consentedAt)],
              ['IP', t.consentIp ?? '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[11px] font-medium mb-0.5" style={{ color: '#94A3B8' }}>{label}</dt>
                <dd className="text-sm font-medium break-words" style={{ color: '#1F2937' }}>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3">
            <dt className="text-[11px] font-medium mb-0.5" style={{ color: '#94A3B8' }}>Text-Hash (SHA-256)</dt>
            <dd className="text-xs font-mono break-all" style={{ color: '#64748B' }}>{t.consentHash ?? '—'}</dd>
          </div>
          <div className="mt-3">
            <dt className="text-[11px] font-medium mb-0.5" style={{ color: '#94A3B8' }}>User-Agent</dt>
            <dd className="text-xs break-all" style={{ color: '#64748B' }}>{t.consentUa ?? '—'}</dd>
          </div>
        </div>
      </div>
    </div>
  )
}
