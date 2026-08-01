'use client'

/**
 * Anonyme Feedback-Kampagne (temporär).
 * Komplett isoliert — zum Entfernen siehe docs/feedback-aktion-entfernen.md
 */

import { useCallback, useEffect, useRef, useState } from 'react'

// ── Fragen-Konfiguration ──────────────────────────────────────────────────────

const TARIF_OPTIONS = [
  { value: 'starter', label: 'Starter' },
  { value: 'pro', label: 'Pro' },
  { value: 'unlimited', label: 'Unlimited' },
  { value: 'unbekannt', label: 'Weiß ich gerade nicht' },
]

const BLOCKER_OPTIONS = [
  'Zu teuer',
  'Mein Tarif reicht mir',
  'Brauche die Extras nicht',
  'Weiß nicht, was drin wäre',
  'Hab nie drüber nachgedacht',
]

type Answers = {
  note_webseite: number | null
  text_webseite: string
  text_templates: string
  note_preise: number | null
  text_preise: string
  tarif: string | null
  upgrade_blocker: string[]
  text_upgrade: string
  text_chef: string
  text_offen: string
}

const EMPTY: Answers = {
  note_webseite: null, text_webseite: '',
  text_templates: '',
  note_preise: null, text_preise: '',
  tarif: null, upgrade_blocker: [], text_upgrade: '',
  text_chef: '',
  text_offen: '',
}

const TOTAL_STEPS = 6

// ── Voice + Text Eingabe ──────────────────────────────────────────────────────

function VoiceTextInput({ value, onChange, placeholder }: {
  value: string
  onChange: (v: string) => void
  placeholder: string
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
          setError('Transkription fehlgeschlagen. Tipp deine Antwort einfach ein.')
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
      setError('Mikrofon nicht verfügbar. Tipp deine Antwort einfach ein.')
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
          rows={4}
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
            'Wird transkribiert…'
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

// ── Schulnoten-Auswahl ────────────────────────────────────────────────────────

function GradePicker({ value, onChange }: { value: number | null; onChange: (n: number) => void }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {[1, 2, 3, 4, 5, 6].map(n => {
          const active = value === n
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              style={{
                flex: 1, maxWidth: 64, aspectRatio: '1', borderRadius: 16,
                border: active ? '2px solid #1a1a1a' : '1.5px solid #E5E7EB',
                background: active ? '#1a1a1a' : '#fff',
                color: active ? '#fff' : '#1a1a1a',
                fontSize: 20, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              {n}
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, padding: '0 4px' }}>
        <span style={{ fontSize: 12.5, color: '#9CA3AF' }}>1 = sehr gut</span>
        <span style={{ fontSize: 12.5, color: '#9CA3AF' }}>6 = ungenügend</span>
      </div>
    </div>
  )
}

// ── Chips ─────────────────────────────────────────────────────────────────────

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '11px 18px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
        border: active ? '2px solid #1a1a1a' : '1.5px solid #E5E7EB',
        background: active ? '#1a1a1a' : '#fff',
        color: active ? '#fff' : '#374151',
        fontSize: 15, fontWeight: 600, transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
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
  const [step, setStep] = useState(0) // 0 = Intro, 1..6 = Fragen, 7 = Danke
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

  const showUpgradeQuestion = answers.tarif !== 'unlimited'

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
        {step >= 1 && step <= TOTAL_STEPS && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#6B7280' }}>Frage {step} von {TOTAL_STEPS}</span>
              <span style={{ fontSize: 13, color: '#9CA3AF' }}>100 % anonym</span>
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

          {/* ── Intro ── */}
          {step === 0 && (
            <div style={{ textAlign: 'center' }}>
              <span style={{
                display: 'inline-block', padding: '6px 14px', borderRadius: 999,
                background: '#ECFDF5', color: '#065F46', fontSize: 13, fontWeight: 700,
                marginBottom: 20,
              }}>
                100 % anonym
              </span>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1a1a1a', margin: '0 0 14px', lineHeight: 1.25 }}>
                Sag uns ehrlich deine Meinung
              </h1>
              <p style={{ fontSize: 16, lineHeight: 1.6, color: '#4B5563', margin: '0 0 8px' }}>
                6 kurze Fragen, 2 Minuten. Wir können nicht sehen, wer geantwortet hat —
                deshalb: Sei schonungslos ehrlich. Kritik bringt uns weiter als Lob.
              </p>
              <p style={{ fontSize: 14.5, lineHeight: 1.6, color: '#9CA3AF', margin: '0 0 28px' }}>
                Du kannst tippen oder deine Antwort einfach einsprechen.
              </p>
              <button onClick={() => setStep(1)} style={primaryBtn}>Los geht&apos;s</button>
            </div>
          )}

          {/* ── 1: Webseite ── */}
          {step === 1 && (
            <StepShell
              title="Welche Schulnote gibst du deiner FinestSites-Webseite?"
              sub="So wie sie heute ist: Design, Bearbeitung, Ergebnis."
            >
              <GradePicker value={answers.note_webseite} onChange={n => set('note_webseite', n)} />
              <FieldLabel>Was nervt dich oder fehlt dir? Auch Kleinigkeiten zählen.</FieldLabel>
              <VoiceTextInput
                value={answers.text_webseite}
                onChange={v => set('text_webseite', v)}
                placeholder="Ganz ehrlich: Was würdest du sofort ändern?"
              />
            </StepShell>
          )}

          {/* ── 2: Templates ── */}
          {step === 2 && (
            <StepShell
              title="Welche Templates wünschst du dir?"
              sub="Für welche Branche, welchen Zweck oder Anlass würdest du sofort eine Seite bauen, wenn es das Template gäbe?"
            >
              <VoiceTextInput
                value={answers.text_templates}
                onChange={v => set('text_templates', v)}
                placeholder="Z. B. Handwerker, Coaches, Events, Restaurants…"
              />
            </StepShell>
          )}

          {/* ── 3: Preise ── */}
          {step === 3 && (
            <StepShell
              title="Wie fair findest du unsere Preise?"
              sub="Schulnote für das Preis-Leistungs-Verhältnis von FinestSites."
            >
              <GradePicker value={answers.note_preise} onChange={n => set('note_preise', n)} />
              <FieldLabel>
                Stell dir vor, du dürftest die Preise selbst festlegen. Wie sähen sie aus, und warum?
              </FieldLabel>
              <VoiceTextInput
                value={answers.text_preise}
                onChange={v => set('text_preise', v)}
                placeholder="Z. B. Was wäre für dich ein fairer Preis pro Monat?"
              />
            </StepShell>
          )}

          {/* ── 4: Tarif + Upgrade ── */}
          {step === 4 && (
            <StepShell
              title="Welchen Tarif nutzt du gerade?"
              sub="Nur zur Einordnung — wir sehen trotzdem nicht, wer du bist."
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {TARIF_OPTIONS.map(o => (
                  <Chip key={o.value} label={o.label} active={answers.tarif === o.value}
                    onClick={() => set('tarif', answers.tarif === o.value ? null : o.value)} />
                ))}
              </div>
              {showUpgradeQuestion && (
                <>
                  <FieldLabel>
                    Ganz ehrlich: Was hat dich bisher von einem größeren Tarif abgehalten?
                    Es gibt keine falsche Antwort — genau das wollen wir wissen.
                  </FieldLabel>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                    {BLOCKER_OPTIONS.map(b => (
                      <Chip key={b} label={b} active={answers.upgrade_blocker.includes(b)}
                        onClick={() => set('upgrade_blocker',
                          answers.upgrade_blocker.includes(b)
                            ? answers.upgrade_blocker.filter(x => x !== b)
                            : [...answers.upgrade_blocker, b]
                        )} />
                    ))}
                  </div>
                  <VoiceTextInput
                    value={answers.text_upgrade}
                    onChange={v => set('text_upgrade', v)}
                    placeholder="Magst du das kurz erklären? (optional)"
                  />
                </>
              )}
            </StepShell>
          )}

          {/* ── 5: Chef-Frage ── */}
          {step === 5 && (
            <StepShell
              title="Wenn du morgen Chef von FinestSites wärst: Was würdest du als Erstes ändern?"
              sub="Features, Preise, Templates, Bedienung — alles ist erlaubt."
            >
              <VoiceTextInput
                value={answers.text_chef}
                onChange={v => set('text_chef', v)}
                placeholder="Als Erstes würde ich…"
              />
            </StepShell>
          )}

          {/* ── 6: Offen ── */}
          {step === 6 && (
            <StepShell
              title="Was wolltest du uns schon immer mal sagen?"
              sub="Lob, Frust, Ideen, Wünsche — alles landet anonym bei uns."
            >
              <VoiceTextInput
                value={answers.text_offen}
                onChange={v => set('text_offen', v)}
                placeholder="Schieß los…"
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
                Deine Antworten wurden anonym gespeichert.
                Du hilfst uns damit mehr, als du denkst.
              </p>
            </div>
          )}

          {/* ── Navigation ── */}
          {step >= 1 && step <= TOTAL_STEPS && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28 }}>
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

        {step >= 1 && step <= TOTAL_STEPS && (
          <p style={{ textAlign: 'center', fontSize: 12.5, color: '#9CA3AF', marginTop: 16 }}>
            Alle Fragen sind freiwillig — du kannst jede überspringen.
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

function StepShell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 style={{ fontSize: 21, fontWeight: 800, color: '#1a1a1a', margin: '0 0 8px', lineHeight: 1.3 }}>
        {title}
      </h1>
      <p style={{ fontSize: 15, lineHeight: 1.55, color: '#6B7280', margin: '0 0 24px' }}>{sub}</p>
      {children}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 15, fontWeight: 600, color: '#374151', margin: '24px 0 10px', lineHeight: 1.45 }}>
      {children}
    </p>
  )
}
