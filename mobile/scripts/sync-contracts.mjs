#!/usr/bin/env node
/**
 * Kopiert die Schnittstellen-Verträge des Servers (src/lib/contracts/app-v1/*.ts, nur zod)
 * nach mobile/src/api/contracts/. Die App kann nicht aus dem Projekt-Root importieren
 * (eigene package.json, Metro sieht nur mobile/), deshalb liegt hier eine 1:1-Kopie.
 *
 *   node scripts/sync-contracts.mjs          → kopieren
 *   node scripts/sync-contracts.mjs --check  → nur prüfen (Abweichung = Exit 1, z. B. in CI)
 *
 * Erlaubt sind in den Verträgen nur Importe von 'zod' und relative Importe untereinander;
 * alles andere bricht ab (sonst würde die App Server-Code mitziehen).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, '../../src/lib/contracts/app-v1');
const DEST = resolve(here, '../src/api/contracts');
const check = process.argv.includes('--check');

const HEADER =
  '// GENERIERT von mobile/scripts/sync-contracts.mjs aus src/lib/contracts/app-v1/ – NICHT BEARBEITEN.\n' +
  '// Änderungen immer im Server-Vertrag machen und danach `npm run sync:contracts` ausführen.\n';

if (!existsSync(SRC)) {
  console.error(`Verträge nicht gefunden: ${SRC}`);
  process.exit(1);
}

const files = readdirSync(SRC).filter(f => f.endsWith('.ts')).sort();
const expected = new Map();
for (const f of files) {
  const text = readFileSync(join(SRC, f), 'utf8');
  for (const m of text.matchAll(/^\s*(?:import|export)\s[^'"]*from\s+['"]([^'"]+)['"]/gm)) {
    const spec = m[1];
    if (spec !== 'zod' && !spec.startsWith('./')) {
      console.error(`${f}: unerlaubter Import '${spec}' (nur 'zod' und './…').`);
      process.exit(1);
    }
  }
  expected.set(f, HEADER + text);
}

if (check) {
  const problems = [];
  for (const [f, content] of expected) {
    const p = join(DEST, f);
    if (!existsSync(p)) problems.push(`fehlt: ${f}`);
    else if (readFileSync(p, 'utf8') !== content) problems.push(`veraltet: ${f}`);
  }
  if (existsSync(DEST)) {
    for (const f of readdirSync(DEST)) if (f.endsWith('.ts') && !expected.has(f)) problems.push(`überzählig: ${f}`);
  }
  if (problems.length) {
    console.error('Verträge der App sind nicht synchron:\n  ' + problems.join('\n  ') + '\n→ npm run sync:contracts');
    process.exit(1);
  }
  console.log(`Verträge synchron (${expected.size} Dateien).`);
  process.exit(0);
}

mkdirSync(DEST, { recursive: true });
for (const f of readdirSync(DEST)) if (f.endsWith('.ts') && !expected.has(f)) rmSync(join(DEST, f));
for (const [f, content] of expected) writeFileSync(join(DEST, f), content);
console.log(`${expected.size} Verträge nach src/api/contracts/ kopiert.`);
