/**
 * 1:1 aus src/app/(dashboard)/submissions/page.tsx übernommen (Namen, Vorschau, Feld-Labels,
 * Telefon-Zusammenführung), plus Kontaktwege für die App (Anrufen, WhatsApp, E-Mail).
 */

export const AVATAR_PALETTE = [
  { bg: '#FFE5D9', fg: '#9A3412' },
  { bg: '#FFE4E6', fg: '#9F1239' },
  { bg: '#E0E7FF', fg: '#3730A3' },
  { bg: '#D1FAE5', fg: '#065F46' },
  { bg: '#FEF3C7', fg: '#854D0E' },
  { bg: '#DBEAFE', fg: '#1E3A8A' },
  { bg: '#F3E8FF', fg: '#6B21A8' },
  { bg: '#CFFAFE', fg: '#155E75' },
];

export function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffffffff;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

const NAME_KEYS = ['name', 'Name', 'vorname', 'Vorname', 'firstname', 'fullname', 'kontakt_name'];

export function displayName(data: Record<string, unknown>): string {
  for (const k of NAME_KEYS) {
    const v = typeof data[k] === 'string' ? (data[k] as string) : null;
    if (v?.trim()) return v.trim();
  }
  const email = findEmail(data);
  if (email) return email.split('@')[0];
  for (const v of Object.values(data)) {
    const s = typeof v === 'string' ? v : v != null ? String(v) : null;
    if (s?.trim()) return s.trim();
  }
  return 'Anonym';
}

export function initials(name: string): string {
  const parts = name.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function previewText(data: Record<string, unknown>): string {
  const skip = new Set(NAME_KEYS);
  return Object.entries(data)
    .filter(([k, v]) => !skip.has(k) && typeof v === 'string' && v.trim())
    .map(([, v]) => (v as string).trim())
    .join(' · ');
}

export function formLabel(name: string): string {
  if (!name) return '';
  return name
    .split(/[-_]+/)
    .map(p => (p[0]?.toUpperCase() ?? '') + p.slice(1))
    .join(' ');
}

const SPECIAL: Record<string, string> = {
  laendervorwahl: 'Ländervorwahl',
  vorwahl: 'Vorwahl',
  telefon: 'Telefon',
  tel: 'Telefon',
  kontakt_tel: 'Telefon',
  kontakt_telefon: 'Telefon',
  kontakt_telefonvorwahl: 'Vorwahl',
  kontakt_name: 'Name',
  kontakt_email: 'E-Mail',
  email: 'E-Mail',
  e_mail: 'E-Mail',
  name: 'Name',
  vorname: 'Vorname',
  nachname: 'Nachname',
  nachricht: 'Nachricht',
  message: 'Nachricht',
  kontaktweg: 'Bevorzugter Kontaktweg',
  ziele: 'Ziele',
  hintergrund: 'Hintergrund',
  alter: 'Alter',
  gewicht: 'Gewicht',
  darmtyp: 'Darmtyp',
  datenschutz: 'Datenschutz akzeptiert',
};

export function prettyKey(key: string): string {
  const lower = key.toLowerCase();
  if (SPECIAL[lower]) return SPECIAL[lower];
  return key
    .replace(/_/g, ' ')
    .split(' ')
    .map(w => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}

const PHONE_PAIRS: [string, string][] = [
  ['laendervorwahl', 'telefon'],
  ['kontakt_telefonvorwahl', 'kontakt_tel'],
  ['vorwahl', 'telefonnummer'],
  ['vorwahl', 'nummer'],
];
const PRIORITY = ['name', 'kontakt_name', 'email', 'e_mail', 'kontakt_email'];

export interface Field {
  key: string;
  label: string;
  value: string;
}

export function processFields(data: Record<string, unknown>): Field[] {
  const map: Record<string, string> = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, v != null ? String(v) : '']),
  );
  const merged: Field[] = [];
  const used = new Set<string>();
  for (const [prefixKey, numberKey] of PHONE_PAIRS) {
    if (map[prefixKey] && map[numberKey]) {
      const prefix = map[prefixKey].trim();
      const rawNumber = map[numberKey].trim();
      const number = rawNumber.replace(/^0+/, '');
      // Nummer bringt die Vorwahl schon mit (z. B. „+49 151 …“) → nicht doppelt voranstellen
      const combined = rawNumber.startsWith('+') || !prefix ? rawNumber : `${prefix.startsWith('+') ? prefix : '+' + prefix} ${number}`;
      merged.push({ key: numberKey, label: 'Telefon', value: combined });
      used.add(prefixKey);
      used.add(numberKey);
      break;
    }
  }
  const others: Field[] = [];
  for (const [k, v] of Object.entries(map)) {
    if (!used.has(k)) others.push({ key: k, label: prettyKey(k), value: v });
  }
  others.sort((a, b) => {
    const pa = PRIORITY.indexOf(a.key.toLowerCase());
    const pb = PRIORITY.indexOf(b.key.toLowerCase());
    if (pa !== -1 && pb !== -1) return pa - pb;
    if (pa !== -1) return -1;
    if (pb !== -1) return 1;
    return 0;
  });
  const result = [...others];
  if (merged.length > 0) {
    let insertAt = 0;
    for (let i = 0; i < result.length; i++) {
      if (PRIORITY.includes(result[i].key.toLowerCase())) insertAt = i + 1;
      else break;
    }
    result.splice(insertAt, 0, ...merged);
  }
  return result;
}

export function isLongValue(value: string) {
  return !!value && (value.includes('\n') || value.length > 60);
}

function findEmail(data: Record<string, unknown>): string | null {
  for (const k of ['email', 'Email', 'mail', 'e_mail', 'kontakt_email']) {
    const v = data[k];
    if (typeof v === 'string' && v.includes('@')) return v.trim();
  }
  return null;
}

/** Telefonnummer in internationalem Format für tel: und WhatsApp. */
export function findPhone(data: Record<string, unknown>): string | null {
  const field = processFields(data).find(f => f.label === 'Telefon' && f.value.trim());
  if (!field) return null;
  let raw = field.value.replace(/[^\d+]/g, '');
  if (!raw) return null;
  if (raw.startsWith('00')) raw = `+${raw.slice(2)}`;
  if (!raw.startsWith('+') && raw.startsWith('0')) raw = `+49${raw.slice(1)}`; // ohne Vorwahl: Deutschland annehmen
  return raw.length >= 7 ? raw : null;
}

export function contactInfo(data: Record<string, unknown>) {
  return { email: findEmail(data), phone: findPhone(data), name: displayName(data) };
}
