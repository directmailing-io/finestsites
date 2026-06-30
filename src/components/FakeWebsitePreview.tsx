/**
 * Shared blurred fake-website preview for "Coming Soon" template cards.
 * Used on both the public /vorlagen grid and the in-app /sites/new page.
 */

export const COMING_SOON_PASTEL = ['#DCD0ED', '#B8CCDB', '#EDCBA8', '#C8D8B8', '#F2C5C5', '#C5DFE0', '#EAD4B5', '#C5D4F2']

function LinkInBio({ accent }: { accent: string }) {
  return (
    <>
      <div style={{ height: 34, background: '#fff', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', padding: '0 13px', gap: 7 }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: accent }} />
        <div style={{ flex: 1, display: 'flex', gap: 5 }}>
          <div style={{ width: 36, height: 7, borderRadius: 3, background: '#e0e0e0' }} />
          <div style={{ width: 36, height: 7, borderRadius: 3, background: '#e0e0e0' }} />
        </div>
        <div style={{ width: 48, height: 20, borderRadius: 10, background: accent }} />
      </div>
      <div style={{ padding: '16px 13px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, background: '#fff' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: accent }} />
        <div style={{ width: 110, height: 10, borderRadius: 5, background: '#222' }} />
        <div style={{ width: 74, height: 7, borderRadius: 3, background: '#bbb' }} />
      </div>
      <div style={{ padding: '0 9px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: 35, borderRadius: 9, background: i === 1 ? accent : '#fff', border: `1.5px solid ${i === 1 ? accent : '#e8e8e8'}`, display: 'flex', alignItems: 'center', padding: '0 11px', gap: 7 }}>
            <div style={{ width: 18, height: 18, borderRadius: 5, background: i === 1 ? 'rgba(255,255,255,0.3)' : accent + '33' }} />
            <div style={{ flex: 1, height: 7, borderRadius: 3, background: i === 1 ? 'rgba(255,255,255,0.5)' : '#ddd' }} />
          </div>
        ))}
      </div>
    </>
  )
}

function EventLanding({ accent }: { accent: string }) {
  return (
    <>
      <div style={{ height: 70, background: accent, display: 'flex', alignItems: 'flex-end', padding: '0 14px 8px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 10, right: 12, background: '#fff', borderRadius: 6, padding: '4px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div style={{ width: 20, height: 8, borderRadius: 3, background: accent }} />
          <div style={{ width: 24, height: 12, borderRadius: 3, background: '#222' }} />
        </div>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.9)' }} />
      </div>
      <div style={{ background: '#fff', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ width: 140, height: 11, borderRadius: 5, background: '#111' }} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: accent }} />
          <div style={{ width: 90, height: 8, borderRadius: 4, background: '#ccc' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: accent + '88' }} />
          <div style={{ width: 110, height: 8, borderRadius: 4, background: '#ccc' }} />
        </div>
        <div style={{ marginTop: 4, height: 30, borderRadius: 7, background: accent }} />
      </div>
      <div style={{ padding: '6px 10px', display: 'flex', gap: 7 }}>
        {[1, 2].map(i => (
          <div key={i} style={{ flex: 1, height: 40, borderRadius: 8, background: i === 1 ? '#f5f5f7' : '#fff', border: '1px solid #eee' }} />
        ))}
      </div>
    </>
  )
}

function ProductLanding({ accent }: { accent: string }) {
  return (
    <>
      <div style={{ height: 30, background: '#fff', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
        <div style={{ width: 60, height: 9, borderRadius: 4, background: '#222' }} />
        <div style={{ flex: 1 }} />
        {[1, 2, 3].map(i => <div key={i} style={{ width: 28, height: 7, borderRadius: 3, background: '#e0e0e0' }} />)}
        <div style={{ width: 40, height: 20, borderRadius: 10, background: accent }} />
      </div>
      <div style={{ display: 'flex', padding: '14px 12px', gap: 10, background: '#fff' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ width: '90%', height: 13, borderRadius: 6, background: '#111' }} />
          <div style={{ width: '75%', height: 13, borderRadius: 6, background: '#111' }} />
          <div style={{ width: '85%', height: 8, borderRadius: 4, background: '#ccc', marginTop: 4 }} />
          <div style={{ width: '70%', height: 8, borderRadius: 4, background: '#ccc' }} />
          <div style={{ marginTop: 8, width: 70, height: 24, borderRadius: 6, background: accent }} />
        </div>
        <div style={{ width: 70, height: 80, borderRadius: 10, background: accent + '55', flexShrink: 0 }} />
      </div>
      <div style={{ padding: '6px 12px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: 22, width: i * 32 + 28, borderRadius: 12, background: i === 1 ? accent : '#f0f0f0' }} />
        ))}
      </div>
    </>
  )
}

function BusinessProfile({ accent }: { accent: string }) {
  return (
    <>
      <div style={{ height: 40, background: '#1a1a2e', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
        <div style={{ width: 26, height: 26, borderRadius: 5, background: accent }} />
        <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#fff' }} />
        <div style={{ width: 50, height: 18, borderRadius: 9, background: accent }} />
      </div>
      <div style={{ display: 'flex', background: '#fff', padding: '10px', gap: 9 }}>
        <div style={{ width: 58, height: 58, borderRadius: 9, background: accent + '44', flexShrink: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: accent, margin: '11px auto 0' }} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 3 }}>
          <div style={{ width: '75%', height: 9, borderRadius: 4, background: '#111' }} />
          <div style={{ width: '55%', height: 7, borderRadius: 3, background: '#bbb' }} />
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ width: 22, height: 9, borderRadius: 3, background: accent }} />
                <div style={{ width: 26, height: 5, borderRadius: 2, background: '#e0e0e0' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ padding: '4px 10px 6px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {[1, 2].map(i => (
          <div key={i} style={{ height: 24, borderRadius: 6, background: '#f5f5f7', display: 'flex', alignItems: 'center', padding: '0 9px', gap: 7 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: accent }} />
            <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#ddd' }} />
          </div>
        ))}
      </div>
    </>
  )
}

/** Renders the blurred fake website content for a given layout index (0–3). */
export function FakeWebsitePreview({ idx }: { idx: number }) {
  const accent = COMING_SOON_PASTEL[idx % COMING_SOON_PASTEL.length]
  const layoutType = idx % 4

  const layout = (() => {
    switch (layoutType) {
      case 1: return <EventLanding accent={accent} />
      case 2: return <ProductLanding accent={accent} />
      case 3: return <BusinessProfile accent={accent} />
      default: return <LinkInBio accent={accent} />
    }
  })()

  return (
    <div style={{ position: 'absolute', inset: 0, filter: 'blur(7px)', transform: 'scale(1.05)' }}>
      {layout}
    </div>
  )
}
