'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

/**
 * „Psst …“-Hinweis auf die native App (Daniel 31.10.2026): dunkles Blatt, echtes App-Icon,
 * eine Pastell-Verlaufslinie unten. Nur auf den Übersichtsseiten, nicht im App-Modus (Layout),
 * nicht für Konten, die die App schon nutzen (`hasApp`). Schließen merkt sich der Browser.
 * Vorschau für Daniel: /sites?psst=1 zeigt ihn immer.
 */
const APP_STORE_URL = 'https://apps.apple.com/de/app/finestsites/id6825371773'
const STORAGE_KEY = 'fs_app_teaser_closed'

export default function AppTeaser({ hasApp }: { hasApp: boolean }) {
  const pathname = usePathname()
  const [closed, setClosed] = useState(true)
  // Vorschau: ?psst=1 zeigt den Hinweis immer (auch mit App oder nach dem Schließen)
  const [preview, setPreview] = useState(false)

  useEffect(() => {
    const forced = new URLSearchParams(window.location.search).get('psst') === '1'
    setPreview(forced)
    try {
      setClosed(!forced && localStorage.getItem(STORAGE_KEY) === '1')
    } catch {
      setClosed(false)
    }
  }, [])

  const onOverview = pathname === '/dashboard' || pathname === '/sites'
  if ((hasApp && !preview) || closed || !onOverview) return null

  const close = () => {
    setClosed(true)
    try { localStorage.setItem(STORAGE_KEY, '1') } catch { /* privater Modus */ }
  }

  return (
    <section aria-label="Hinweis zur FinestSites-App" className="fs-teaser relative mb-6 overflow-hidden rounded-[24px] text-white">
      <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6 sm:pr-14">
        <div className="flex min-w-0 flex-1 items-start gap-4 pr-8 sm:items-center sm:gap-5 sm:pr-0">
          <img
            src="/app-icon-192.png"
            alt=""
            width={64}
            height={64}
            className="fs-teaser-icon h-12 w-12 flex-shrink-0 rounded-[13px] bg-white sm:h-16 sm:w-16 sm:rounded-[17px]"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Psst … nur unter uns
            </p>
            <h2 className="mt-1 text-[18px] font-semibold leading-snug tracking-tight [text-wrap:balance] sm:mt-1.5 sm:text-[21px]">
              Die FinestSites-App ist da.
            </h2>
            <p className="mt-1.5 hidden max-w-[46ch] text-[14px] leading-relaxed sm:block" style={{ color: 'rgba(255,255,255,0.68)' }}>
              Noch bevor wir es überall erzählen: Deine Seiten, Anfragen und Chats jetzt auch auf iPhone und iPad.
            </p>
          </div>
        </div>
        <p className="-mt-2 text-[14px] leading-relaxed sm:hidden" style={{ color: 'rgba(255,255,255,0.68)' }}>
          Noch bevor wir es überall erzählen: Deine Seiten, Anfragen und Chats jetzt auch auf iPhone und iPad.
        </p>

        <div className="flex flex-col gap-2.5 sm:w-[260px] sm:flex-shrink-0">
          <span className="text-[12px] font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Apple: Such im App Store nach
          </span>
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="fs-teaser-search flex h-11 items-center gap-2.5 rounded-full px-4 text-[15px] font-semibold"
            aria-label="FinestSites im App Store öffnen"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" style={{ opacity: 0.55 }}>
              <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
            </svg>
            <span>FinestSites</span>
            <span className="fs-teaser-caret" aria-hidden="true" />
          </a>
          <span className="text-[12px] leading-snug" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Android: kommt bald. Noch ein kleines bisschen Geduld.
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={close}
        aria-label="Hinweis schließen"
        className="absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/10"
        style={{ color: 'rgba(255,255,255,0.55)' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>

      <style>{`
        .fs-teaser {
          background:
            radial-gradient(120% 140% at 0% 0%, rgba(217,211,243,0.10), transparent 55%),
            radial-gradient(90% 120% at 100% 100%, rgba(187,214,242,0.08), transparent 60%),
            #0E0F13;
          box-shadow: 0 1px 2px rgba(16,24,40,0.10), 0 18px 40px rgba(16,24,40,0.16);
          animation: fs-teaser-in .5s cubic-bezier(.2,.7,.2,1) both;
        }
        .fs-teaser::after {
          content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 3px;
          background: linear-gradient(90deg, #F7C4B4, #F6DFA9, #CDE8D3, #BBD6F2, #D9D3F3, #F5C9DC, #F7C4B4);
          background-size: 200% 100%;
          animation: fs-teaser-line 14s linear infinite;
        }
        .fs-teaser-icon { box-shadow: 0 0 0 1px rgba(255,255,255,0.08), 0 10px 30px rgba(187,214,242,0.18); }
        .fs-teaser-search {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
          color: #fff;
          transition: background .2s, border-color .2s;
        }
        .fs-teaser-search:hover { background: rgba(255,255,255,0.13); border-color: rgba(255,255,255,0.2); }
        .fs-teaser-caret { width: 2px; height: 18px; margin-left: -6px; border-radius: 1px; background: #BBD6F2; animation: fs-teaser-blink 1.1s steps(1) infinite; }
        @keyframes fs-teaser-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes fs-teaser-line { to { background-position: 200% 0; } }
        @keyframes fs-teaser-blink { 50% { opacity: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .fs-teaser, .fs-teaser::after, .fs-teaser-caret { animation: none; }
        }
      `}</style>
    </section>
  )
}
