// Erzeugt einen Passwort-Hash genau so, wie BetterAuth ihn speichert
// (accounts.password, Format "salt:hash", scrypt aus @better-auth/utils).
//
//   node scripts/local-testenv/hash-password.mjs 'Test1234!'
//
// Wird nur gebraucht, wenn das Testpasswort geändert werden soll; der Hash
// für Test1234! steht fest in anonymize.sql und seed-test-accounts.sql.
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const pw = process.argv[2]
if (!pw) {
  console.error('Aufruf: node scripts/local-testenv/hash-password.mjs <passwort>')
  process.exit(1)
}

// better-auth aus dem Projekt (oder FS_NODE_MODULES) auflösen
const base = process.env.FS_NODE_MODULES
  ? path.join(process.env.FS_NODE_MODULES, '..', 'package.json')
  : path.join(process.cwd(), 'package.json')
const require = createRequire(base)
const ba = require.resolve('better-auth/crypto')
const { hashPassword, verifyPassword } = await import(pathToFileURL(ba).href)

const hash = await hashPassword(pw)
if (!(await verifyPassword({ hash, password: pw }))) throw new Error('Selbsttest fehlgeschlagen')
console.log(hash)
