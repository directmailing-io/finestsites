import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { templates } from '@/lib/db/schema'
import { and, inArray, eq, asc, sql } from 'drizzle-orm'
import VorlagenGrid from './_components/VorlagenGrid'
import NavBar from '../_components/NavBar'
import Footer from '../_components/Footer'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Alle Vorlagen – FinestSites',
  description: 'Alle Website-Vorlagen für Network-Marketing-Profis. Finde das passende Template für dein Unternehmen.',
}

export default async function VorlagenPage() {
  let templateList: {
    id: string
    title: string
    description: string | null
    domain: string
    isFree: boolean
    badge: string | null
    tags: string[]
    nmCompanies: string[]
    isAllrounder: boolean
    previewImages: unknown
    isComingSoon: boolean
  }[] = []

  try {
    const rows = await db
      .select({
        id: templates.id,
        title: templates.title,
        description: templates.description,
        domain: templates.domain,
        isFree: templates.isFree,
        badge: templates.badge,
        tags: templates.tags,
        nmCompanies: templates.nmCompanies,
        isAllrounder: templates.isAllrounder,
        previewImages: templates.previewImages,
        status: templates.status,
        createdAt: templates.createdAt,
      })
      .from(templates)
      .where(and(inArray(templates.status, ['published', 'coming_soon']), eq(templates.isTest, false), eq(templates.isFree, false), eq(templates.isAllrounder, false)))
      .orderBy(asc(sql`COALESCE(${templates.sortOrder}, 100)`), asc(templates.createdAt))

    templateList = rows.map(r => ({
      id: r.id,
      title: r.title,
      description: r.description,
      domain: r.domain,
      isFree: r.isFree ?? false,
      badge: r.badge ?? null,
      tags: (r.tags as string[] | null) ?? [],
      nmCompanies: (r.nmCompanies as string[] | null) ?? [],
      isAllrounder: r.isAllrounder ?? false,
      previewImages: r.previewImages,
      isComingSoon: r.status === 'coming_soon',
    }))
  } catch (err) {
    console.error('[VorlagenPage] fetch error:', err)
  }

  return (
    <div style={{ fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#fff', minHeight: '100vh' }}>
      <NavBar />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px 80px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
            Alle Vorlagen
          </p>
          <h1 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, color: '#111', letterSpacing: '-0.025em', marginBottom: 16, lineHeight: 1.1 }}>
            Finde das passende Template.
          </h1>
          <p style={{ fontSize: 16, color: '#777', maxWidth: 500, margin: '0 auto' }}>
            Jedes Template wurde speziell für ein Network-Marketing-Unternehmen entwickelt. Fertige Texte, fertige Designs.
          </p>
        </div>

        <VorlagenGrid templates={templateList} />
      </div>

      <Footer />
    </div>
  )
}
