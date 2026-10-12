'use client'

import { useState } from 'react'

/**
 * Admin-Service: Domain für einen Kunden verbinden. Nutzt dieselbe API wie der Editor
 * (/api/sites/[id]/domain), die Admins jede Seite bearbeiten lässt – Validierung,
 * Sperrliste und „nackte Domain → www“ gelten damit identisch.
 */
export default function AdminDomainConnect({ siteId, onChanged }: { siteId: string; onChanged: () => void }) {
  const [domain, setDomain] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  async function connect() {
    setBusy(true); setMsg(null)
    try {
      const res = await fetch(`/api/sites/${siteId}/domain`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domain }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Fehler')
      // Direkt prüfen: steht der CNAME schon, wird die Domain sofort aktiv
      const v = await fetch(`/api/sites/${siteId}/domain/verify`, { method: 'POST' }).then(r => r.json()).catch(() => null)
      setMsg({ ok: true, text: `${data.custom_domain} angelegt · Status: ${v?.custom_domain_status ?? data.custom_domain_status}` })
      setDomain('')
      onChanged()
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Fehler' })
    } finally { setBusy(false) }
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
      <input value={domain} onChange={e => setDomain(e.target.value)} placeholder="Domain verbinden, z. B. www.kunde.de"
        className="px-2 py-1 rounded-[7px] font-mono" style={{ border: '1px solid #E5E7EB', minWidth: 210 }} />
      <button type="button" onClick={connect} disabled={busy || !domain.trim()}
        className="px-2.5 py-1 rounded-[7px] font-semibold"
        style={{ background: '#111827', color: '#fff', opacity: busy || !domain.trim() ? 0.5 : 1 }}>
        {busy ? 'Verbinde…' : 'Verbinden'}
      </button>
      {msg && <span style={{ color: msg.ok ? '#16A34A' : '#DC2626' }}>{msg.text}</span>}
    </div>
  )
}
