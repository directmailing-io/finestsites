import FooterWaitlistMini from './FooterWaitlistMini'

export default function Footer() {
  return (
    <>
      <style>{`
        .fs-footer-dark { background: #0f0f0f; color: #fff; padding: 64px 7vw 0; }
        .fs-footer-grid { max-width: 1060px; margin: 0 auto; display: grid; grid-template-columns: 1.6fr 1fr 1fr; gap: 56px; padding-bottom: 56px; }
        .fs-footer-bottom { max-width: 1060px; margin: 0 auto; padding: 24px 0 32px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }
        @media (max-width: 767px) {
          .fs-footer-dark { padding: 48px 22px 0; }
          .fs-footer-grid { grid-template-columns: 1fr; gap: 36px; padding-bottom: 40px; }
          .fs-footer-bottom { flex-direction: column; align-items: flex-start; gap: 12px; }
        }
      `}</style>
      <footer className="fs-footer-dark">
        <div className="fs-footer-grid">
          {/* Brand column */}
          <div className="fs-footer-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/logo-black.svg" alt="FinestSites" style={{ height: 22, display: 'block', filter: 'brightness(0) invert(1)', opacity: 0.85, marginBottom: 16 }} />
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, marginBottom: 20, maxWidth: 260 }}>
              Professionelle Websites fuer Network-Marketing-Profis. In 5 Minuten live.
            </p>
            {/* Warteliste Mini-Formular */}
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(196,168,240,0.7)', marginBottom: 12 }}>
              Fruehzugang sichern
            </p>
            <FooterWaitlistMini />
          </div>

          {/* Produkt column */}
          <div>
            <h5 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 18 }}>Produkt</h5>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Templates ansehen', href: '/#templates' },
                { label: 'Preise',            href: '/#preise' },
                { label: 'Anmelden',          href: 'https://app.finestsites.io/login' },
                { label: 'Konto erstellen',   href: 'https://app.finestsites.io/register' },
              ].map(l => (
                <li key={l.label}><a href={l.href} style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>{l.label}</a></li>
              ))}
            </ul>
          </div>

          {/* Rechtliches column */}
          <div>
            <h5 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 18 }}>Rechtliches</h5>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Impressum',             href: '/impressum' },
                { label: 'Datenschutzerklärung',  href: '/datenschutz' },
                { label: 'AGB',                   href: '/agb' },
              ].map(l => (
                <li key={l.label}><a href={l.href} style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>{l.label}</a></li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="fs-footer-bottom">
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>© 2026 FinestSites · Alle Rechte vorbehalten</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginRight: 4 }}>Zahlungsarten</span>
            {[
              { src: '/payment/visa.svg',       alt: 'Visa' },
              { src: '/payment/mastercard.svg', alt: 'Mastercard' },
              { src: '/payment/amex.svg',       alt: 'American Express' },
              { src: '/payment/sepa.svg',       alt: 'SEPA' },
            ].map(p => (
              <div key={p.alt} style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 40,
                minWidth: 56,
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.src} alt={p.alt} style={{ height: 22, filter: 'brightness(0) invert(1)', opacity: 0.75 }} />
              </div>
            ))}
          </div>
        </div>
      </footer>
    </>
  )
}
