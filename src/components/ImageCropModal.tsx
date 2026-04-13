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
  const imgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)
  const [crop, setCrop] = useState<CropRect>({ x: 0.1, y: 0.1, w: 0.8, h: 0.6 })
  const [dragging, setDragging] = useState<null | 'move' | 'tl' | 'tr' | 'bl' | 'br'>(null)
  const dragStart = useRef<{ mx: number; my: number; crop: CropRect } | null>(null)
  const [ready, setReady] = useState(false)

  function handleImageLoad() {
    const img = imgRef.current
    if (!img) return
    const ar = img.naturalWidth / img.naturalHeight
    const modalW = Math.min(window.innerWidth * 0.9, 720)
    const maxH = Math.min(window.innerHeight * 0.58, 460)
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

  function onMouseDown(e: React.MouseEvent, handle: typeof dragging) {
    e.preventDefault()
    setDragging(handle)
    const { w, h } = getContainerSize()
    dragStart.current = { mx: e.clientX / w, my: e.clientY / h, crop: { ...crop } }
  }

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging || !dragStart.current) return
    const { w, h } = getContainerSize()
    const dx = e.clientX / w - dragStart.current.mx
    const dy = e.clientY / h - dragStart.current.my
    const c = dragStart.current.crop
    let nx = c.x, ny = c.y, nw = c.w, nh = c.h
    const minSize = 0.05

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

  const onMouseUp = useCallback(() => setDragging(null), [])

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onMouseMove, onMouseUp])

  function handleConfirm() {
    const img = imgRef.current
    const canvas = canvasRef.current
    if (!img || !canvas) return
    const nw = img.naturalWidth, nh = img.naturalHeight
    const px = Math.round(crop.x * nw), py = Math.round(crop.y * nh)
    const pw = Math.round(crop.w * nw), ph = Math.round(crop.h * nh)
    canvas.width = aspectRatio ? outputWidth : pw
    canvas.height = aspectRatio ? Math.round(outputWidth / aspectRatio) : ph
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(img, px, py, pw, ph, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(blob => { if (blob) onConfirm(blob) }, 'image/jpeg', 0.92)
  }

  const l = crop.x * 100, t = crop.y * 100
  const W = crop.w * 100, H = crop.h * 100
  const OV = 'rgba(0,0,0,0.52)' // overlay colour

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.85)' }}>
      <div className="flex flex-col rounded-[24px] overflow-hidden bg-white" style={{ width: '90vw', maxWidth: 720, maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: '#F1F5F9' }}>
          <div>
            <h3 className="font-semibold text-gray-900">Bild zuschneiden</h3>
            {aspectRatio && (
              <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                {aspectRatio === 1.6 ? '16:10' : aspectRatio === 16/9 ? '16:9' : aspectRatio.toFixed(2)} · Ausgabe {outputWidth}×{Math.round(outputWidth / aspectRatio)}px
              </p>
            )}
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-[8px]" style={{ background: '#F3F4F6', color: '#6B7280' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Crop area */}
        <div className="flex items-center justify-center flex-shrink-0" style={{ background: '#000' }}>
          <div
            ref={containerRef}
            className="relative"
            style={{
              width: dims ? dims.w : '100%',
              height: dims ? dims.h : 320,
              userSelect: 'none',
              overflow: 'hidden',
            }}
          >
            {/* The ONE image — full opacity, fills container exactly (no objectFit) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={imageUrl}
              alt=""
              style={{ display: 'block', width: '100%', height: '100%' }}
              onLoad={handleImageLoad}
            />

            {ready && (
              <>
                {/* ── Dark overlay: 4 rects around the crop box ── */}
                {/* Top */}
                <div style={{ position: 'absolute', inset: 0, top: 0, left: 0, right: 0, height: `${t}%`, background: OV, pointerEvents: 'none' }} />
                {/* Bottom */}
                <div style={{ position: 'absolute', left: 0, right: 0, top: `${t + H}%`, bottom: 0, background: OV, pointerEvents: 'none' }} />
                {/* Left */}
                <div style={{ position: 'absolute', left: 0, top: `${t}%`, width: `${l}%`, height: `${H}%`, background: OV, pointerEvents: 'none' }} />
                {/* Right */}
                <div style={{ position: 'absolute', left: `${l + W}%`, right: 0, top: `${t}%`, height: `${H}%`, background: OV, pointerEvents: 'none' }} />

                {/* Crop box border + rule-of-thirds grid */}
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: `${l}%`, top: `${t}%`, width: `${W}%`, height: `${H}%`,
                    border: '2px solid rgba(255,255,255,0.85)',
                  }}
                >
                  {[1/3, 2/3].map(p => (
                    <div key={`h${p}`} style={{ position: 'absolute', left: 0, right: 0, top: `${p*100}%`, height: 1, background: 'rgba(255,255,255,0.3)' }} />
                  ))}
                  {[1/3, 2/3].map(p => (
                    <div key={`v${p}`} style={{ position: 'absolute', top: 0, bottom: 0, left: `${p*100}%`, width: 1, background: 'rgba(255,255,255,0.3)' }} />
                  ))}
                </div>

                {/* Invisible move handle covering the crop box */}
                <div
                  className="absolute cursor-move"
                  style={{ left: `${l}%`, top: `${t}%`, width: `${W}%`, height: `${H}%` }}
                  onMouseDown={e => onMouseDown(e, 'move')}
                />

                {/* Corner handles */}
                {(['tl', 'tr', 'bl', 'br'] as const).map(handle => {
                  const hl = handle.includes('r') ? l + W : l
                  const ht = handle.includes('b') ? t + H : t
                  return (
                    <div
                      key={handle}
                      style={{
                        position: 'absolute',
                        left: `calc(${hl}% - 6px)`, top: `calc(${ht}% - 6px)`,
                        width: 12, height: 12,
                        background: 'white',
                        borderRadius: 3,
                        border: '1.5px solid rgba(0,0,0,0.2)',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                        cursor: `${handle}-resize`,
                        zIndex: 10,
                      }}
                      onMouseDown={e => onMouseDown(e, handle)}
                    />
                  )
                })}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t flex-shrink-0" style={{ borderColor: '#F1F5F9' }}>
          <p className="text-xs" style={{ color: '#94A3B8' }}>
            {aspectRatio ? 'Ecken ziehen zum Anpassen des Ausschnitts' : 'Bereich auswählen'}
          </p>
          <div className="flex items-center gap-3">
            <button onClick={onCancel} className="px-4 py-2 text-sm font-medium rounded-[12px]"
              style={{ background: '#F3F4F6', color: '#374151' }}>
              Abbrechen
            </button>
            <button onClick={handleConfirm} className="px-5 py-2 text-sm font-semibold text-white rounded-[12px]"
              style={{ background: '#1a1a1a' }}>
              Zuschneiden & verwenden
            </button>
          </div>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  )
}
