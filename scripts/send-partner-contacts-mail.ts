/**
 * Produkt-Update „Partner-Kontaktdaten“ verschicken.
 *
 * Test an eine Adresse:   npx tsx scripts/send-partner-contacts-mail.ts --to info@example.com
 * Vorschau (kein Versand): npx tsx scripts/send-partner-contacts-mail.ts --dry
 * Echter Versand (nur auf dem App-Server, dort zeigt DATABASE_URL auf Prod):
 *                          npx tsx scripts/send-partner-contacts-mail.ts --go
 * Nachversand an Konten, die nur Entwurfs-Partnerseiten haben: --drafts --dry / --drafts --go
 *
 * Empfänger bei --go: jeder Nutzer mit mindestens einer veröffentlichten Seite,
 * auf der partner_modus=duo bzw. team_modus=team gesetzt ist (eine Mail pro Nutzer).
 */
import fs from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'
import { Resend } from 'resend'
import { partnerContactsUpdateEmail } from '../src/lib/email/templates'

// .env.local (Mac) bzw. .env.production (Server) laden, falls die Shell nichts gesetzt hat
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
const SUBJECT = 'Neu für eure Partnerseite: Jeder kann eigene Kontaktdaten zeigen'
const from = process.env.RESEND_FROM_EMAIL ?? 'FinestSites <info@finestsites.io>'

type Recipient = { email: string; firstName: string | null; partnerName: string | null }

// --drafts: nur Konten, deren Partnerseiten ausschließlich im Entwurf sind (Nachversand nach der
// ersten Welle an veröffentlichte Seiten). Demo-/Admin-Konto ist immer ausgeschlossen.
const DRAFTS_ONLY = argv.includes('--drafts')
const EXCLUDED_USERNAMES = ['demo']

async function recipientsFromDb(): Promise<Recipient[]> {
  // dieselben Optionen wie src/lib/db/index.ts (SSL kommt aus der URL)
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1, connect_timeout: 8 })
  const rows = await sql<{ email: string; first_name: string | null; partner_name: string | null }[]>`
    select u.email, u.first_name,
      (select d2.field_value from site_data d2
         where d2.user_site_id = s.id and d2.field_key in ('vorname2', 'partner_vorname') and coalesce(d2.field_value, '') <> ''
         limit 1) as partner_name
    from site_data d
    join user_sites s on s.id = d.user_site_id
    join users u on u.id = s.user_id
    where ((d.field_key = 'partner_modus' and d.field_value = 'duo') or (d.field_key = 'team_modus' and d.field_value = 'team'))
      and coalesce(u.username, '') not in ${sql(EXCLUDED_USERNAMES)}
      and ${DRAFTS_ONLY
        ? sql`s.status <> 'published' and not exists (
            select 1 from user_sites s2 join site_data d2 on d2.user_site_id = s2.id
            where s2.user_id = u.id and s2.status = 'published'
              and ((d2.field_key = 'partner_modus' and d2.field_value = 'duo') or (d2.field_key = 'team_modus' and d2.field_value = 'team')))`
        : sql`s.status = 'published'`}
    order by u.email, s.published_at desc nulls last`
  await sql.end()
  const seen = new Map<string, Recipient>()
  for (const r of rows) {
    const key = r.email.toLowerCase()
    const cur = seen.get(key)
    if (!cur) seen.set(key, { email: r.email, firstName: r.first_name, partnerName: r.partner_name })
    else if (!cur.partnerName && r.partner_name) cur.partnerName = r.partner_name
  }
  return [...seen.values()]
}

async function main() {
  const resend = new Resend(process.env.RESEND_API_KEY ?? '')
  if (argv.includes('--dry')) {
    const list = await recipientsFromDb()
    console.log(`${list.length} Empfänger:`); for (const r of list) console.log(` - ${r.email} (${r.firstName ?? '—'} & ${r.partnerName ?? '—'})`)
    return
  }
  const to = opt('--to')
  if (to) {
    const html = partnerContactsUpdateEmail({ firstName: opt('--name') ?? 'Daniel', partnerName: opt('--partner') ?? 'Anna' })
    const res = await resend.emails.send({ from, to, subject: SUBJECT, html, replyTo: 'info@finestsites.io' })
    console.log(res.error ? `FEHLER: ${res.error.message}` : `Testmail an ${to} verschickt (${res.data?.id})`)
    return
  }
  if (!argv.includes('--go')) { console.log('Nichts getan. --to <mail> | --dry | --go'); return }
  const list = await recipientsFromDb()
  console.log(`Versand an ${list.length} Empfänger …`)
  for (const r of list) {
    const html = partnerContactsUpdateEmail({ firstName: r.firstName ?? undefined, partnerName: r.partnerName ?? undefined })
    const res = await resend.emails.send({ from, to: r.email, subject: SUBJECT, html, replyTo: 'info@finestsites.io' })
    console.log(res.error ? ` ✗ ${r.email}: ${res.error.message}` : ` ✓ ${r.email}`)
    await new Promise(r => setTimeout(r, 600)) // Resend-Rate-Limit (2/s) nicht reizen
  }
}
main().catch(e => { console.error(e); process.exit(1) })
