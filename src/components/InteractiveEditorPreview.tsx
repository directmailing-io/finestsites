'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

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
  preview_interactive?: boolean
  preview_value?: string
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

function buildPreviewSrc(templateId: string, overrides: Record<string, string>, vp: Viewport = 'desktop'): string {
  const base = `/api/templates/${templateId}/public-preview`
  const params = new URLSearchParams()
  if (vp !== 'desktop') params.set('vp', vp)
  if (Object.keys(overrides).length > 0) {
    const json = JSON.stringify(overrides)
    const b64 = btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    params.set('data', b64)
  }
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

// ─── Control type detection ───────────────────────────────────────────────────

function isToggleField(f: PlaceholderField): boolean {
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
  const paneRef    = useRef<HTMLDivElement>(null)
  const iframeRef  = useRef<HTMLIFrameElement>(null)
  const pendingScroll = useRef<number | null>(null)

  // Lazy-init with actual viewport width so the first render already has the
  // correct scale — avoids the 880→actual jump that caused desktop overflow on mobile.
  const [paneWidth, setPaneWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 880
    return window.innerWidth
  })
  const [paneHeight, setPaneHeight] = useState<number>(() => {
    if (typeof window === 'undefined') return 620
    const w = window.innerWidth
    if (w <= 479) return 360
    if (w <= 767) return 420
    if (w <= 1023) return 560
    return 620
  })
  // Always start as 'desktop' on SSR — corrected to actual device after mount.
  const [viewport, setViewport] = useState<Viewport>('desktop')
  const [isLoading, setIsLoading] = useState(false)

  // ─── Measure preview pane ─────────────────────────────────────────────────

  useEffect(() => {
    const update = () => {
      if (paneRef.current) {
        setPaneWidth(paneRef.current.offsetWidth)
        setPaneHeight(paneRef.current.offsetHeight)
      }
    }
    update()
    const ro = new ResizeObserver(update)
    if (paneRef.current) ro.observe(paneRef.current)
    return () => ro.disconnect()
  }, [])

  // ─── Fields ───────────────────────────────────────────────────────────────

  const allFields         = placeholderSchema.fields ?? []
  const interactiveFields = allFields.filter(f => f.preview_interactive)

  const colorFields  = interactiveFields.filter(isColorField)
  const imageFields  = interactiveFields.filter(isImageField)
  const toggleFields = interactiveFields.filter(isToggleField)

  const hasControls = interactiveFields.length > 0

  // ─── State ────────────────────────────────────────────────────────────────

  const [initialValues] = useState<Record<string, string>>(() => {
    const vals: Record<string, string> = {}
    for (const f of interactiveFields) {
      vals[f.key] = f.preview_value ?? f.default_value ?? ''
    }
    return vals
  })

  const allValuesRef  = useRef<Record<string, string>>(initialValues)
  const viewportRef   = useRef<Viewport>('desktop')
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(initialValues)
  // Start empty — set correctly after mount with actual window.innerWidth.
  // This avoids SSR/hydration mismatch (server has no window, so viewport
  // would always be 'desktop' without this pattern).
  const [previewSrc, setPreviewSrc] = useState<string>('')

  const demoUrl = `demo.${domain}`

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function captureScroll() {
    try {
      const y = iframeRef.current?.contentWindow?.scrollY
      pendingScroll.current = typeof y === 'number' && y > 50 ? y : null
    } catch { pendingScroll.current = null }
  }

  // After mount: detect actual device viewport and load correct preview URL.
  // Runs once after hydration — this is the ONLY place where previewSrc gets
  // its initial value, guaranteeing the correct ?vp= param for mobile/tablet.
  useEffect(() => {
    const w = window.innerWidth
    const vp: Viewport = w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop'
    setViewport(vp) // eslint-disable-line react-hooks/set-state-in-effect
    viewportRef.current = vp
    setPreviewSrc(buildPreviewSrc(templateId, allValuesRef.current, vp))
  }, [templateId])

  // Keep viewportRef in sync so updateField always uses the current viewport
  useEffect(() => { viewportRef.current = viewport }, [viewport])

  // Reload iframe when viewport switcher changes (so correct ?vp= param is sent)
  useEffect(() => {
    setIsLoading(true) // eslint-disable-line react-hooks/set-state-in-effect
    setPreviewSrc(buildPreviewSrc(templateId, allValuesRef.current, viewport))
  }, [viewport, templateId])

  const updateField = useCallback((key: string, value: string) => {
    captureScroll()
    setIsLoading(true)
    allValuesRef.current = { ...allValuesRef.current, [key]: value }
    setFieldValues(prev => ({ ...prev, [key]: value }))
    setPreviewSrc(buildPreviewSrc(templateId, allValuesRef.current, viewportRef.current))
  }, [templateId])

  const handleToggle = useCallback((key: string) => {
    const newValue = (allValuesRef.current[key] ?? 'ja') === 'ja' ? 'nein' : 'ja'
    allValuesRef.current = { ...allValuesRef.current, [key]: newValue }
    setFieldValues(prev => ({ ...prev, [key]: newValue }))
    try {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'fs-toggle', key, value: newValue },
        '*'
      )
    } catch { /* cross-origin guard */ }
  }, [])

  const handleIframeLoad = useCallback(() => {
    setIsLoading(false)
    const target = pendingScroll.current
    pendingScroll.current = null
    if (target !== null) {
      setTimeout(() => {
        try {
          iframeRef.current?.contentWindow?.scrollTo({ top: target, behavior: 'instant' })
        } catch { /* cross-origin guard */ }
      }, 50)
    }
  }, [])

  // ─── Scaling ──────────────────────────────────────────────────────────────

  const targetWidth = VIEWPORT_CONFIG[viewport].width
  // Guard: if paneWidth hasn't been measured yet (SSR), use a safe fallback
  // so scale doesn't stay at 0.999 (which would show template at full desktop size).
  const safePaneWidth = paneWidth > 0 ? paneWidth : 320
  const scale   = Math.min(0.999, safePaneWidth / targetWidth)

  const scaledW = targetWidth * scale
  const leftPad = viewport !== 'desktop' ? Math.max(0, (safePaneWidth - scaledW) / 2) : 0

  // ─── Shared controls markup ───────────────────────────────────────────────
  // Rendered in both the desktop sidebar and the mobile inline controls section.

  function renderControls(variant: 'sidebar' | 'mobile') {
    const isMobileVariant = variant === 'mobile'
    return (
      <>
        {/* Color fields */}
        {colorFields.map(field => (
          <SidebarSection key={field.key} label={field.label} variant={variant}>
            {isMobileVariant ? (
              /* Mobile: horizontal scroll chips */
              <div className="fs-mobile-scroll">
                {(field.card_options ?? []).map(opt => {
                  const isActive = fieldValues[field.key] === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => updateField(field.key, opt.value)}
                      className={`fs-color-chip${isActive ? ' active' : ''}`}
                      style={{ '--chip-color': opt.color ?? accentColor, '--accent': accentColor } as React.CSSProperties}
                    >
                      <span className="fs-color-dot" style={{ background: opt.color ?? '#999' }} />
                      <span className="fs-color-label">{opt.label}</span>
                      {isActive && <CheckIcon color={accentColor} />}
                    </button>
                  )
                })}
              </div>
            ) : (
              /* Desktop: vertical list */
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
                        minHeight: 44,
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
            )}
          </SidebarSection>
        ))}

        {/* Image fields */}
        {imageFields.map(field => (
          <SidebarSection key={field.key} label={field.label} variant={variant}>
            {isMobileVariant ? (
              /* Mobile: horizontal scroll image chips */
              <div className="fs-mobile-scroll">
                {(field.card_options ?? []).map(opt => {
                  const isActive = fieldValues[field.key] === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => updateField(field.key, opt.value)}
                      className={`fs-img-chip${isActive ? ' active' : ''}`}
                      style={{ '--accent': accentColor } as React.CSSProperties}
                    >
                      <div className="fs-img-thumb">
                        {opt.image_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={opt.image_url} alt={opt.label} />
                        )}
                        {isActive && (
                          <div className="fs-img-check">
                            <CheckIcon color="#fff" />
                          </div>
                        )}
                      </div>
                      <span className="fs-img-label">{opt.label}</span>
                    </button>
                  )
                })}
              </div>
            ) : (
              /* Desktop: vertical list with thumbnail */
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
                        minHeight: 44,
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
            )}
          </SidebarSection>
        ))}

        {/* Toggle fields */}
        {toggleFields.length > 0 && (
          <SidebarSection label="Sektionen ein/aus" variant={variant}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobileVariant ? 0 : 2 }}>
              {toggleFields.map(field => {
                const isOn = (fieldValues[field.key] ?? 'ja') === 'ja'
                return (
                  <div
                    key={field.key}
                    onClick={() => handleToggle(field.key)}
                    className="fs-toggle-row"
                    style={{ '--accent': accentColor } as React.CSSProperties}
                  >
                    <span className="fs-toggle-label">{field.label}</span>
                    <ToggleSwitch isOn={isOn} color={accentColor} />
                  </div>
                )
              })}
            </div>
          </SidebarSection>
        )}
      </>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'relative' }}>
      <div className="editor-frame" style={{
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 8px 48px rgba(0,0,0,0.09), 0 2px 12px rgba(0,0,0,0.05)',
      }}>

        {/* ── Top bar ──────────────────────────────────────────────────────── */}
        <div className="editor-topbar" style={{
          background: '#FAFAFA',
          borderBottom: '1px solid rgba(0,0,0,0.07)',
          padding: '0 16px',
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}>

          {/* Logo + domain */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/logo-black.svg" alt="FinestSites" style={{ height: 16, width: 'auto' }} />
            <div style={{ width: 1, height: 16, background: 'rgba(0,0,0,0.1)' }} />
            <span style={{ fontSize: 12, color: '#999', fontWeight: 500 }}>{demoUrl}</span>
          </div>

          {/* Viewport switcher — hidden on mobile/tablet via CSS */}
          <div className="editor-viewport-switcher" style={{ display: 'flex', alignItems: 'center', gap: 1, background: '#EDEDED', borderRadius: 9, padding: 3 }}>
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

          {/* Actions — hidden on mobile via CSS */}
          <div className="editor-topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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

        {/* ── Body: sidebar + preview ──────────────────────────────────────── */}
        <div className="editor-body" style={{
          display: 'grid',
          gridTemplateColumns: hasControls ? '260px 1fr' : '1fr',
        }}>

          {/* ── LEFT: Sidebar (desktop + tablet) ──────────────────────────── */}
          {hasControls && (
            <aside className="editor-sidebar" style={{
              background: '#fff',
              borderRight: '1px solid rgba(0,0,0,0.07)',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}>
              {renderControls('sidebar')}
              <div style={{ flex: 1 }} />
            </aside>
          )}

          {/* ── RIGHT: iframe preview ─────────────────────────────────────── */}
          <div
            ref={paneRef}
            className="editor-preview-pane"
            style={{
              background: viewport === 'desktop' ? '#F5F4F0' : '#E0E0E0',
              position: 'relative',
              minWidth: 0,
              overflow: 'hidden',
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

            {/* Scaled iframe.
                IMPORTANT: transform:scale is applied to the WRAPPER DIV, not
                the iframe itself. iOS Safari has a known bug where transform
                on <iframe> elements is not rendered correctly — the content
                appears unscaled at full device viewport width.
                Scaling a regular <div> that contains the iframe works correctly
                on all browsers including iOS Safari. */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: leftPad,
              width: targetWidth,
              height: scale > 0 ? Math.ceil(paneHeight / scale) : paneHeight,
              transformOrigin: 'top left',
              transform: `scale(${scale})`,
              WebkitTransform: `scale(${scale})`,
            }}>
              <iframe
                ref={iframeRef}
                src={previewSrc}
                onLoad={handleIframeLoad}
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

        {/* ── Mobile inline controls (below preview) ───────────────────────── */}
        {/* Apple configurator pattern: options stack below the product preview   */}
        {hasControls && (
          <div className="editor-mobile-controls">
            {renderControls('mobile')}
          </div>
        )}

      </div>

      {/* ── Global styles ─────────────────────────────────────────────────── */}
      <style>{`
        /* Prevent horizontal page scroll caused by the scaled iframe's
           position:absolute layout footprint escaping overflow:hidden on iOS Safari.
           This is the definitive page-level fix. */
        html, body { overflow-x: hidden !important; max-width: 100%; }

        @keyframes fs-spin { to { transform: rotate(360deg); } }

        /* ── Shared toggle row ─────────────────────────────────────────────── */
        .fs-toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 6px;
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.12s;
          min-height: 44px;
          -webkit-tap-highlight-color: transparent;
        }
        .fs-toggle-row:hover { background: #F7F7F7; }
        .fs-toggle-row:active { background: #EFEFEF; }
        .fs-toggle-label {
          font-size: 13px;
          color: #333;
          font-weight: 500;
          user-select: none;
          line-height: 1.3;
        }

        /* ── Mobile-only controls section ─────────────────────────────────── */
        .editor-mobile-controls {
          display: none;
          background: #fff;
          border-top: 1px solid rgba(0,0,0,0.08);
        }

        /* ── Mobile horizontal scroll strip ───────────────────────────────── */
        .fs-mobile-scroll {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 4px 2px 8px;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .fs-mobile-scroll::-webkit-scrollbar { display: none; }

        /* Color chip (mobile) */
        .fs-color-chip {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 8px 14px 8px 10px;
          border-radius: 100px;
          border: 1.5px solid rgba(0,0,0,0.1);
          background: #fff;
          cursor: pointer;
          white-space: nowrap;
          min-height: 40px;
          scroll-snap-align: start;
          transition: border-color 0.12s, background 0.12s;
          -webkit-tap-highlight-color: transparent;
          flex-shrink: 0;
        }
        .fs-color-chip.active {
          border-color: var(--accent);
          background: color-mix(in srgb, var(--accent) 8%, #fff);
        }
        .fs-color-dot {
          width: 16px; height: 16px;
          border-radius: 50%;
          flex-shrink: 0;
          box-shadow: inset 0 0 0 1px rgba(0,0,0,0.08);
        }
        .fs-color-label {
          font-size: 13px;
          font-weight: 600;
          color: #222;
        }
        .fs-color-chip.active .fs-color-label { color: var(--accent); }

        /* Image chip (mobile) */
        .fs-img-chip {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 0;
          border: none;
          background: none;
          cursor: pointer;
          scroll-snap-align: start;
          flex-shrink: 0;
          -webkit-tap-highlight-color: transparent;
        }
        .fs-img-thumb {
          width: 72px; height: 46px;
          border-radius: 8px;
          overflow: hidden;
          background: #F0F0F0;
          border: 2px solid rgba(0,0,0,0.08);
          transition: border-color 0.12s;
          position: relative;
          flex-shrink: 0;
        }
        .fs-img-chip.active .fs-img-thumb {
          border-color: var(--accent);
        }
        .fs-img-thumb img {
          width: 100%; height: 100%; object-fit: cover; display: block;
        }
        .fs-img-check {
          position: absolute; inset: 0;
          background: rgba(0,0,0,0.35);
          display: flex; align-items: center; justify-content: center;
        }
        .fs-img-label {
          font-size: 11px;
          font-weight: 600;
          color: #555;
          text-align: center;
          max-width: 72px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .fs-img-chip.active .fs-img-label { color: var(--accent); }

        /* ── Desktop layout ────────────────────────────────────────────────── */
        /* translateZ(0) forces GPU compositing: fixes iOS Safari overflow:hidden
           not clipping scaled/transformed children (known webkit bug). */
        .editor-frame { overflow: hidden; -webkit-transform: translateZ(0); transform: translateZ(0); }
        .editor-viewport-switcher { }
        .editor-topbar-actions { }
        .editor-sidebar { }
        .editor-preview-pane { height: 620px; overflow: hidden; }
        .editor-body { }

        /* ── Tablet layout (768–1023px) ────────────────────────────────────── */
        @media (max-width: 1023px) {
          .editor-viewport-switcher { display: none !important; }
          .editor-topbar-actions a:first-child { display: none; } /* hide Live-Demo */
          .editor-body { grid-template-columns: 220px 1fr !important; }
          /* Touch-friendly sidebar items */
          .fs-toggle-row { min-height: 48px; padding: 12px 6px; }
          .fs-toggle-label { font-size: 13.5px; }
          .editor-preview-pane { height: 560px !important; }
        }

        /* ── Mobile layout (<768px) ────────────────────────────────────────── */
        @media (max-width: 767px) {
          /* Frame: edge-to-edge, no rounded corners on mobile */
          .editor-frame {
            border-radius: 16px !important;
            border-left: none !important;
            border-right: none !important;
            border-top: none !important;
          }

          /* Top bar: simplified */
          .editor-topbar-actions { display: none !important; }
          .editor-viewport-switcher { display: none !important; }

          /* Body: preview only, no sidebar */
          .editor-body { grid-template-columns: 1fr !important; }
          .editor-sidebar { display: none !important; }

          /* Preview: shorter, full-width */
          .editor-preview-pane { height: 420px !important; }

          /* Show mobile controls below preview */
          .editor-mobile-controls { display: block !important; }
        }

        /* ── Very small phones (<480px) ────────────────────────────────────── */
        @media (max-width: 479px) {
          .editor-preview-pane { height: 360px !important; }
          .editor-frame { border-radius: 12px !important; }
        }
      `}</style>
    </div>
  )
}

// ─── Sidebar section wrapper ─────────────────────────────────────────────────

function SidebarSection({
  label,
  children,
  variant,
}: {
  label: string
  children: React.ReactNode
  variant?: 'sidebar' | 'mobile'
}) {
  const isMobile = variant === 'mobile'
  return (
    <div style={{
      borderBottom: '1px solid rgba(0,0,0,0.05)',
      padding: isMobile ? '14px 16px 16px' : undefined,
    }}>
      {!isMobile && (
        <div style={{
          padding: '11px 16px 5px',
          fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: '#bbb',
        }}>
          {label}
        </div>
      )}
      {isMobile && (
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: '#bbb',
          marginBottom: 10,
        }}>
          {label}
        </div>
      )}
      <div style={{ padding: isMobile ? undefined : '3px 16px 12px' }}>
        {children}
      </div>
    </div>
  )
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

function ToggleSwitch({ isOn, color }: { isOn: boolean; color: string }) {
  return (
    <div style={{
      width: 38, height: 22, borderRadius: 100,
      background: isOn ? color : '#D8D8D8',
      position: 'relative', flexShrink: 0,
      transition: 'background 0.2s cubic-bezier(0.4,0,0.2,1)',
    }}>
      <div style={{
        position: 'absolute',
        top: 3,
        left: isOn ? 16 : 3,
        width: 16, height: 16, borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.2s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
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

function CheckIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5">
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
