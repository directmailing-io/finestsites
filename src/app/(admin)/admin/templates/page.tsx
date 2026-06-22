import { db } from '@/lib/db'
import { templates as templatesTable } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'
import Link from 'next/link'

export default async function AdminTemplatesPage() {
  const templates = await db
    .select()
    .from(templatesTable)
    .orderBy(desc(templatesTable.createdAt))

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Templates</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            {templates.length} Template(s) insgesamt
          </p>
        </div>
        <Link href="/admin/templates/new"
          className="text-sm font-medium px-5 py-2.5 text-white rounded-[16px]"
          style={{ background: '#1a1a1a', boxShadow: '0 4px 14px rgba(26,26,26,0.20)' }}>
          + Neues Template
        </Link>
      </div>

      {templates.length === 0 ? (
        <div className="p-12 rounded-[24px] bg-white text-center"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
          <div className="text-4xl mb-4">📐</div>
          <h3 className="font-semibold text-gray-900 mb-1">Noch keine Templates</h3>
          <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
            Erstelle dein erstes Template und definiere die Platzhalter.
          </p>
          <Link href="/admin/templates/new"
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white rounded-[16px]"
            style={{ background: '#1a1a1a', boxShadow: '0 4px 14px rgba(26,26,26,0.25)' }}>
            Erstes Template erstellen
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {templates.map((t) => {
            const fieldCount = (t.placeholderSchema as any)?.fields?.length ?? 0
            const isPublished = t.status === 'published'
            return (
              <div key={t.id} className="flex items-center gap-4 p-5 rounded-[24px] bg-white"
                style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-medium text-gray-900 text-sm">{t.title}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: isPublished ? '#F0FDF4' : '#F3F4F6',
                        color: isPublished ? '#16A34A' : '#6B7280',
                      }}>
                      {isPublished ? 'Veröffentlicht' : 'Entwurf'}
                    </span>
                    {t.isTest && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: '#FEF3C7', color: '#B45309' }}>
                        Test
                      </span>
                    )}
                    {t.isFree && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: '#DBEAFE', color: '#1D4ED8' }}>
                        Kostenlos
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    <span>🌐 {t.domain}</span>
                    <span>📋 {fieldCount} Felder</span>
                    <span>{new Date(t.createdAt).toLocaleDateString('de-DE')}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link href={`/admin/templates/${t.id}`}
                    className="text-xs font-medium px-3 py-2 rounded-[12px] transition-all"
                    style={{ background: '#F3F4F6', color: '#374151' }}>
                    Bearbeiten
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
