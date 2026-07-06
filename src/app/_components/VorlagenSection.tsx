'use client'

import { useState } from 'react'

interface Product {
  name: string
  available: boolean
}

interface Company {
  id: string
  label: string
  products: Product[]
}

const companies: Company[] = [
  {
    id: 'pm-international',
    label: 'PM International',
    products: [
      { name: 'FitLine OptimalSet', available: true },
      { name: 'FitLine Business', available: false },
      { name: 'FitLine Stoffwechselkur', available: false },
      { name: 'FitLine Abnehm-Challenge', available: false },
      { name: 'Business für Mamas', available: false },
      { name: 'FitLine Skincare', available: false },
    ],
  },
  {
    id: 'vorwerk',
    label: 'Vorwerk (Thermomix)',
    products: [
      { name: 'TM6 Präsentation', available: false },
      { name: 'Thermomix Business', available: false },
      { name: 'Kochen & Gesundheit', available: false },
      { name: 'Familien-Küche', available: false },
      { name: 'Demo-Abend Einladung', available: false },
    ],
  },
  {
    id: 'lr',
    label: 'LR Health & Beauty',
    products: [
      { name: 'Aloe Vera Produkte', available: false },
      { name: 'Lifetakt Gesundheit', available: false },
      { name: 'LR Beauty-Linie', available: false },
      { name: 'LR Business', available: false },
      { name: 'Geschäftsmöglichkeit', available: false },
    ],
  },
  {
    id: 'nu-skin',
    label: 'Nu Skin',
    products: [
      { name: 'ageLOC LumiSpa iO', available: false },
      { name: 'Pharmanex Supplements', available: false },
      { name: 'Nu Skin Beauty', available: false },
      { name: 'Nu Skin Business', available: false },
      { name: 'Skin Care Routine', available: false },
    ],
  },
  {
    id: 'herbalife',
    label: 'Herbalife',
    products: [
      { name: 'Formula 1 Shake', available: false },
      { name: 'Herbal Tea Konzentrat', available: false },
      { name: 'Herbalife Business', available: false },
      { name: 'Sport & Fitness', available: false },
      { name: 'Gewichtsmanagement', available: false },
    ],
  },
  {
    id: 'amway',
    label: 'AMWAY',
    products: [
      { name: 'Nutrilite Supplements', available: false },
      { name: 'Artistry Beauty', available: false },
      { name: 'AMWAY Business', available: false },
      { name: 'eSpring Wasserfilter', available: false },
      { name: 'Haushalt & Home Care', available: false },
    ],
  },
  {
    id: 'young-living',
    label: 'Young Living',
    products: [
      { name: 'Starter Kit Öle', available: false },
      { name: 'Premium Starter Kit', available: false },
      { name: 'Young Living Business', available: false },
      { name: 'Thieves Collection', available: false },
      { name: 'Wellness-Lifestyle', available: false },
    ],
  },
  {
    id: 'juice-plus',
    label: 'Juice Plus+',
    products: [
      { name: 'Juice Plus+ Kapseln', available: false },
      { name: 'Complete Shake', available: false },
      { name: 'Tower Garden', available: false },
      { name: 'Juice Plus+ Business', available: false },
      { name: 'Gesunde Ernährung', available: false },
    ],
  },
  {
    id: 'forever-living',
    label: 'Forever Living',
    products: [
      { name: 'Aloe Vera Gel', available: false },
      { name: 'CLEAN9 Programm', available: false },
      { name: 'Forever Business', available: false },
      { name: 'Bee Products', available: false },
      { name: 'Personal Care', available: false },
    ],
  },
  {
    id: 'doterra',
    label: 'doTERRA',
    products: [
      { name: 'Ätherische Öle Starter-Kit', available: false },
      { name: 'doTERRA Business', available: false },
      { name: 'Wellness Advocate', available: false },
      { name: 'Home Essentials Kit', available: false },
      { name: 'Lifelong Vitality', available: false },
    ],
  },
]

export default function VorlagenSection() {
  const [activeTab, setActiveTab] = useState('pm-international')

  const activeCompany = companies.find(c => c.id === activeTab) ?? companies[0]

  return (
    <section style={{ background: '#fff', padding: 'clamp(64px, 8vw, 96px) 0' }}>
      <style>{`
        .vs-tab-bar {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 0 clamp(20px, 5vw, 48px) 0;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .vs-tab-bar::-webkit-scrollbar { display: none; }
        .vs-tab-btn {
          white-space: nowrap;
          border: none;
          cursor: pointer;
          font-family: inherit;
          font-size: 14px;
          font-weight: 500;
          padding: 9px 18px;
          border-radius: 100px;
          transition: background 0.15s, color 0.15s;
          flex-shrink: 0;
        }
        .vs-tab-btn.active {
          background: #111;
          color: #fff;
        }
        .vs-tab-btn:not(.active) {
          background: #F3F4F6;
          color: #555;
        }
        .vs-tab-btn:not(.active):hover {
          background: #E5E7EB;
          color: #111;
        }
        .vs-card-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        @media (max-width: 1023px) {
          .vs-card-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 479px) {
          .vs-card-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 clamp(20px, 5vw, 48px)' }}>
        {/* Section label + headline */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <p style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#aaa',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            marginBottom: 18,
          }}>
            Verfügbare Vorlagen
          </p>
          <h2 style={{
            fontFamily: '"Plein", sans-serif',
            fontSize: 'clamp(28px, 4vw, 46px)',
            fontWeight: 400,
            letterSpacing: '-0.025em',
            lineHeight: 1.15,
            color: '#111',
            margin: '0 auto',
            maxWidth: 640,
          }}>
            Für dein Network-Marketing-Unternehmen.
          </h2>
          <p style={{
            fontSize: 16,
            color: '#888',
            maxWidth: 520,
            margin: '16px auto 0',
            lineHeight: 1.7,
          }}>
            Wähle dein Unternehmen und sieh, welche Seiten bereits verfügbar sind und was noch kommt.
          </p>
        </div>
      </div>

      {/* Tab bar — full width scroll, no inner padding clamp on the bar itself */}
      <div style={{ maxWidth: 960, margin: '0 auto', marginBottom: 32 }}>
        <div className="vs-tab-bar">
          {companies.map(company => (
            <button
              key={company.id}
              className={`vs-tab-btn${activeTab === company.id ? ' active' : ''}`}
              onClick={() => setActiveTab(company.id)}
            >
              {company.label}
            </button>
          ))}
        </div>
      </div>

      {/* Card grid */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 clamp(20px, 5vw, 48px)' }}>
        <div className="vs-card-grid">
          {activeCompany.products.map((product, i) => (
            <div
              key={i}
              style={{
                background: product.available ? '#fff' : '#F9FAFB',
                border: product.available ? '1.5px solid #8060b0' : '1px solid #E5E7EB',
                borderRadius: 16,
                padding: '22px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                opacity: product.available ? 1 : 0.7,
                transition: 'box-shadow 0.15s',
              }}
            >
              <div>
                <p style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#9CA3AF',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: 5,
                }}>
                  {activeCompany.label}
                </p>
                <p style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: product.available ? '#111' : '#6B7280',
                  lineHeight: 1.35,
                  margin: 0,
                }}>
                  {product.name}
                </p>
              </div>

              {product.available ? (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: '#D1FAE5',
                  borderRadius: 100,
                  padding: '4px 12px',
                  width: 'fit-content',
                }}>
                  <span style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: '#10B981',
                    display: 'inline-block',
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#065F46' }}>Jetzt verfügbar</span>
                </div>
              ) : (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: '#F3F4F6',
                  borderRadius: 100,
                  padding: '4px 12px',
                  width: 'fit-content',
                }}>
                  <span style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: '#9CA3AF',
                    display: 'inline-block',
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Kommt bald</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
