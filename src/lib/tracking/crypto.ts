import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

/**
 * Zugriffstoken (Meta, TikTok) liegen verschlüsselt in der Datenbank.
 * AES-256-GCM; Schlüssel aus TRACKING_SECRET (Fallback BETTER_AUTH_SECRET).
 * Format: base64(iv) . base64(tag) . base64(ciphertext)
 */
function key(): Buffer {
  const secret = process.env.TRACKING_SECRET || process.env.BETTER_AUTH_SECRET
  if (!secret) throw new Error('TRACKING_SECRET fehlt')
  return createHash('sha256').update(secret).digest()
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), enc].map(b => b.toString('base64')).join('.')
}

export function decryptSecret(stored: string): string {
  const [iv, tag, enc] = stored.split('.').map(p => Buffer.from(p, 'base64'))
  const decipher = createDecipheriv('aes-256-gcm', key(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}
