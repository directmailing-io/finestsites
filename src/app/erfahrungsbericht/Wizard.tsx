'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  TESTIMONIAL_CATEGORIES, TestimonialCategoryKey, HEALTH_CLAIM_GUIDE,
  REWARD_MESSAGE, WHATSAPP_SHARE_TEXT, guidedQuestionsFor, CONSENT_BONUS,
} from '@/lib/constants/testimonial-content'
import { getCurrentTestimonialConsentText } from '@/lib/constants/testimonial-consent'
import { compressImage } from './lib/compress-image'
import { compressVideo, webCodecsSupported, COMPRESS_THRESHOLD_BYTES } from './lib/compress-video'
import { saveDraft, loadDraft, clearDraft, DraftData } from './lib/draft'

// ── API-Helfer ────────────────────────────────────────────────────────────────

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Etwas ist schiefgelaufen. Bitte versuch es nochmal.')
  return data as T
}

async function uploadProxy(blob: Blob, filename: string, kind: string, submissionId: string, uploadToken: string): Promise<string> {
  const fd = new FormData()
  fd.append('file', blob, filename)
  fd.append('submissionId', submissionId)
  fd.append('uploadToken', uploadToken)
  fd.append('kind', kind)
  const res = await fetch('/api/erfahrungsbericht/upload', { method: 'POST', body: fd })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Upload fehlgeschlagen. Bitte versuch es nochmal.')
  return (data as { assetId: string }).assetId
}

// fetch kennt keinen Upload-Fortschritt, deshalb XHR für den Presigned-PUT
function putWithProgress(url: string, blob: Blob, contentType: string, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded / e.total) }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Upload fehlgeschlagen.')))
    xhr.onerror = () => reject(new Error('Upload fehlgeschlagen. Prüf deine Internetverbindung.'))
    xhr.send(blob)
  })
}

// ── Sprach- und Texteingabe (aus dem Feedback-Wizard übernommen) ──────────────

const AUDIO_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/ogg;codecs=opus',
]

function pickAudioMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  if (typeof MediaRecorder.isTypeSupported !== 'function') return ''
  return AUDIO_MIME_CANDIDATES.find(c => MediaRecorder.isTypeSupported(c)) ?? ''
}

function voiceSupported(): boolean {
  return typeof navigator !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia
    && typeof MediaRecorder !== 'undefined'
}

function VoiceTextInput({ value, onChange, onAudio, placeholder, rows = 6, maxLength = 6000 }: {
  value: string
  onChange: (v: string, source: 'typed' | 'dictated') => void
  onAudio?: (blob: Blob) => void
  placeholder: string
  rows?: number
  maxLength?: number
}) {
  const [supported, setSupported] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { setSupported(voiceSupported()) }, [])

  const stopTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null } }

  const stopRecording = useCallback(() => {
    try { recorderRef.current?.stop() } catch { /* schon gestoppt */ }
    setRecording(false)
    stopTimer()
  }, [])

  const startRecording = useCallback(async () => {
    setError('')
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError('Mikrofon blockiert. Öffne die Seite direkt in Safari oder Chrome oder tipp deine Antwort ein.')
      return
    }
    try {
      const mime = pickAudioMime()
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = e => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const type = rec.mimeType || chunksRef.current[0]?.type || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        if (blob.size < 500) {
          setError('Die Aufnahme war zu kurz. Versuch es nochmal.')
          return
        }
        setTranscribing(true)
        try {
          const fd = new FormData()
          fd.append('audio', blob, 'aufnahme')
          const res = await fetch('/api/feedback/transcribe', { method: 'POST', body: fd })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error ?? 'Fehler')
          const text = (data.text ?? '').trim()
          if (text) {
            onChange((value ? value.trimEnd() + ' ' + text : text).slice(0, maxLength), 'dictated')
            onAudio?.(blob)
          } else {
            setError('Wir konnten nichts verstehen. Versuch es nochmal oder tipp deine Antwort ein.')
          }
        } catch {
          setError('Hat gerade nicht geklappt. Tipp deine Antwort einfach ein.')
        } finally {
          setTranscribing(false)
        }
      }
      // Timeslice: zuverlässige Chunks auch auf iOS Safari
      rec.start(1000)
      recorderRef.current = rec
      setRecording(true)
      setSeconds(0)
      timerRef.current = setInterval(() => {
        setSeconds(s => {
          if (s >= 89) { stopRecording(); return s }
          return s + 1
        })
      }, 1000)
    } catch {
      stream.getTracks().forEach(t => t.stop())
      setError('Einsprechen klappt in diesem Browser nicht. Tipp deine Antwort einfach ein.')
    }
  }, [onChange, onAudio, value, stopRecording, maxLength])

  useEffect(() => () => { stopTimer(); recorderRef.current?.stream?.getTracks().forEach(t => t.stop()) }, [])

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <textarea
          value={value}
          onChange={e => onChange(e.target.value.slice(0, maxLength), 'typed')}
          placeholder={placeholder}
          rows={rows}
          style={{
            width: '100%', padding: '14px 16px', paddingBottom: supported ? 56 : 14,
            border: '1.5px solid #E5E7EB', borderRadius: 20, fontSize: 16,
            lineHeight: 1.55, color: '#1a1a1a', background: '#fff',
            resize: 'vertical', outline: 'none', fontFamily: 'inherit',
          }}
          onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
          onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
        />
        {supported && (
          <button
            type="button"
            className="fs-press"
            onClick={recording ? stopRecording : startRecording}
            disabled={transcribing}
            style={{
              position: 'absolute', left: 10, bottom: 14,
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 16px', borderRadius: 999, border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
              background: recording ? '#DC2626' : '#1a1a1a',
              color: '#fff',
              opacity: transcribing ? 0.6 : 1,
              transition: 'background 0.2s',
            }}
          >
            {recording ? (
              <>
                <span style={{
                  width: 8, height: 8, borderRadius: 999, background: '#fff',
                  animation: 'fs-pulse 1s infinite',
                }} />
                Fertig · {String(Math.floor(seconds / 60))}:{String(seconds % 60).padStart(2, '0')}
              </>
            ) : transcribing ? (
              'Wird zu Text…'
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                </svg>
                Einsprechen
              </>
            )}
          </button>
        )}
      </div>
      {error && <p style={{ margin: '8px 2px 0', fontSize: 13, color: '#B45309' }}>{error}</p>}
    </div>
  )
}

// ── Video-Aufnahme direkt im Browser ──────────────────────────────────────────

const VIDEO_MIME_CANDIDATES = [
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
]

function pickVideoMime(): string {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return ''
  return VIDEO_MIME_CANDIDATES.find(c => MediaRecorder.isTypeSupported(c)) ?? ''
}

const MAX_RECORD_SECONDS = 120

function VideoRecorder({ onFinish, onClose }: {
  onFinish: (blob: Blob) => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [ready, setReady] = useState(false)
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null)
  const previewUrlRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // Hochkant (9:16) ist gewollt: so passen die Videos später in die Fallstudien-Seite
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 720 }, height: { ideal: 1280 },
            aspectRatio: { ideal: 9 / 16 }, facingMode: 'user',
          },
          audio: true,
        })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
        setReady(true)
      } catch {
        setError('Kamera blockiert. Erlaube den Zugriff in den Browser-Einstellungen oder lade stattdessen ein Video hoch.')
      }
    })()
    return () => {
      cancelled = true
      if (timerRef.current) clearInterval(timerRef.current)
      try { recorderRef.current?.stop() } catch { /* egal */ }
      streamRef.current?.getTracks().forEach(t => t.stop())
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    }
  }, [])

  const stop = useCallback(() => {
    try { recorderRef.current?.stop() } catch { /* schon gestoppt */ }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setRecording(false)
  }, [])

  const start = useCallback(() => {
    const stream = streamRef.current
    if (!stream) return
    setError('')
    try {
      const mime = pickVideoMime()
      const rec = new MediaRecorder(stream, {
        ...(mime ? { mimeType: mime } : {}),
        videoBitsPerSecond: 2_500_000,
        audioBitsPerSecond: 128_000,
      })
      chunksRef.current = []
      rec.ondataavailable = e => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        const type = (rec.mimeType || chunksRef.current[0]?.type || 'video/webm').split(';')[0]
        const blob = new Blob(chunksRef.current, { type })
        if (blob.size < 5000) {
          setError('Die Aufnahme war zu kurz. Versuch es nochmal.')
          return
        }
        // Erst anschauen, dann entscheiden: hochladen oder neu aufnehmen
        const url = URL.createObjectURL(blob)
        previewUrlRef.current = url
        setPreview({ blob, url })
      }
      rec.start(1000)
      recorderRef.current = rec
      setRecording(true)
      setSeconds(0)
      timerRef.current = setInterval(() => {
        setSeconds(s => {
          if (s >= MAX_RECORD_SECONDS - 1) { stop(); return s }
          return s + 1
        })
      }, 1000)
    } catch {
      setError('Aufnehmen klappt in diesem Browser nicht. Lade stattdessen ein Video hoch.')
    }
  }, [stop])

  const retake = useCallback(() => {
    if (previewUrlRef.current) { URL.revokeObjectURL(previewUrlRef.current); previewUrlRef.current = null }
    setPreview(null)
    setError('')
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [])

  return (
    <div style={{ animation: 'fs-step-in 0.35s cubic-bezier(0.16,1,0.3,1)' }}>
      <div style={{
        position: 'relative', borderRadius: 22, overflow: 'hidden', background: '#111',
        aspectRatio: '9 / 16', width: 'min(100%, 280px)', margin: '0 auto',
      }}>
        {preview ? (
          <video
            key={preview.url}
            src={preview.url}
            controls
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <video
            ref={videoRef}
            muted
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
          />
        )}
        {recording && (
          <span style={{
            position: 'absolute', top: 14, left: 14, display: 'flex', alignItems: 'center', gap: 7,
            padding: '6px 12px', borderRadius: 999, background: 'rgba(0,0,0,0.55)',
            color: '#fff', fontSize: 13.5, fontWeight: 700,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: '#EF4444', animation: 'fs-pulse 1s infinite' }} />
            {String(Math.floor(seconds / 60))}:{String(seconds % 60).padStart(2, '0')} / 2:00
          </span>
        )}
      </div>
      {!recording && !preview && (
        <p style={{ margin: '10px 2px 0', fontSize: 13, color: '#9CA3AF', textAlign: 'center' }}>
          30 bis 60 Sekunden reichen völlig. Maximal 2 Minuten.
        </p>
      )}
      {error && <p style={{ margin: '10px 2px 0', fontSize: 13.5, color: '#B45309' }}>{error}</p>}
      {preview ? (
        <>
          <p style={{ margin: '12px 2px 0', fontSize: 14, fontWeight: 600, color: '#374151', textAlign: 'center' }}>
            Schau es dir kurz an. Zufrieden?
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button
              type="button"
              className="fs-press"
              onClick={retake}
              style={{
                flex: 1, padding: '14px 0', borderRadius: 999, border: '1.5px solid #E5E7EB',
                background: '#fff', color: '#374151', fontSize: 15.5, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Neu aufnehmen
            </button>
            <button
              type="button"
              className="fs-press"
              onClick={() => onFinish(preview.blob)}
              style={{
                flex: 1, padding: '14px 0', borderRadius: 999, border: 'none',
                background: '#059669', color: '#fff', fontSize: 15.5, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Video verwenden
            </button>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button
            type="button"
            className="fs-press"
            onClick={() => { stop(); onClose() }}
            style={{
              flex: 1, padding: '14px 0', borderRadius: 999, border: '1.5px solid #E5E7EB',
              background: '#fff', color: '#374151', fontSize: 15.5, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Abbrechen
          </button>
          <button
            type="button"
            className="fs-press"
            onClick={recording ? stop : start}
            disabled={!ready}
            style={{
              flex: 2, padding: '14px 0', borderRadius: 999, border: 'none',
              background: recording ? '#DC2626' : '#1a1a1a', color: '#fff',
              fontSize: 15.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              opacity: ready ? 1 : 0.5,
            }}
          >
            {recording ? 'Aufnahme beenden' : 'Aufnahme starten'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Heilaussagen-Hinweis (streng, bei Text- und Video-Step) ───────────────────

function HealthClaimCard() {
  return (
    <div style={{
      padding: '16px 16px 14px', borderRadius: 20, background: '#FFFBEB',
      border: '1.5px solid #FDE68A', marginBottom: 20,
    }}>
      <p style={{
        margin: '0 0 6px', fontSize: 14.5, fontWeight: 800, color: '#92400E',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 16 }}>⚠️</span> {HEALTH_CLAIM_GUIDE.title}
      </p>
      <p style={{ margin: '0 0 12px', fontSize: 13.5, lineHeight: 1.55, color: '#78350F' }}>
        {HEALTH_CLAIM_GUIDE.intro}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {HEALTH_CLAIM_GUIDE.badExamples.map(t => (
          <p key={t} style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: '#991B1B' }}>
            ❌ {t}
          </p>
        ))}
        {HEALTH_CLAIM_GUIDE.goodExamples.map(t => (
          <p key={t} style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: '#065F46' }}>
            ✅ „{t}“
          </p>
        ))}
      </div>
    </div>
  )
}

// ── Konfetti ──────────────────────────────────────────────────────────────────

function launchConfetti(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = window.devicePixelRatio || 1
  canvas.width = window.innerWidth * dpr
  canvas.height = window.innerHeight * dpr
  ctx.scale(dpr, dpr)
  const colors = ['#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899', '#FBBF24']
  const parts = Array.from({ length: 160 }, () => ({
    x: window.innerWidth / 2 + (Math.random() - 0.5) * 120,
    y: window.innerHeight * 0.55,
    vx: (Math.random() - 0.5) * 14,
    vy: -(6 + Math.random() * 12),
    size: 5 + Math.random() * 6,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 0.3,
  }))
  const start = performance.now()
  function frame(t: number) {
    if (!ctx) return
    const elapsed = t - start
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
    if (elapsed > 3500) return
    for (const p of parts) {
      p.vy += 0.28
      p.x += p.vx
      p.y += p.vy
      p.vx *= 0.99
      p.rot += p.vr
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillStyle = p.color
      ctx.globalAlpha = Math.max(0, 1 - elapsed / 3500)
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
      ctx.restore()
    }
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

// ── Bausteine ─────────────────────────────────────────────────────────────────

const primaryBtn: React.CSSProperties = {
  padding: '14px 34px', borderRadius: 999, border: 'none',
  background: '#1a1a1a', color: '#fff', fontSize: 16, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '14px 16px', border: '1.5px solid #E5E7EB',
  borderRadius: 16, fontSize: 16, color: '#1a1a1a', background: '#fff',
  outline: 'none', fontFamily: 'inherit',
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{ ...inputStyle, ...props.style }}
      onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
      onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
    />
  )
}

function StepShell({ title, sub, children }: {
  title: string
  sub?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h1 style={{
        fontSize: 25, fontWeight: 800, color: '#1a1a1a', letterSpacing: '-0.02em',
        margin: sub ? '0 0 8px' : '0 0 26px', lineHeight: 1.25,
      }}>
        {title}
      </h1>
      {sub && <p style={{ fontSize: 15.5, lineHeight: 1.5, color: '#9CA3AF', margin: '0 0 26px' }}>{sub}</p>}
      {children}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 15.5, fontWeight: 600, color: '#374151', margin: '26px 0 10px', lineHeight: 1.45 }}>
      {children}
    </p>
  )
}

function SelectCard({ label, sub, emoji, active, onClick, disabled }: {
  label: string
  sub?: string
  emoji?: string
  active: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className="fs-press"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        width: '100%', padding: sub ? '15px 18px' : '16px 18px', borderRadius: 20,
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'inherit', textAlign: 'left',
        border: active ? '2px solid #1a1a1a' : '1.5px solid #E5E7EB',
        background: active ? '#FAFAFA' : '#fff',
        color: active ? '#1a1a1a' : '#374151',
        fontSize: 15.5, fontWeight: active ? 700 : 500,
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {emoji && <span style={{ fontSize: 26, lineHeight: 1 }}>{emoji}</span>}
        <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span>{label}</span>
          {sub && <span style={{ fontSize: 13.5, fontWeight: 500, color: active ? '#4B5563' : '#9CA3AF' }}>{sub}</span>}
        </span>
      </span>
      <span style={{
        width: 22, height: 22, borderRadius: 999, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: active ? 'none' : '1.5px solid #D1D5DB',
        background: active ? '#1a1a1a' : 'transparent',
        transition: 'all 0.15s',
      }}>
        {active && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12l5 5 11-11" />
          </svg>
        )}
      </span>
    </button>
  )
}

function Spinner({ size = 22, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: 999, display: 'inline-block',
      border: `2.5px solid ${color}`, borderTopColor: 'transparent',
      animation: 'fs-spin 0.8s linear infinite',
    }} />
  )
}

// ── Foto-Raster ───────────────────────────────────────────────────────────────

type PhotoItem = {
  localId: string
  assetId: string | null
  previewUrl: string
  status: 'uploading' | 'done' | 'error'
  error?: string
}

function PhotoGrid({ items, max, onAdd, onRemove }: {
  items: PhotoItem[]
  max: number
  onAdd: (files: File[]) => void
  onRemove: (item: PhotoItem) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const firstError = items.find(i => i.status === 'error')?.error
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {items.map(item => (
          <div key={item.localId} style={{
            position: 'relative', aspectRatio: '1', borderRadius: 16, overflow: 'hidden',
            background: '#F3F4F6',
            border: item.status === 'error' ? '2px solid #DC2626' : '1.5px solid #E5E7EB',
          }}>
            {item.previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.previewUrl} alt="" style={{
                width: '100%', height: '100%', objectFit: 'cover',
                opacity: item.status === 'done' ? 1 : 0.55, display: 'block',
              }} />
            )}
            {item.status === 'uploading' && (
              <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spinner color="#1a1a1a" />
              </span>
            )}
            {item.status === 'error' && (
              <span style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24,
              }}>
                ⚠️
              </span>
            )}
            <button
              type="button"
              onClick={() => onRemove(item)}
              aria-label="Foto entfernen"
              style={{
                position: 'absolute', top: 6, right: 6, width: 26, height: 26,
                borderRadius: 999, border: 'none', cursor: 'pointer',
                background: 'rgba(0,0,0,0.6)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        ))}
        {items.length < max && (
          <button
            type="button"
            className="fs-press"
            onClick={() => inputRef.current?.click()}
            style={{
              aspectRatio: '1', borderRadius: 16, cursor: 'pointer',
              border: '2px dashed #D1D5DB', background: '#FAFAFA',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
              color: '#6B7280', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Foto
          </button>
        )}
      </div>
      {firstError && <p style={{ margin: '10px 2px 0', fontSize: 13.5, color: '#DC2626' }}>{firstError}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        style={{ display: 'none' }}
        onChange={e => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          if (files.length) onAdd(files)
        }}
      />
    </div>
  )
}

// ── Wizard ────────────────────────────────────────────────────────────────────

type StepId = 'intro' | 'name' | 'category' | 'text' | 'before' | 'after' | 'video' | 'personal' | 'consent'

type Session = { submissionId: string; uploadToken: string; startedAt: number }

type VideoState =
  | { phase: 'none' }
  | { phase: 'compressing'; progress: number; cancel: () => void }
  | { phase: 'uploading'; progress: number }
  | { phase: 'done'; assetId: string }
  | { phase: 'error'; message: string }

type StatusResponse = {
  category: string
  assets: { assetId: string; kind: string; sortOrder: number; previewUrl: string | null }[]
}

// Live-KI-Prüfung je Antwort auf Heil- und Wirkaussagen
type CheckState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'ok' }
  | { status: 'issues'; issues: { quote: string; reason: string }[]; suggestion: string }
  | { status: 'error' }

// Dezente Farbwelten für die drei Fragen: vorher (rot), Weg (gelb), Ergebnis (grün)
const QUESTION_COLORS = [
  { bg: '#FEF6F5', border: '#FBDAD5', badge: '#DC2626' },
  { bg: '#FFFDF2', border: '#F5E6A8', badge: '#D97706' },
  { bg: '#F3FCF7', border: '#BBE9D0', badge: '#059669' },
]

function stepsForCategory(category: TestimonialCategoryKey | null): StepId[] {
  const base: StepId[] = ['intro', 'name', 'category', 'text']
  if (category !== 'business') base.push('before', 'after')
  base.push('video', 'personal', 'consent')
  return base
}

function formatDisplayName(name: string, mode: 'full' | 'abbreviated'): string {
  const parts = name.trim().split(/\s+/)
  if (mode === 'abbreviated' && parts.length >= 2) {
    return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`
  }
  return name.trim()
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const VIDEO_UPLOAD_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']
const MAX_VIDEO_BYTES = 200 * 1024 * 1024

export default function Wizard() {
  const [session, setSession] = useState<Session | null>(null)
  const [category, setCategory] = useState<TestimonialCategoryKey | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState('')

  const [answers, setAnswers] = useState<string[]>(['', '', ''])
  const [hasTyped, setHasTyped] = useState(false)
  const [hasDictated, setHasDictated] = useState(false)
  const audioAssetIdRef = useRef<string | null>(null)

  const [checks, setChecks] = useState<CheckState[]>([{ status: 'idle' }, { status: 'idle' }, { status: 'idle' }])
  const approvedRef = useRef<string[]>(['', '', ''])    // zuletzt akzeptierte Fassung (Bestandsschutz)
  const checkedTextRef = useRef<string[]>(['', '', '']) // Text zum Zeitpunkt der letzten Prüfung
  const checkedCtxRef = useRef<string[]>(['', '', ''])  // andere Antworten zum Zeitpunkt der Prüfung
  const answersRef = useRef(answers)
  useEffect(() => { answersRef.current = answers }, [answers])

  // Kausalität entsteht oft erst im Zusammenspiel der Antworten ("seitdem" in
  // Antwort 3 meint das Produkt aus Antwort 2) → Kontext gehört zum Prüfstand
  const ctxFor = (all: string[], i: number) => all.filter((_, j) => j !== i).map(a => a.trim()).join('\n')

  const [beforePhotos, setBeforePhotos] = useState<PhotoItem[]>([])
  const [afterPhotos, setAfterPhotos] = useState<PhotoItem[]>([])
  const [video, setVideo] = useState<VideoState>({ phase: 'none' })
  const [showRecorder, setShowRecorder] = useState(false)
  const [showVideoRules, setShowVideoRules] = useState(false)
  const videoCancelledRef = useRef(false)
  const videoInputRef = useRef<HTMLInputElement>(null)

  const [fullName, setFullName] = useState('')
  const [displayNameMode, setDisplayNameMode] = useState<'full' | 'abbreviated'>('full')
  const [age, setAge] = useState('')
  const [email, setEmail] = useState('')
  const [instagram, setInstagram] = useState('')
  const [tiktok, setTiktok] = useState('')
  const [facebook, setFacebook] = useState('')
  const [showOptional, setShowOptional] = useState(false)

  const [consentAccepted, setConsentAccepted] = useState(false)
  const [showConsentText, setShowConsentText] = useState(false)
  const [website, setWebsite] = useState('') // Honeypot

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [done, setDone] = useState(false)
  const confettiRef = useRef<HTMLCanvasElement>(null)

  const [pendingResume, setPendingResume] = useState<DraftData | null>(null)
  const [resumeHint, setResumeHint] = useState('')

  const steps = useMemo(() => stepsForCategory(category), [category])
  const step = steps[Math.min(stepIndex, steps.length - 1)]
  const isLast = stepIndex >= steps.length - 1

  useEffect(() => { setPendingResume(loadDraft()) }, [])

  useEffect(() => {
    window.scrollTo({ top: 0 })
    if (done && confettiRef.current) launchConfetti(confettiRef.current)
  }, [stepIndex, done])

  const textSource = hasDictated && hasTyped ? 'mixed' : hasDictated ? 'dictated' : 'typed'

  const questions = useMemo(() => guidedQuestionsFor(category), [category])

  // Die drei Antworten werden mit ihrer Frage als Überschrift zu einem Text kombiniert
  const combinedText = useMemo(() =>
    questions
      .map((q, i) => {
        const a = (answers[i] ?? '').trim()
        return a ? `${q.label}\n${a}` : ''
      })
      .filter(Boolean)
      .join('\n\n'),
  [questions, answers])

  // ── Live-KI-Check auf Heil- und Wirkaussagen ────────────────────────────────

  const runCheck = useCallback(async (i: number, text: string, ctx: string) => {
    if (!session) return
    checkedTextRef.current[i] = text
    checkedCtxRef.current[i] = ctx
    setChecks(c => c.map((x, j) => (j === i ? { status: 'checking' as const } : x)))
    try {
      const res = await postJson<{ ok: boolean; issues?: { quote: string; reason: string }[]; suggestion?: string }>(
        '/api/erfahrungsbericht/check-text',
        {
          submissionId: session.submissionId, uploadToken: session.uploadToken,
          answers: answersRef.current.map(a => a.trim()), questionIndex: i,
          approvedText: approvedRef.current[i],
        },
      )
      // Antwort wurde inzwischen weitergetippt → Ergebnis verwerfen, neuer Check folgt
      if (answersRef.current[i].trim() !== text) return
      if (res.ok || !res.suggestion) {
        setChecks(c => c.map((x, j) => (j === i ? { status: 'ok' as const } : x)))
      } else {
        setChecks(c => c.map((x, j) => (j === i
          ? { status: 'issues' as const, issues: res.issues ?? [], suggestion: res.suggestion! }
          : x)))
      }
    } catch {
      if (answersRef.current[i].trim() !== text) return
      // Check ist ein Bonus und blockiert nie. Kein erneuter Versuch bis der Text sich ändert.
      setChecks(c => c.map((x, j) => (j === i ? { status: 'error' as const } : x)))
    }
  }, [session])

  useEffect(() => {
    if (step !== 'text' || !session) return
    const timers = answers.map((raw, i) => {
      const text = raw.trim()
      if (text.length < 25) return null
      const ctx = ctxFor(answers, i)
      // Auch bei unverändertem Text neu prüfen, wenn sich Nachbar-Antworten
      // geändert haben — Kausalität entsteht erst im Zusammenspiel
      if (text === checkedTextRef.current[i] && ctx === checkedCtxRef.current[i]) return null
      return setTimeout(() => runCheck(i, text, ctx), 2500)
    })
    return () => timers.forEach(t => { if (t) clearTimeout(t) })
  }, [answers, step, session, runCheck])

  function acceptSuggestion(i: number) {
    const c = checks[i]
    if (c.status !== 'issues') return
    approvedRef.current[i] = c.suggestion
    checkedTextRef.current[i] = c.suggestion
    checkedCtxRef.current[i] = ctxFor(answersRef.current, i)
    setAnswers(a => a.map((x, j) => (j === i ? c.suggestion : x)))
    setChecks(cs => cs.map((x, j) => (j === i ? { status: 'ok' as const } : x)))
    setHasTyped(true)
  }

  // Zwischenstand lokal sichern, damit ein unterbrochener Durchlauf fortsetzbar ist
  useEffect(() => {
    if (!session || done) return
    saveDraft({
      submissionId: session.submissionId, uploadToken: session.uploadToken,
      category: category ?? '', stepIndex, answers, textSource,
      fullName, displayNameMode, age, email, instagram, tiktok, facebook,
      startedAt: session.startedAt,
    })
  }, [session, done, category, stepIndex, answers, textSource, fullName, displayNameMode, age, email, instagram, tiktok, facebook])

  function restoreFields(d: DraftData) {
    setAnswers([d.answers?.[0] ?? '', d.answers?.[1] ?? '', d.answers?.[2] ?? ''])
    setHasTyped(d.textSource === 'typed' || d.textSource === 'mixed')
    setHasDictated(d.textSource === 'dictated' || d.textSource === 'mixed')
    setFullName(d.fullName ?? '')
    setDisplayNameMode(d.displayNameMode === 'abbreviated' ? 'abbreviated' : 'full')
    setAge(d.age ?? '')
    setEmail(d.email ?? '')
    setInstagram(d.instagram ?? '')
    setTiktok(d.tiktok ?? '')
    setFacebook(d.facebook ?? '')
  }

  async function resumeDraft(d: DraftData) {
    setPendingResume(null)
    try {
      const status = await postJson<StatusResponse>('/api/erfahrungsbericht/status', {
        submissionId: d.submissionId, uploadToken: d.uploadToken,
      })
      restoreFields(d)
      const cat = status.category as TestimonialCategoryKey
      setCategory(cat)
      setSession({ submissionId: d.submissionId, uploadToken: d.uploadToken, startedAt: d.startedAt })

      const toItems = (kind: string): PhotoItem[] => status.assets
        .filter(a => a.kind === kind)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(a => ({ localId: a.assetId, assetId: a.assetId, previewUrl: a.previewUrl ?? '', status: 'done' as const }))
      setBeforePhotos(toItems('before_image'))
      setAfterPhotos(toItems('after_image'))
      const vid = status.assets.find(a => a.kind === 'video')
      if (vid) setVideo({ phase: 'done', assetId: vid.assetId })
      const aud = status.assets.find(a => a.kind === 'audio')
      audioAssetIdRef.current = aud?.assetId ?? null

      const catSteps = stepsForCategory(cat)
      setStepIndex(Math.min(Math.max(d.stepIndex, 1), catSteps.length - 1))
    } catch {
      clearDraft()
      restoreFields(d)
      setResumeHint('Deine letzte Sitzung ist abgelaufen. Deine Texte haben wir dir aufgehoben, Fotos und Videos musst du leider nochmal hochladen.')
    }
  }

  function discardResume() {
    clearDraft()
    setPendingResume(null)
  }

  // ── Kategorie wählen → Draft auf dem Server anlegen ─────────────────────────

  async function chooseCategory(key: TestimonialCategoryKey) {
    if (starting) return
    if (category === key && session) return
    setStartError('')
    setStarting(true)
    try {
      const res = await postJson<{ submissionId: string; uploadToken: string }>('/api/erfahrungsbericht/start', { category: key })
      // Kategoriewechsel = neuer Draft. Alte Uploads verfallen (Cron räumt auf).
      setBeforePhotos([])
      setAfterPhotos([])
      setVideo({ phase: 'none' })
      audioAssetIdRef.current = null
      setCategory(key)
      setSession({ submissionId: res.submissionId, uploadToken: res.uploadToken, startedAt: Date.now() })
    } catch (e) {
      setStartError(e instanceof Error ? e.message : 'Etwas ist schiefgelaufen. Bitte versuch es nochmal.')
    } finally {
      setStarting(false)
    }
  }

  // ── Fotos ───────────────────────────────────────────────────────────────────

  function addPhotos(files: File[], kind: 'before_image' | 'after_image') {
    if (!session) return
    const { submissionId, uploadToken } = session
    const setter = kind === 'before_image' ? setBeforePhotos : setAfterPhotos
    const current = kind === 'before_image' ? beforePhotos : afterPhotos
    const slots = 5 - current.length
    for (const file of files.slice(0, slots)) {
      const localId = crypto.randomUUID()
      const previewUrl = URL.createObjectURL(file)
      setter(items => [...items, { localId, assetId: null, previewUrl, status: 'uploading' }])
      const update = (patch: Partial<PhotoItem>) =>
        setter(items => items.map(i => (i.localId === localId ? { ...i, ...patch } : i)))
      ;(async () => {
        try {
          let blob: Blob | null = await compressImage(file)
          if (!blob) {
            if (file.size <= 5 * 1024 * 1024) blob = file
            else throw new Error('Foto konnte nicht verarbeitet werden. Versuch ein JPG oder PNG unter 5 MB.')
          }
          const assetId = await uploadProxy(blob, 'foto.jpg', kind, submissionId, uploadToken)
          update({ assetId, status: 'done' })
        } catch (e) {
          update({ status: 'error', error: e instanceof Error ? e.message : 'Upload fehlgeschlagen.' })
        }
      })()
    }
  }

  function removePhoto(item: PhotoItem, kind: 'before_image' | 'after_image') {
    const setter = kind === 'before_image' ? setBeforePhotos : setAfterPhotos
    setter(items => items.filter(i => i.localId !== item.localId))
    if (item.previewUrl.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl)
    if (item.assetId && session) {
      postJson('/api/erfahrungsbericht/delete-asset', {
        submissionId: session.submissionId, uploadToken: session.uploadToken, assetId: item.assetId,
      }).catch(() => {})
    }
  }

  // ── Video ───────────────────────────────────────────────────────────────────

  async function handleVideoBlob(input: Blob) {
    if (!session) return
    const { submissionId, uploadToken } = session
    setShowRecorder(false)

    const baseType = (input.type || '').split(';')[0]
    if (!VIDEO_UPLOAD_TYPES.includes(baseType)) {
      setVideo({ phase: 'error', message: 'Dieses Format können wir leider nicht verarbeiten. Nimm ein MP4, WebM oder MOV.' })
      return
    }

    let blob = input
    let contentType = baseType

    if (webCodecsSupported() && input.size > COMPRESS_THRESHOLD_BYTES) {
      videoCancelledRef.current = false
      const { promise, cancel } = compressVideo(input, p =>
        setVideo(v => (v.phase === 'compressing' ? { ...v, progress: p } : v)))
      setVideo({
        phase: 'compressing', progress: 0,
        cancel: () => { videoCancelledRef.current = true; cancel() },
      })
      try {
        blob = await promise
        contentType = 'video/mp4'
      } catch {
        if (videoCancelledRef.current) { setVideo({ phase: 'none' }); return }
        // Kompression nicht möglich → Original hochladen, wenn es passt
        blob = input
        contentType = baseType
      }
    }

    if (blob.size > MAX_VIDEO_BYTES) {
      setVideo({ phase: 'error', message: 'Das Video ist zu groß (max. 200 MB). Nimm es etwas kürzer auf oder film direkt hier auf der Seite.' })
      return
    }

    try {
      setVideo({ phase: 'uploading', progress: 0 })
      const { assetId, uploadUrl } = await postJson<{ assetId: string; uploadUrl: string }>('/api/erfahrungsbericht/presign', {
        submissionId, uploadToken, contentType, sizeBytes: blob.size,
      })
      await putWithProgress(uploadUrl, blob, contentType, p =>
        setVideo(v => (v.phase === 'uploading' ? { ...v, progress: p } : v)))
      await postJson('/api/erfahrungsbericht/finalize-asset', { submissionId, uploadToken, assetId })
      setVideo({ phase: 'done', assetId })
    } catch (e) {
      setVideo({ phase: 'error', message: e instanceof Error ? e.message : 'Upload fehlgeschlagen. Bitte versuch es nochmal.' })
    }
  }

  function removeVideo() {
    if (video.phase === 'done' && session) {
      postJson('/api/erfahrungsbericht/delete-asset', {
        submissionId: session.submissionId, uploadToken: session.uploadToken, assetId: video.assetId,
      }).catch(() => {})
    }
    setVideo({ phase: 'none' })
  }

  // ── Diktat-Audio als O-Ton mitspeichern ─────────────────────────────────────

  function handleDictationAudio(blob: Blob) {
    if (!session) return
    const { submissionId, uploadToken } = session
    ;(async () => {
      try {
        if (audioAssetIdRef.current) {
          await postJson('/api/erfahrungsbericht/delete-asset', {
            submissionId, uploadToken, assetId: audioAssetIdRef.current,
          }).catch(() => {})
          audioAssetIdRef.current = null
        }
        audioAssetIdRef.current = await uploadProxy(blob, 'diktat', 'audio', submissionId, uploadToken)
      } catch { /* O-Ton ist ein Bonus, darf nie stören */ }
    })()
  }

  // ── Absenden ────────────────────────────────────────────────────────────────

  async function submit() {
    if (!session) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const parsedAge = Number.parseInt(age, 10)
      await postJson('/api/erfahrungsbericht/submit', {
        submissionId: session.submissionId,
        uploadToken: session.uploadToken,
        text: combinedText,
        textSource,
        fullName: fullName.trim(),
        displayNameMode,
        age: Number.isInteger(parsedAge) ? parsedAge : null,
        email: email.trim(),
        instagram, tiktok, facebook,
        consentAccepted,
        website,
      })
      clearDraft()
      setDone(true)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Fehler beim Senden. Bitte versuch es nochmal.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Weiter-Logik ────────────────────────────────────────────────────────────

  const photosBusy = (items: PhotoItem[]) => items.some(i => i.status === 'uploading')
  const videoBusy = video.phase === 'compressing' || video.phase === 'uploading'

  const canProceed = (() => {
    switch (step) {
      case 'intro': return true
      case 'name': {
        const name = fullName.trim()
        return name.length >= 3 && name.includes(' ')
      }
      case 'category': return !!session && !!category && !starting
      case 'text': return combinedText.length > 0
      case 'before': return !photosBusy(beforePhotos)
      case 'after': return !photosBusy(afterPhotos)
      case 'video': return !videoBusy && !showRecorder
      case 'personal': {
        const name = fullName.trim()
        return name.length >= 3 && name.includes(' ') && EMAIL_RE.test(email.trim())
      }
      case 'consent': return consentAccepted && !submitting
    }
  })()

  const nextLabel = (() => {
    if (step === 'intro') return 'Los geht\'s'
    if (step === 'before' && beforePhotos.length === 0) return 'Überspringen'
    if (step === 'after' && afterPhotos.length === 0) return 'Überspringen'
    if (step === 'video' && video.phase !== 'done') return videoBusy ? 'Video lädt…' : 'Überspringen'
    return 'Weiter'
  })()

  const firstName = fullName.trim().split(/\s+/)[0] || ''

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: 'inherit' }}>
      <canvas ref={confettiRef} style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50,
        width: '100vw', height: '100vh', display: done ? 'block' : 'none',
      }} />

      {/* Top-Leiste */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 20,
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        padding: '14px 20px', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)',
      }}>
        <span style={{
          fontSize: 12, fontWeight: 700, color: '#065F46', background: '#ECFDF5',
          padding: '4px 12px', borderRadius: 999,
        }}>
          Dauert nur ein paar Minuten
        </span>
      </div>

      {/* Inhalt */}
      <div style={{
        maxWidth: 600, margin: '0 auto',
        padding: done ? '120px 24px 60px' : '92px 24px 190px',
      }}>
        {done ? (
          <div style={{ textAlign: 'center', animation: 'fs-step-in 0.45s cubic-bezier(0.16,1,0.3,1)' }}>
            <div style={{
              width: 72, height: 72, borderRadius: 999, background: '#10B981',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
            }}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12l5 5 11-11" />
              </svg>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1a1a1a', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
              Danke{firstName ? `, ${firstName}` : ' dir'}!
            </h1>
            <p style={{ fontSize: 16.5, lineHeight: 1.6, color: '#6B7280', margin: '0 0 10px' }}>
              Dein Bericht ist angekommen. Wir schauen ihn uns an und melden uns
              in den nächsten Tagen per E-Mail wegen deiner kostenlosen Fallstudien-Seite.
            </p>
            <p style={{ fontSize: 15.5, lineHeight: 1.6, color: '#6B7280', margin: '0 0 28px' }}>
              {REWARD_MESSAGE.shareText}
            </p>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(WHATSAPP_SHARE_TEXT)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="fs-press"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 9,
                padding: '15px 30px', borderRadius: 999, textDecoration: 'none',
                background: '#25D366', color: '#fff', fontSize: 16, fontWeight: 700,
                boxShadow: '0 6px 20px rgba(37,211,102,0.35)',
              }}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.074-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Link an Teampartner schicken
            </a>
          </div>
        ) : (
          <div key={step} style={{ animation: 'fs-step-in 0.4s cubic-bezier(0.16,1,0.3,1)' }}>

            {step === 'intro' && (
              <StepShell title={REWARD_MESSAGE.title}>
                <p style={{ fontSize: 16, lineHeight: 1.65, color: '#4B5563', margin: '0 0 22px' }}>
                  {REWARD_MESSAGE.text}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    ['💬', '3 kurze Fragen, tippen oder einfach einsprechen'],
                    ['📸', 'Fotos und Video nur, wenn du magst'],
                    ['🎁', 'Als Dankeschön: deine Fallstudien-Seite gratis'],
                  ].map(([emoji, label]) => (
                    <div key={label} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '13px 16px', borderRadius: 18, background: '#F9FAFB',
                      fontSize: 14.5, fontWeight: 500, color: '#374151', lineHeight: 1.4,
                    }}>
                      <span style={{ fontSize: 22 }}>{emoji}</span>
                      {label}
                    </div>
                  ))}
                </div>

                {resumeHint && (
                  <p style={{
                    margin: '20px 0 0', padding: '12px 16px', borderRadius: 16,
                    background: '#FFFBEB', color: '#92400E', fontSize: 14, lineHeight: 1.5,
                  }}>
                    {resumeHint}
                  </p>
                )}

                {pendingResume && (
                  <div style={{
                    marginTop: 22, padding: '16px 18px', borderRadius: 20,
                    border: '1.5px solid #A7F3D0', background: '#ECFDF5',
                  }}>
                    <p style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#065F46' }}>
                      Willkommen zurück! Du hast schon angefangen.
                    </p>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        type="button"
                        className="fs-press"
                        onClick={() => resumeDraft(pendingResume)}
                        style={{
                          flex: 1, padding: '12px 0', borderRadius: 999, border: 'none',
                          background: '#059669', color: '#fff', fontSize: 14.5, fontWeight: 700,
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        Weitermachen
                      </button>
                      <button
                        type="button"
                        className="fs-press"
                        onClick={discardResume}
                        style={{
                          flex: 1, padding: '12px 0', borderRadius: 999,
                          border: '1.5px solid #A7F3D0', background: '#fff',
                          color: '#065F46', fontSize: 14.5, fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        Neu anfangen
                      </button>
                    </div>
                  </div>
                )}
              </StepShell>
            )}

            {step === 'name' && (
              <StepShell
                title="Hi! Wie heißt du?"
                sub="Dein Vor- und Nachname. So können wir dich persönlich ansprechen."
              >
                <TextInput
                  value={fullName}
                  onChange={e => setFullName(e.target.value.slice(0, 200))}
                  placeholder="z. B. Sandra Kaiser"
                  autoComplete="name"
                />
                <p style={{ margin: '10px 2px 0', fontSize: 13, lineHeight: 1.5, color: '#9CA3AF' }}>
                  Ob dein voller Name oder nur „{fullName.trim().includes(' ') ? formatDisplayName(fullName, 'abbreviated') : 'Sandra K.'}“ angezeigt wird, entscheidest du am Ende selbst.
                </p>
              </StepShell>
            )}

            {step === 'category' && (
              <StepShell
                title={`Hey ${firstName}! Worum geht es in deinem Bericht?`}
                sub="Wähl die Kategorie, die am besten passt."
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {TESTIMONIAL_CATEGORIES.map(c => (
                    <SelectCard
                      key={c.key}
                      emoji={c.emoji}
                      label={c.title}
                      sub={c.subtitle}
                      active={category === c.key}
                      disabled={starting}
                      onClick={() => chooseCategory(c.key)}
                    />
                  ))}
                </div>
                {starting && (
                  <p style={{ margin: '14px 2px 0', fontSize: 13.5, color: '#9CA3AF' }}>Einen Moment…</p>
                )}
                {startError && (
                  <p style={{ margin: '14px 2px 0', fontSize: 14, color: '#DC2626' }}>{startError}</p>
                )}
              </StepShell>
            )}

            {step === 'text' && (
              <StepShell
                title="Erzähl uns deine Erfahrung"
                sub="3 kurze Fragen. Tipp einfach los oder sprich deine Antwort ein, wir schreiben sie für dich auf."
              >
                <HealthClaimCard />
                {questions.map((q, i) => {
                  const colors = QUESTION_COLORS[i] ?? QUESTION_COLORS[0]
                  const check = checks[i] ?? { status: 'idle' as const }
                  return (
                    <div key={q.key} style={{
                      marginBottom: i < questions.length - 1 ? 16 : 0,
                      padding: '16px 14px 14px', borderRadius: 22,
                      background: colors.bg, border: `1.5px solid ${colors.border}`,
                    }}>
                      <p style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        margin: '0 0 10px', fontSize: 15.5, fontWeight: 700, color: '#1a1a1a', lineHeight: 1.4,
                      }}>
                        <span style={{
                          width: 24, height: 24, borderRadius: 999, flexShrink: 0, marginTop: 0,
                          background: colors.badge, color: '#fff', fontSize: 13, fontWeight: 700,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {i + 1}
                        </span>
                        {q.label}
                      </p>
                      <VoiceTextInput
                        value={answers[i] ?? ''}
                        onChange={(v, source) => {
                          setAnswers(a => a.map((x, j) => (j === i ? v : x)))
                          if (source === 'typed') setHasTyped(true)
                          else setHasDictated(true)
                          if (v.trim() !== checkedTextRef.current[i]) {
                            setChecks(c => (c[i].status === 'idle' ? c : c.map((x, j) => (j === i ? { status: 'idle' as const } : x))))
                          }
                        }}
                        onAudio={handleDictationAudio}
                        placeholder={q.placeholder}
                        rows={3}
                        maxLength={1800}
                      />
                      {check.status === 'checking' && (
                        <p style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          margin: '10px 2px 0', fontSize: 13, fontWeight: 600, color: '#6B7280',
                        }}>
                          <Spinner size={13} color="#9CA3AF" /> KI prüft kurz auf Heil- und Wirkaussagen…
                        </p>
                      )}
                      {check.status === 'ok' && (
                        <p style={{ margin: '10px 2px 0', fontSize: 13, fontWeight: 700, color: '#059669' }}>
                          ✓ Alles gut, keine Heil- oder Wirkaussagen gefunden.
                        </p>
                      )}
                      {check.status === 'issues' && (
                        <div style={{
                          marginTop: 12, padding: '14px 14px 12px', borderRadius: 16,
                          background: '#fff', border: '1.5px solid #FDE68A',
                        }}>
                          <p style={{ margin: '0 0 8px', fontSize: 13.5, fontWeight: 800, color: '#92400E' }}>
                            ⚠️ Kurzer Hinweis von unserer KI
                          </p>
                          {check.issues.slice(0, 3).map(issue => (
                            <p key={issue.quote} style={{ margin: '0 0 8px', fontSize: 13, lineHeight: 1.5, color: '#78350F' }}>
                              „{issue.quote}“ – {issue.reason}
                            </p>
                          ))}
                          {check.suggestion && (
                            <>
                              <p style={{
                                margin: '10px 0 0', padding: '10px 12px', borderRadius: 12,
                                background: '#F3FCF7', border: '1px solid #BBE9D0',
                                fontSize: 13.5, lineHeight: 1.55, color: '#065F46',
                              }}>
                                {check.suggestion}
                              </p>
                              <button
                                type="button"
                                className="fs-press"
                                onClick={() => acceptSuggestion(i)}
                                style={{
                                  marginTop: 10, width: '100%', padding: '11px 0', borderRadius: 999,
                                  border: 'none', background: '#059669', color: '#fff',
                                  fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                                }}
                              >
                                Vorschlag übernehmen
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
                {hasDictated && combinedText && (
                  <p style={{ margin: '14px 2px 0', fontSize: 13.5, color: '#059669', fontWeight: 600 }}>
                    Wir haben das mal aufgeschrieben. Passt das so? Du kannst alles direkt im Text ändern.
                  </p>
                )}
              </StepShell>
            )}

            {step === 'before' && (
              <StepShell
                title="Hast du Vorher-Fotos?"
                sub="Bilder von vor deinem Start. Bis zu 5 Stück, komplett optional."
              >
                <PhotoGrid
                  items={beforePhotos}
                  max={5}
                  onAdd={files => addPhotos(files, 'before_image')}
                  onRemove={item => removePhoto(item, 'before_image')}
                />
              </StepShell>
            )}

            {step === 'after' && (
              <StepShell
                title="Und wie sieht es heute aus?"
                sub="Deine Nachher-Fotos. Bis zu 5 Stück, auch optional."
              >
                <PhotoGrid
                  items={afterPhotos}
                  max={5}
                  onAdd={files => addPhotos(files, 'after_image')}
                  onRemove={item => removePhoto(item, 'after_image')}
                />
              </StepShell>
            )}

            {step === 'video' && (
              <StepShell
                title={`Magst du ein kurzes Video machen, ${firstName}?`}
                sub="Optional, wirkt aber am stärksten. Bitte im Hochkant-Format. 30 bis 60 Sekunden sind ideal, maximal 2 Minuten."
              >
                {video.phase === 'none' && combinedText && (
                  <div style={{
                    padding: '16px 16px 6px', borderRadius: 20, background: '#EFF6FF',
                    border: '1.5px solid #BFDBFE', marginBottom: 16,
                  }}>
                    <p style={{ margin: '0 0 4px', fontSize: 14.5, fontWeight: 800, color: '#1E40AF' }}>
                      📝 Dein Spickzettel
                    </p>
                    <p style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.5, color: '#1E3A8A' }}>
                      Sag am besten einfach das, was du geschrieben hast. Das ist schon geprüft.
                    </p>
                    <div style={{ marginBottom: 12 }}>
                      <p style={{ margin: '0 0 3px', fontSize: 12.5, fontWeight: 700, color: '#1E40AF' }}>Stell dich kurz vor</p>
                      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: '#374151' }}>
                        {`Zum Beispiel: „Hi, ich bin ${firstName}!“`}
                      </p>
                    </div>
                    {questions.map((q, i) => {
                      const a = (answers[i] ?? '').trim()
                      if (!a) return null
                      return (
                        <div key={q.key} style={{ marginBottom: 12 }}>
                          <p style={{ margin: '0 0 3px', fontSize: 12.5, fontWeight: 700, color: '#1E40AF' }}>{q.label}</p>
                          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: '#374151', whiteSpace: 'pre-wrap' }}>{a}</p>
                        </div>
                      )
                    })}
                  </div>
                )}

                {video.phase === 'none' && !showRecorder && (
                  showVideoRules ? <HealthClaimCard /> : (
                    <button
                      type="button"
                      onClick={() => setShowVideoRules(true)}
                      style={{
                        marginBottom: 16, padding: '8px 2px', border: 'none', background: 'none',
                        color: '#92400E', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                        textDecoration: 'underline', textUnderlineOffset: 3, fontFamily: 'inherit',
                      }}
                    >
                      ⚠️ Regeln zu Heil- und Wirkaussagen nochmal ansehen
                    </button>
                  )
                )}

                {showRecorder ? (
                  <VideoRecorder
                    onFinish={blob => handleVideoBlob(blob)}
                    onClose={() => setShowRecorder(false)}
                  />
                ) : video.phase === 'none' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <button
                      type="button"
                      className="fs-press"
                      onClick={() => setShowRecorder(true)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                        width: '100%', padding: '17px 0', borderRadius: 20, border: 'none',
                        background: '#1a1a1a', color: '#fff', fontSize: 16, fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                      </svg>
                      Jetzt aufnehmen
                    </button>
                    <button
                      type="button"
                      className="fs-press"
                      onClick={() => videoInputRef.current?.click()}
                      style={{
                        width: '100%', padding: '16px 0', borderRadius: 20,
                        border: '1.5px solid #E5E7EB', background: '#fff',
                        color: '#374151', fontSize: 15.5, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      Video vom Handy hochladen
                    </button>
                    <input
                      ref={videoInputRef}
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime"
                      style={{ display: 'none' }}
                      onChange={e => {
                        const file = e.target.files?.[0]
                        e.target.value = ''
                        if (file) handleVideoBlob(file)
                      }}
                    />
                  </div>
                ) : video.phase === 'compressing' || video.phase === 'uploading' ? (
                  <div style={{
                    padding: '22px 20px', borderRadius: 22, border: '1.5px solid #E5E7EB', background: '#fff',
                  }}>
                    <p style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>
                      {video.phase === 'compressing' ? 'Video wird verkleinert…' : 'Video wird hochgeladen…'}
                    </p>
                    <div style={{ height: 8, borderRadius: 999, background: '#F1F5F9', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 999, background: '#1a1a1a',
                        width: `${Math.round(video.progress * 100)}%`, transition: 'width 0.25s ease',
                      }} />
                    </div>
                    <p style={{ margin: '10px 0 0', fontSize: 13.5, color: '#9CA3AF' }}>
                      {Math.round(video.progress * 100)} % · Lass die Seite dabei einfach offen.
                    </p>
                    {video.phase === 'compressing' && (
                      <button
                        type="button"
                        onClick={video.cancel}
                        style={{
                          marginTop: 14, padding: '8px 4px', border: 'none', background: 'none',
                          color: '#6B7280', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                          textDecoration: 'underline', textUnderlineOffset: 3, fontFamily: 'inherit',
                        }}
                      >
                        Abbrechen
                      </button>
                    )}
                  </div>
                ) : video.phase === 'done' ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                    padding: '17px 18px', borderRadius: 22, border: '1.5px solid #A7F3D0', background: '#ECFDF5',
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 700, color: '#065F46' }}>
                      <span style={{
                        width: 26, height: 26, borderRadius: 999, background: '#10B981', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 12l5 5 11-11" />
                        </svg>
                      </span>
                      Dein Video ist gespeichert
                    </span>
                    <button
                      type="button"
                      onClick={removeVideo}
                      style={{
                        padding: '8px 4px', border: 'none', background: 'none',
                        color: '#065F46', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                        textDecoration: 'underline', textUnderlineOffset: 3, fontFamily: 'inherit',
                        flexShrink: 0,
                      }}
                    >
                      Entfernen
                    </button>
                  </div>
                ) : (
                  <div style={{
                    padding: '17px 18px', borderRadius: 22, border: '1.5px solid #FECACA', background: '#FEF2F2',
                  }}>
                    <p style={{ margin: '0 0 12px', fontSize: 14.5, lineHeight: 1.5, color: '#991B1B' }}>
                      {video.phase === 'error' ? video.message : ''}
                    </p>
                    <button
                      type="button"
                      className="fs-press"
                      onClick={() => setVideo({ phase: 'none' })}
                      style={{
                        padding: '10px 20px', borderRadius: 999, border: 'none',
                        background: '#991B1B', color: '#fff', fontSize: 14, fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      Nochmal versuchen
                    </button>
                  </div>
                )}
              </StepShell>
            )}

            {step === 'personal' && (
              <StepShell
                title={`Fast geschafft, ${firstName}!`}
                sub="Nur noch zwei Dinge, dann bist du durch."
              >
                <FieldLabel>Wie soll dein Name angezeigt werden?</FieldLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <SelectCard
                    label="Voller Name"
                    sub={fullName.trim().includes(' ') ? `So erscheint's: ${formatDisplayName(fullName, 'full')}` : 'z. B. Sandra Kaiser'}
                    active={displayNameMode === 'full'}
                    onClick={() => setDisplayNameMode('full')}
                  />
                  <SelectCard
                    label="Vorname + Initial"
                    sub={fullName.trim().includes(' ') ? `So erscheint's: ${formatDisplayName(fullName, 'abbreviated')}` : 'z. B. Sandra K.'}
                    active={displayNameMode === 'abbreviated'}
                    onClick={() => setDisplayNameMode('abbreviated')}
                  />
                </div>

                <FieldLabel>Deine E-Mail-Adresse</FieldLabel>
                <TextInput
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value.slice(0, 320))}
                  placeholder="du@beispiel.de"
                  autoComplete="email"
                  inputMode="email"
                />
                <p style={{ margin: '8px 2px 0', fontSize: 13, lineHeight: 1.5, color: '#9CA3AF' }}>
                  Brauchen wir, um dich wegen deiner kostenlosen Fallstudien-Seite zu erreichen.
                  Kein Spam, wird nicht veröffentlicht.
                </p>

                {showOptional ? (
                  <>
                    <FieldLabel>Dein Alter (optional)</FieldLabel>
                    <TextInput
                      type="number"
                      value={age}
                      onChange={e => setAge(e.target.value.slice(0, 3))}
                      placeholder="z. B. 42"
                      inputMode="numeric"
                      min={16}
                      max={120}
                      style={{ maxWidth: 140 }}
                    />

                    <FieldLabel>Deine Social-Media-Profile (optional)</FieldLabel>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <TextInput value={instagram} onChange={e => setInstagram(e.target.value.slice(0, 300))} placeholder="Instagram, z. B. @sandra.kaiser" />
                      <TextInput value={tiktok} onChange={e => setTiktok(e.target.value.slice(0, 300))} placeholder="TikTok" />
                      <TextInput value={facebook} onChange={e => setFacebook(e.target.value.slice(0, 300))} placeholder="Facebook" />
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowOptional(true)}
                    style={{
                      marginTop: 22, padding: '8px 2px', border: 'none', background: 'none',
                      color: '#6B7280', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                      textDecoration: 'underline', textUnderlineOffset: 3, fontFamily: 'inherit',
                    }}
                  >
                    + Alter oder Social Media ergänzen (optional)
                  </button>
                )}
              </StepShell>
            )}

            {step === 'consent' && (
              <StepShell
                title={`Ein letzter Klick, ${firstName}`}
                sub="Damit wir deinen Bericht auch wirklich zeigen dürfen."
              >
                <div style={{
                  padding: '16px 16px 14px', borderRadius: 20, background: '#ECFDF5',
                  border: '1.5px solid #A7F3D0', marginBottom: 20,
                }}>
                  <p style={{ margin: '0 0 6px', fontSize: 14.5, fontWeight: 800, color: '#065F46' }}>
                    🎁 {CONSENT_BONUS.title}
                  </p>
                  <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: '#047857' }}>
                    {CONSENT_BONUS.text}
                  </p>
                </div>

                {/* Honeypot: für Menschen unsichtbar, Bots füllen es aus */}
                <input
                  type="text"
                  name="website"
                  value={website}
                  onChange={e => setWebsite(e.target.value)}
                  autoComplete="off"
                  tabIndex={-1}
                  aria-hidden="true"
                  style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }}
                />

                <button
                  type="button"
                  onClick={() => setConsentAccepted(v => !v)}
                  className="fs-press"
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 14, width: '100%',
                    padding: '17px 18px', borderRadius: 20, textAlign: 'left',
                    border: consentAccepted ? '2px solid #1a1a1a' : '1.5px solid #E5E7EB',
                    background: consentAccepted ? '#FAFAFA' : '#fff',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <span style={{
                    width: 24, height: 24, borderRadius: 8, flexShrink: 0, marginTop: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: consentAccepted ? 'none' : '1.5px solid #D1D5DB',
                    background: consentAccepted ? '#1a1a1a' : '#fff',
                    transition: 'all 0.15s',
                  }}>
                    {consentAccepted && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 12l5 5 11-11" />
                      </svg>
                    )}
                  </span>
                  <span style={{ fontSize: 14.5, lineHeight: 1.55, color: '#374151' }}>
                    Ich bin einverstanden, dass FinestSites meinen Bericht mit meinem Namen
                    (wie von mir gewählt) veröffentlicht und andere FinestSites-Nutzer ihn auf
                    ihren Seiten einbinden dürfen. Ich kann das jederzeit per E-Mail widerrufen.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowConsentText(v => !v)}
                  style={{
                    marginTop: 14, padding: '8px 2px', border: 'none', background: 'none',
                    color: '#6B7280', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    textDecoration: 'underline', textUnderlineOffset: 3, fontFamily: 'inherit',
                  }}
                >
                  {showConsentText ? 'Einwilligung zuklappen' : 'Vollständige Einwilligung lesen'}
                </button>

                {showConsentText && (
                  <p style={{
                    margin: '12px 0 0', padding: '16px 18px', borderRadius: 18,
                    background: '#F9FAFB', border: '1px solid #E5E7EB',
                    fontSize: 13.5, lineHeight: 1.65, color: '#4B5563', whiteSpace: 'pre-wrap',
                  }}>
                    {getCurrentTestimonialConsentText()}
                  </p>
                )}

                {submitError && (
                  <p style={{ margin: '16px 2px 0', fontSize: 14, color: '#DC2626' }}>{submitError}</p>
                )}
              </StepShell>
            )}
          </div>
        )}
      </div>

      {/* Bottom-Bar */}
      {!done && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 20,
          background: '#fff', borderTop: '1px solid #F1F5F9',
        }}>
          <div style={{ height: 4, background: '#F1F5F9' }}>
            <div style={{
              height: '100%', width: `${((stepIndex + 1) / steps.length) * 100}%`,
              background: '#1a1a1a', transition: 'width 0.35s ease',
            }} />
          </div>
          <div style={{
            maxWidth: 600, margin: '0 auto', padding: '14px 24px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            paddingBottom: 'max(14px, env(safe-area-inset-bottom))',
          }}>
            {stepIndex > 0 ? (
              <button
                onClick={() => setStepIndex(i => i - 1)}
                style={{
                  padding: '10px 4px', border: 'none', background: 'none',
                  color: '#1a1a1a', fontSize: 15.5, fontWeight: 600, cursor: 'pointer',
                  textDecoration: 'underline', textUnderlineOffset: 4, fontFamily: 'inherit',
                }}
              >
                Zurück
              </button>
            ) : <span />}
            {isLast ? (
              <button
                onClick={submit}
                disabled={!canProceed}
                className="fs-press"
                style={{
                  ...primaryBtn, padding: '17px 48px', fontSize: 17.5,
                  background: '#059669', boxShadow: '0 6px 20px rgba(5,150,105,0.35)',
                  opacity: canProceed ? 1 : 0.5,
                }}
              >
                {submitting ? 'Wird gesendet…' : 'Absenden'}
              </button>
            ) : (
              <button
                onClick={() => setStepIndex(i => i + 1)}
                disabled={!canProceed}
                className="fs-press"
                style={{ ...primaryBtn, opacity: canProceed ? 1 : 0.5 }}
              >
                {nextLabel}
              </button>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fs-pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.35 } }
        @keyframes fs-step-in {
          from { opacity: 0; transform: translateY(14px) }
          to { opacity: 1; transform: translateY(0) }
        }
        @keyframes fs-spin { to { transform: rotate(360deg) } }
        .fs-press:not(:disabled):active { transform: scale(0.97) }
      `}</style>
    </div>
  )
}
