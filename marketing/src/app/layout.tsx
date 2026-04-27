import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: 'FinestSites – Professionelle Webseiten für dein Business',
  description:
    'Starte deine eigene professionelle Webseite in wenigen Minuten. Wähle aus unseren hochwertigen Templates und bringe dein Business online.',
  openGraph: {
    title: 'FinestSites – Professionelle Webseiten für dein Business',
    description:
      'Starte deine eigene professionelle Webseite in wenigen Minuten.',
    type: 'website',
  },
}

const REGISTER_URL = process.env.NEXT_PUBLIC_REGISTER_URL ?? '/register'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="bg-white text-gray-900 font-sans">
        {/* ── Navigation ─────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/" className="font-black text-xl tracking-tight text-gray-900">
              Finest<span className="text-indigo-600">Sites</span>
            </Link>
            <nav className="hidden md:flex items-center gap-8">
              <Link href="/#templates" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                Templates
              </Link>
              <Link href="/#preise" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                Preise
              </Link>
            </nav>
            <a
              href={REGISTER_URL}
              className="inline-flex items-center px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 transition-colors"
            >
              Kostenlos starten
            </a>
          </div>
        </header>

        <main>{children}</main>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer className="border-t border-gray-100 mt-24">
          <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="font-black text-lg tracking-tight">
              Finest<span className="text-indigo-600">Sites</span>
            </p>
            <p className="text-sm text-gray-400">
              © {new Date().getFullYear()} FinestSites. Alle Rechte vorbehalten.
            </p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">Impressum</a>
              <a href="#" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">Datenschutz</a>
              <a href="#" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">AGB</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
