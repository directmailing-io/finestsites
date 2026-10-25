/**
 * Lädt eine gebaute Template-HTML nach R2 – mit Abgleich gegen die bisherige Fassung (R2 ist die Quelle,
 * siehe Memory „R2 = Source of Truth“). Ohne --go nur Vergleich.
 *
 * App-Server: node --env-file=.env.production --import tsx scripts/r2-template-upload.ts <templateId> <lokale index.html> [--expect <alte index.html>] [--go]
 *  --expect: Datei, der die aktuelle R2-Fassung entsprechen muss (z. B. index.html aus dem vorherigen Commit).
 *            Weicht R2 davon ab (jemand hat zwischendurch hochgeladen), wird abgebrochen.
 */
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { getFromR2, uploadToR2 } from '@/lib/r2/client'

const [templateId, file] = process.argv.slice(2)
const argv = process.argv.slice(4)
const go = argv.includes('--go')
const expectIdx = argv.indexOf('--expect')
const expectFile = expectIdx > -1 ? argv[expectIdx + 1] : null
if (!templateId || !file) { console.error('usage: r2-template-upload.ts <templateId> <file> [--expect old.html] [--go]'); process.exit(1) }

const sha = (t: string) => createHash('sha256').update(t).digest('hex').slice(0, 12)
const key = `templates/${templateId}/index.html`

async function main() {
  const next = fs.readFileSync(file, 'utf8')
  const current = await getFromR2(key)
  console.log(`R2 ${key}: ${current.length} Zeichen, sha ${sha(current)}`)
  console.log(`neu: ${next.length} Zeichen, sha ${sha(next)}`)
  if (expectFile) {
    const expected = fs.readFileSync(expectFile, 'utf8')
    if (sha(expected) !== sha(current)) {
      console.error(`ABBRUCH: R2 entspricht nicht ${expectFile} (sha ${sha(expected)}). Erst klären, was dort liegt.`)
      process.exit(2)
    }
    console.log('R2 entspricht der erwarteten alten Fassung ✓')
  }
  if (sha(current) === sha(next)) { console.log('Identisch, nichts zu tun'); return }
  if (!go) { console.log('Trockenlauf (ohne --go)'); return }
  await uploadToR2(key, next, 'text/html; charset=utf-8')
  const check = await getFromR2(key)
  console.log(sha(check) === sha(next) ? 'Hochgeladen und geprüft ✓' : 'WARNUNG: R2-Inhalt weicht nach Upload ab')
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
