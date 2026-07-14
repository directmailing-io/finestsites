'use client'

import { useRef, useState, useCallback, useEffect } from 'react'

interface CropRect { x: number; y: number; w: number; h: number }

interface ImageCropModalProps {
  imageUrl: string
  onConfirm: (blob: Blob) => void
  onCancel: () => void
  aspectRatio?: number
  outputWidth?: number
}

export default function ImageCropModal({
  imageUrl,
  onConfirm,
  onCancel,
  aspectRatio,
  outputWidth = 1600,
}: ImageCropModalProps) {
  const imgRef    = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [dims, setDims]       = useState<{ w: number; h: number } | null>(null)
  const [crop, setCrop]       = useState<CropRect>({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 })
  const [dragging, setDragging] = useState<null | 'move' | 'tl' | 'tr' | 'bl' | 'br'>(null)
  const dragStart = useRef<{ mx: number; my: number; crop: CropRect } | null>(null)
  const [ready, setReady] = useState(false)

  // ── Image load: calculate render size ────────────────────────────────────────
  function handleImageLoad() {
    const img = imgRef.current
    if (!img) return
    const ar  = img.naturalWidth / img.naturalHeight
    const isSmall = window.innerWidth < 640
    const modalW = Math.min(window.innerWidth * (isSmall ? 1 : 0.9), 720)
    const maxH   = isSmall
      ? Math.min(window.innerHeight * 0.52, 380)
      : Math.min(window.innerHeight * 0.58, 460)
    let w = modalW, h = w / ar
    if (h > maxH) { h = maxH; w = h * ar }
    setDims({ w: Math.round(w), h: Math.round(h) })
    setReady(true)
  }

  useEffect(() => {
    if (!ready || !dims) return
    requestAnimationFrame(() => setCrop(initCrop(dims.w, dims.h)))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  function initCrop(cw: number, ch: number): CropRect {
    if (!aspectRatio) return { x: 0.1, y: 0.1, w: 0.8, h: 0.8 }
    const containerAr = cw / ch
    if (containerAr > aspectRatio) {
      const w = (ch * aspectRatio * 0.9) / cw
      return { x: (1 - w) / 2, y: 0.05, w, h: 0.9 }
    } else {
      const h = (cw / aspectRatio * 0.9) / ch
      return { x: 0.05, y: (1 - h) / 2, w: 0.9, h }
    }
  }

  function getContainerSize() {
    if (dims) return { w: dims.w, h: dims.h }
    const el = containerRef.current
    if (!el) return { w: 1, h: 1 }
    return { w: el.clientWidth, h: el.clientHeight }
  }

  // ── Shared drag start (mouse + touch) ────────────────────────────────────────
  function startDrag(clientX: number, clientY: number, handle: typeof dragging) {
    setDragging(handle)
    const { w, h } = getContainerSize()
    dragStart.current = { mx: clientX / w, my: clientY / h, crop: { ...crop } }
  }

  function onMouseDown(e: React.MouseEvent, handle: typeof dragging) {
    e.preventDefault()
    startDrag(e.clientX, e.clientY, handle)
  }

  function onTouchStart(e: React.TouchEvent, handle: typeof dragging) {
    e.preventDefault()          // stops page scroll while cropping
    e.stopPropagation()
    const t = e.touches[0]
    startDrag(t.clientX, t.clientY, handle)
  }

  // ── Shared move logic ─────────────────────────────────────────────────────────
  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!dragging || !dragStart.current) return
    const { w, h } = getContainerSize()
    const dx = clientX / w - dragStart.current.mx
    const dy = clientY / h - dragStart.current.my
    const c  = dragStart.current.crop
    const minSize = 0.05
    let nx = c.x, ny = c.y, nw = c.w, nh = c.h

    if (dragging === 'move') {
      nx = Math.max(0, Math.min(1 - nw, c.x + dx))
      ny = Math.max(0, Math.min(1 - nh, c.y + dy))
    } else if (dragging === 'tl') {
      const newX = Math.min(c.x + c.w - minSize, Math.max(0, c.x + dx))
      const newY = Math.min(c.y + c.h - minSize, Math.max(0, c.y + dy))
      nw = c.w + (c.x - newX); nh = c.h + (c.y - newY)
      nx = newX; ny = newY
    } else if (dragging === 'tr') {
      nw = Math.max(minSize, Math.min(1 - c.x, c.w + dx))
      const newY = Math.min(c.y + c.h - minSize, Math.max(0, c.y + dy))
      nh = c.h + (c.y - newY); ny = newY
    } else if (dragging === 'bl') {
      const newX = Math.min(c.x + c.w - minSize, Math.max(0, c.x + dx))
      nw = c.w + (c.x - newX); nx = newX
      nh = Math.max(minSize, Math.min(1 - c.y, c.h + dy))
    } else if (dragging === 'br') {
      nw = Math.max(minSize, Math.min(1 - c.x, c.w + dx))
      nh = Math.max(minSize, Math.min(1 - c.y, c.h + dy))
    }

    let next: CropRect = { x: nx, y: ny, w: nw, h: nh }

    // Enforce aspect ratio on resize (not on move)
    if (aspectRatio && dragging !== 'move') {
      const { w: cw, h: ch } = getContainerSize()
      const pxH = (next.w * cw) / aspectRatio / ch
      if (dragging === 'tl' || dragging === 'tr') {
        next = { ...next, h: pxH, y: next.y + (nh - pxH) }
      } else {
        next = { ...next, h: pxH }
      }
      next.y = Math.max(0, Math.min(1 - next.h, next.y))
    }

    setCrop(next)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, aspectRatio, dims])

  const onMouseMove = useCallback((e: MouseEvent) => {
    handleMove(e.clientX, e.clientY)
  }, [handleMove])

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (!dragging) return
    e.preventDefault()          // critical: block page scroll while dragging
    handleMove(e.touches[0].clientX, e.touches[0].clientY)
  }, [dragging, handleMove])

  const stopDrag = useCallback(() => setDragging(null), [])

  // ── Register global move/end listeners ───────────────────────────────────────
  useEffect(() => {
    window.addEventListener('mousemove',  onMouseMove)
    window.addEventListener('mouseup',    stopDrag)
    // passive:false is required so we can call preventDefault() inside onTouchMove
    window.addEventListener('touchmove',  onTouchMove, { passive: false })
    window.addEventListener('touchend',   stopDrag)
    window.addEventListener('touchcancel', stopDrag)
    return () => {
      window.removeEventListener('mousemove',  onMouseMove)
      window.removeEventListener('mouseup',    stopDrag)
      window.removeEventListener('touchmove',  onTouchMove)
      window.removeEventListener('touchend',   stopDrag)
      window.removeEventListener('touchcancel', stopDrag)
    }
  }, [onMouseMove, onTouchMove, stopDrag])

  // ── Confirm: render crop on hidden canvas and return blob ─────────────────────
  function handleConfirm() {
    const img    = imgRef.current
    const canvas = canvasRef.current
    if (!img || !canvas) return
    const nw = img.naturalWidth, nh = img.naturalHeight
    const px = Math.round(crop.x * nw), py = Math.round(crop.y * nh)
    const pw = Math.round(crop.w * nw), ph = Math.round(crop.h * nh)
    canvas.width  = aspectRatio ? outputWidth : pw
    canvas.height = aspectRatio ? Math.round(outputWidth / aspectRatio) : ph
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(img, px, py, pw, ph, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(blob => { if (blob) onConfirm(blob) }, 'image/jpeg', 0.92)
  }

  const l = crop.x * 100, t = crop.y * 100
  const W = crop.w * 100, H = crop.h * 100
  const OV = 'rgba(0,0,0,0.52)'

  // Corner handle definitions: visual position + cursor
  const HANDLES = [
    { id: 'tl', l: l,     top: t,     cursor: 'nw-resize' },
    { id: 'tr', l: l + W, top: t,     cursor: 'ne-resize' },
    { id: 'bl', l: l,     top: t + H, cursor: 'sw-resize' },
    { id: 'br', l: l + W, top: t + H, cursor: 'se-resize' },
  ] as const

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.88)' }}
    >
      <div
        className="flex flex-col bg-white overflow-hidden w-full sm:w-auto"
        style={{
          borderRadius: '24px 24px 0 0',
          // On mobile: full-width sheet from bottom
          // On desktop: centered modal
          maxWidth: 720,
          maxHeight: '96vh',
        }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: '#F1F5F9' }}>
          <div>
            <h3 className="font-semibold text-gray-900" style={{ fontSize: 16 }}>Bild zuschneiden</h3>
            {aspectRatio && (
              <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                {aspectRatio === 1 ? '1:1' : aspectRatio === 1.6 ? '16:10' : aspectRatio === 16/9 ? '16:9' : aspectRatio.toFixed(2)}
                {' · '}Ausgabe {outputWidth}×{Math.round(outputWidth / aspectRatio)}px
              </p>
            )}
          </div>
          <button
            onClick={onCancel}
            style={{ width: 36, height: 36, borderRadius: 10, background: '#F3F4F6', color: '#6B7280', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* ── Crop canvas ── */}
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{ background: '#111', overflowY: 'auto' }}
        >
          <div
            ref={containerRef}
            style={{
              position: 'relative',
              width:  dims ? dims.w : '100%',
              height: dims ? dims.h : 300,
              userSelect: 'none',
              // Prevent browser native touch scroll/zoom while user drags inside
              touchAction: 'none',
              overflow: 'hidden',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={imageUrl}
              alt=""
              draggable={false}
              style={{ display: 'block', width: '100%', height: '100%', pointerEvents: 'none' }}
              onLoad={handleImageLoad}
            />

            {ready && (
              <>
                {/* Dark overlay — 4 rects around crop box */}
                <div style={{ position:'absolute', inset:0, top:0, left:0, right:0, height:`${t}%`, background:OV, pointerEvents:'none' }} />
                <div style={{ position:'absolute', left:0, right:0, top:`${t+H}%`, bottom:0, background:OV, pointerEvents:'none' }} />
                <div style={{ position:'absolute', left:0, top:`${t}%`, width:`${l}%`, height:`${H}%`, background:OV, pointerEvents:'none' }} />
                <div style={{ position:'absolute', left:`${l+W}%`, right:0, top:`${t}%`, height:`${H}%`, background:OV, pointerEvents:'none' }} />

                {/* Crop border + rule-of-thirds grid */}
                <div
                  style={{ position:'absolute', left:`${l}%`, top:`${t}%`, width:`${W}%`, height:`${H}%`, border:'2px solid rgba(255,255,255,0.9)', pointerEvents:'none', boxSizing:'border-box' }}
                >
                  {[1/3, 2/3].map(p => (
                    <div key={`h${p}`} style={{ position:'absolute', left:0, right:0, top:`${p*100}%`, height:1, background:'rgba(255,255,255,0.28)' }} />
                  ))}
                  {[1/3, 2/3].map(p => (
                    <div key={`v${p}`} style={{ position:'absolute', top:0, bottom:0, left:`${p*100}%`, width:1, background:'rgba(255,255,255,0.28)' }} />
                  ))}
                </div>

                {/* Move handle — full crop area */}
                <div
                  style={{ position:'absolute', left:`${l}%`, top:`${t}%`, width:`${W}%`, height:`${H}%`, cursor:'move', touchAction:'none' }}
                  onMouseDown={e => onMouseDown(e, 'move')}
                  onTouchStart={e => onTouchStart(e, 'move')}
                />

                {/* Corner handles — 52×52 touch target, small visual dot */}
                {HANDLES.map(({ id, l: hl, top: ht, cursor }) => (
                  <div
                    key={id}
                    onMouseDown={e => onMouseDown(e, id)}
                    onTouchStart={e => onTouchStart(e, id)}
                    style={{
                      position: 'absolute',
                      // Center the 52px hit area on the corner point
                      left: `calc(${hl}% - 26px)`,
                      top:  `calc(${ht}% - 26px)`,
                      width: 52, height: 52,
                      cursor,
                      zIndex: 20,
                      touchAction: 'none',
                      // Flex-center the visible dot inside the large hit area
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {/* Visual handle dot */}
                    <div style={{
                      width: 14, height: 14,
                      background: '#fff',
                      borderRadius: 4,
                      border: '1.5px solid rgba(0,0,0,0.18)',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                      flexShrink: 0,
                    }} />
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div
          className="flex items-center justify-between gap-3 px-5 py-4 border-t flex-shrink-0"
          style={{ borderColor: '#F1F5F9', flexWrap: 'wrap' }}
        >
          <p className="text-xs" style={{ color: '#94A3B8', flexShrink: 0, lineHeight: 1.4 }}>
            {aspectRatio
              ? 'Ecken oder Fläche ziehen zum Anpassen'
              : 'Bereich auswählen'}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
            <button
              onClick={onCancel}
              style={{
                height: 44, padding: '0 18px', fontSize: 14, fontWeight: 600,
                borderRadius: 12, border: 'none', background: '#F3F4F6', color: '#374151',
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              Abbrechen
            </button>
            <button
              onClick={handleConfirm}
              style={{
                height: 44, padding: '0 20px', fontSize: 14, fontWeight: 700,
                borderRadius: 12, border: 'none', background: '#111827', color: '#fff',
                cursor: 'pointer', whiteSpace: 'nowrap',
                boxShadow: '0 4px 14px rgba(17,24,39,0.2)',
              }}
            >
              Zuschneiden &amp; verwenden
            </button>
          </div>
        </div>
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  )
}
