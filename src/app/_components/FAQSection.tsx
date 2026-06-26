'use client'

import { useState } from 'react'

const FAQS = [
  {
    q: 'Wie schnell ist meine Website live?',
    a: 'In der Regel unter 5 Minuten. Du wählst ein Template, trägst deine Infos ein und kannst deine Seite sofort veröffentlichen. Keine Installation, keine technischen Vorkenntnisse nötig.',
  },
  {
    q: 'Brauche ich eigene Domain oder Hosting?',
    a: 'Nein. Hosting und SSL-Zertifikat sind inklusive. Du bekommst eine eigene Webadresse mit deinem Nutzernamen. Wenn du eine eigene Domain möchtest, kannst du diese jederzeit verknüpfen.',
  },
  {
    q: 'Funktioniert FinestSites für jedes Network-Marketing-Unternehmen?',
    a: 'Ja. Ob Herbalife, doTERRA, ZINZINO oder ein anderes Unternehmen — unsere Templates sind für Network-Marketer aller Art geeignet. Du passt Texte, Bilder und Farben einfach an deine Marke an.',
  },
  {
    q: 'Was passiert, wenn ich kündigen möchte?',
    a: 'Du kannst jederzeit monatlich kündigen, ohne Mindestlaufzeit oder Kündigungsfristen. Es gibt kein Kleingedrucktes. Nach der Kündigung bleibt dein Account bis zum Ende des bezahlten Zeitraums aktiv.',
  },
  {
    q: 'Kann ich die Texte und Bilder selbst anpassen?',
    a: 'Ja, vollständig. Im Editor trägst du deine eigenen Texte, Fotos und Kontaktdaten ein. Das Template bildet nur den Rahmen — der Inhalt ist komplett deiner.',
  },
  {
    q: 'Bekomme ich Benachrichtigungen, wenn jemand Kontakt aufnimmt?',
    a: 'Ja. Sobald ein Interessent das Kontaktformular auf deiner Website ausfüllt, erhältst du eine E-Mail-Benachrichtigung. Alle Anfragen findest du zusätzlich übersichtlich in deinem Dashboard.',
  },
  {
    q: 'Ist FinestSites DSGVO-konform?',
    a: 'Ja. Alle Websites werden DSGVO-konform ausgeliefert — inklusive Datenschutzerklärung, Impressum und SSL-Verschlüsselung. Außerdem prüft unsere KI automatisch, ob deine Texte den EU-Health-Claims entsprechen.',
  },
]

export default function FAQSection() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section id="faq" style={{ background: '#fff' }} className="fs-section-pad">
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16, textAlign: 'center' }}>FAQ</p>
        <h2 style={{ fontFamily: '"Plein", sans-serif', fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 400, color: '#111', letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 48, textAlign: 'center' }}>
          Häufig gestellte Fragen
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {FAQS.map((faq, i) => (
            <div key={i} style={{ borderBottom: '1px solid #ebebeb' }}>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 16,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '22px 0',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 16, fontWeight: 600, color: '#111', lineHeight: 1.4 }}>{faq.q}</span>
                <span style={{
                  flexShrink: 0,
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: open === i ? '#111' : '#f5f3f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s',
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={open === i ? '#fff' : '#555'} strokeWidth="2.5" strokeLinecap="round" style={{ transition: 'transform 0.25s', transform: open === i ? 'rotate(45deg)' : 'none' }}>
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </span>
              </button>
              <div style={{
                maxHeight: open === i ? 400 : 0,
                overflow: 'hidden',
                transition: 'max-height 0.3s ease',
              }}>
                <p style={{ fontSize: 15, color: '#555', lineHeight: 1.75, paddingBottom: 22 }}>{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
