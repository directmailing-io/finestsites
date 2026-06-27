'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────
// These mirror the placeholderSchema field structure.
// preview_interactive and preview_value are set by admin per field.

interface CardOption {
  value: string
  label: string
  description?: string
  card_type?: 'color' | 'image' | 'text'
  color?: string
  image_url?: string
}

interface PlaceholderField {
  key: string
  label: string
  type: string
  preview_interactive?: boolean   // can visitor change this in marketing preview?
  preview_value?: string          // admin-set demo value
  default_value?: string
  card_options?: CardOption[]
}

export interface PlaceholderSchema {
  fields?: PlaceholderField[]
  preview_values?: Record<string, string>
}

interface Props {
  templateId: string
  domain: string
  placeholderSchema: PlaceholderSchema
  accentColor: string
  registerUrl: string
}

// ─── Viewport config ──────────────────────────────────────────────────────────

type Viewport = 'desktop' | 'tablet' | 'mobile'

const VIEWPORT_CONFIG: Record<Viewport, { width: number; label: string }> = {
  desktop: { width: 1280, label: 'Desktop' },
  tablet:  { width: 768,  label: 'Tablet'  },
  mobile:  { width: 390,  label: 'Mobil'   },
}

// ─── URL encoding ─────────────────────────────────────────────────────────────

function buildPreviewSrc(templateId: string, overrides: Record<string, string>): string {
  const base = `/api/templates/${templateId}/public-preview`
  if (Object.keys(overrides).length === 0) return base
  const json = JSON.stringify(overrides)
  // base64url: same as server's Buffer.from(str, 'base64url')
  const b64 = btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${base}?data=${b64}`
}

// ─── Control type detection ───────────────────────────────────────────────────

function isToggleField(f: PlaceholderField): boolean {
  // ja/nein card_select → show as toggle
  const vals = (f.card_options ?? []).map(o => o.value)
  return f.type === 'card_select' && vals.includes('ja') && vals.includes('nein') && vals.length === 2
}

function isColorField(f: PlaceholderField): boolean {
  return f.type === 'card_select' && !isToggleField(f) &&
    (f.card_options ?? []).some(o => o.card_type === 'color')
}

function isImageField(f: PlaceholderField): boolean {
  return f.type === 'card_select' && !isToggleField(f) &&
    (f.card_options ?? []).some(o => o.card_type === 'image')
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InteractiveEditorPreview({
  templateId,
  domain,
  placeholderSchema,
  accentColor,
  registerUrl,
}: Props) {
  const paneRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const pendingScroll = useRef<number | null>(null)
  const [paneWidth, setPaneWidth] = useState(880)
  const [viewport, setViewport] = useState<Viewport>('desktop')
  const [isLoading, setIsLoading] = useState(false)

  // ─── Measure preview pane width for CSS transform scaling ─────────────────

  useEffect(() => {
    const update = () => {
      if (paneRef.current) setPaneWidth(paneRef.current.offsetWidth)
    }
    update()
    const ro = new ResizeObserver(update)
    if (paneRef.current) ro.observe(paneRef.current)
    return () => ro.disconnect()
  }, [])

  // ─── Derive interactive fields from schema ────────────────────────────────

  const allFields = placeholderSchema.fields ?? []
  const interactiveFields = allFields.filter(f => f.preview_interactive)

  const colorFields  = interactiveFields.filter(isColorField)
  const imageFields  = interactiveFields.filter(isImageField)
  const toggleFields = interactiveFields.filter(isToggleField)

  const hasControls = interactiveFields.length > 0

  // ─── State: one value per interactive field ───────────────────────────────

  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const f of interactiveFields) {
      init[f.key] = f.preview_value ?? f.default_value ?? ''
    }
    return init
  })

  const demoUrl = `demo.${domain}`
  const previewSrc = buildPreviewSrc(templateId, fieldValues)

  // ─── Field update — capture scroll before src changes, restore after load ──

  function captureScroll() {
    try {
      const y = iframeRef.current?.contentWindow?.scrollY
      pendingScroll.current = typeof y === 'number' && y > 50 ? y : null
    } catch { pendingScroll.current = null }
  }

  const updateField = useCallback((key: string, value: string) => {
    captureScroll()
    setIsLoading(true)
    setFieldValues(prev => ({ ...prev, [key]: value }))
  }, [])

  const toggleField = useCallback((key: string) => {
    captureScroll()
    setFieldValues(prev => ({
      ...prev,
      [key]: prev[key] === 'ja' ? 'nein' : 'ja',
    }))
  }, [])

  const handleIframeLoad = useCallback(() => {
    setIsLoading(false)
    const target = pendingScroll.current
    pendingScroll.current = null
    if (target !== null) {
      // rAF gives the iframe a frame to render before we scroll
      requestAnimationFrame(() => {
        try {
          iframeRef.current?.contentWindow?.scrollTo({ top: target, behavior: 'instant' })
        } catch { /* cross-origin guard */ }
      })
    }
  }, [])

  // ─── Viewport + iframe scaling ────────────────────────────────────────────

  const targetWidth = VIEWPORT_CONFIG[viewport].width
  const scale = Math.min(0.999, paneWidth / targetWidth)
  const PANE_H = 620

  const iframeStyle: React.CSSProperties = {
    width: targetWidth,
    height: Math.ceil(PANE_H / scale),
    border: 'none',
    display: 'block',
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
    flexShrink: 0,
  }

  // For tablet/mobile: center horizontally
  const scaledW = targetWidth * scale
  const leftPad = viewport !== 'desktop' ? Math.max(0, (paneWidth - scaledW) / 2) : 0

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 8px 48px rgba(0,0,0,0.09), 0 2px 12px rgba(0,0,0,0.05)',
      }}>

        {/* ── Top bar ──────────────────────────────────────────────────────── */}
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

          {/* Logo + domain */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/logo-black.svg" alt="FinestSites" style={{ height: 16, width: 'auto' }} />
            <div style={{ width: 1, height: 16, background: 'rgba(0,0,0,0.1)' }} />
            <span style={{ fontSize: 12, color: '#999', fontWeight: 500 }}>{demoUrl}</span>
          </div>

          {/* Viewport switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 1, background: '#EDEDED', borderRadius: 9, padding: 3 }} className="editor-viewport-switcher">
            {(['desktop', 'tablet', 'mobile'] as Viewport[]).map(vp => (
              <button
                key={vp}
                onClick={() => setViewport(vp)}
                title={VIEWPORT_CONFIG[vp].label}
                style={{
                  width: 32, height: 26, borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: viewport === vp ? '#fff' : 'transparent',
                  color: viewport === vp ? '#111' : '#aaa',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: viewport === vp ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                {vp === 'desktop' ? <MonitorIcon /> : vp === 'tablet' ? <TabletIcon /> : <PhoneIcon />}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <a
              href={`https://${demoUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, color: '#999', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

        {/* ── Mobile tabs ──────────────────────────────────────────────────── */}
        {hasControls && (
          <MobileTabs accentColor={accentColor} />
        )}

        {/* ── Body: sidebar + preview ──────────────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: hasControls ? '260px 1fr' : '1fr',
        }} className="editor-body">

          {/* ── LEFT: Sidebar ─────────────────────────────────────────────── */}
          {hasControls && (
            <aside className="editor-sidebar" style={{
              background: '#fff',
              borderRight: '1px solid rgba(0,0,0,0.07)',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}>

              {/* Color fields */}
              {colorFields.map(field => (
                <SidebarSection key={field.key} label={field.label}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {(field.card_options ?? []).map(opt => {
                      const isActive = fieldValues[field.key] === opt.value
                      return (
                        <button
                          key={opt.value}
                          onClick={() => updateField(field.key, opt.value)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '9px 11px', borderRadius: 9, width: '100%',
                            border: `1.5px solid ${isActive ? accentColor : 'rgba(0,0,0,0.09)'}`,
                            background: isActive ? `${accentColor}0d` : '#fff',
                            cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s',
                          }}
                        >
                          <div style={{
                            width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                            background: opt.color ?? '#999',
                            boxShadow: isActive
                              ? `0 0 0 2px #fff, 0 0 0 3.5px ${opt.color ?? accentColor}`
                              : 'inset 0 0 0 1px rgba(0,0,0,0.1)',
                            transition: 'box-shadow 0.12s',
                          }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#222', lineHeight: 1.25 }}>{opt.label}</div>
                            {opt.description && (
                              <div style={{ fontSize: 11, color: '#aaa', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.description}</div>
                            )}
                          </div>
                          {isActive && <Checkmark color={accentColor} />}
                        </button>
                      )
                    })}
                  </div>
                </SidebarSection>
              ))}

              {/* Image selector fields (Hero variant etc.) */}
              {imageFields.map(field => (
                <SidebarSection key={field.key} label={field.label}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {(field.card_options ?? []).map(opt => {
                      const isActive = fieldValues[field.key] === opt.value
                      return (
                        <button
                          key={opt.value}
                          onClick={() => updateField(field.key, opt.value)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '7px 10px 7px 7px', borderRadius: 9, width: '100%',
                            border: `1.5px solid ${isActive ? accentColor : 'rgba(0,0,0,0.09)'}`,
                            background: isActive ? `${accentColor}0d` : '#fff',
                            cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s',
                          }}
                        >
                          <div style={{
                            width: 54, height: 34, borderRadius: 5, flexShrink: 0,
                            background: '#F0F0F0', overflow: 'hidden',
                            border: `1px solid ${isActive ? accentColor + '40' : 'rgba(0,0,0,0.06)'}`,
                          }}>
                            {opt.image_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={opt.image_url} alt={opt.label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#222', lineHeight: 1.25 }}>{opt.label}</div>
                            {opt.description && (
                              <div style={{ fontSize: 11, color: '#aaa', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.description}</div>
                            )}
                          </div>
                          {isActive && <Checkmark color={accentColor} />}
                        </button>
                      )
                    })}
                  </div>
                </SidebarSection>
              ))}

              {/* Toggle fields (Sektionen) */}
              {toggleFields.length > 0 && (
                <SidebarSection label="Sektionen ein/aus">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {toggleFields.map(field => {
                      const isOn = (fieldValues[field.key] ?? 'ja') === 'ja'
                      return (
                        <div
                          key={field.key}
                          onClick={() => toggleField(field.key)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '9px 6px', borderRadius: 8, cursor: 'pointer', transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#F7F7F7')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <span style={{ fontSize: 12.5, color: '#333', fontWeight: 500 }}>{field.label}</span>
                          <ToggleSwitch isOn={isOn} color={accentColor} />
                        </div>
                      )
                    })}
                  </div>
                </SidebarSection>
              )}

              <div style={{ flex: 1 }} />
            </aside>
          )}

          {/* ── RIGHT: iframe preview ─────────────────────────────────────── */}
          <div
            ref={paneRef}
            className="editor-preview-pane"
            style={{
              background: viewport === 'desktop' ? '#F5F4F0' : '#E0E0E0',
              overflow: 'hidden',
              position: 'relative',
              height: PANE_H,
            }}
          >
            {/* Loading overlay */}
            {isLoading && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 10,
                background: 'rgba(245,244,240,0.6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(2px)',
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  border: `2.5px solid ${accentColor}33`,
                  borderTopColor: accentColor,
                  animation: 'fs-spin 0.7s linear infinite',
                }} />
              </div>
            )}

            {/* Scaled iframe — desktop flush left, tablet/mobile centered */}
            <div style={{
              position: 'absolute',
              top: viewport !== 'desktop' ? 12 : 0,
              left: leftPad,
            }}>
              <iframe
                ref={iframeRef}
                src={previewSrc}
                onLoad={handleIframeLoad}
                style={iframeStyle}
                title="Template Vorschau"
              />
            </div>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes fs-spin { to { transform: rotate(360deg); } }

        @media (max-width: 768px) {
          .editor-topbar { display: none !important; }
          .editor-mobile-tabs { display: flex !important; }
          .editor-body { grid-template-columns: 1fr !important; }
          .editor-sidebar { border-right: none !important; border-bottom: 1px solid rgba(0,0,0,0.07); max-height: 340px; }
          .editor-sidebar.mobile-hidden { display: none !important; }
          .editor-preview-pane { height: 500px !important; }
          .editor-preview-pane.mobile-hidden { display: none !important; }
          .editor-viewport-switcher { display: none !important; }
        }
        @media (max-width: 480px) {
          .editor-preview-pane { height: 420px !important; }
        }
      `}</style>
    </div>
  )
}

// ─── Mobile tabs ─────────────────────────────────────────────────────────────

function MobileTabs({ accentColor }: { accentColor: string }) {
  const [tab, setTab] = useState<'preview' | 'edit'>('preview')
  return (
    <div className="editor-mobile-tabs" style={{ display: 'none', background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
      {(['preview', 'edit'] as const).map(t => (
        <button
          key={t}
          onClick={() => setTab(t)}
          style={{
            flex: 1, padding: '11px 0', fontSize: 13, fontWeight: 600,
            background: 'none', border: 'none', cursor: 'pointer',
            color: tab === t ? accentColor : '#bbb',
            borderBottom: `2px solid ${tab === t ? accentColor : 'transparent'}`,
            transition: 'all 0.15s',
          }}
        >
          {t === 'preview' ? 'Vorschau' : 'Anpassen'}
        </button>
      ))}
    </div>
  )
}

// ─── Sidebar section wrapper ─────────────────────────────────────────────────

function SidebarSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
      <div style={{
        padding: '11px 16px 5px',
        fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: '#bbb',
      }}>
        {label}
      </div>
      <div style={{ padding: '3px 16px 12px' }}>
        {children}
      </div>
    </div>
  )
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

function ToggleSwitch({ isOn, color }: { isOn: boolean; color: string }) {
  return (
    <div style={{
      width: 34, height: 20, borderRadius: 100,
      background: isOn ? color : '#E0E0E0',
      position: 'relative', flexShrink: 0, transition: 'background 0.18s',
    }}>
      <div style={{
        position: 'absolute', top: 3, left: isOn ? 14 : 3,
        width: 14, height: 14, borderRadius: '50%',
        background: '#fff', transition: 'left 0.18s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </div>
  )
}

// ─── Checkmark icon ──────────────────────────────────────────────────────────

function Checkmark({ color }: { color: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" style={{ flexShrink: 0 }}>
      <path d="M20 6L9 17l-5-5"/>
    </svg>
  )
}

// ─── Viewport icons ──────────────────────────────────────────────────────────

function MonitorIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <path d="M8 21h8M12 17v4"/>
    </svg>
  )
}

function TabletIcon() {
  return (
    <svg width="13" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="2" width="16" height="20" rx="2"/>
      <circle cx="12" cy="18" r="1" fill="currentColor" stroke="none"/>
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg width="11" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="5" y="2" width="14" height="20" rx="2"/>
      <circle cx="12" cy="18" r="1" fill="currentColor" stroke="none"/>
    </svg>
  )
}
