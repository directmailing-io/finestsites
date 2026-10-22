/**
 * Besucher-Chat: Zeiten, Tag-Trenner, Vorschau und Avatar-Farbe (Gefühl wie WhatsApp, Werte aus den Tokens).
 */
import type { ChatConversation, ChatMessage, ChatVisitor } from '@/api/types';
import { avatarColor } from '@/features/inbox/helpers';

/** Stabile Farbe je Besucher: Hash aus Initialen + Anzeigename (ändert sich nicht zwischen Liste und Gespräch). */
export function visitorColor(v: Pick<ChatVisitor, 'initials' | 'displayName'>) {
  return avatarColor(`${v.initials}:${v.displayName}`);
}

const pad = (n: number) => String(n).padStart(2, '0');

export function hhmm(iso: string) {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayDiff(d: Date, now: Date) {
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((b - a) / 86400000);
}

/** Liste: heute → HH:mm, gestern → „Gestern“, sonst dd.MM. */
export function listTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (sameDay(d, now)) return hhmm(iso);
  const diff = dayDiff(d, now);
  if (diff === 1) return 'Gestern';
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`;
}

/** Tag-Trenner im Verlauf: Heute, Gestern, Wochentag (bis 6 Tage), sonst „14. Oktober 2026“. */
export function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const diff = dayDiff(d, now);
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Gestern';
  if (diff > 1 && diff < 7) return new Intl.DateTimeFormat('de-DE', { weekday: 'long' }).format(d);
  return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

/** „online“ oder „zuletzt online heute um 14:02 / gestern / am 12.10.“ */
export function presenceText(v: Pick<ChatVisitor, 'online' | 'lastSeenAt'>, now = new Date()): string {
  if (v.online) return 'online';
  if (!v.lastSeenAt) return 'zuletzt online unbekannt';
  const d = new Date(v.lastSeenAt);
  if (sameDay(d, now)) return `zuletzt online heute um ${hhmm(v.lastSeenAt)}`;
  const diff = dayDiff(d, now);
  if (diff === 1) return `zuletzt online gestern um ${hhmm(v.lastSeenAt)}`;
  return `zuletzt online am ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`;
}

/** Vorschau in der Liste: eigene Nachricht mit „Du: “, Zeilenumbrüche weg. */
export function previewOf(c: ChatConversation): string {
  const m = c.lastMessage;
  if (!m) return 'Noch keine Nachricht';
  const text = m.preview.replace(/\s*\n\s*/g, ' ').trim();
  return m.sender === 'owner' ? `Du: ${text}` : text;
}

/** Adresse der Seite, auf der der Besucher den Chat begonnen hat. */
export function startedOnUrl(c: Pick<ChatConversation, 'siteHost' | 'startedOnPath'>): string {
  const path = c.startedOnPath && c.startedOnPath.startsWith('/') ? c.startedOnPath : '';
  return `https://${c.siteHost}${path}`;
}

export type ThreadItem =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'msg'; key: string; m: ChatMessage; /** letzte Blase einer Folge vom selben Absender (bekommt die Ecke) */ tail: boolean; /** Folge-Blase (kleiner Abstand) */ follow: boolean };

/** Verlauf (älteste zuerst) → Zeilen mit Tag-Trennern, älteste zuerst. */
export function buildThreadItems(messages: ChatMessage[], now = new Date()): ThreadItem[] {
  const items: ThreadItem[] = [];
  let lastDay = '';
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const d = new Date(m.createdAt);
    const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (dayKey !== lastDay) {
      items.push({ kind: 'day', key: `day-${dayKey}`, label: dayLabel(m.createdAt, now) });
      lastDay = dayKey;
    }
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const sameDayAsPrev = !!prev && sameDay(new Date(prev.createdAt), d);
    const sameDayAsNext = !!next && sameDay(new Date(next.createdAt), d);
    items.push({
      kind: 'msg',
      key: m.id,
      m,
      follow: !!prev && prev.sender === m.sender && sameDayAsPrev,
      tail: !next || next.sender !== m.sender || !sameDayAsNext,
    });
  }
  return items;
}

/** Telefonnummer für tel:/wa.me (nur Ziffern und führendes +). */
export function dialable(phone: string | null): string | null {
  if (!phone) return null;
  let raw = phone.replace(/[^\d+]/g, '');
  if (raw.startsWith('00')) raw = `+${raw.slice(2)}`;
  return raw.length >= 6 ? raw : null;
}
