/**
 * Bereinigt veröffentlichte Kundentexte (about_me_html / intro / bio) mit Krankheits-/
 * Symptombegriffen minimal-invasiv über die strenge KI-Prüfung (nur beanstandete Sätze
 * werden umformuliert, alles andere bleibt zeichengenau).
 *
 *   npx tsx scripts/remediate-compliance-texts.ts --dry      → zeigt Vorher/Nachher, schreibt nichts
 *   npx tsx scripts/remediate-compliance-texts.ts --apply    → schreibt: Backup in <key>__backup_20261008,
 *                                                              neuer Text, Freigabe (__chk/__chkbase),
 *                                                              EN-Übersetzung, KV-Purge des Hosts
 * Nur auf dem App-Server (Prod-DB, OPENAI_API_KEY, WORKER_SECRET).
 */
import fs from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'
import { checkCompliance, findBlockedTerms } from '../src/lib/compliance/check'

for (const file of ['.env.production', '.env.local']) {
  const p = path.resolve(process.cwd(), file)
  if (!fs.existsSync(p)) continue
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1')
  }
}
const APPLY = process.argv.includes('--apply')
const ONLY = (() => { const i = process.argv.indexOf('--site'); return i > -1 ? process.argv[i + 1] : null })()
const BACKUP_SUFFIX = '__backup_20261008'
const KEYS = ['about_me_html', 'intro', 'bio']
const OUT = path.resolve(process.cwd(), 'scratch-remediation-' + (APPLY ? 'apply' : 'dry') + '.txt')
fs.writeFileSync(OUT, '')

/** Zusatzregeln für die Bereinigung bestehender Kundentexte: so wenig wie möglich ändern, nichts erfinden. */
const REMEDIATION_RULES = `═══ SONDERMODUS: BEREINIGUNG BESTEHENDER TEXTE ═══
Du bereinigst einen bereits veröffentlichten Text eines echten Menschen. Oberstes Ziel: so wenig wie möglich ändern, nichts hinzuerfinden.
A. STREICHEN STATT ERSETZEN: Entferne Krankheiten, Symptome, Diagnosen, Therapien, Medikamente, Ärzte und Beschwerden ersatzlos – als Wort, Aufzählungspunkt, Teilsatz oder ganzen Satz. Erfinde KEINE neue Motivation (also NICHT "Ich war auf der Suche nach einer einfachen Routine" o. ä. einfügen). Nur wenn ein Satz ohne die Streichung keinen Sinn mehr ergibt, kürze ihn auf das, was der Mensch sonst noch gesagt hat (z. B. "Ich hatte Migräne und wollte etwas verändern" → "Ich wollte etwas verändern").
B. BEZÜGE PRÜFEN: Wenn du einen Satz streichst, auf den ein folgender Satz verweist ("Das hat …", "Dieser Satz …", "Diese Zeit …", "Dazu kam …"), passe den Folgesatz an oder streiche ihn mit, damit nichts ins Leere zeigt. Lies den Vorschlag am Ende einmal als Ganzes: Jeder Satz muss sich auf etwas beziehen, das noch im Text steht.
C. STIMME BEHALTEN: Emojis, Anrede, Absätze, Rechtschreibung, Ortsangaben, Jahreszahlen, Berufe, Familie, alles Persönliche ohne Gesundheitsbezug bleibt zeichengenau stehen. Keine Glättung, kein neuer Ton.
D. GEWICHT: Kommt im Text ein Produkt/Konzept vor (Optimalset, FitLine, cellRESET, Stoffwechselkur, Kur, Produkte), entferne konkrete Kilo-/kg-Zahlen und die Wörter "abgenommen"/"Kilo"/"kg"/"Gewicht verloren" vollständig. Erlaubt sind Formulierungen wie "ich fühle mich leichter", "ich habe einen Weg gefunden, der zu mir passt", "mein Wohlfühlgewicht". Gilt auch für Dritte ("ein Freund hatte 20 kg abgenommen").
E. ERLAUBT BLEIBT: müde, erschöpft (ohne "Erschöpfung"/"Burnout"), antriebslos, wenig Energie, schlecht geschlafen (ohne "Schlafstörung/-probleme"), "fühle mich wohler", "schlafe besser", "mehr Energie" – solange kein Kausalwort zum Produkt im selben Satz steht. Diese Stellen NICHT anfassen.
F. HTML: Tags, Absätze (<p>, <br>) und Formatierungen wie im Original lassen; nur Textinhalt ändern.`

type Row = { site_id: string; username: string; domain: string; custom_domain: string | null; custom_domain_status: string | null; field_key: string; field_value: string }

async function main() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY fehlt')
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1, connect_timeout: 8 })
  const rows = await sql<Row[]>`
    select s.id as site_id, u.username, t.domain, s.custom_domain, s.custom_domain_status, d.field_key, d.field_value
    from site_data d
    join user_sites s on s.id = d.user_site_id
    join users u on u.id = s.user_id
    join templates t on t.id = s.template_id
    where s.status = 'published' and d.field_key = any(${KEYS}) and coalesce(d.field_value, '') <> ''
      and not exists (select 1 from site_data b where b.user_site_id = s.id and b.field_key = d.field_key || ${BACKUP_SUFFIX})
    order by u.username, t.domain`
  const affected = rows.filter(r => findBlockedTerms(r.field_value).length > 0 && (!ONLY || r.username === ONLY))
  console.log(`${affected.length} Text(e) mit Sperrbegriffen (${rows.length} geprüft)`)

  let done = 0, failed = 0
  for (const r of affected) {
    const host = r.custom_domain_status === 'active' && r.custom_domain ? r.custom_domain : `${r.username}.${r.domain}`
    const before = findBlockedTerms(r.field_value).map(b => b.reason.split(':')[0]).join(', ')
    let result = await checkCompliance(r.field_value, '', apiKey, REMEDIATION_RULES)
    let suggestion = result.ok ? '' : result.suggested_html
    // zweite Runde, falls der Vorschlag noch Sperrbegriffe enthält
    if (suggestion && findBlockedTerms(suggestion).length) {
      const again = await checkCompliance(suggestion, '', apiKey, REMEDIATION_RULES + '\n\nDer Text enthält weiterhin gesperrte Begriffe (' + findBlockedTerms(suggestion).map(b => b.quote).join(' | ') + '). Entferne genau diese Stellen vollständig.')
      if (!again.ok && again.suggested_html) suggestion = again.suggested_html
    }
    if (suggestion) { fs.appendFileSync(OUT, `\n\n==== ${host} · ${r.field_key}\n--- VORHER\n${r.field_value}\n--- NACHHER\n${suggestion}\n`) }
    const stillBlocked = suggestion ? findBlockedTerms(suggestion) : [{ quote: '', reason: 'kein Vorschlag' }]
    console.log(`\n── ${host} · ${r.field_key} · gefunden: ${before}`)
    console.log('VORHER : ' + r.field_value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500))
    console.log('NACHHER: ' + (suggestion ? suggestion.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500) : '(leer)'))
    if (stillBlocked.length) { failed++; console.log(`   ✗ nicht automatisch lösbar (${stillBlocked.map(b => b.reason.split(':')[0]).join(', ')}) – manuell prüfen`); continue }
    if (!APPLY) { console.log('   (dry) würde übernommen'); continue }
    await sql.begin(async tx => {
      await tx`insert into site_data (user_site_id, field_key, field_value) values (${r.site_id}, ${r.field_key + BACKUP_SUFFIX}, ${r.field_value})`
      await tx`update site_data set field_value = ${suggestion}, updated_at = now() where user_site_id = ${r.site_id} and field_key = ${r.field_key}`
      for (const k of [r.field_key + '__chk', r.field_key + '__chkbase']) {
        await tx`insert into site_data (user_site_id, field_key, field_value) values (${r.site_id}, ${k}, ${suggestion})
                 on conflict (user_site_id, field_key) do update set field_value = excluded.field_value, updated_at = now()`
      }
      // Übersetzung invalidieren: der _en-Text wird beim nächsten Rendern/Publish neu erzeugt;
      // bis dahin zeigt die EN-Ansicht den deutschen (bereinigten) Text statt einer belasteten Übersetzung
      await tx`delete from site_data where user_site_id = ${r.site_id} and field_key in (${r.field_key + '_en'}, ${r.field_key + '_en_src'})`
    })
    // EN neu übersetzen (nutzt dieselbe Logik wie der Editor)
    try {
      const { ensureAboutMeTranslation } = await import('../src/lib/utils/translate')
      await ensureAboutMeTranslation(r.site_id)
      console.log('   ✓ übernommen + übersetzt')
    } catch (e) { console.log('   ✓ übernommen (Übersetzung folgt beim nächsten Veröffentlichen: ' + (e instanceof Error ? e.message.slice(0, 80) : e) + ')') }
    // Seite neu rendern lassen
    const secret = process.env.WORKER_SECRET
    if (secret) {
      const res = await fetch(`https://${host}/.finestsites/kv`, { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, body: '{"action":"purge"}' }).catch(() => null)
      console.log(`   purge ${host} → ${res ? res.status : 'fehlgeschlagen'}`)
    }
    done++
  }
  await sql.end()
  console.log(`\nfertig: ${done} übernommen, ${failed} manuell, Modus ${APPLY ? 'APPLY' : 'DRY'}`)
}
main().catch(e => { console.error(e); process.exit(1) })
