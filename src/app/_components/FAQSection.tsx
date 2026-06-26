'use client'

import { useState } from 'react'

const FAQS = [
  {
    q: 'Wie schnell bin ich mit meiner Website online?',
    a: 'In der Regel in unter 5 Minuten. Du suchst dir ein Template aus, nimmst ein paar persönliche Anpassungen vor — Profilbild, Farbthema, welche Bereiche du anzeigen möchtest — und deine Seite ist live. Das geht genauso gut vom Handy aus, du brauchst dafür keinen Laptop.',
  },
  {
    q: 'Brauche ich technisches Wissen, Marketing-Kenntnisse oder kreatives Talent?',
    a: 'Nein. Gar nicht. Die Templates sind schlüsselfertig. Texte, Design, Struktur, psychologische Überzeugungskraft — das alles ist bereits drin. Du musst nichts erfinden oder selbst ausdenken. Einfach Template wählen, ein paar Infos eintragen, fertig.',
  },
  {
    q: 'Was für Templates gibt es und wie unterscheiden sie sich?',
    a: 'Es gibt mehrere Templates, die jeweils auf ein anderes Ziel optimiert sind. Eines ist z. B. auf die Produkte ausgerichtet, ein anderes auf die Geschäftsmöglichkeit, ein weiteres spricht gezielt Mütter an, die ein zweites Standbein aufbauen möchten. Jedes Template wurde gemeinsam mit Führungskräften aus Network-Marketing-Unternehmen, UX/UI-Designern und Marketing-Experten entwickelt. Nichts ist dem Zufall überlassen — für sowas zahlen Unternehmen mehrere tausend Euro.',
  },
  {
    q: 'Was kann ich an meiner Website anpassen?',
    a: 'Du kannst ein Farbthema wählen, dein Profilbild hochladen, den Stil der Seite festlegen und einzelne Bereiche ein- oder ausblenden, die du nicht brauchst. Das sind keine großen Eingriffe — die Anpassung dauert meistens 5 Minuten. Alles andere, also Texte, Design und Struktur, ist bereits fertig.',
  },
  {
    q: 'Wofür kann ich meinen Website-Link nutzen?',
    a: 'Für alles. Du kannst ihn in deine Social-Media-Biografie eintragen, in Stories teilen, auf Visitenkarten drucken, auf Flyern verteilen, sogar auf dein Auto kleben. Jeder, der deinen Link aufruft, landet auf einer professionellen Seite, die rund um die Uhr für dich arbeitet.',
  },
  {
    q: 'Wie erhalte ich Anfragen von Interessenten?',
    a: 'Über ein Kontaktformular auf deiner Website. Sobald jemand es ausfüllt, siehst du die Anfrage in deinem FinestSites-Dashboard. Du musst nicht aktiv suchen — die Interessenten melden sich bei dir.',
  },
  {
    q: 'Muss ich mich um Hosting, DSGVO oder Barrierefreiheit kümmern?',
    a: 'Nein, das übernehmen wir komplett. Hosting, SSL-Verschlüsselung, Datenschutzerklärung, Impressum, Barrierefreiheit — alles inklusive. Du musst dich damit nie beschäftigen.',
  },
  {
    q: 'Wird meine Website auch langfristig besser?',
    a: 'Ja. Wir optimieren die Templates laufend weiter. Je mehr Nutzer FinestSites hat, desto mehr Daten und Erfahrungswerte haben wir — und desto besser können wir testen, was wirklich funktioniert. Diese Verbesserungen fließen automatisch in deine Website ein. Du merkst davon nichts, aber deine Ergebnisse werden besser.',
  },
  {
    q: 'Ersetzt die Website meinen bisherigen Prozess im Network Marketing?',
    a: 'Nein. Sie ergänzt ihn. Was du bisher gut machst, bleibt so. Aber viele Menschen beobachten dich still und melden sich nie — obwohl sie interessiert wären. Eine eigene Website gibt diesen Menschen die Möglichkeit, sich eigenständig zu informieren und dann aktiv auf dich zuzukommen. Sie schließt also eine Lücke, die ohne Website einfach bleibt.',
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
