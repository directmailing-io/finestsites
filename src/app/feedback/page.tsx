'use client'

/**
 * Anonyme Feedback-Kampagne (temporär).
 * Komplett isoliert. Zum Entfernen siehe docs/feedback-aktion-entfernen.md
 */

import { useCallback, useEffect, useRef, useState } from 'react'

// ── Fragen-Konfiguration ──────────────────────────────────────────────────────

const TARIF_OPTIONS = [
  { value: 'starter', label: 'Starter' },
  { value: 'pro', label: 'Pro' },
  { value: 'unlimited', label: 'Unlimited' },
  { value: 'unbekannt', label: 'Weiß nicht' },
]

const TEMPLATE_OPTIONS = [
  'Mama-Business',
  'Stoffwechselkur',
  'ProShape (Abnehmen)',
  'Sportler',
  'Beauty & Pflege',
  'Team-Aufbau',
]

const PREIS_OPTIONS = [
  { value: 'zu_teuer', label: 'Zu teuer', color: '#DC2626', bg: '#FEF2F2' },
  { value: 'geht_so', label: 'Geht so', color: '#CA8A04', bg: '#FEFCE8' },
  { value: 'fair', label: 'Fair', color: '#16A34A', bg: '#F0FDF4' },
  { value: 'guenstig', label: 'Richtig günstig', color: '#059669', bg: '#ECFDF5' },
]

const GRUND_OPTIONS = [
  { value: 'zu_teuer', label: 'Für mich ist das zu teuer' },
  { value: 'nicht_ueberzeugt', label: 'Die Seiten überzeugen mich noch nicht' },
  { value: 'anderer', label: 'Anderer Grund' },
]

const GRUND_FOLLOWUP: Record<string, { label: string; placeholder: string }> = {
  zu_teuer: { label: 'Welcher Preis wäre für dich okay?', placeholder: 'Z. B. 15 Euro im Monat, weil…' },
  nicht_ueberzeugt: { label: 'Was fehlt dir noch?', placeholder: 'Sag es ganz direkt…' },
  anderer: { label: 'Magst du kurz sagen, warum?', placeholder: 'Einfach kurz erklären…' },
}

const GRADE_COLORS = ['#22C55E', '#84CC16', '#EAB308', '#F97316', '#EF4444', '#B91C1C']

type Answers = {
  note_webseite: number | null
  text_webseite: string
  template_wuensche: string[]
  text_templates: string
  preis_meinung: string | null
  text_preise: string
  tarif: string | null
  upgrade_grund: string | null
  text_upgrade: string
  empfehlung: string | null
  text_empfehlung: string
  text_chef: string
}

const EMPTY: Answers = {
  note_webseite: null, text_webseite: '',
  template_wuensche: [], text_templates: '',
  preis_meinung: null, text_preise: '',
  tarif: null, upgrade_grund: null, text_upgrade: '',
  empfehlung: null, text_empfehlung: '',
  text_chef: '',
}

const TOTAL_STEPS = 6

// ── Voice + Text Eingabe ──────────────────────────────────────────────────────

function VoiceTextInput({ value, onChange, placeholder, rows = 3 }: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  rows?: number
}) {
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null } }

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop()
    setRecording(false)
    stopTimer()
  }, [])

  const startRecording = useCallback(async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      const rec = new MediaRecorder(stream, { mimeType: mime })
      chunksRef.current = []
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: mime })
        if (blob.size < 1000) return
        setTranscribing(true)
        try {
          const fd = new FormData()
          fd.append('audio', blob, mime === 'audio/webm' ? 'aufnahme.webm' : 'aufnahme.mp4')
          const res = await fetch('/api/feedback/transcribe', { method: 'POST', body: fd })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error ?? 'Fehler')
          const text = (data.text ?? '').trim()
          if (text) onChange(value ? value.trimEnd() + ' ' + text : text)
        } catch {
          setError('Hat nicht geklappt. Tipp deine Antwort einfach ein.')
        } finally {
          setTranscribing(false)
        }
      }
      rec.start()
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
      setError('Mikro klappt nicht. Tipp deine Antwort einfach ein.')
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
            width: '100%', padding: '14px 16px', paddingBottom: 52,
            border: '1.5px solid #E5E7EB', borderRadius: 16, fontSize: 16,
            lineHeight: 1.55, color: '#1a1a1a', background: '#fff',
            resize: 'vertical', outline: 'none', fontFamily: 'inherit',
          }}
          onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
          onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
        />
        <button
          type="button"
          onClick={recording ? stopRecording : startRecording}
          disabled={transcribing}
          style={{
            position: 'absolute', left: 10, bottom: 14,
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
            fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit',
            background: recording ? '#DC2626' : '#F3F4F6',
            color: recording ? '#fff' : '#374151',
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
              Stopp · {String(Math.floor(seconds / 60))}:{String(seconds % 60).padStart(2, '0')}
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
      </div>
      {error && <p style={{ margin: '8px 2px 0', fontSize: 13, color: '#B45309' }}>{error}</p>}
      <style jsx global>{`
        @keyframes fs-pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.35 } }
      `}</style>
    </div>
  )
}

// ── Schulnoten-Auswahl (farbig) ───────────────────────────────────────────────

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
                flex: 1, maxWidth: 64, aspectRatio: '1', borderRadius: 16,
                border: active ? `2px solid ${color}` : '1.5px solid #E5E7EB',
                background: active ? color : '#fff',
                color: active ? '#fff' : color,
                fontSize: 22, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.15s',
                transform: active ? 'scale(1.08)' : 'scale(1)',
                boxShadow: active ? `0 4px 14px ${color}55` : 'none',
              }}
            >
              {n}
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

// ── Chips ─────────────────────────────────────────────────────────────────────

function Chip({ label, active, onClick, color, bg }: {
  label: string
  active: boolean
  onClick: () => void
  color?: string
  bg?: string
}) {
  const activeColor = color ?? '#1a1a1a'
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '11px 18px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
        border: active ? `2px solid ${activeColor}` : '1.5px solid #E5E7EB',
        background: active ? (bg ?? '#1a1a1a') : '#fff',
        color: active ? (bg ? activeColor : '#fff') : '#374151',
        fontSize: 15, fontWeight: active ? 700 : 600, transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )
}

// ── Ja/Nein Buttons ───────────────────────────────────────────────────────────

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
              flex: 1, padding: '20px 12px', borderRadius: 18, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              border: active ? `2px solid ${o.color}` : '1.5px solid #E5E7EB',
              background: active ? o.bg : '#fff',
              color: active ? o.color : '#6B7280',
              fontSize: 16, fontWeight: 700, transition: 'all 0.15s',
              transform: active ? 'scale(1.03)' : 'scale(1)',
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
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

export default function FeedbackPage() {
  const [step, setStep] = useState(1) // 1..6 = Fragen, 7 = Danke
  const [answers, setAnswers] = useState<Answers>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const confettiRef = useRef<HTMLCanvasElement>(null)

  const set = <K extends keyof Answers>(key: K, val: Answers[K]) =>
    setAnswers(a => ({ ...a, [key]: val }))

  useEffect(() => {
    window.scrollTo({ top: 0 })
    if (step === 7 && confettiRef.current) launchConfetti(confettiRef.current)
  }, [step])

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
      setStep(7)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Fehler beim Senden. Bitte versuch es nochmal.')
    } finally {
      setSubmitting(false)
    }
  }

  const showUpgradeQuestion = answers.tarif !== null && answers.tarif !== 'unlimited'
  const grundFollowup = answers.upgrade_grund ? GRUND_FOLLOWUP[answers.upgrade_grund] : null

  return (
    <div style={{
      minHeight: '100vh', background: '#FAFAFA', display: 'flex', flexDirection: 'column',
      alignItems: 'center', padding: '0 20px',
      fontFamily: 'inherit',
    }}>
      <canvas ref={confettiRef} style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50,
        width: '100vw', height: '100vh', display: step === 7 ? 'block' : 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 560, padding: '40px 0 60px' }}>

        {/* Fortschritt */}
        {step <= TOTAL_STEPS && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#6B7280' }}>{step} von {TOTAL_STEPS}</span>
              <span style={{
                fontSize: 12, fontWeight: 700, color: '#065F46', background: '#ECFDF5',
                padding: '3px 10px', borderRadius: 999,
              }}>
                100 % anonym
              </span>
            </div>
            <div style={{ height: 6, background: '#E5E7EB', borderRadius: 999 }}>
              <div style={{
                height: '100%', width: `${(step / TOTAL_STEPS) * 100}%`,
                background: '#1a1a1a', borderRadius: 999, transition: 'width 0.35s ease',
              }} />
            </div>
          </div>
        )}

        <div style={{
          background: '#fff', borderRadius: 24, padding: '32px 28px',
          border: '1px solid #F1F5F9',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
        }}>

          {/* ── 1: Deine Webseite ── */}
          {step === 1 && (
            <StepShell
              title="Wie gefällt dir deine Webseite?"
              sub="Also die Seite, die du mit FinestSites gebaut hast."
            >
              <GradePicker value={answers.note_webseite} onChange={n => set('note_webseite', n)} />
              <FieldLabel>Was stört dich daran?</FieldLabel>
              <VoiceTextInput
                value={answers.text_webseite}
                onChange={v => set('text_webseite', v)}
                placeholder="Sag es ganz ehrlich…"
              />
            </StepShell>
          )}

          {/* ── 2: Templates ── */}
          {step === 2 && (
            <StepShell
              title="Welche Templates fehlen dir?"
              sub="Tippe alles an, was du dir wünschst."
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {TEMPLATE_OPTIONS.map(t => (
                  <Chip key={t} label={t} active={answers.template_wuensche.includes(t)}
                    onClick={() => set('template_wuensche',
                      answers.template_wuensche.includes(t)
                        ? answers.template_wuensche.filter(x => x !== t)
                        : [...answers.template_wuensche, t]
                    )} />
                ))}
              </div>
              <FieldLabel>Noch andere Ideen?</FieldLabel>
              <VoiceTextInput
                value={answers.text_templates}
                onChange={v => set('text_templates', v)}
                placeholder="Z. B. für Events, Kunden-Betreuung…"
                rows={2}
              />
            </StepShell>
          )}

          {/* ── 3: Preise ── */}
          {step === 3 && (
            <StepShell title="Was denkst du über unsere Preise?">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {PREIS_OPTIONS.map(o => (
                  <Chip key={o.value} label={o.label} color={o.color} bg={o.bg}
                    active={answers.preis_meinung === o.value}
                    onClick={() => set('preis_meinung', answers.preis_meinung === o.value ? null : o.value)} />
                ))}
              </div>
              <FieldLabel>Was wäre für dich ein fairer Preis?</FieldLabel>
              <VoiceTextInput
                value={answers.text_preise}
                onChange={v => set('text_preise', v)}
                placeholder="Z. B. 10 Euro im Monat, weil…"
                rows={2}
              />
            </StepShell>
          )}

          {/* ── 4: Tarif + Upgrade ── */}
          {step === 4 && (
            <StepShell title="Welchen Tarif hast du gerade?">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {TARIF_OPTIONS.map(o => (
                  <Chip key={o.value} label={o.label} active={answers.tarif === o.value}
                    onClick={() => {
                      const next = answers.tarif === o.value ? null : o.value
                      setAnswers(a => ({
                        ...a,
                        tarif: next,
                        ...(next === 'unlimited' ? { upgrade_grund: null, text_upgrade: '' } : {}),
                      }))
                    }} />
                ))}
              </div>
              {showUpgradeQuestion && (
                <>
                  <FieldLabel>Warum kein größeres Paket?</FieldLabel>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {GRUND_OPTIONS.map(g => (
                      <Chip key={g.value} label={g.label} active={answers.upgrade_grund === g.value}
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
                      />
                    </>
                  )}
                </>
              )}
            </StepShell>
          )}

          {/* ── 5: Weiterempfehlung ── */}
          {step === 5 && (
            <StepShell title="Wirst du FinestSites deinen Partnern empfehlen?">
              <YesNo value={answers.empfehlung} onChange={v => {
                setAnswers(a => ({
                  ...a,
                  empfehlung: a.empfehlung === v ? null : v,
                  ...(v === 'ja' ? { text_empfehlung: '' } : {}),
                }))
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

          {/* ── 6: Chef-Frage ── */}
          {step === 6 && (
            <StepShell
              title="Wenn du hier Chef wärst: Was würdest du zuerst ändern?"
              sub="Alles erlaubt: Preise, Templates, Bedienung."
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

          {/* ── Danke ── */}
          {step === 7 && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{
                width: 64, height: 64, borderRadius: 999, background: '#10B981',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
              }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12l5 5 11-11" />
                </svg>
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a', margin: '0 0 12px' }}>
                Danke dir!
              </h1>
              <p style={{ fontSize: 16, lineHeight: 1.6, color: '#4B5563', margin: 0 }}>
                Alles anonym gespeichert. Du hilfst uns damit richtig.
              </p>
            </div>
          )}

          {/* ── Navigation ── */}
          {step <= TOTAL_STEPS && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28 }}>
              {step > 1 ? (
                <button
                  onClick={() => setStep(s => s - 1)}
                  style={{
                    padding: '12px 20px', borderRadius: 999, border: '1.5px solid #E5E7EB',
                    background: '#fff', color: '#374151', fontSize: 15, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Zurück
                </button>
              ) : <span />}
              {step < TOTAL_STEPS ? (
                <button onClick={() => setStep(s => s + 1)} style={primaryBtn}>Weiter</button>
              ) : (
                <button onClick={submit} disabled={submitting} style={{ ...primaryBtn, opacity: submitting ? 0.6 : 1 }}>
                  {submitting ? 'Wird gesendet…' : 'Absenden'}
                </button>
              )}
            </div>
          )}
        </div>

        {step <= TOTAL_STEPS && (
          <p style={{ textAlign: 'center', fontSize: 12.5, color: '#9CA3AF', marginTop: 16 }}>
            Alles freiwillig. Tippen oder einsprechen, wie du magst.
          </p>
        )}
      </div>
    </div>
  )
}

const primaryBtn: React.CSSProperties = {
  padding: '13px 28px', borderRadius: 999, border: 'none',
  background: '#1a1a1a', color: '#fff', fontSize: 15.5, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit',
}

function StepShell({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 style={{ fontSize: 21, fontWeight: 800, color: '#1a1a1a', margin: sub ? '0 0 6px' : '0 0 22px', lineHeight: 1.3 }}>
        {title}
      </h1>
      {sub && <p style={{ fontSize: 14.5, lineHeight: 1.5, color: '#9CA3AF', margin: '0 0 22px' }}>{sub}</p>}
      {children}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 15, fontWeight: 600, color: '#374151', margin: '22px 0 10px', lineHeight: 1.45 }}>
      {children}
    </p>
  )
}
