/** Formatierungen wie im Web (de-DE). */

/** Euro-Beträge: nur im Partnerprogramm (Provisionen) erlaubt. */
export function euros(cents: number) {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fullDate(iso: string) {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** Wie submissions/page.tsx: heute Uhrzeit, gestern „Gestern“, sonst Wochentag/Datum. */
export function smartTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(d);
  }
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return 'Gestern';
  const diffDays = (now.getTime() - d.getTime()) / 86400000;
  if (diffDays < 7) return new Intl.DateTimeFormat('de-DE', { weekday: 'long' }).format(d);
  if (now.getFullYear() === d.getFullYear()) {
    return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' }).format(d);
  }
  return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

/** Chat-Zeit wie SupportChat.formatTime */
export function chatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  if (d.toDateString() === now.toDateString()) return `${hh}:${mm}`;
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}. ${hh}:${mm}`;
}

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

/** Titel eines Support-Gesprächs wie convTitle() im Web (support/page.tsx). */
export function chatTitle(subject: string | null, createdAt: string) {
  if (subject) return subject;
  const d = new Date(createdAt);
  return `Gespräch vom ${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

/** Uhrzeit in der Gesprächsliste wie formatTime() im Web: heute „HH:MM“, sonst „T.M. HH:MM“. */
export function supportTime(iso: string) {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (d.toDateString() === new Date().toDateString()) return `${hh}:${mm}`;
  return `${d.getDate()}.${d.getMonth() + 1}. ${hh}:${mm}`;
}

/** Begrüßung nach Uhrzeit wie sites/page.tsx */
export function greeting(name: string | null | undefined, hour = new Date().getHours()) {
  const time =
    hour >= 5 && hour < 11 ? 'Guten Morgen' : hour >= 11 && hour < 18 ? 'Guten Tag' : hour >= 18 && hour < 23 ? 'Guten Abend' : 'Hallo';
  return name ? `${time}, ${name}` : time;
}

export function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}
