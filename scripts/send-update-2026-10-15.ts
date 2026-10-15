/**
 * Produkt-Update 15.10.2026: Business-Seite in 8 Sprachen, eigene Farbe, neue Hintergrundbilder.
 * Kategorie "updates" (wer sie abbestellt hat, wird übersprungen), Vorlage productUpdate202610Email.
 *
 * Auf dem App-Server (Prod-DB, Prod-Resend):
 *   node --env-file=.env.production --import tsx scripts/send-update-2026-10-15.ts                      # Trockenlauf
 *   node --env-file=.env.production --import tsx scripts/send-update-2026-10-15.ts --to info@daniel-kurzeja.de --send   # Test an Daniel
 *   node --env-file=.env.production --import tsx scripts/send-update-2026-10-15.ts --send               # an alle (3 Segmente)
 *   … --segment starter --send | --segment none --send                                               # einzeln
 *   … --to info@daniel-kurzeja.de --segment none --send                                               # Test einer Fassung
 */
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { users } from '@/lib/db/schema'
import { loadAllRecipients, sendCategoryMail, type BulkRecipient } from '@/lib/email/bulk'
import { productUpdate202610Email, PRODUCT_UPDATE_2026_10_SUBJECT, type ProductUpdateSegment } from '@/lib/email/templates'

const argv = process.argv.slice(2)
const opt = (k: string) => { const i = argv.indexOf(k); return i > -1 ? argv[i + 1] : undefined }
const SEND = argv.includes('--send')
const WITH_SUB = new Set(['active', 'past_due', 'trialing'])

/**
 * Drei Fassungen: pro (Pro/Unlimited mit Abo), starter (Starter mit Abo, Zusatzkarte „mehr Seiten“),
 * none (kein Abo, Zusatzkarte „in 5 Minuten online“). --segment pro|starter|none|all, --to für einen Test
 * (dann --segment wählen, sonst pro).
 */
async function segmentOf(): Promise<Map<string, ProductUpdateSegment>> {
  const rows = await db.select({ id: users.id, plan: users.plan, status: users.subscriptionStatus }).from(users)
  const m = new Map<string, ProductUpdateSegment>()
  for (const r of rows) {
    const sub = WITH_SUB.has(r.status ?? '')
    m.set(r.id, !sub ? 'none' : r.plan === 'starter' ? 'starter' : 'pro')
  }
  return m
}

async function sendSegment(segment: ProductUpdateSegment, recipients: BulkRecipient[], isTest: boolean) {
  console.log(`\n== ${segment}: ${recipients.length} Empfänger vor Opt-out-Filter · ${SEND ? 'VERSAND' : 'Trockenlauf'}`)
  if (recipients.length === 0) return
  const result = await sendCategoryMail({
    category: 'updates',
    type: 'product_update',
    subject: PRODUCT_UPDATE_2026_10_SUBJECT,
    buildHtml: (u, prefs) => productUpdate202610Email({ firstName: u.firstName ?? undefined, segment, prefs }),
    recipients,
    dryRun: !SEND,
    onProgress: m => console.log('  ' + m),
  })
  if (result.skipped) console.log(`  Abbestellt: ${result.skippedEmails.join(', ')}`)
  if (SEND && !isTest) {
    await db.execute(sql`
      INSERT INTO newsletter_sends (subject, body, recipient_filter, specific_emails, sent, failed, skipped, total, category)
      VALUES (${PRODUCT_UPDATE_2026_10_SUBJECT}, ${'Vorlage productUpdate202610Email (scripts/send-update-2026-10-15.ts)'}, ${JSON.stringify({ mode: 'script', segment })}, ${JSON.stringify(recipients.map(u => u.email))}, ${result.sent}, ${result.failed}, ${result.skipped}, ${result.total}, ${'updates'})
    `).catch(e => console.error('newsletter_sends:', e.message))
  }
  console.log(`  Ergebnis: ${result.sent} gesendet, ${result.failed} fehlgeschlagen, ${result.skipped} abbestellt`)
}

async function main() {
  const all = await loadAllRecipients()
  const seg = await segmentOf()
  const to = opt('--to')
  const wanted = (opt('--segment') ?? (to ? 'pro' : 'all')) as ProductUpdateSegment | 'all'
  if (to) {
    const r = all.filter(u => u.email.toLowerCase() === to.toLowerCase())
    if (r.length === 0) { console.error('Adresse nicht gefunden.'); process.exit(1) }
    await sendSegment(wanted === 'all' ? 'pro' : wanted, r, true)
    process.exit(0)
  }
  for (const s of ['pro', 'starter', 'none'] as const) {
    if (wanted !== 'all' && wanted !== s) continue
    await sendSegment(s, all.filter(u => seg.get(u.id) === s), false)
  }
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
