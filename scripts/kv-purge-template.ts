/**
 * Leert den Worker-KV-Cache für ALLE veröffentlichten Seiten eines Templates (nach einem R2-Upload der Template-HTML).
 * Hosts: <username>.<template-domain> und, falls gesetzt, die eigene Domain. Ein Aufruf je Host (so arbeitet der Worker).
 *
 * App-Server: node --env-file=.env.production --import tsx scripts/kv-purge-template.ts <templateId> [--dry]
 */
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { templates, userSites, users } from '@/lib/db/schema'

const templateId = process.argv[2]
const dry = process.argv.includes('--dry')
const secret = process.env.WORKER_SECRET
if (!templateId) { console.error('usage: kv-purge-template.ts <templateId> [--dry]'); process.exit(1) }
if (!secret && !dry) { console.error('WORKER_SECRET fehlt'); process.exit(1) }

async function main() {
  const tpl = await db.query.templates.findFirst({ where: eq(templates.id, templateId), columns: { domain: true, title: true } })
  if (!tpl) throw new Error('Template nicht gefunden')
  const rows = await db.select({ username: users.username, customDomain: userSites.customDomain, customStatus: userSites.customDomainStatus })
    .from(userSites).innerJoin(users, eq(users.id, userSites.userId))
    .where(and(eq(userSites.templateId, templateId), eq(userSites.status, 'published')))
  const hosts = new Set<string>()
  for (const r of rows) {
    if (r.username) hosts.add(`${r.username}.${tpl.domain}`)
    if (r.customDomain) hosts.add(r.customDomain)   // auch nicht aktive: schlägt dann nur fehl und wird gemeldet
  }
  console.log(`„${tpl.title}“: ${rows.length} veröffentlichte Seiten, ${hosts.size} Hosts`)
  if (dry) { console.log([...hosts].join('\n')); return }
  let ok = 0; const failed: string[] = []
  for (const host of hosts) {
    try {
      const res = await fetch(`https://${host}/.finestsites/kv`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
        body: JSON.stringify({ action: 'purge' }), signal: AbortSignal.timeout(10_000),
      })
      if (res.ok) ok++; else failed.push(`${host} (${res.status})`)
    } catch (e) { failed.push(`${host} (${(e as Error).name})`) }
  }
  console.log(`geleert: ${ok}/${hosts.size}` + (failed.length ? `\nfehlgeschlagen: ${failed.join(', ')}` : ''))
  // Neue Vorlagen-Fassung → Vorschaubilder der Karten neu aufnehmen (scripts/site-thumbnails.ts)
  await db.update(userSites).set({ thumbRequestedAt: new Date() })
    .where(and(eq(userSites.templateId, templateId), eq(userSites.status, 'published')))
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
