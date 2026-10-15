/**
 * Produkt-Update 15.10.2026: Business-Seite in 8 Sprachen, eigene Farbe, neue Hintergrundbilder.
 * Kategorie "updates" (wer sie abbestellt hat, wird übersprungen), Vorlage productUpdate202610Email.
 *
 * Auf dem App-Server (Prod-DB, Prod-Resend):
 *   node --env-file=.env.production --import tsx scripts/send-update-2026-10-15.ts                      # Trockenlauf
 *   node --env-file=.env.production --import tsx scripts/send-update-2026-10-15.ts --to info@daniel-kurzeja.de --send   # Test an Daniel
 *   node --env-file=.env.production --import tsx scripts/send-update-2026-10-15.ts --send               # an alle
 */
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { loadAllRecipients, sendCategoryMail } from '@/lib/email/bulk'
import { productUpdate202610Email, PRODUCT_UPDATE_2026_10_SUBJECT } from '@/lib/email/templates'

const argv = process.argv.slice(2)
const opt = (k: string) => { const i = argv.indexOf(k); return i > -1 ? argv[i + 1] : undefined }
const SEND = argv.includes('--send')

async function main() {
  let recipients = await loadAllRecipients()
  const to = opt('--to')
  if (to) recipients = recipients.filter(u => u.email.toLowerCase() === to.toLowerCase())
  if (recipients.length === 0) { console.error('Keine Empfänger.'); process.exit(1) }
  console.log(`${recipients.length} Empfänger vor Opt-out-Filter · ${SEND ? 'VERSAND' : 'Trockenlauf'}`)

  const result = await sendCategoryMail({
    category: 'updates',
    type: 'product_update',
    subject: PRODUCT_UPDATE_2026_10_SUBJECT,
    buildHtml: (u, prefs) => productUpdate202610Email({ firstName: u.firstName ?? undefined, prefs }),
    recipients,
    dryRun: !SEND,
    onProgress: m => console.log('  ' + m),
  })
  if (result.skipped) console.log(`  Abbestellt: ${result.skippedEmails.join(', ')}`)
  if (SEND && !to) {
    await db.execute(sql`
      INSERT INTO newsletter_sends (subject, body, recipient_filter, specific_emails, sent, failed, skipped, total, category)
      VALUES (${PRODUCT_UPDATE_2026_10_SUBJECT}, ${'Vorlage productUpdate202610Email (scripts/send-update-2026-10-15.ts)'}, ${JSON.stringify({ mode: 'script' })}, ${JSON.stringify(recipients.map(u => u.email))}, ${result.sent}, ${result.failed}, ${result.skipped}, ${result.total}, ${'updates'})
    `).catch(e => console.error('newsletter_sends:', e.message))
  }
  console.log(`Ergebnis: ${result.sent} gesendet, ${result.failed} fehlgeschlagen, ${result.skipped} abbestellt`)
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
