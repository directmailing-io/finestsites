import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { getTemplate, getPublishedTemplates, templateImageUrl } from '@/lib/supabase'
import type { Metadata } from 'next'

const REGISTER_URL = process.env.NEXT_PUBLIC_REGISTER_URL ?? '/register'

const TAG_LABEL: Record<string, string> = {
  fitline: 'FitLine',
  pminternational: 'PM International',
  sonstiges: 'Sonstiges',
  demo: 'Demo',
}

// ISR: Generate static pages for all published templates at build time
export async function generateStaticParams() {
  const templates = await getPublishedTemplates()
  return templates.map(t => ({ id: t.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const template = await getTemplate(id)
  if (!template) return { title: 'Template nicht gefunden' }

  return {
    title: `${template.title} – FinestSites Template`,
    description: template.description ?? `Entdecke das ${template.title} Template auf FinestSites.`,
  }
}

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const template = await getTemplate(id)
  if (!template) notFound()

  const tags = (template.tags ?? []).filter(tag => tag !== 'demo')
  const images = template.preview_images ?? []

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">

      {/* ── Breadcrumb ───────────────────────────────────────────────────── */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8">
        <Link href="/" className="hover:text-gray-600 transition-colors">Start</Link>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <Link href="/#templates" className="hover:text-gray-600 transition-colors">Templates</Link>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-gray-600 font-medium">{template.title}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">

        {/* ── Left: Images ────────────────────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-4">
          {images.length > 0 ? (
            images.map((imgPath, i) => (
              <div key={i} className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-gray-50 border border-gray-100">
                <Image
                  src={templateImageUrl(imgPath)}
                  alt={`${template.title} Vorschau ${i + 1}`}
                  fill
                  unoptimized
                  className="object-cover object-top"
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  priority={i === 0}
                />
              </div>
            ))
          ) : (
            <div className="aspect-[4/3] rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">
              <div className="text-center text-gray-300">
                <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
                <p className="text-sm">Kein Vorschaubild</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Info + CTA ───────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <div className="sticky top-24 space-y-6">

            {/* Header */}
            <div>
              {template.is_free && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs font-bold uppercase tracking-wide mb-3">
                  Kostenlos verfügbar
                </span>
              )}
              <h1 className="text-3xl font-black text-gray-900 mb-2">{template.title}</h1>
              <div className="flex items-center gap-1.5 text-sm text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                </svg>
                {template.domain}
              </div>
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold"
                  >
                    {TAG_LABEL[tag] ?? tag}
                  </span>
                ))}
              </div>
            )}

            {/* Description */}
            {template.description && (
              <div className="bg-gray-50 rounded-2xl p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Beschreibung</p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                  {template.description}
                </p>
              </div>
            )}

            {/* Feature list */}
            <div className="space-y-2">
              {[
                'Sofort einsatzbereit',
                'Vollständig anpassbar',
                'Mobil optimiert',
                'Eigene Domain möglich',
              ].map(f => (
                <div key={f} className="flex items-center gap-2.5 text-sm text-gray-600">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {f}
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="space-y-3 pt-2">
              <a
                href={REGISTER_URL}
                className="flex items-center justify-center w-full py-4 rounded-2xl bg-gray-900 text-white font-bold text-base hover:bg-gray-700 transition-colors"
              >
                Template aktivieren
                <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
              <p className="text-xs text-center text-gray-400">
                Konto anlegen · Template aktivieren · Online gehen
              </p>
            </div>

            {/* Trust */}
            <div className="border-t border-gray-100 pt-5 grid grid-cols-3 gap-4 text-center">
              {[
                { icon: '🔒', text: 'SSL inklusive' },
                { icon: '↩', text: '14 Tage zurück' },
                { icon: '⚡', text: 'Sofort live' },
              ].map(({ icon, text }) => (
                <div key={text}>
                  <p className="text-xl mb-1">{icon}</p>
                  <p className="text-[11px] text-gray-400 font-medium">{text}</p>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>

      {/* ── Back link ────────────────────────────────────────────────────── */}
      <div className="mt-16 pt-8 border-t border-gray-100">
        <Link
          href="/#templates"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Alle Templates ansehen
        </Link>
      </div>

    </div>
  )
}
