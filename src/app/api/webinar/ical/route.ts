import { NextResponse } from 'next/server'

export const dynamic = 'force-static'

export async function GET() {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FinestSites//Webinar//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'DTSTART:20260721T180000Z',
    'DTEND:20260721T183000Z',
    'SUMMARY:FinestSites PreLaunch Call',
    'DESCRIPTION:Exklusiver Live-Call nur für ausgewählte Teams.\\n\\nZoom Link: https://us06web.zoom.us/j/8811338936?pwd=TktDYUNZYWY3eFZXbkdGSlQrV0pmdz09\\nMeeting-ID: 881 133 8936\\nKenncode: 100',
    'LOCATION:Zoom (online)',
    'URL:https://us06web.zoom.us/j/8811338936?pwd=TktDYUNZYWY3eFZXbkdGSlQrV0pmdz09',
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:FinestSites PreLaunch Call startet in 15 Minuten!',
    'TRIGGER:-PT15M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="finestsites-webinar.ics"',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
