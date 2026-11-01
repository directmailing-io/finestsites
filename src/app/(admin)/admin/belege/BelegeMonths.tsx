'use client'

import { useEffect, useState } from 'react'
import type { MonthDocs } from '@/lib/admin/belege'

const LINE = '#ECEEF2'
const MUTED = '#8A94A6'
const eur = (c: number) => (c / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
const day = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' })
const label = (m: string) => {
  const [y, mo] = m.split('-').map(Number)
  return new Date(Date.UTC(y, mo - 1, 15)).toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** Monatsliste: aufklappen lädt die Belege live (Stripe + DB), „ZIP“ lädt alles für die Steuerberatung. */
export default function BelegeMonths({ months }: { months: string[] }) {
  // Vormonat offen – das ist der Monat, den man gerade abschließt
  const [open, setOpen] = useState<string | null>(months[1] ?? months[0] ?? null)
  return (
    <div className="flex flex-col gap-3">
      {months.map(m => (
        <MonthCard key={m} month={m} open={open === m} onToggle={() => setOpen(o => (o === m ? null : m))} current={m === months[0]} />
      ))}
    </div>
  )
}

function MonthCard({ month, open, onToggle, current }: { month: string; open: boolean; onToggle: () => void; current: boolean }) {
  const [data, setData] = useState<MonthDocs | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [zipping, setZipping] = useState(false)

  // Erst beim Aufklappen laden (Stripe-Abfragen), danach im Speicher behalten
  useEffect(() => {
    if (!open || data) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true); setError('')
    fetch(`/api/admin/belege?month=${month}`)
      .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? 'Fehler'); if (!cancelled) setData(j) })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Fehler') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, data, month])

  async function downloadZip() {
    setZipping(true)
    try {
      const r = await fetch(`/api/admin/belege/zip?month=${month}`)
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Download fehlgeschlagen')
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `FinestSites-Belege-${month}.zip`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Download fehlgeschlagen')
    } finally { setZipping(false) }
  }

  const t = data?.totals
  return (
    <section className="rounded-[20px] bg-white" style={{ border: `1px solid ${LINE}` }}>
      <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2.5" strokeLinecap="round"
            style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }}><path d="m9 6 6 6-6 6" /></svg>
          <span className="text-[16px] font-semibold text-gray-900">{label(month)}</span>
          {current && <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: '#F3F4F6', color: '#4B5563' }}>läuft noch</span>}
        </button>
        <button type="button" onClick={downloadZip} disabled={zipping}
          className="inline-flex h-9 flex-shrink-0 items-center gap-2 rounded-full px-4 text-[13px] font-semibold text-white disabled:opacity-60"
          style={{ background: '#111827' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4M4 19h16" /></svg>
          {zipping ? 'Wird gepackt …' : 'ZIP'}
        </button>
      </div>

      {open && (
        <div className="border-t px-4 pb-5 pt-4 sm:px-5" style={{ borderColor: LINE }}>
          {loading && <p className="text-sm" style={{ color: MUTED }}>Lade Belege aus Stripe …</p>}
          {error && <p className="text-sm" style={{ color: '#B91C1C' }}>{error}</p>}
          {data && t && (
            <>
              <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <Kpi label="Einnahmen brutto" value={eur(t.invoiceGross)} sub={`netto ${eur(t.invoiceNet)} · USt ${eur(t.invoiceTax)}`} />
                <Kpi label="Gutschriften" value={eur(t.creditGross)} sub={`Vorsteuer ${eur(t.creditVat)}`} />
                <Kpi label="Stripe-Gebühren" value={eur(t.stripeFees)} sub="Gebührenrechnung im Stripe-Dashboard" />
                <Kpi label="Auf dein Konto" value={eur(t.payoutTotal)} sub={`${data.payouts.length} Stripe-Auszahlung${data.payouts.length === 1 ? '' : 'en'}`} />
              </div>

              <Group title="Rechnungen" count={data.invoices.length} hint="nach Zahlungseingang">
                {data.invoices.map(i => (
                  <Row key={i.id} left={i.number} sub={`${day(i.paidAt)} · ${i.customerName || i.customerEmail || ''}`} amount={eur(i.grossCents)}
                    href={i.pdfUrl ?? i.hostedUrl ?? undefined} />
                ))}
              </Group>

              <Group title="Gutschriften" count={data.creditNotes.length} hint="an Partner">
                {data.creditNotes.map(c => (
                  <Row key={c.id} left={c.number} sub={`${c.date.split('-').reverse().slice(0, 2).join('.')} · ${c.partner} · ${c.method === 'credit' ? 'mit Abo verrechnet' : 'überwiesen'}`}
                    amount={eur(c.grossCents)} href={`/api/affiliate/credit-notes/${c.id}`} />
                ))}
              </Group>

              <Group title="Stripe-Auszahlungen" count={data.payouts.length} hint="Geldtransit, keine Einnahme · Aufschlüsselung im ZIP">
                {data.payouts.map(p => (
                  <Row key={p.id} left={day(p.arrivalDate)} sub={p.id} amount={eur(p.amountCents)} />
                ))}
              </Group>
            </>
          )}
        </div>
      )}
    </section>
  )
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl px-3.5 py-3" style={{ background: '#F8F9FB' }}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: MUTED }}>{label}</div>
      <div className="mt-1 text-[18px] font-bold tabular-nums text-gray-900">{value}</div>
      <div className="mt-0.5 text-[11px] leading-snug" style={{ color: '#A3ACBA' }}>{sub}</div>
    </div>
  )
}

function Group({ title, count, hint, children }: { title: string; count: number; hint: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-baseline gap-2">
        <span className="text-[13px] font-semibold text-gray-900">{title}</span>
        <span className="text-[12px] tabular-nums" style={{ color: MUTED }}>{count}</span>
        <span className="text-[12px]" style={{ color: '#B6BDC9' }}>· {hint}</span>
      </div>
      {count === 0
        ? <p className="text-[13px]" style={{ color: '#B6BDC9' }}>Keine in diesem Monat.</p>
        : <div className="divide-y rounded-xl" style={{ border: `1px solid ${LINE}`, borderColor: LINE }}>{children}</div>}
    </div>
  )
}

function Row({ left, sub, amount, href }: { left: string; sub: string; amount: string; href?: string }) {
  const inner = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-gray-900">{left}</span>
        <span className="block truncate text-[12px]" style={{ color: MUTED }}>{sub}</span>
      </span>
      <span className="text-[13px] font-semibold tabular-nums text-gray-900">{amount}</span>
      {href && <span className="text-[12px] font-semibold" style={{ color: '#111827' }}>PDF</span>}
    </>
  )
  return href
    ? <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-gray-50" style={{ borderColor: LINE }}>{inner}</a>
    : <div className="flex items-center gap-3 px-3.5 py-2.5" style={{ borderColor: LINE }}>{inner}</div>
}
