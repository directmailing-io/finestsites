import Link from 'next/link'

export default function SitesPage() {
  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Meine Seiten</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            Alle deine Websites auf einen Blick.
          </p>
        </div>
        <Link href="/sites/new"
          className="text-sm font-medium px-5 py-2.5 text-white rounded-[16px]"
          style={{ background: '#1a1a1a', boxShadow: '0 4px 14px rgba(26,26,26,0.20)' }}>
          + Neue Website
        </Link>
      </div>

      <div className="p-12 rounded-[24px] bg-white text-center"
        style={{ boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)' }}>
        <div className="w-14 h-14 rounded-[20px] flex items-center justify-center mx-auto mb-4"
          style={{ background: '#F3F4F6' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
        </div>
        <h3 className="font-semibold text-gray-900 mb-1">Noch keine Website erstellt</h3>
        <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
          Wähle ein Template und erstelle deine erste Website in wenigen Minuten.
        </p>
        <Link href="/sites/new"
          className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white rounded-[16px]"
          style={{ background: '#1a1a1a', boxShadow: '0 4px 14px rgba(26,26,26,0.25)' }}>
          Template auswählen
        </Link>
      </div>
    </div>
  )
}
