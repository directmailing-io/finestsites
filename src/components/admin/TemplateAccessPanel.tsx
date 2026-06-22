'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface GrantedUser {
  id: string
  user_id: string
  granted_at: string
  users: { email: string; username: string | null } | null
}

interface SearchUser {
  id: string
  email: string
  username: string | null
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid #E2E8F0',
  fontSize: 13,
  background: '#FAFAFA',
  outline: 'none',
  color: '#0F172A',
  transition: 'border-color 0.15s, box-shadow 0.15s',
}

function UserRow({
  email, username, action, actionLabel, actionColor, loading,
}: {
  email: string; username: string | null
  action: () => void; actionLabel: string; actionColor: string; loading: boolean
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-[14px] transition-colors"
      style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
      {/* Avatar placeholder */}
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold"
        style={{ background: '#E2E8F0', color: '#475569' }}>
        {email[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{email}</p>
        {username && (
          <p className="text-xs truncate" style={{ color: '#94A3B8' }}>@{username}</p>
        )}
      </div>
      <button
        onClick={action}
        disabled={loading}
        className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-[10px] transition-all disabled:opacity-50"
        style={{ background: actionColor === 'red' ? '#FEF2F2' : '#F0FDF4', color: actionColor === 'red' ? '#DC2626' : '#16A34A' }}>
        {loading ? '…' : actionLabel}
      </button>
    </div>
  )
}

export default function TemplateAccessPanel({ templateId }: { templateId: string }) {
  const [granted, setGranted] = useState<GrantedUser[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [loadingGrant, setLoadingGrant] = useState<string | null>(null)
  const [loadingRevoke, setLoadingRevoke] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadGranted = useCallback(async () => {
    const res = await fetch(`/api/admin/templates/${templateId}/access`)
    if (res.ok) setGranted(await res.json())
  }, [templateId])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadGranted() }, [loadGranted])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (searchQuery.length < 2) { setSearchResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(searchQuery)}`)
      if (res.ok) setSearchResults(await res.json())
      setSearching(false)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchQuery])

  async function grantAccess(userId: string) {
    setLoadingGrant(userId)
    await fetch(`/api/admin/templates/${templateId}/access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    })
    await loadGranted()
    setLoadingGrant(null)
  }

  async function revokeAccess(userId: string) {
    setLoadingRevoke(userId)
    await fetch(`/api/admin/templates/${templateId}/access`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    })
    await loadGranted()
    setLoadingRevoke(null)
  }

  const grantedIds = new Set(granted.map(g => g.user_id))
  // Filter out already-granted users from search results
  const filteredResults = searchResults.filter(u => !grantedIds.has(u.id))

  return (
    <div className="flex flex-col gap-6 lg:flex-row">

      {/* Left: Search + Grant */}
      <div className="flex-1 flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Nutzer freischalten</h3>
          <p className="text-xs mb-3" style={{ color: '#94A3B8' }}>
            Suche nach E-Mail oder Benutzername — nur freigeschaltete Nutzer sehen dieses Template.
          </p>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14"
              viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              style={{ ...inputStyle, paddingLeft: 36 }}
              placeholder="E-Mail oder Benutzername …"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={e => { e.currentTarget.style.borderColor = '#94A3B8'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(148,163,184,0.15)' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>
        </div>

        {searching && (
          <div className="flex items-center gap-2 text-xs" style={{ color: '#94A3B8' }}>
            <div className="w-3 h-3 rounded-full border border-gray-300 border-t-gray-600 animate-spin" />
            Suche …
          </div>
        )}

        {searchQuery.length >= 2 && !searching && filteredResults.length === 0 && (
          <p className="text-xs py-2" style={{ color: '#94A3B8' }}>
            {searchResults.length > 0 ? 'Alle gefundenen Nutzer haben bereits Zugang.' : 'Keine Nutzer gefunden.'}
          </p>
        )}

        <div className="flex flex-col gap-2">
          {filteredResults.map(u => (
            <UserRow key={u.id}
              email={u.email} username={u.username}
              action={() => grantAccess(u.id)}
              actionLabel="Freischalten"
              actionColor="green"
              loading={loadingGrant === u.id}
            />
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="hidden lg:block w-px" style={{ background: '#F1F5F9' }} />
      <div className="lg:hidden h-px" style={{ background: '#F1F5F9' }} />

      {/* Right: Granted Users */}
      <div className="flex-1 flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">
            Freigeschaltete Nutzer
            {granted.length > 0 && (
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: '#F0F9FF', color: '#0369A1' }}>
                {granted.length}
              </span>
            )}
          </h3>
          <p className="text-xs" style={{ color: '#94A3B8' }}>
            Diese Nutzer sehen das Template auch im Test-Modus.
          </p>
        </div>

        {granted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 rounded-[16px] text-center"
            style={{ background: '#FAFAFA', border: '1px dashed #E2E8F0' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" className="mb-2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <p className="text-xs font-medium" style={{ color: '#CBD5E1' }}>Noch keine Nutzer freigeschaltet</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {granted.map(g => (
              <UserRow key={g.id}
                email={g.users?.email ?? '—'}
                username={g.users?.username ?? null}
                action={() => revokeAccess(g.user_id)}
                actionLabel="Entziehen"
                actionColor="red"
                loading={loadingRevoke === g.user_id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
