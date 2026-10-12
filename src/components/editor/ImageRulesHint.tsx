'use client'

import { useState } from 'react'

/**
 * Dezenter Hinweis bei jedem Bild-Upload: keine Vorher-Nachher-Bilder.
 * Hintergrund (12.10.2026): Vorher-Nachher- und Körpervergleiche gelten bei Nahrungsergänzung
 * als Wirkversprechen (HCVO Art. 10/12 lit. b, BGH I ZR 135/24) und sind abmahnfähig, auch
 * wenn die Person zugestimmt hat. Bewusst ruhig gestaltet: eine Zeile, Details nur auf Tippen.
 */
export default function ImageRulesHint({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-[12px] px-3 py-2.5" style={{ background: '#F8FAFC', border: '1px solid #EEF2F6' }}>
      <div className="flex items-start gap-2.5">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="flex-shrink-0" style={{ marginTop: 1.5 }} aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <p className={`${compact ? 'text-[11.5px]' : 'text-xs'} leading-relaxed`} style={{ color: '#475569', margin: 0 }}>
          Bitte keine Vorher-Nachher-Bilder und keine Körper-, Haut- oder Gewichtsvergleiche.{' '}
          <button type="button" onClick={() => setOpen(o => !o)}
            className="font-semibold underline-offset-2 hover:underline" style={{ color: '#334155' }} aria-expanded={open}>
            {open ? 'Weniger' : 'Warum?'}
          </button>
        </p>
      </div>
      {open && (
        <p className={`${compact ? 'text-[11.5px]' : 'text-xs'} leading-relaxed mt-1.5`} style={{ color: '#64748B', margin: '6px 0 0 25px' }}>
          Solche Bilder gelten rechtlich als Wirkversprechen für die Produkte und können abgemahnt werden, auch wenn sie echt sind
          und die Person zugestimmt hat. Am besten wirkt ein freundliches Porträt von dir oder ein Foto, auf dem du die Produkte
          im Alltag nutzt.
        </p>
      )}
    </div>
  )
}
