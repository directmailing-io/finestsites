import { db } from '@/lib/db'
import { userSites, users, templates } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { desc } from 'drizzle-orm'
import Link from 'next/link'

export default async function SitesPage() {
  const rows = await db
    .select({
      id: userSites.id,
      status: userSites.status,
      createdAt: userSites.createdAt,
      publishedAt: userSites.publishedAt,
      userId: userSites.userId,
      userEmail: users.email,
      userUsername: users.username,
      templateTitle: templates.title,
      templateDomain: templates.domain,
    })
    .from(userSites)
    .leftJoin(users, eq(users.id, userSites.userId))
    .leftJoin(templates, eq(templates.id, userSites.templateId))
    .where(eq(userSites.status, 'published'))
    .orderBy(desc(userSites.publishedAt))

  return (
    <div style={{ maxWidth: 1000 }}>
      <div className="mb-6">
        <Link href="/admin" className="flex items-center gap-2 text-sm mb-5" style={{ color: '#94A3B8' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Zurück zum Dashboard
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Aktive Seiten</h1>
            <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>Alle veröffentlichten Websites</p>
          </div>
          <span className="text-sm font-semibold px-3 py-1.5 rounded-full"
            style={{ background: '#ECFDF5', color: '#065F46' }}>
            {rows.length} live
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[20px] bg-white p-10 text-center"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }}>
          <p className="text-sm font-medium text-gray-900">Keine veröffentlichten Seiten</p>
          <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Noch keine Nutzer haben ihre Seite veröffentlicht.</p>
        </div>
      ) : (
        <div className="rounded-[20px] bg-white overflow-hidden"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }}>
          <div className="grid px-6 py-3 text-xs font-semibold uppercase tracking-wider"
            style={{ gridTemplateColumns: '1fr 160px 160px 120px 32px', background: '#F8FAFC', borderBottom: '1px solid #F1F5F9', color: '#94A3B8' }}>
            <span>Template / URL</span>
            <span>Nutzer</span>
            <span>Username</span>
            <span>Veröffentlicht am</span>
            <span></span>
          </div>
          <div className="divide-y" style={{ borderColor: '#F8FAFC' }}>
            {rows.map((site) => {
              const username = site.userUsername ?? null
              const domain = site.templateDomain ?? null
              const siteUrl = username && domain ? `https://${username}.${domain}` : null
              const publishedAt = site.publishedAt
                ? new Date(site.publishedAt).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
                : '—'

              return (
                <Link key={site.id} href={`/admin/users/${site.userId}`}
                  className="grid items-center px-6 py-3.5 transition-colors hover:bg-gray-50"
                  style={{ gridTemplateColumns: '1fr 160px 160px 120px 32px' }}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {site.templateTitle ?? 'Website'}
                    </p>
                    {siteUrl && (
                      <span className="text-xs font-mono truncate block" style={{ color: '#2563EB' }}>
                        {siteUrl}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-700 truncate">{site.userEmail ?? '—'}</p>
                  </div>
                  <div>
                    {username ? (
                      <span className="text-xs font-mono" style={{ color: '#64748B' }}>@{username}</span>
                    ) : (
                      <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>
                    )}
                  </div>
                  <div className="text-sm" style={{ color: '#64748B' }}>{publishedAt}</div>
                  <div className="flex justify-end">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2">
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
