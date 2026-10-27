/**
 * Schreibt das Platzhalter-Schema eines Templates aus dem Repo in die Datenbank (templates.placeholder_schema),
 * mit Abgleich gegen die bisherige Fassung: Weicht die DB von --expect ab (jemand hat zwischendurch im Admin
 * gespeichert), wird abgebrochen. Ohne --go nur Vergleich.
 *
 * App-Server: node --env-file=.env.production --import tsx scripts/template-schema-upload.ts <templateId> <schema.json> [--expect alt.json] [--go]
 */
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { templates } from '@/lib/db/schema'

const [templateId, file] = process.argv.slice(2)
const argv = process.argv.slice(4)
const go = argv.includes('--go')
const expectIdx = argv.indexOf('--expect')
const expectFile = expectIdx > -1 ? argv[expectIdx + 1] : null
if (!templateId || !file) { console.error('usage: template-schema-upload.ts <templateId> <schema.json> [--expect old.json] [--go]'); process.exit(1) }

// Vergleich über kanonisches JSON (Schlüssel sortiert), damit Formatierung keine Rolle spielt
const canon = (v: unknown): string => JSON.stringify(sortKeys(v))
function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys)
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v as object).sort().map(k => [k, sortKeys((v as Record<string, unknown>)[k])]))
  return v
}
const sha = (v: unknown) => createHash('sha256').update(canon(v)).digest('hex').slice(0, 12)

async function main() {
  const next = JSON.parse(fs.readFileSync(file, 'utf8')) as { fields?: Array<{ key?: string }> }
  const row = await db.query.templates.findFirst({ where: eq(templates.id, templateId), columns: { title: true, placeholderSchema: true } })
  if (!row) throw new Error('Template nicht gefunden: ' + templateId)
  type SchemaLike = { fields?: Array<{ key?: string }> }
  const current = row.placeholderSchema as SchemaLike
  const keys = (o: SchemaLike) => (o.fields ?? []).map(f => f.key)
  console.log(`DB „${row.title}“: ${keys(current).length} Felder, sha ${sha(current)}`)
  console.log(`neu: ${keys(next).length} Felder, sha ${sha(next)}`)
  if (expectFile) {
    const expected = JSON.parse(fs.readFileSync(expectFile, 'utf8'))
    if (sha(expected) !== sha(current)) {
      console.error(`ABBRUCH: DB entspricht nicht ${expectFile} (sha ${sha(expected)}). Erst klären, was dort liegt.`)
      process.exit(2)
    }
    console.log('DB entspricht der erwarteten alten Fassung ✓')
  }
  const added = keys(next).filter(k => !keys(current).includes(k)), removed = keys(current).filter(k => !keys(next).includes(k))
  console.log(`Felder neu: ${added.join(', ') || '–'} | entfernt: ${removed.join(', ') || '–'}`)
  if (sha(current) === sha(next)) { console.log('Identisch, nichts zu tun'); return }
  if (!go) { console.log('Trockenlauf (ohne --go)'); return }
  await db.update(templates).set({ placeholderSchema: next, updatedAt: new Date() }).where(eq(templates.id, templateId))
  const check = await db.query.templates.findFirst({ where: eq(templates.id, templateId), columns: { placeholderSchema: true } })
  console.log(sha(check?.placeholderSchema) === sha(next) ? 'Gespeichert und geprüft ✓' : 'WARNUNG: DB-Inhalt weicht nach dem Speichern ab')
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
