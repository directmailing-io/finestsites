/**
 * Ankündigung App + Besucher-Chat (November 2026). Kategorie "updates" (wer sie abbestellt hat,
 * wird übersprungen), Vorlage appLaunch202611Email.
 *
 * Auf dem App-Server (Prod-DB, Prod-Resend):
 *   node --env-file=.env.production --import tsx scripts/send-app-launch-2026-11.ts                                   # Trockenlauf
 *   node --env-file=.env.production --import tsx scripts/send-app-launch-2026-11.ts --to info@daniel-kurzeja.de --send  # Test an Daniel
 *   node --env-file=.env.production --import tsx scripts/send-app-launch-2026-11.ts --send                              # an alle, NUR mit Daniels Freigabe
 */
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { loadAllRecipients, sendCategoryMail, type BulkRecipient } from '@/lib/email/bulk'
import { appLaunch202611Email, APP_LAUNCH_2026_11_SUBJECT } from '@/lib/email/templates'

const argv = process.argv.slice(2)
const opt = (k: string) => { const i = argv.indexOf(k); return i > -1 ? argv[i + 1] : undefined }
const SEND = argv.includes('--send')

async function send(recipients: BulkRecipient[], isTest: boolean) {
  console.log(`\n== ${recipients.length} Empfänger vor Opt-out-Filter · ${SEND ? 'VERSAND' : 'Trockenlauf'}`)
  if (recipients.length === 0) return
  const result = await sendCategoryMail({
    category: 'updates',
    type: 'product_update',
    subject: APP_LAUNCH_2026_11_SUBJECT,
    buildHtml: (u, prefs) => appLaunch202611Email({ firstName: u.firstName ?? undefined, prefs }),
    recipients,
    dryRun: !SEND,
    onProgress: m => console.log('  ' + m),
  })
  if (result.skipped) console.log(`  Abbestellt: ${result.skippedEmails.join(', ')}`)
  if (SEND && !isTest) {
    await db.execute(sql`
      INSERT INTO newsletter_sends (subject, body, recipient_filter, specific_emails, sent, failed, skipped, total, category)
      VALUES (${APP_LAUNCH_2026_11_SUBJECT}, ${'Vorlage appLaunch202611Email (scripts/send-app-launch-2026-11.ts)'}, ${JSON.stringify({ mode: 'script' })}, ${JSON.stringify(recipients.map(u => u.email))}, ${result.sent}, ${result.failed}, ${result.skipped}, ${result.total}, ${'updates'})
    `).catch(e => console.error('newsletter_sends:', e.message))
  }
  console.log(`  Ergebnis: ${result.sent} gesendet, ${result.failed} fehlgeschlagen, ${result.skipped} abbestellt`)
}

async function main() {
  const all = await loadAllRecipients()
  const to = opt('--to')
  if (to) {
    const r = all.filter(u => u.email.toLowerCase() === to.toLowerCase())
    if (r.length === 0) { console.error('Adresse nicht gefunden.'); process.exit(1) }
    await send(r, true)
    process.exit(0)
  }
  await send(all, false)
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
