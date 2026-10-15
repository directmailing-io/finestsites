/**
 * Mail an alle Nutzer (oder eine Auswahl) in einer bestimmten Kategorie verschicken.
 * Das ist der Standardweg für "schick Mail X an alle": Opt-outs werden automatisch beachtet,
 * jede Mail bekommt Abbestellen-Link und Einstellungen-Link im Footer und landet in email_logs.
 *
 * Läuft auf dem App-Server (Prod-DB über .env.production):
 *   node --env-file=.env.production --import tsx scripts/send-category-mail.ts \
 *     --category updates --subject "Betreff mit {{vorname}}" --body-file /tmp/mail.md            # Trockenlauf
 *   … --send                                                                                      # wirklich senden
 *   … --to info@daniel-kurzeja.de --send                                                          # nur an eine Adresse (Test)
 *   … --segment with-sub | --segment without-sub                                                  # nach Abo-Status
 *
 * Kategorien: system (nicht abbestellbar, nur für Pflichtinfos), updates, tips, offers.
 * Body = Mail-Markup (Leerzeile = Absatz, **fett**, [Text](URL), [[Button]](URL)), Platzhalter
 * {{vorname}} {{nachname}} {{username}} {{email}}, optional mit Fallback {{vorname|Hallo}}.
 */
import fs from 'node:fs'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'
import { isEmailCategory } from '@/lib/email/categories'
import { loadAllRecipients, sendCategoryMail, type BulkRecipient } from '@/lib/email/bulk'

const argv = process.argv.slice(2)
const opt = (k: string) => { const i = argv.indexOf(k); return i > -1 ? argv[i + 1] : undefined }
const SEND = argv.includes('--send')
const WITH_SUB = new Set(['active', 'past_due', 'trialing'])

async function main() {
  const category = opt('--category')
  const subject = opt('--subject')
  const bodyFile = opt('--body-file')
  if (!isEmailCategory(category) || !subject || !bodyFile) {
    console.error('Nötig: --category <system|updates|tips|offers> --subject "…" --body-file <datei> [--send] [--to mail] [--segment with-sub|without-sub]')
    process.exit(1)
  }
  const body = fs.readFileSync(bodyFile, 'utf8').trim()
  if (!body) { console.error('Body-Datei ist leer.'); process.exit(1) }

  let recipients: BulkRecipient[] = await loadAllRecipients()
  const to = opt('--to')
  if (to) recipients = recipients.filter(u => u.email.toLowerCase() === to.toLowerCase())
  const segment = opt('--segment')
  if (segment) {
    const status = await db.select({ id: users.id, s: users.subscriptionStatus }).from(users)
    const withSub = new Set(status.filter(r => WITH_SUB.has(r.s ?? '')).map(r => r.id))
    recipients = recipients.filter(u => segment === 'with-sub' ? withSub.has(u.id) : !withSub.has(u.id))
  }
  if (recipients.length === 0) { console.error('Keine Empfänger.'); process.exit(1) }

  console.log(`Kategorie ${category} · ${recipients.length} Empfänger vor Opt-out-Filter · ${SEND ? 'VERSAND' : 'Trockenlauf'}`)
  const result = await sendCategoryMail({
    category, subject, body, recipients, dryRun: !SEND,
    type: category === 'updates' ? 'product_update' : category === 'tips' ? 'tip' : category === 'offers' ? 'offer' : 'newsletter',
    onProgress: m => console.log('  ' + m),
  })
  if (result.skipped) console.log(`  Abbestellt (übersprungen): ${result.skippedEmails.join(', ')}`)
  if (SEND) {
    await db.execute(sql`
      INSERT INTO newsletter_sends (subject, body, recipient_filter, specific_emails, sent, failed, skipped, total, category)
      VALUES (${subject}, ${body}, ${JSON.stringify({ mode: 'script', segment: segment ?? 'all', to: to ?? null })}, ${JSON.stringify(recipients.map(u => u.email))}, ${result.sent}, ${result.failed}, ${result.skipped}, ${result.total}, ${category})
    `).catch(e => console.error('newsletter_sends:', e.message))
  }
  console.log(`Ergebnis: ${result.sent} gesendet, ${result.failed} fehlgeschlagen, ${result.skipped} abbestellt, ${result.total} gesamt`)
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
