/**
 * Launch-Mail „Vitalcheck-Seite“ an alle verifizierten Nutzer, segmentiert nach Tarif.
 *
 * Testversand (alle 4 Varianten an eine Adresse):
 *   npx tsx scripts/send-vitalcheck-launch-mail.ts --to info@example.com
 * Vorschau der Empfänger je Segment (kein Versand):
 *   npx tsx scripts/send-vitalcheck-launch-mail.ts --dry
 * Echter Versand (nur auf dem App-Server; optional --segment none|starter|pro|unlimited):
 *   npx tsx scripts/send-vitalcheck-launch-mail.ts --go
 *
 * Sicherung: --go verweigert, solange das Template noch im Test-Modus (is_test) ist.
 */
import fs from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'
import { Resend } from 'resend'
import { vitalcheckLaunchEmail, VITALCHECK_SUBJECTS, type VitalcheckSegment } from '../src/lib/email/templates'

for (const file of ['.env.production', '.env.local']) {
  const p = path.resolve(process.cwd(), file)
  if (!fs.existsSync(p)) continue
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1')
  }
}
const argv = process.argv.slice(2)
const opt = (k: string) => { const i = argv.indexOf(k); return i > -1 ? argv[i + 1] : undefined }
const from = process.env.RESEND_FROM_EMAIL ?? 'FinestSites <info@finestsites.io>'
const TEMPLATE_ID = '8a3ef41a-78fa-419d-937d-ccc7b552da1a'
const SEGMENTS: VitalcheckSegment[] = ['none', 'starter', 'pro', 'unlimited']

type Recipient = { email: string; firstName: string | null; segment: VitalcheckSegment }

async function fromDb(): Promise<{ recipients: Recipient[]; isTest: boolean }> {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1, connect_timeout: 8 })
  const rows = await sql<{ email: string; first_name: string | null; segment: VitalcheckSegment }[]>`
    select u.email, u.first_name,
      case
        when u.plan = 'unlimited' and u.subscription_status = 'active' then 'unlimited'
        when u.plan = 'pro' and u.subscription_status in ('active', 'past_due') then 'pro'
        when u.plan = 'starter' and u.subscription_status = 'active' then 'starter'
        else 'none'
      end as segment
    from users u
    where u.email_verified = true and coalesce(u.is_admin, false) = false
    order by segment, u.email`
  const [t] = await sql<{ is_test: boolean }[]>`select is_test from templates where id = ${TEMPLATE_ID}`
  await sql.end()
  const seen = new Set<string>(); const recipients: Recipient[] = []
  for (const r of rows) { const k = r.email.toLowerCase(); if (seen.has(k)) continue; seen.add(k); recipients.push({ email: r.email, firstName: r.first_name, segment: r.segment }) }
  return { recipients, isTest: t?.is_test ?? true }
}

async function main() {
  const resend = new Resend(process.env.RESEND_API_KEY ?? '')
  const to = opt('--to')
  if (to) {
    for (const seg of SEGMENTS) {
      const res = await resend.emails.send({ from, to, subject: `[TEST · Variante ${seg}] ${VITALCHECK_SUBJECTS[seg]}`, html: vitalcheckLaunchEmail({ firstName: opt('--name') ?? 'Daniel', segment: seg }), replyTo: 'info@finestsites.io' })
      console.log(res.error ? ` ✗ ${seg}: ${res.error.message}` : ` ✓ ${seg} → ${to} (${res.data?.id})`)
      await new Promise(r => setTimeout(r, 700))
    }
    return
  }
  const { recipients, isTest } = await fromDb()
  const only = opt('--segment') as VitalcheckSegment | undefined
  const list = only ? recipients.filter(r => r.segment === only) : recipients
  const counts = SEGMENTS.map(s => `${s}: ${list.filter(r => r.segment === s).length}`).join(' · ')
  if (argv.includes('--dry')) { console.log(`${list.length} Empfänger (${counts}); Template is_test=${isTest}`); for (const r of list) console.log(` - ${r.segment.padEnd(9)} ${r.email} (${r.firstName ?? '—'})`); return }
  if (!argv.includes('--go')) { console.log('Nichts getan. --to <mail> | --dry | --go [--segment x]'); return }
  if (isTest) { console.error('Abbruch: Template steht noch auf is_test=true – erst freigeben (is_test=false), dann versenden.'); process.exit(1) }
  console.log(`Versand an ${list.length} Empfänger (${counts}) …`)
  let ok = 0, fail = 0
  for (const r of list) {
    const res = await resend.emails.send({ from, to: r.email, subject: VITALCHECK_SUBJECTS[r.segment], html: vitalcheckLaunchEmail({ firstName: r.firstName ?? undefined, segment: r.segment }), replyTo: 'info@finestsites.io' })
    if (res.error) { fail++; console.log(` ✗ ${r.email}: ${res.error.message}`) } else { ok++ }
    await new Promise(r => setTimeout(r, 600))
  }
  console.log(`fertig: ${ok} gesendet, ${fail} Fehler`)
}
main().catch(e => { console.error(e); process.exit(1) })
