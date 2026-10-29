import type { Metadata } from 'next'
import NavBar from '@/app/_components/NavBar'
import Footer from '@/app/_components/Footer'
import { CHAT_AVV_CURRENT_VERSION, CHAT_AVV_SECTIONS, CHAT_AVV_STAND } from '@/lib/chat/avv'

export const metadata: Metadata = {
  title: 'Auftragsverarbeitung Besucher-Chat – FinestSites',
  description: 'Ergänzung zur Auftragsverarbeitung nach Art. 28 DSGVO für den Besucher-Chat von FinestSites.',
  robots: { index: false },
}

export default function ChatAvvPage() {
  const sections = CHAT_AVV_SECTIONS[CHAT_AVV_CURRENT_VERSION]
  return (
    <div style={{ fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#fff', minHeight: '100vh' }}>
      <NavBar />

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '120px 24px 96px' }}>
        <h1 style={{ fontFamily: '"Plein", sans-serif', fontSize: 'clamp(30px, 4vw, 44px)', fontWeight: 400, color: '#111', letterSpacing: '-0.025em', marginBottom: 12 }}>
          Ergänzung zur Auftragsverarbeitung: Besucher-Chat
        </h1>
        <p style={{ fontSize: 14, color: '#aaa', marginBottom: 20 }}>Stand: {CHAT_AVV_STAND} · Version {CHAT_AVV_CURRENT_VERSION}</p>
        <p style={{ fontSize: 15, color: '#444', lineHeight: 1.85, marginBottom: 48 }}>
          Kurz gesagt: Wenn du den Besucher-Chat einschaltest, speichern wir die Nachrichten deiner Besucher für dich,
          auf Servern in Deutschland, und löschen sie automatisch 180 Tage nach der letzten Nachricht. Du entscheidest,
          wir verarbeiten nur in deinem Auftrag. Die genauen Regeln stehen unten.
        </p>

        {sections.map(s => (
          <div key={s.title} style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 12 }}>{s.title}</h2>
            <div style={{ fontSize: 15, color: '#444', lineHeight: 1.85 }}>
              {s.paragraphs.map((p, i) => (
                <p key={i} style={{ marginTop: i === 0 ? 0 : 12 }}>({i + 1}) {p}</p>
              ))}
            </div>
            <hr style={{ marginTop: 40, border: 'none', borderTop: '1px solid #F1F1F1' }} />
          </div>
        ))}

        <p style={{ fontSize: 13, color: '#aaa' }}>
          FinestSites Daniel Kurzeja · Herrleinstr. 39 · 97437 Haßfurt · Stand: {CHAT_AVV_STAND}
        </p>
      </main>

      <Footer />
    </div>
  )
}
