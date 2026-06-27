'use client'

import { useRef, useState, useCallback, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ThemeOption {
  value: string       // field value, e.g. 'gruen'
  label: string       // display label, e.g. 'Grün'
  description?: string
  color?: string      // hex for color-type cards
  image_url?: string  // for image-type cards
  card_type?: 'color' | 'image'
}

interface HeroVariantOption {
  value: string
  label: string
  description?: string
  image_url?: string
}

interface SectionOption {
  field_key: string   // actual placeholder field key
  label: string
  emoji?: string
  default_value?: string  // 'ja' (on) or 'nein' (off)
}

export interface PreviewConfig {
  // Color theme
  theme_field_key?: string           // e.g. 'farbthema'
  editable_themes?: ThemeOption[]
  // Hero image variant
  hero_variant_field_key?: string    // e.g. 'hero_variant'
  editable_hero_variants?: HeroVariantOption[]
  // Section show/hide toggles
  editable_sections?: SectionOption[]
  // Initial field values to render preview with
  default_values?: Record<string, string>
}

interface Props {
  templateId: string
  domain: string
  previewConfig: PreviewConfig
  accentColor: string
  registerUrl: string
}

// ─── URL encoding helper ──────────────────────────────────────────────────────

function buildPreviewSrc(templateId: string, overrides: Record<string, string>): string {
  const base = `/api/templates/${templateId}/public-preview`
  if (Object.keys(overrides).length === 0) return base
  // base64url encode (same format the server decodes with Buffer.from(str, 'base64url'))
  const json = JSON.stringify(overrides)
  const b64 = btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${base}?data=${b64}`
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
  const heroVariants = previewConfig.editable_hero_variants ?? []
  const sections = previewConfig.editable_sections ?? []
  const themeKey = previewConfig.theme_field_key ?? 'farbthema'
  const heroKey = previewConfig.hero_variant_field_key ?? 'hero_variant'

  // Build initial field state from default_values + section defaults
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = { ...(previewConfig.default_values ?? {}) }
    for (const s of sections) {
      if (!(s.field_key in init)) {
        init[s.field_key] = s.default_value ?? 'ja'
      }
    }
    return init
  })

  const [mobileTab, setMobileTab] = useState<'preview' | 'edit'>('preview')
  const [isLoading, setIsLoading] = useState(false)
  const loadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const previewSrc = buildPreviewSrc(templateId, fieldValues)
  const demoUrl = `demo.${domain}`

  // ─── Value update handler ─────────────────────────────────────────────────

  const updateField = useCallback((key: string, value: string) => {
    setIsLoading(true)
    setFieldValues(prev => ({ ...prev, [key]: value }))
    // Loading overlay auto-hides after 2s max (iframe onLoad also hides it)
    if (loadTimer.current) clearTimeout(loadTimer.current)
    loadTimer.current = setTimeout(() => setIsLoading(false), 2000)
  }, [])

  const toggleSection = useCallback((fieldKey: string) => {
    setFieldValues(prev => {
      const current = prev[fieldKey] ?? 'ja'
      const next = current === 'ja' ? 'nein' : 'ja'
      return { ...prev, [fieldKey]: next }
    })
  }, [])

  useEffect(() => () => { if (loadTimer.current) clearTimeout(loadTimer.current) }, [])

  const hasControls = themes.length > 0 || heroVariants.length > 0 || sections.length > 0

  const activeTheme = fieldValues[themeKey]
  const activeHeroVariant = fieldValues[heroKey]

  return (
    <div style={{ position: 'relative' }}>
      {/* ── Editor chrome ─────────────────────────────────────────────────── */}
      <div style={{
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 8px 48px rgba(0,0,0,0.09), 0 2px 12px rgba(0,0,0,0.05)',
      }}>

        {/* Top bar */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '-0.04em', color: '#111' }}>
              finest<span style={{ color: accentColor }}>sites</span>
            </span>
            <div style={{ width: 1, height: 16, background: 'rgba(0,0,0,0.1)' }} />
            <span style={{ fontSize: 13, color: '#888', fontWeight: 500 }}>{demoUrl}</span>
          </div>
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
              Live-Demo
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
                color: mobileTab === tab ? accentColor : '#aaa',
                borderBottom: `2px solid ${mobileTab === tab ? accentColor : 'transparent'}`,
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

          {/* ── LEFT: Sidebar ──────────────────────────────────────────────── */}
          {hasControls && (
            <aside
              className={`editor-sidebar${mobileTab === 'preview' ? ' mobile-hidden' : ''}`}
              style={{
                background: '#fff',
                borderRight: '1px solid rgba(0,0,0,0.07)',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* ── Color theme (card_select style) ────────────────────── */}
              {themes.length > 0 && (
                <SidebarSection label="Farbthema">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {themes.map(theme => {
                      const isActive = activeTheme === theme.value
                      return (
                        <button
                          key={theme.value}
                          onClick={() => updateField(themeKey, theme.value)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 12px', borderRadius: 10,
                            border: `1.5px solid ${isActive ? accentColor : 'rgba(0,0,0,0.1)'}`,
                            background: isActive ? `${accentColor}08` : '#fff',
                            cursor: 'pointer', textAlign: 'left', width: '100%',
                            transition: 'all 0.15s',
                          }}
                        >
                          {/* Color circle */}
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                            background: theme.color ?? '#999',
                            boxShadow: isActive ? `0 0 0 2px #fff, 0 0 0 4px ${theme.color ?? accentColor}` : 'inset 0 0 0 1px rgba(0,0,0,0.08)',
                            transition: 'box-shadow 0.15s',
                          }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: isActive ? '#111' : '#333', lineHeight: 1.2 }}>{theme.label}</div>
                            {theme.description && (
                              <div style={{ fontSize: 11, color: '#999', marginTop: 1, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {theme.description}
                              </div>
                            )}
                          </div>
                          {isActive && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2.5" style={{ flexShrink: 0 }}>
                              <path d="M20 6L9 17l-5-5"/>
                            </svg>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </SidebarSection>
              )}

              {/* ── Hero-Variante (image cards) ─────────────────────────── */}
              {heroVariants.length > 0 && (
                <SidebarSection label="Hero-Variante">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {heroVariants.map(variant => {
                      const isActive = activeHeroVariant === variant.value
                      return (
                        <button
                          key={variant.value}
                          onClick={() => updateField(heroKey, variant.value)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 10px 8px 8px', borderRadius: 10,
                            border: `1.5px solid ${isActive ? accentColor : 'rgba(0,0,0,0.1)'}`,
                            background: isActive ? `${accentColor}08` : '#fff',
                            cursor: 'pointer', textAlign: 'left', width: '100%',
                            transition: 'all 0.15s',
                          }}
                        >
                          {/* Thumbnail */}
                          <div style={{
                            width: 56, height: 36, borderRadius: 6, flexShrink: 0,
                            background: '#F0F0F0', overflow: 'hidden',
                            border: isActive ? `1px solid ${accentColor}40` : '1px solid rgba(0,0,0,0.08)',
                          }}>
                            {variant.image_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={variant.image_url} alt={variant.label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: isActive ? '#111' : '#333', lineHeight: 1.2 }}>{variant.label}</div>
                            {variant.description && (
                              <div style={{ fontSize: 11, color: '#999', marginTop: 1, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {variant.description}
                              </div>
                            )}
                          </div>
                          {isActive && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2.5" style={{ flexShrink: 0 }}>
                              <path d="M20 6L9 17l-5-5"/>
                            </svg>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </SidebarSection>
              )}

              {/* ── Section toggles ─────────────────────────────────────── */}
              {sections.length > 0 && (
                <SidebarSection label="Sektionen ein/aus">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {sections.map(section => {
                      const isOn = (fieldValues[section.field_key] ?? section.default_value ?? 'ja') === 'ja'
                      return (
                        <div
                          key={section.field_key}
                          onClick={() => toggleSection(section.field_key)}
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
                          <div style={{
                            width: 34, height: 20, borderRadius: 100,
                            background: isOn ? accentColor : '#e0e0e0',
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

              {/* Spacer + bottom CTA */}
              <div style={{ flex: 1 }} />
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
                  Mit diesem Template starten &rarr;
                </a>
              </div>
            </aside>
          )}

          {/* ── RIGHT: iframe ──────────────────────────────────────────────── */}
          <div
            className={`editor-preview-pane${mobileTab === 'edit' ? ' mobile-hidden' : ''}`}
            style={{ background: '#F5F4F0', overflow: 'hidden', position: 'relative' }}
          >
            {/* Loading overlay */}
            {isLoading && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 10,
                background: 'rgba(245,244,240,0.7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(2px)',
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  border: `2.5px solid ${accentColor}33`,
                  borderTopColor: accentColor,
                  animation: 'spin 0.7s linear infinite',
                }} />
              </div>
            )}
            <iframe
              ref={iframeRef}
              src={previewSrc}
              key={previewSrc}
              onLoad={() => setIsLoading(false)}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              title="Template Vorschau"
            />
          </div>

        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 768px) {
          .editor-topbar { display: none !important; }
          .editor-mobile-tabs { display: flex !important; }
          .editor-body { grid-template-columns: 1fr !important; }
          .editor-sidebar { border-right: none !important; border-bottom: 1px solid rgba(0,0,0,0.07); max-height: 360px; }
          .editor-sidebar.mobile-hidden { display: none !important; }
          .editor-preview-pane { height: 520px !important; }
          .editor-preview-pane.mobile-hidden { display: none !important; }
        }
        @media (max-width: 480px) {
          .editor-preview-pane { height: 460px !important; }
        }
      `}</style>
    </div>
  )
}

// ─── SidebarSection ─────────────────────────────────────────────────────────

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
      <div style={{ padding: '4px 16px 14px' }}>
        {children}
      </div>
    </div>
  )
}
