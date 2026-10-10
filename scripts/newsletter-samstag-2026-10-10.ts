/**
 * Samstags-Update 10.10.2026 – zwei Fassungen, sauber nach Abo-Status getrennt.
 *
 * Läuft auf dem App-Server (Prod-DB über .env.production):
 *   node --env-file=.env.production --import tsx scripts/newsletter-samstag-2026-10-10.ts          # Trockenlauf: nur zählen
 *   node --env-file=.env.production --import tsx scripts/newsletter-samstag-2026-10-10.ts --send   # wirklich senden
 *
 * Versand und Protokoll (email_logs, newsletter_sends) entsprechen 1:1 dem Admin-Newsletter
 * (src/app/api/admin/newsletter/route.ts), nur die Segmentierung ist präziser:
 *   mit Abo  = subscription_status active | past_due | trialing  (haben ein Abo, kein Preis-Pitch)
 *   ohne Abo = alles andere (null, canceled, …)
 */
import { db } from '@/lib/db'
import { users, emailLogs } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'
import { getResend, FROM_EMAIL } from '@/lib/resend'
import { newsletterEmail } from '@/lib/email/templates'
import { markupToHtml } from '@/lib/email/markup'

const SEND = process.argv.includes('--send')
const WITH_SUB = new Set(['active', 'past_due', 'trialing'])

const SUBJECT = 'Schönen Samstag, {{vorname}} ☀️ – das hat sich bei FinestSites getan'

const UPDATES = `Hey {{vorname}},

erstmal: schönen Samstag dir! Ich wollte dir kurz schreiben, weil sich die letzten Tage bei FinestSites richtig viel getan hat. Einiges davon kam direkt aus euren Rückmeldungen, deshalb hier mal alles auf einen Blick:

**🌍 Deine Optimalset-Seite spricht jetzt 8 Sprachen**
Deutsch, Englisch, Italienisch, Russisch, Ukrainisch, Polnisch, Bulgarisch und Hindi. Die Seite erkennt automatisch, welche Sprache der Besucher spricht, und zeigt sie direkt passend an. Dein „Über mich“-Text wird dabei automatisch mitübersetzt. Perfekt, um Kunden und Teampartner aus aller Welt anzusprechen. Für die anderen Seiten folgen die Übersetzungen nach und nach.

**💚 Die Vitalcheck-Seite ist da**
Das Feedback ist echt überragend. Es macht einfach Spaß, sich sein eigenes Vitalprofil erstellen zu lassen, und für dich ist es ein super Türöffner für Gespräche. Du findest sie unter [Vorlagen](https://finestsites.io/vorlagen).

**🏢 Firmenname im Impressum**
In den Einstellungen kannst du jetzt deinen Firmennamen eintragen. Der steht dann automatisch in deinem Impressum.

**👫 Partner-Seiten: Kontaktdaten von beiden**
Wenn ihr eure Seite zu zweit betreibt, könnt ihr jetzt die Kontaktdaten von beiden Partnern anzeigen lassen (WhatsApp, Telefon usw.), ganz wie ihr wollt.

**✏️ Änderungen gehen erst online, wenn du es willst**
Im Editor kannst du jetzt in Ruhe an deiner Seite arbeiten. Besucher sehen die neue Fassung erst, wenn du auf „Änderungen veröffentlichen“ tippst. Du erkennst das an dem orangen Hinweis im Editor.

**🤓 Nur für die Technik-Nerds unter euch**
Wer bezahlte Werbung bei Facebook, Google oder TikTok schaltet, kann in den Einstellungen unter „Werbung“ jetzt seinen Tracking-Pixel einrichten. Damit siehst du messbar, was deine Anzeigen bringen. Alle anderen können diesen Punkt entspannt überspringen. 😉

**🤝 Partnerprogramm**
Einige von euch haben das Partnerprogramm schon entdeckt. Dazu gibt es bald Updates und Neuigkeiten, also gespannt bleiben. :)

Dazu kommen noch viele kleine Optimierungen, die man gar nicht alle aufzählen kann. Und an dieser Stelle ein großes Danke an jeden, der sich mit Verbesserungsvorschlägen, Wünschen und Ideen meldet. Genau dadurch wird FinestSites immer besser.`

const SIGNOFF = `Wenn du Fragen hast oder dir etwas fehlt, schreib mir einfach. Ich lese alles persönlich.

Schönen Samstag dir und bis bald,
Daniel`

const BODY_MIT_ABO = `${UPDATES}

${SIGNOFF}`

const BODY_OHNE_ABO = `${UPDATES}

**🚀 Deine Seite wartet nur noch auf dich**
Wenn du schon länger überlegst, deine Seite online zu stellen: Ab 17 € im Monat bist du dabei, das sind nicht mal 60 Cent am Tag. Weniger als ein Kaffee, dafür eine Seite, die rund um die Uhr für dich arbeitet. Und das Beste: Du kannst jederzeit monatlich kündigen, ganz ohne Haken. Einfach ausprobieren, und wenn es nichts für dich ist, bist du mit einem Klick wieder raus.

[[Jetzt Seite online stellen]](https://app.finestsites.io/billing)

${SIGNOFF}`

type U = { email: string; firstName: string | null; lastName: string | null; username: string | null; subscriptionStatus: string | null }

function interpolate(text: string, u: U): string {
  return text.replace(/\{\{(\w+)(?:\|([^}]*))?\}\}/g, (m, field: string, fb?: string) => {
    const f = fb ?? ''
    switch (field) {
      case 'vorname':  return u.firstName?.trim() || f || 'du'
      case 'nachname': return u.lastName?.trim()  || f || ''
      case 'username': return u.username?.trim()  || f || ''
      case 'email':    return u.email
      default:         return m
    }
  })
}

async function sendSegment(label: string, body: string, recipients: U[]) {
  console.log(`\n== ${label}: ${recipients.length} Empfänger`)
  if (!SEND) { console.log('   (Trockenlauf – nichts gesendet)'); return }
  const resend = getResend()
  let sent = 0, failed = 0
  for (let i = 0; i < recipients.length; i += 100) {
    const chunk = recipients.slice(i, i + 100)
    const payloads = chunk.map(u => {
      const subject = interpolate(SUBJECT, u)
      return { u, subject, html: newsletterEmail({ subject, bodyHtml: markupToHtml(interpolate(body, u)) }) }
    })
    const result = await resend.batch.send(payloads.map(p => ({ from: FROM_EMAIL, to: p.u.email, subject: p.subject, html: p.html })))
    if (result.error) {
      console.error('   Resend-Fehler:', JSON.stringify(result.error))
      failed += chunk.length
      await db.insert(emailLogs).values(payloads.map(p => ({ type: 'newsletter', to: p.u.email, subject: p.subject, status: 'error' as const, errorMessage: result.error?.message ?? 'Batch error' })))
      continue
    }
    const raw = result.data as any
    const items: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : []
    const ok = items.filter(r => r?.id).length
    const okResolved = items.length > 0 ? ok : chunk.length
    sent += okResolved; failed += chunk.length - okResolved
    await db.insert(emailLogs).values(payloads.map((p, idx) => ({
      type: 'newsletter', to: p.u.email, subject: p.subject,
      resendId: items[idx]?.id ?? undefined, status: items[idx]?.id ? 'sent' as const : 'error' as const,
    })))
    console.log(`   Batch ${i / 100 + 1}: ${okResolved}/${chunk.length} ok`)
  }
  await db.execute(sql`
    INSERT INTO newsletter_sends (subject, body, recipient_filter, specific_emails, sent, failed, total)
    VALUES (${SUBJECT}, ${body}, ${JSON.stringify({ mode: 'script', segment: label })}, ${JSON.stringify(recipients.map(u => u.email))}, ${sent}, ${failed}, ${recipients.length})
  `)
  console.log(`   Ergebnis: ${sent} gesendet, ${failed} fehlgeschlagen`)
}

async function main() {
  const all: U[] = await db.select({ email: users.email, firstName: users.firstName, lastName: users.lastName, username: users.username, subscriptionStatus: users.subscriptionStatus }).from(users).orderBy(users.email)
  const seen = new Set<string>()
  const unique = all.filter(u => u.email?.includes('@') && !seen.has(u.email.toLowerCase()) && seen.add(u.email.toLowerCase()))
  const mit = unique.filter(u => WITH_SUB.has(u.subscriptionStatus ?? ''))
  const ohne = unique.filter(u => !WITH_SUB.has(u.subscriptionStatus ?? ''))
  console.log(`Gesamt ${unique.length} (mit Abo ${mit.length}, ohne Abo ${ohne.length})`)
  await sendSegment('mit Abo', BODY_MIT_ABO, mit)
  await sendSegment('ohne Abo', BODY_OHNE_ABO, ohne)
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
