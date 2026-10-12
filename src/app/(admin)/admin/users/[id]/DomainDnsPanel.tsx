'use client'

import { useState } from 'react'

/**
 * Admin-Ansicht der DNS-Vorgaben für eine eigene Domain: genau das, was der Nutzer im Editor
 * sieht (CNAME auf domains.finestsites.io, bei Apex-Domains www + Weiterleitung bzw. ALIAS),
 * plus Live-Abfrage, was aktuell im DNS des Kunden steht – für Support-Gespräche.
 */

const FALLBACK_HOST = 'domains.finestsites.io'

interface DnsRecordResult { name: string; cname: string[]; a: string[]; aaaa: string[]; ok: boolean }
interface CfInfo { status: string; ssl_status: string; errors: string[]; txt: { name: string; value: string } | null }
interface DnsCheck { host: string; is_apex: boolean; fallback_host: string; checked_at: string; records: DnsRecordResult[]; cloudflare: CfInfo | null }

export default function DomainDnsPanel({ domain, status }: { domain: string; status: string | null }) {
  const [open, setOpen] = useState(false)
  const [check, setCheck] = useState<DnsCheck | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const labels = domain.split('.')
  const isApex = labels.length === 2
  const hostPart = isApex ? 'www' : labels[0]

  async function runCheck() {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/admin/dns-check?host=${encodeURIComponent(domain)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Abfrage fehlgeschlagen')
      setCheck(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Abfrage fehlgeschlagen')
    } finally { setLoading(false) }
  }

  return (
    <div className="mt-1.5">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="text-[11px] font-medium flex items-center gap-1"
        style={{ color: '#6B7280' }}>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}><polyline points="9 18 15 12 9 6"/></svg>
        DNS-Einträge {status === 'active' ? '(verbunden)' : '(ausstehend)'}
      </button>

      {open && (
        <div className="mt-2 rounded-[10px] overflow-hidden text-[11px]" style={{ border: '1px solid #E5E7EB', background: '#fff' }}>
          <div className="grid font-semibold uppercase tracking-wider px-2.5 py-1.5"
            style={{ gridTemplateColumns: '90px 70px 1fr', background: '#F8FAFC', color: '#9CA3AF', borderBottom: '1px solid #E5E7EB', fontSize: 10 }}>
            <span>Typ</span><span>Name</span><span>Ziel</span>
          </div>
          <div className="grid px-2.5 py-2 gap-1 font-mono" style={{ gridTemplateColumns: '90px 70px 1fr', color: '#374151' }}>
            <span className="font-sans font-bold">CNAME</span><span>{hostPart}</span><span className="break-all">{FALLBACK_HOST}</span>
          </div>
          {isApex && (
            <div className="px-2.5 pb-2 font-sans" style={{ color: '#B45309' }}>
              Altbestand: Diese Domain ist noch als nackte Domain hinterlegt. Cloudflare prüft aber nur den Hostnamen, der per CNAME auf uns zeigt; ein CNAME auf der nackten Domain ist bei den meisten Anbietern nicht möglich. Neue Verbindungen werden automatisch als www.{domain} angelegt. Diese hier bitte entfernen und als www neu verbinden lassen.
            </div>
          )}
          {!isApex && hostPart === 'www' && (
            <div className="px-2.5 pb-2 font-sans" style={{ color: '#6B7280' }}>
              Zusätzlich beim Anbieter: Weiterleitung von {domain.replace(/^www\./, '')} auf {domain} (kein DNS-Eintrag, meist „Weiterleitung/Redirect“ im Domain-Menü).
            </div>
          )}

          <div className="px-2.5 py-2 flex items-center gap-2 font-sans" style={{ borderTop: '1px solid #F3F4F6', background: '#FAFAFA' }}>
            <button type="button" onClick={runCheck} disabled={loading}
              className="px-2.5 py-1 rounded-[7px] font-semibold"
              style={{ background: '#111827', color: '#fff', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Prüfe…' : check ? 'Erneut prüfen' : 'DNS live prüfen'}
            </button>
            {check && <span style={{ color: '#9CA3AF' }}>Stand {new Date(check.checked_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr, Resolver 1.1.1.1</span>}
            {error && <span style={{ color: '#DC2626' }}>{error}</span>}
          </div>

          {check && (
            <div className="px-2.5 pb-2.5 flex flex-col gap-1.5 font-sans">
              {check.records.map(r => {
                const nothing = r.cname.length === 0 && r.a.length === 0 && r.aaaa.length === 0
                const color = r.ok ? '#16A34A' : nothing ? '#9CA3AF' : '#DC2626'
                return (
                  <div key={r.name} className="flex items-start gap-2">
                    <span className="mt-[3px] inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                    <div className="min-w-0">
                      <span className="font-mono">{r.name}</span>
                      <span style={{ color }}> {r.ok ? 'zeigt korrekt auf ' + r.cname.find(c => c === FALLBACK_HOST || c === 'custom.womenplus.io') : nothing ? 'kein Eintrag gefunden' : 'zeigt woanders hin'}</span>
                      {!r.ok && !nothing && (
                        <div className="font-mono break-all" style={{ color: '#6B7280' }}>
                          {r.cname.length > 0 && <>CNAME → {r.cname.join(', ')}<br /></>}
                          {r.a.length > 0 && <>A → {r.a.join(', ')}<br /></>}
                          {r.aaaa.length > 0 && <>AAAA → {r.aaaa.join(', ')}</>}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              {check.cloudflare && (
                <div className="mt-1 pt-1.5" style={{ borderTop: '1px dashed #E5E7EB', color: '#6B7280' }}>
                  Cloudflare: Hostname <strong>{check.cloudflare.status}</strong>, SSL <strong>{check.cloudflare.ssl_status}</strong>
                  {check.cloudflare.errors.length > 0 && <> · {check.cloudflare.errors.join('; ')}</>}
                  {check.cloudflare.txt && (
                    <div className="mt-1">
                      Alternative, falls der Kunde den CNAME nicht vorab setzen kann (TXT-Nachweis, danach trotzdem CNAME nötig):
                      <div className="font-mono break-all mt-0.5" style={{ color: '#374151' }}>TXT {check.cloudflare.txt.name} = {check.cloudflare.txt.value}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
