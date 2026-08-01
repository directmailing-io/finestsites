'use client'

/**
 * Anonyme Feedback-Kampagne (temporär).
 * Komplett isoliert. Zum Entfernen siehe docs/feedback-aktion-entfernen.md
 */

import { useCallback, useEffect, useRef, useState } from 'react'

// ── Fragen-Konfiguration ──────────────────────────────────────────────────────

const TARIF_OPTIONS = [
  { value: 'starter', label: 'Starter', sub: '1 Seite · 21 € im Monat' },
  { value: 'pro', label: 'Pro', sub: '3 Seiten · 27 € im Monat' },
  { value: 'unlimited', label: 'Unlimited', sub: 'Unbegrenzt Seiten · 47 € im Monat' },
]

const TEMPLATE_OPTIONS = [
  'Mama-Business-Seite',
  'Stoffwechselkur-Seite',
  'ProShape-Seite',
  'Sportler-Seite',
  'Beauty & Pflege-Seite',
  'Vitalcheck-Seite',
  'Gesund im Alter-Seite',
  'Muskelaufbau-Seite',
]
const MAX_WUENSCHE = 3

const PREIS_TARIFE = [
  { key: 'preis_starter' as const, name: 'Starter', info: '1 Seite · 21 € im Monat' },
  { key: 'preis_pro' as const, name: 'Pro', info: '3 Seiten · 27 € im Monat' },
  { key: 'preis_unlimited' as const, name: 'Unlimited', info: 'Unbegrenzt Seiten · 47 € im Monat' },
]

const PREIS_SEGMENTE = [
  { value: 'fair', label: 'Fair', color: '#16A34A', bg: '#F0FDF4' },
  { value: 'okay', label: 'Gerade so okay', color: '#CA8A04', bg: '#FEFCE8' },
  { value: 'zu_teuer', label: 'Zu teuer', color: '#DC2626', bg: '#FEF2F2' },
]

const GRUND_OPTIONS = [
  { value: 'zu_teuer', label: 'Das größere Paket ist mir zu teuer' },
  { value: 'brauche_nicht', label: 'Ich brauche nicht mehr Seiten' },
  { value: 'nicht_ueberzeugt', label: 'Die anderen Seiten überzeugen mich noch nicht' },
  { value: 'anderer', label: 'Anderer Grund' },
]

const GRUND_FOLLOWUP: Record<string, { label: string; placeholder: string; voice: boolean }> = {
  zu_teuer: { label: 'Bei welchem Preis würdest du upgraden?', placeholder: 'Sag es ganz offen…', voice: false },
  brauche_nicht: { label: 'Was müsste dabei sein, damit sich mehr Seiten für dich lohnen?', placeholder: 'Sag es ganz ehrlich…', voice: true },
  nicht_ueberzeugt: { label: 'Was fehlt dir noch?', placeholder: 'Sag es ganz direkt…', voice: true },
  anderer: { label: 'Magst du kurz sagen, warum?', placeholder: 'Einfach kurz erklären…', voice: true },
}

const PARTNER_OPTIONS = [
  { value: 'provision', label: '10 % Provision für dich, jeden Monat', sub: 'Und wer über dich kommt, zahlt dauerhaft 10 % weniger.' },
  { value: 'rabatt', label: '20 % Rabatt für deine Empfehlung', sub: 'Du bekommst nichts, dafür zahlt die Person dauerhaft 20 % weniger.' },
  { value: 'anderes', label: 'Ich hätte eine andere Idee', sub: 'Erzähl uns, wie es für dich perfekt wäre.' },
]

const GRADE_COLORS = ['#22C55E', '#84CC16', '#EAB308', '#F97316', '#EF4444', '#B91C1C']
const GRADE_EMOJIS = ['🤩', '😊', '🙂', '😕', '😖', '😫']

type Answers = {
  note_optimalset: number | null
  text_optimalset: string
  note_business: number | null
  text_business: string
  template_wuensche: string[]
  tarif: string | null
  upgrade_grund: string | null
  text_upgrade: string
  preis_starter: string | null
  preis_pro: string | null
  preis_unlimited: string | null
  text_preis_jetzt: string
  empfehlung: string | null
  text_empfehlung: string
  partner_modell: string | null
  text_partner: string
  text_chef: string
}

const EMPTY: Answers = {
  note_optimalset: null, text_optimalset: '',
  note_business: null, text_business: '',
  template_wuensche: [],
  tarif: null,
  upgrade_grund: null, text_upgrade: '',
  preis_starter: null, preis_pro: null, preis_unlimited: null,
  text_preis_jetzt: '',
  empfehlung: null, text_empfehlung: '',
  partner_modell: null, text_partner: '',
  text_chef: '',
}

// ── Voice + Text Eingabe (robust auf allen Geräten) ───────────────────────────

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/ogg;codecs=opus',
]

function pickMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  if (typeof MediaRecorder.isTypeSupported !== 'function') return ''
  return MIME_CANDIDATES.find(c => MediaRecorder.isTypeSupported(c)) ?? ''
}

function voiceSupported(): boolean {
  return typeof navigator !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia
    && typeof MediaRecorder !== 'undefined'
}

function VoiceTextInput({ value, onChange, placeholder, rows = 3, voice = true }: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  rows?: number
  voice?: boolean
}) {
  const [supported, setSupported] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { if (voice) setSupported(voiceSupported()) }, [voice])

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
      const mime = pickMime()
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
          if (text) onChange(value ? value.trimEnd() + ' ' + text : text)
          else setError('Wir konnten nichts verstehen. Versuch es nochmal oder tipp deine Antwort ein.')
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
  }, [onChange, value, stopRecording])

  useEffect(() => () => { stopTimer(); recorderRef.current?.stream?.getTracks().forEach(t => t.stop()) }, [])

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <textarea
          value={value}
          onChange={e => onChange(e.target.value.slice(0, 3000))}
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

// ── Schulnoten (farbig, mit Emojis) ───────────────────────────────────────────

function GradePicker({ value, onChange }: { value: number | null; onChange: (n: number) => void }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {[1, 2, 3, 4, 5, 6].map(n => {
          const active = value === n
          const color = GRADE_COLORS[n - 1]
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              style={{
                flex: 1, maxWidth: 68, padding: '12px 0 10px', borderRadius: 18,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                border: active ? `2px solid ${color}` : '1.5px solid #E5E7EB',
                background: active ? color : '#fff',
                color: active ? '#fff' : color,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.15s',
                transform: active ? 'scale(1.08)' : 'scale(1)',
                boxShadow: active ? `0 4px 14px ${color}55` : 'none',
              }}
            >
              <span style={{ fontSize: 22, lineHeight: 1, filter: active ? 'none' : 'grayscale(0.15)' }}>
                {GRADE_EMOJIS[n - 1]}
              </span>
              <span style={{ fontSize: 15, fontWeight: 800 }}>{n}</span>
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, padding: '0 4px' }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#22C55E' }}>sehr gut</span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#B91C1C' }}>ungenügend</span>
      </div>
    </div>
  )
}

// ── Auswahl-Karten ────────────────────────────────────────────────────────────

function SelectCard({ label, sub, active, onClick, disabled, color, bg }: {
  label: string
  sub?: string
  active: boolean
  onClick: () => void
  disabled?: boolean
  color?: string
  bg?: string
}) {
  const activeColor = color ?? '#1a1a1a'
  const activeBg = bg ?? '#FAFAFA'
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
        border: active ? `2px solid ${activeColor}` : '1.5px solid #E5E7EB',
        background: active ? activeBg : '#fff',
        color: active ? (color ?? '#1a1a1a') : '#374151',
        fontSize: 15.5, fontWeight: active ? 700 : 500,
        opacity: disabled ? 0.4 : 1,
        transition: 'all 0.15s',
      }}
    >
      <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span>{label}</span>
        {sub && <span style={{ fontSize: 13.5, fontWeight: 500, color: active ? '#4B5563' : '#9CA3AF' }}>{sub}</span>}
      </span>
      <span style={{
        width: 22, height: 22, borderRadius: 999, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: active ? 'none' : '1.5px solid #D1D5DB',
        background: active ? activeColor : 'transparent',
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

// ── Preisbewertung pro Tarif ──────────────────────────────────────────────────

function PriceRow({ name, info, value, onChange }: {
  name: string
  info: string
  value: string | null
  onChange: (v: string) => void
}) {
  return (
    <div style={{
      border: '1.5px solid #E5E7EB', borderRadius: 22, padding: '16px 16px 14px',
      background: '#fff',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#1a1a1a' }}>{name}</span>
        <span style={{ fontSize: 13.5, fontWeight: 500, color: '#9CA3AF' }}>{info}</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {PREIS_SEGMENTE.map(s => {
          const active = value === s.value
          return (
            <button
              key={s.value}
              type="button"
              className="fs-press"
              onClick={() => onChange(s.value)}
              style={{
                flex: 1, padding: '11px 4px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
                border: active ? `2px solid ${s.color}` : '1.5px solid #E5E7EB',
                background: active ? s.bg : '#fff',
                color: active ? s.color : '#6B7280',
                fontSize: 13.5, fontWeight: active ? 700 : 500,
                transition: 'all 0.15s', whiteSpace: 'nowrap',
              }}
            >
              {s.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Ja/Nein ───────────────────────────────────────────────────────────────────

function YesNo({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  const options = [
    { value: 'ja', label: 'Ja', color: '#16A34A', bg: '#F0FDF4', up: true },
    { value: 'nein', label: 'Nein', color: '#DC2626', bg: '#FEF2F2', up: false },
  ]
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      {options.map(o => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              flex: 1, padding: '24px 12px', borderRadius: 24, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              border: active ? `2px solid ${o.color}` : '1.5px solid #E5E7EB',
              background: active ? o.bg : '#fff',
              color: active ? o.color : '#6B7280',
              fontSize: 17, fontWeight: 700, transition: 'all 0.15s',
              transform: active ? 'scale(1.03)' : 'scale(1)',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: o.up ? 'none' : 'rotate(180deg)' }}>
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
            </svg>
            {o.label}
          </button>
        )
      })}
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

// ── Seite ─────────────────────────────────────────────────────────────────────

type StepId = 'optimalset' | 'business' | 'wunsch' | 'tarif' | 'upgrade' | 'preis' | 'empfehlung' | 'partner' | 'chef'

export default function FeedbackPage() {
  const [answers, setAnswers] = useState<Answers>(EMPTY)
  const [stepIndex, setStepIndex] = useState(0)
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [customIdea, setCustomIdea] = useState('')
  const confettiRef = useRef<HTMLCanvasElement>(null)

  const showUpgrade = answers.tarif !== null && answers.tarif !== 'unlimited'
  const showPartner = answers.empfehlung === 'ja'
  const steps: StepId[] = [
    'optimalset', 'business', 'wunsch', 'tarif',
    ...(showUpgrade ? ['upgrade' as const] : []),
    'preis', 'empfehlung',
    ...(showPartner ? ['partner' as const] : []),
    'chef',
  ]
  const step = steps[Math.min(stepIndex, steps.length - 1)]
  const isLast = stepIndex >= steps.length - 1

  const set = <K extends keyof Answers>(key: K, val: Answers[K]) =>
    setAnswers(a => ({ ...a, [key]: val }))

  useEffect(() => {
    window.scrollTo({ top: 0 })
    if (done && confettiRef.current) launchConfetti(confettiRef.current)
  }, [stepIndex, done])

  async function submit() {
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answers),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Fehler beim Senden')
      }
      setDone(true)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Fehler beim Senden. Bitte versuch es nochmal.')
    } finally {
      setSubmitting(false)
    }
  }

  // Note setzen: bei Note 1 gibt es keine Folgefrage, Text dann verwerfen
  const setNote = (noteKey: 'note_optimalset' | 'note_business', textKey: 'text_optimalset' | 'text_business', n: number) =>
    setAnswers(a => ({ ...a, [noteKey]: n, [textKey]: n === 1 ? '' : a[textKey] }))

  const toggleWunsch = (t: string) =>
    set('template_wuensche',
      answers.template_wuensche.includes(t)
        ? answers.template_wuensche.filter(x => x !== t)
        : answers.template_wuensche.length >= MAX_WUENSCHE
          ? answers.template_wuensche
          : [...answers.template_wuensche, t]
    )

  const addCustomIdea = () => {
    const t = customIdea.trim().slice(0, 60)
    if (!t) return
    if (!answers.template_wuensche.includes(t) && answers.template_wuensche.length < MAX_WUENSCHE) {
      set('template_wuensche', [...answers.template_wuensche, t])
    }
    setCustomIdea('')
  }

  const customChips = answers.template_wuensche.filter(t => !TEMPLATE_OPTIONS.includes(t))

  const setPreis = (key: 'preis_starter' | 'preis_pro' | 'preis_unlimited', v: string) =>
    setAnswers(a => {
      const next = { ...a, [key]: a[key] === v ? null : v }
      return jetztPreisSichtbar(next) ? next : { ...next, text_preis_jetzt: '' }
    })

  // "Welchen Preis wärst du bereit, jetzt zu zahlen?" — wenn der eigene Tarif
  // als zu teuer markiert ist (ohne Tarifangabe: irgendein Tarif)
  function jetztPreisSichtbar(a: Answers): boolean {
    const own = a.tarif === 'starter' ? a.preis_starter
      : a.tarif === 'pro' ? a.preis_pro
      : a.tarif === 'unlimited' ? a.preis_unlimited
      : null
    if (a.tarif) return own === 'zu_teuer'
    return [a.preis_starter, a.preis_pro, a.preis_unlimited].includes('zu_teuer')
  }

  const grundFollowup = answers.upgrade_grund ? GRUND_FOLLOWUP[answers.upgrade_grund] : null

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
          100 % anonym
        </span>
      </div>

      {/* Inhalt */}
      <div style={{
        maxWidth: 600, margin: '0 auto',
        padding: done ? '120px 24px 60px' : '92px 24px 170px',
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
              Danke dir!
            </h1>
            <p style={{ fontSize: 16.5, lineHeight: 1.6, color: '#6B7280', margin: 0 }}>
              Alles anonym gespeichert. Du hilfst uns damit richtig.
            </p>
          </div>
        ) : (
          <div key={step} style={{ animation: 'fs-step-in 0.4s cubic-bezier(0.16,1,0.3,1)' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#9CA3AF', margin: '0 0 10px' }}>
              {stepIndex + 1} von {steps.length}
            </p>

            {step === 'optimalset' && (
              <StepShell title="Wie gefällt dir die Optimalset-Seite?" demoUrl="https://demo.dailyoptimal.de/">
                <GradePicker value={answers.note_optimalset} onChange={n => setNote('note_optimalset', 'text_optimalset', n)} />
                {answers.note_optimalset !== null && answers.note_optimalset >= 2 && (
                  <>
                    <FieldLabel>Was fehlt dir dort? Was würdest du dir anders wünschen?</FieldLabel>
                    <VoiceTextInput
                      value={answers.text_optimalset}
                      onChange={v => set('text_optimalset', v)}
                      placeholder="Sag es ganz ehrlich…"
                    />
                  </>
                )}
              </StepShell>
            )}

            {step === 'business' && (
              <StepShell title="Wie gefällt dir die Business-Seite?" demoUrl="https://demo.wellpreneur.io/">
                <GradePicker value={answers.note_business} onChange={n => setNote('note_business', 'text_business', n)} />
                {answers.note_business !== null && answers.note_business >= 2 && (
                  <>
                    <FieldLabel>Was fehlt dir dort? Was würdest du dir anders wünschen?</FieldLabel>
                    <VoiceTextInput
                      value={answers.text_business}
                      onChange={v => set('text_business', v)}
                      placeholder="Sag es ganz ehrlich…"
                    />
                  </>
                )}
              </StepShell>
            )}

            {step === 'wunsch' && (
              <StepShell title="Welche 3 Seiten wünschst du dir am meisten?" sub="Wähle bis zu 3 aus.">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {TEMPLATE_OPTIONS.map(t => {
                    const active = answers.template_wuensche.includes(t)
                    return (
                      <SelectCard key={t} label={t.replace('-Seite', '')} active={active}
                        disabled={!active && answers.template_wuensche.length >= MAX_WUENSCHE}
                        onClick={() => toggleWunsch(t)} />
                    )
                  })}
                </div>
                <FieldLabel>Deine eigene Idee? Zählt mit zu deinen 3.</FieldLabel>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={customIdea}
                    onChange={e => setCustomIdea(e.target.value.slice(0, 60))}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomIdea() } }}
                    placeholder="Deine Idee…"
                    disabled={answers.template_wuensche.length >= MAX_WUENSCHE}
                    style={{
                      flex: 1, padding: '13px 16px', border: '1.5px solid #E5E7EB', borderRadius: 999,
                      fontSize: 16, color: '#1a1a1a', outline: 'none', fontFamily: 'inherit',
                      opacity: answers.template_wuensche.length >= MAX_WUENSCHE ? 0.4 : 1,
                    }}
                    onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
                    onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
                  />
                  <button
                    type="button"
                    className="fs-press"
                    onClick={addCustomIdea}
                    disabled={!customIdea.trim() || answers.template_wuensche.length >= MAX_WUENSCHE}
                    style={{
                      padding: '13px 20px', borderRadius: 999, border: 'none', cursor: 'pointer',
                      background: '#1a1a1a', color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
                      opacity: !customIdea.trim() || answers.template_wuensche.length >= MAX_WUENSCHE ? 0.35 : 1,
                    }}
                  >
                    Hinzufügen
                  </button>
                </div>
                {customChips.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                    {customChips.map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleWunsch(t)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 7,
                          padding: '9px 14px', borderRadius: 999, border: '2px solid #1a1a1a',
                          background: '#FAFAFA', color: '#1a1a1a', fontSize: 14.5, fontWeight: 700,
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        {t}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    ))}
                  </div>
                )}
              </StepShell>
            )}

            {step === 'tarif' && (
              <StepShell title="Welchen Tarif hast du gerade?">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {TARIF_OPTIONS.map(o => (
                    <SelectCard key={o.value} label={o.label} sub={o.sub} active={answers.tarif === o.value}
                      onClick={() => {
                        const next = answers.tarif === o.value ? null : o.value
                        setAnswers(a => ({
                          ...a,
                          tarif: next,
                          ...(next === 'unlimited' || next === null ? { upgrade_grund: null, text_upgrade: '' } : {}),
                        }))
                      }} />
                  ))}
                </div>
              </StepShell>
            )}

            {step === 'upgrade' && (
              <StepShell title="Warum kein größeres Paket?" sub="Ganz ehrlich, es gibt keine falsche Antwort.">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {GRUND_OPTIONS.map(g => (
                    <SelectCard key={g.value} label={g.label} active={answers.upgrade_grund === g.value}
                      onClick={() => set('upgrade_grund', answers.upgrade_grund === g.value ? null : g.value)} />
                  ))}
                </div>
                {grundFollowup && (
                  <>
                    <FieldLabel>{grundFollowup.label}</FieldLabel>
                    <VoiceTextInput
                      value={answers.text_upgrade}
                      onChange={v => set('text_upgrade', v)}
                      placeholder={grundFollowup.placeholder}
                      rows={2}
                      voice={grundFollowup.voice}
                    />
                  </>
                )}
              </StepShell>
            )}

            {step === 'preis' && (
              <StepShell title="Wie findest du unsere Preise?" sub="Sag es pro Tarif, ganz ehrlich.">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {PREIS_TARIFE.map(t => (
                    <PriceRow key={t.key} name={t.name} info={t.info}
                      value={answers[t.key]}
                      onChange={v => setPreis(t.key, v)} />
                  ))}
                </div>
                {jetztPreisSichtbar(answers) && (
                  <>
                    <FieldLabel>Welchen Preis wärst du bereit, JETZT zu zahlen?</FieldLabel>
                    <VoiceTextInput
                      value={answers.text_preis_jetzt}
                      onChange={v => set('text_preis_jetzt', v)}
                      placeholder="Sag es ganz ehrlich…"
                      rows={2}
                      voice={false}
                    />
                  </>
                )}
              </StepShell>
            )}

            {step === 'empfehlung' && (
              <StepShell title="Wirst du FinestSites deinen Partnern empfehlen?">
                <YesNo value={answers.empfehlung} onChange={v => {
                  setAnswers(a => {
                    const next = a.empfehlung === v ? null : v
                    return {
                      ...a,
                      empfehlung: next,
                      text_empfehlung: next === 'nein' ? a.text_empfehlung : '',
                      partner_modell: next === 'ja' ? a.partner_modell : null,
                      text_partner: next === 'ja' ? a.text_partner : '',
                    }
                  })
                }} />
                {answers.empfehlung === 'nein' && (
                  <>
                    <FieldLabel>Was muss anders sein, damit du uns empfiehlst?</FieldLabel>
                    <VoiceTextInput
                      value={answers.text_empfehlung}
                      onChange={v => set('text_empfehlung', v)}
                      placeholder="Ganz ehrlich…"
                    />
                  </>
                )}
              </StepShell>
            )}

            {step === 'partner' && (
              <StepShell
                title="Wie soll unser Partnerprogramm aussehen?"
                sub="Du empfiehlst FinestSites. Welches Modell wäre dir am liebsten?"
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {PARTNER_OPTIONS.map(o => (
                    <SelectCard key={o.value} label={o.label} sub={o.sub} active={answers.partner_modell === o.value}
                      onClick={() => setAnswers(a => {
                        const next = a.partner_modell === o.value ? null : o.value
                        return { ...a, partner_modell: next, text_partner: next === 'anderes' ? a.text_partner : '' }
                      })} />
                  ))}
                </div>
                {answers.partner_modell === 'anderes' && (
                  <>
                    <FieldLabel>Wie sähe dein perfektes Partnerprogramm aus?</FieldLabel>
                    <VoiceTextInput
                      value={answers.text_partner}
                      onChange={v => set('text_partner', v)}
                      placeholder="Erzähl einfach…"
                    />
                  </>
                )}
              </StepShell>
            )}

            {step === 'chef' && (
              <StepShell
                title="Wenn du hier Chef wärst: Was würdest du zuerst ändern?"
                sub="Alles erlaubt: Preise, Seiten, Bedienung."
              >
                <VoiceTextInput
                  value={answers.text_chef}
                  onChange={v => set('text_chef', v)}
                  placeholder="Als Erstes würde ich…"
                  rows={4}
                />
                {submitError && (
                  <p style={{ margin: '14px 2px 0', fontSize: 14, color: '#DC2626' }}>{submitError}</p>
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
              <button onClick={submit} disabled={submitting} className="fs-press"
                style={{ ...primaryBtn, opacity: submitting ? 0.6 : 1 }}>
                {submitting ? 'Wird gesendet…' : 'Absenden'}
              </button>
            ) : (
              <button onClick={() => setStepIndex(i => i + 1)} className="fs-press" style={primaryBtn}>Weiter</button>
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
        .fs-press:not(:disabled):active { transform: scale(0.97) }
      `}</style>
    </div>
  )
}

const primaryBtn: React.CSSProperties = {
  padding: '14px 34px', borderRadius: 999, border: 'none',
  background: '#1a1a1a', color: '#fff', fontSize: 16, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit',
}

function StepShell({ title, sub, demoUrl, children }: {
  title: string
  sub?: string
  demoUrl?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h1 style={{
        fontSize: 25, fontWeight: 800, color: '#1a1a1a', letterSpacing: '-0.02em',
        margin: sub || demoUrl ? '0 0 8px' : '0 0 26px', lineHeight: 1.25,
      }}>
        {title}
      </h1>
      {sub && <p style={{ fontSize: 15.5, lineHeight: 1.5, color: '#9CA3AF', margin: demoUrl ? '0 0 14px' : '0 0 26px' }}>{sub}</p>}
      {demoUrl && (
        <a
          href={demoUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '10px 18px', borderRadius: 999, border: '1.5px solid #E5E7EB',
            fontSize: 14, fontWeight: 600, color: '#1a1a1a', textDecoration: 'none',
            margin: '4px 0 26px', background: '#fff',
          }}
        >
          Beispielseite ansehen
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17L17 7M8 7h9v9" />
          </svg>
        </a>
      )}
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
