'use client'

import { useRef, useState, useCallback, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ThemeOption {
  key: string
  label: string
  color: string
}

interface SectionOption {
  key: string
  label: string
  emoji?: string
  default_on?: boolean
}

interface HeaderImageOption {
  key: string
  label: string
  emoji?: string
}

export interface PreviewConfig {
  editable_themes?: ThemeOption[]
  editable_sections?: SectionOption[]
  editable_header_images?: HeaderImageOption[]
}

interface Props {
  templateId: string
  templateTitle: string
  domain: string              // e.g. "womenplus.io" → shown as "demo.womenplus.io"
  previewConfig: PreviewConfig
  accentColor: string
  registerUrl: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InteractiveEditorPreview({
  templateId,
  domain,
  previewConfig,
  accentColor,
  registerUrl,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const themes = previewConfig.editable_themes ?? []
  const sections = previewConfig.editable_sections ?? []
  const headerImages = previewConfig.editable_header_images ?? []

  // State
  const [activeTheme, setActiveTheme] = useState<string | null>(themes[0]?.key ?? null)
  const initialSections = Object.fromEntries(sections.map(s => [s.key, s.default_on !== false]))
  const [sectionStates, setSectionStates] = useState<Record<string, boolean>>(initialSections)
  const [activeImageIdx, setActiveImageIdx] = useState(0)
  const [mobileTab, setMobileTab] = useState<'preview' | 'edit'>('preview')
  const [iframeReady, setIframeReady] = useState(false)
  const [toastVisible, setToastVisible] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const demoUrl = `demo.${domain}`
  const previewSrc = `/api/templates/${templateId}/public-preview`

  // ─── postMessage helper ───────────────────────────────────────────────────

  const sendMessage = useCallback((msg: Record<string, unknown>) => {
    try {
      iframeRef.current?.contentWindow?.postMessage(msg, '*')
    } catch {
      // cross-origin safety
    }
  }, [])

  function showToast() {
    setToastVisible(true)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastVisible(false), 2000)
  }

  // ─── Control handlers ─────────────────────────────────────────────────────

  function handleThemeChange(theme: ThemeOption) {
    setActiveTheme(theme.key)
    sendMessage({ type: 'finestsites:updateField', key: 'theme_color', value: theme.key })
    showToast()
  }

  function handleSectionToggle(section: SectionOption) {
    setSectionStates(prev => {
      const newVal = !prev[section.key]
      sendMessage({ type: 'finestsites:toggleSection', section: section.key, visible: newVal })
      showToast()
      return { ...prev, [section.key]: newVal }
    })
  }

  function handleImageSelect(idx: number, img: HeaderImageOption) {
    setActiveImageIdx(idx)
    sendMessage({ type: 'finestsites:updateField', key: 'header_bg_image', value: img.key })
    showToast()
  }

  // Re-send initial state when iframe loads
  useEffect(() => {
    if (!iframeReady) return
    if (activeTheme) {
      sendMessage({ type: 'finestsites:updateField', key: 'theme_color', value: activeTheme })
    }
    for (const [key, visible] of Object.entries(sectionStates)) {
      if (!visible) {
        sendMessage({ type: 'finestsites:toggleSection', section: key, visible: false })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iframeReady])

  const hasControls = themes.length > 0 || sections.length > 0 || headerImages.length > 0

  // ─── Styles ───────────────────────────────────────────────────────────────

  const accent = accentColor

  return (
    <div style={{ position: 'relative' }}>
      {/* ── Editor chrome ─────────────────────────────────────────────────── */}
      <div style={{
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 8px 48px rgba(0,0,0,0.09), 0 2px 12px rgba(0,0,0,0.05)',
      }}>

        {/* Top bar — desktop only */}
        <div style={{
          background: '#FAFAFA',
          borderBottom: '1px solid rgba(0,0,0,0.07)',
          padding: '0 16px',
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }} className="editor-topbar">
          {/* Left */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '-0.04em', color: '#111' }}>
              finest<span style={{ color: accent }}>sites</span>
            </span>
            <div style={{ width: 1, height: 16, background: 'rgba(0,0,0,0.1)' }} />
            <span style={{ fontSize: 13, color: '#888', fontWeight: 500 }}>{demoUrl}</span>
          </div>
          {/* Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <a
              href={`https://${demoUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, color: '#999', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              Live-Demo öffnen
            </a>
            <a
              href={registerUrl}
              style={{
                background: '#111', color: '#fff', fontSize: 12, fontWeight: 600,
                padding: '6px 14px', borderRadius: 8, textDecoration: 'none',
              }}
            >
              Template starten
            </a>
          </div>
        </div>

        {/* Mobile tabs */}
        <div className="editor-mobile-tabs" style={{
          display: 'none',
          background: '#fff',
          borderBottom: '1px solid rgba(0,0,0,0.07)',
        }}>
          {(['preview', 'edit'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              style={{
                flex: 1, padding: '12px 0',
                fontSize: 13, fontWeight: 600,
                background: 'none', border: 'none', cursor: 'pointer',
                color: mobileTab === tab ? accent : '#aaa',
                borderBottom: `2px solid ${mobileTab === tab ? accent : 'transparent'}`,
                transition: 'all 0.15s',
              }}
            >
              {tab === 'preview' ? 'Vorschau' : 'Anpassen'}
            </button>
          ))}
        </div>

        {/* Body: sidebar + preview */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: hasControls ? '280px 1fr' : '1fr',
        }} className="editor-body">

          {/* ── LEFT: Sidebar ─────────────────────────────────────────────── */}
          {hasControls && (
            <aside
              className="editor-sidebar"
              style={{
                background: '#fff',
                borderRight: '1px solid rgba(0,0,0,0.07)',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Color themes */}
              {themes.length > 0 && (
                <SidebarSection label="Farbtheme">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {themes.map(theme => (
                      <button
                        key={theme.key}
                        onClick={() => handleThemeChange(theme)}
                        title={theme.label}
                        style={{
                          height: 40, borderRadius: 9, border: `2px solid ${activeTheme === theme.key ? '#111' : 'transparent'}`,
                          background: theme.color, cursor: 'pointer', fontSize: 8.5,
                          color: 'rgba(255,255,255,0.85)', fontWeight: 700, padding: '0 6px',
                          display: 'flex', alignItems: 'flex-end', paddingBottom: 4,
                          transition: 'all 0.15s',
                          boxShadow: activeTheme === theme.key ? '0 0 0 3px rgba(0,0,0,0.1)' : 'none',
                        }}
                      >
                        {theme.label}
                      </button>
                    ))}
                  </div>
                </SidebarSection>
              )}

              {/* Section toggles */}
              {sections.length > 0 && (
                <SidebarSection label="Sektionen ein/aus">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {sections.map(section => {
                      const isOn = sectionStates[section.key] ?? true
                      return (
                        <div
                          key={section.key}
                          onClick={() => handleSectionToggle(section)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 6px', borderRadius: 8, cursor: 'pointer',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#F5F5F5')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            {section.emoji && <span style={{ fontSize: 13 }}>{section.emoji}</span>}
                            <span style={{ fontSize: 12.5, color: '#333', fontWeight: 500 }}>{section.label}</span>
                          </div>
                          {/* Toggle switch */}
                          <div style={{
                            width: 34, height: 20, borderRadius: 100,
                            background: isOn ? accent : '#e0e0e0',
                            position: 'relative', flexShrink: 0, transition: 'background 0.2s',
                          }}>
                            <div style={{
                              position: 'absolute', top: 3, left: isOn ? 14 : 3,
                              width: 14, height: 14, borderRadius: '50%',
                              background: '#fff', transition: 'left 0.2s',
                              boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                            }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </SidebarSection>
              )}

              {/* Header images */}
              {headerImages.length > 0 && (
                <SidebarSection label="Header-Hintergrundbild">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                    {headerImages.map((img, idx) => (
                      <button
                        key={img.key}
                        onClick={() => handleImageSelect(idx, img)}
                        title={img.label}
                        style={{
                          height: 52, borderRadius: 8,
                          border: `2px solid ${activeImageIdx === idx ? accent : 'rgba(0,0,0,0.08)'}`,
                          background: '#F5F5F5', cursor: 'pointer',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          gap: 3, transition: 'all 0.15s',
                        }}
                      >
                        <span style={{ fontSize: 18 }}>{img.emoji ?? '🖼️'}</span>
                        <span style={{ fontSize: 9, color: '#999', fontWeight: 600 }}>{img.label}</span>
                      </button>
                    ))}
                  </div>
                </SidebarSection>
              )}

              {/* Spacer */}
              <div style={{ flex: 1 }} />

              {/* Bottom hint + CTA */}
              <div style={{ padding: '0 16px 16px' }}>
                <p style={{ fontSize: 11, color: '#bbb', textAlign: 'center', lineHeight: 1.5, marginBottom: 12 }}>
                  Das sind nur Vorschau-Anpassungen.<br />
                  Alle Texte trägst du nach der Registrierung ein.
                </p>
                <a
                  href={registerUrl}
                  style={{
                    display: 'block', background: '#111', color: '#fff',
                    borderRadius: 12, padding: '14px 16px',
                    textAlign: 'center', fontSize: 13, fontWeight: 600,
                    textDecoration: 'none', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#333')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#111')}
                >
                  Mit diesem Template starten →
                </a>
              </div>
            </aside>
          )}

          {/* ── RIGHT: iframe preview ─────────────────────────────────────── */}
          <div
            className="editor-preview-pane"
            style={{
              background: '#F5F4F0',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <iframe
              ref={iframeRef}
              src={previewSrc}
              onLoad={() => setIframeReady(true)}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                display: 'block',
              }}
              title="Template Vorschau"
            />
          </div>

        </div>
      </div>

      {/* ── Change toast ──────────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', bottom: 90, left: '50%',
        transform: `translateX(-50%) translateY(${toastVisible ? '0' : '12px'})`,
        background: '#111', color: '#fff',
        fontSize: 12, fontWeight: 600,
        padding: '9px 18px', borderRadius: 100,
        display: 'flex', alignItems: 'center', gap: 7,
        opacity: toastVisible ? 1 : 0,
        transition: 'all 0.22s cubic-bezier(0.4,0,0.2,1)',
        pointerEvents: 'none', zIndex: 300, whiteSpace: 'nowrap',
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
        Vorschau aktualisiert
      </div>

      <style>{`
        @media (max-width: 768px) {
          .editor-topbar { display: none !important; }
          .editor-mobile-tabs { display: flex !important; }
          .editor-body { grid-template-columns: 1fr !important; }
          .editor-sidebar {
            border-right: none !important;
            border-bottom: 1px solid rgba(0,0,0,0.07);
            max-height: 340px;
          }
          .editor-preview-pane { height: 520px !important; }
        }
        @media (max-width: 480px) {
          .editor-preview-pane { height: 460px !important; }
        }
      `}</style>
    </div>
  )
}

// ─── SidebarSection helper ─────────────────────────────────────────────────────

function SidebarSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
      <div style={{
        padding: '12px 16px 6px',
        fontSize: 10.5, fontWeight: 700, letterSpacing: '0.07em',
        textTransform: 'uppercase', color: '#aaa',
      }}>
        {label}
      </div>
      <div style={{ padding: '2px 16px 14px' }}>
        {children}
      </div>
    </div>
  )
}
