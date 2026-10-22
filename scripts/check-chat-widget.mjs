#!/usr/bin/env node
/**
 * Prüft das Besucher-Chat-Widget (public/chat-widget/v1.js), bevor es ausgeliefert wird:
 *  - Syntax (Node vm, Script wird nur kompiliert, nicht ausgeführt)
 *  - Größe ≤ 64 kB (unminifiziert, Konzept docs/chat/konzept.md; seit 22.10.2026 abends mit Gesprächs-Code 64 statt 60)
 *  - keine http://-URLs, keine externen Hosts (kein CDN, keine Schriften), kein eval/new Function
 * Aufruf: node scripts/check-chat-widget.mjs  (npm run check:chat-widget)
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import vm from 'node:vm'

const here = dirname(fileURLToPath(import.meta.url))
const file = resolve(here, '../public/chat-widget/v1.js')
const MAX_BYTES = 64 * 1024
const errors = []

const src = readFileSync(file, 'utf8')
const bytes = Buffer.byteLength(src, 'utf8')

// 1. Syntax
try {
  new vm.Script(src, { filename: 'v1.js' })
} catch (err) {
  errors.push(`Syntaxfehler: ${err.message}`)
}

// 2. Größe
if (bytes > MAX_BYTES) errors.push(`Zu groß: ${bytes} Bytes (max. ${MAX_BYTES})`)

// 3. Keine unsicheren URLs / externen Hosts
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
if (/http:\/\//i.test(code)) errors.push('Enthält http://-URL')
const hosts = [...code.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map(m => m[1].toLowerCase())
for (const h of hosts) errors.push(`Externer Host: ${h}`)
if (/\b(?:import|fetch)\s*\(\s*['"`]\/\//.test(code) || /src\s*=\s*['"`]\/\//.test(code)) errors.push('Protokoll-relative externe Adresse')
if (/<link\b/i.test(code) || /@import\b/.test(code) || /@font-face\b/.test(code)) errors.push('Lädt Stylesheet/Schrift nach')

// 4. Kein eval
if (/\beval\s*\(/.test(code)) errors.push('Enthält eval(')
if (/new\s+Function\s*\(/.test(code)) errors.push('Enthält new Function(')
if (/\bimportScripts\s*\(/.test(code)) errors.push('Enthält importScripts(')

// 5. Grundform: IIFE, nur same-origin-API, Shadow DOM
if (!code.includes("'/.finestsites/chat/'")) errors.push('API-Präfix /.finestsites/chat/ fehlt')
if (!code.includes('attachShadow')) errors.push('Kein Shadow DOM')

if (errors.length) {
  console.error(`check-chat-widget: FEHLER (${file})`)
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}
console.log(`check-chat-widget: ok (${bytes} Bytes, ${(bytes / 1024).toFixed(1)} kB von 64 kB)`)
