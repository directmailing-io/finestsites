import Image from 'next/image'
import Link from 'next/link'
import { getPublishedTemplates, templateImageUrl } from '@/lib/supabase'

const REGISTER_URL = process.env.NEXT_PUBLIC_REGISTER_URL ?? '/register'

// ── Tag label map ────────────────────────────────────────────────────────────
const TAG_LABEL: Record<string, string> = {
  fitline: 'FitLine',
  pminternational: 'PM International',
  sonstiges: 'Sonstiges',
  demo: 'Demo',
}

export default async function HomePage() {
  const templates = await getPublishedTemplates()

  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          Neu: Templates für PM International & FitLine
        </div>
        <h1 className="text-5xl md:text-6xl font-black text-gray-900 leading-tight tracking-tight mb-6">
          Deine professionelle<br />
          <span className="text-indigo-600">Webseite in Minuten</span>
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed mb-10">
          Wähle ein Template, passe es mit deinen Inhalten an und geh online —
          ohne technisches Wissen, ohne Agentur, ohne Wartezeit.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href={REGISTER_URL}
            className="inline-flex items-center px-8 py-3.5 rounded-2xl bg-gray-900 text-white font-semibold text-base hover:bg-gray-700 transition-colors"
          >
            Jetzt kostenlos starten
            <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
          <a
            href="#templates"
            className="inline-flex items-center px-8 py-3.5 rounded-2xl border border-gray-200 text-gray-700 font-semibold text-base hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Templates ansehen
          </a>
        </div>
      </section>

      {/* ── Stats bar ─────────────────────────────────────────────────────── */}
      <section className="border-y border-gray-100 bg-gray-50/50">
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: `${templates.length}+`, label: 'Templates verfügbar' },
            { value: '5 Min.', label: 'bis zur eigenen Seite' },
            { value: '14 Tage', label: 'Geld-zurück-Garantie' },
            { value: '100%', label: 'ohne Code' },
          ].map(({ value, label }) => (
            <div key={label}>
              <p className="text-3xl font-black text-gray-900">{value}</p>
              <p className="text-sm text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Template grid ──────────────────────────────────────────────────── */}
      <section id="templates" className="max-w-6xl mx-auto px-6 py-20">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-black text-gray-900 mb-3">Unsere Templates</h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            Alle Templates sind professionell gestaltet und sofort einsatzbereit.
            Wähle einfach das passende für dich.
          </p>
        </div>

        {templates.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg font-medium">Bald verfügbar</p>
            <p className="text-sm mt-2">Die ersten Templates werden gerade vorbereitet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((t) => {
              const imagePath = t.preview_images?.[0]
              const imageUrl = imagePath ? templateImageUrl(imagePath) : null
              const tags = (t.tags ?? []).filter(tag => tag !== 'demo')

              return (
                <Link
                  key={t.id}
                  href={`/templates/${t.id}`}
                  className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-gray-200 hover:shadow-lg transition-all duration-200"
                >
                  {/* Card image */}
                  <div className="relative aspect-[4/3] bg-gray-50 overflow-hidden">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={t.title}
                        fill
                        unoptimized
                        className="object-cover object-top group-hover:scale-[1.02] transition-transform duration-500"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg className="w-10 h-10 text-gray-200" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="M21 15l-5-5L5 21" />
                        </svg>
                      </div>
                    )}
                    {/* Free badge */}
                    {t.is_free && (
                      <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-green-500 text-white text-[11px] font-bold uppercase tracking-wide">
                        Kostenlos
                      </span>
                    )}
                  </div>

                  {/* Card body */}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-bold text-gray-900 text-base leading-tight">{t.title}</h3>
                      <span className="text-[11px] font-medium text-gray-400 whitespace-nowrap mt-0.5 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                        </svg>
                        {t.domain}
                      </span>
                    </div>

                    {t.description && (
                      <p className="text-sm text-gray-500 leading-relaxed line-clamp-2 mb-3">
                        {t.description}
                      </p>
                    )}

                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {tags.map(tag => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-semibold"
                          >
                            {TAG_LABEL[tag] ?? tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                      <span className="text-sm font-semibold text-indigo-600 group-hover:text-indigo-700 transition-colors flex items-center gap-1">
                        Details ansehen
                        <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <span
                        className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold"
                      >
                        Aktivieren →
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-gray-900 mb-3">So einfach geht&apos;s</h2>
            <p className="text-gray-500 text-lg">In drei Schritten zur eigenen Webseite</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Template wählen',
                desc: 'Stöbere in unserer Template-Bibliothek und wähle das Design, das zu dir und deinem Business passt.',
              },
              {
                step: '02',
                title: 'Inhalte anpassen',
                desc: 'Trage deine Texte, Bilder und Kontaktdaten ein — ohne Code, direkt in unserem Editor.',
              },
              {
                step: '03',
                title: 'Online gehen',
                desc: 'Mit einem Klick veröffentlichst du deine Seite. Deine eigene Domain inklusive.',
              },
            ].map(({ step, title, desc }) => (
              <div key={step} className="bg-white rounded-2xl p-8 border border-gray-100">
                <p className="text-5xl font-black text-indigo-100 mb-4">{step}</p>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing teaser ─────────────────────────────────────────────────── */}
      <section id="preise" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-black text-gray-900 mb-3">Einfache Preise</h2>
          <p className="text-gray-500 text-lg">Keine versteckten Kosten, keine langen Verträge</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            {
              name: 'Starter',
              price: 'Kostenlos',
              sub: 'für immer',
              features: ['1 kostenlose Seite', 'Alle Basis-Templates', 'FinestSites-Subdomain'],
              cta: 'Kostenlos starten',
              highlight: false,
            },
            {
              name: 'Pro',
              price: '€ 29',
              sub: 'pro Monat',
              features: ['Bis zu 3 Seiten', 'Alle Templates', 'Eigene Domain', 'Prioritäts-Support'],
              cta: 'Pro starten',
              highlight: true,
            },
            {
              name: 'Unlimited',
              price: '€ 79',
              sub: 'pro Monat',
              features: ['Unbegrenzte Seiten', 'Alle Templates', 'Eigene Domains', 'Premium-Support'],
              cta: 'Unlimited starten',
              highlight: false,
            },
          ].map(({ name, price, sub, features, cta, highlight }) => (
            <div
              key={name}
              className={`rounded-2xl p-8 border ${highlight ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-100 text-gray-900'}`}
            >
              <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${highlight ? 'text-gray-400' : 'text-gray-400'}`}>{name}</p>
              <p className={`text-4xl font-black mb-0.5 ${highlight ? 'text-white' : 'text-gray-900'}`}>{price}</p>
              <p className={`text-sm mb-6 ${highlight ? 'text-gray-400' : 'text-gray-400'}`}>{sub}</p>
              <ul className="space-y-2.5 mb-8">
                {features.map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm">
                    <svg className={`w-4 h-4 flex-shrink-0 ${highlight ? 'text-green-400' : 'text-green-500'}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className={highlight ? 'text-gray-300' : 'text-gray-600'}>{f}</span>
                  </li>
                ))}
              </ul>
              <a
                href={REGISTER_URL}
                className={`block w-full text-center py-3 rounded-xl text-sm font-semibold transition-colors ${
                  highlight
                    ? 'bg-white text-gray-900 hover:bg-gray-100'
                    : 'bg-gray-900 text-white hover:bg-gray-700'
                }`}
              >
                {cta}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="bg-indigo-600 rounded-3xl px-8 py-16 text-center text-white">
          <h2 className="text-3xl md:text-4xl font-black mb-4">Bereit für deine eigene Webseite?</h2>
          <p className="text-indigo-200 text-lg mb-8 max-w-xl mx-auto">
            Starte noch heute kostenlos — kein Kreditkarte nötig.
          </p>
          <a
            href={REGISTER_URL}
            className="inline-flex items-center px-8 py-4 rounded-2xl bg-white text-gray-900 font-bold text-base hover:bg-gray-100 transition-colors"
          >
            Jetzt kostenlos registrieren
            <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </section>
    </>
  )
}
