/**
 * Nachtruhe (Standard 21–8 Uhr Ortszeit). Reine Funktionen, getestet in scripts/app-api-contract-test.ts.
 */

export type QuietHours = { enabled: boolean; start: number; end: number; timezone: string }

export const DEFAULT_QUIET_HOURS: QuietHours = { enabled: true, start: 21, end: 8, timezone: 'Europe/Berlin' }

function localHourMinute(date: Date, timezone: string): { h: number; m: number } {
  let tz = timezone
  try { new Intl.DateTimeFormat('en-GB', { timeZone: tz }) } catch { tz = DEFAULT_QUIET_HOURS.timezone }
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date)
  const h = Number(parts.find(p => p.type === 'hour')?.value ?? '0') % 24
  const m = Number(parts.find(p => p.type === 'minute')?.value ?? '0')
  return { h, m }
}

export function isInQuietHours(date: Date, q: QuietHours): boolean {
  if (!q.enabled || q.start === q.end) return false
  const { h } = localHourMinute(date, q.timezone)
  return q.start > q.end ? (h >= q.start || h < q.end) : (h >= q.start && h < q.end)
}

/** Frühester Zeitpunkt nach der Nachtruhe (bei „nicht in der Nachtruhe“: date selbst). */
export function nextAllowedTime(date: Date, q: QuietHours): Date {
  if (!isInQuietHours(date, q)) return date
  const { h, m } = localHourMinute(date, q.timezone)
  const nowMin = h * 60 + m
  const delta = ((q.end * 60 - nowMin) + 1440) % 1440 || 1440
  const t = new Date(date.getTime() + delta * 60_000)
  t.setSeconds(0, 0)
  return t
}
