'use client'

/** Gesprächsliste (links bzw. Handy-Startansicht) – Stil wie „Anfragen“ / WhatsApp Web. */
import Link from 'next/link'
import type { ChatConversation, ChatConversationStatus } from '@/lib/contracts/app-v1/chat'
import { avatarColor, listTime } from './utils'

export function Avatar({ seed, initials, size = 48, online }: { seed: string; initials: string; size?: number; online?: boolean }) {
  const c = avatarColor(seed)
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <div
        className="rounded-full flex items-center justify-center font-semibold select-none"
        style={{ width: size, height: size, background: c.bg, color: c.fg, fontSize: size * 0.36, letterSpacing: '-0.01em' }}
        aria-hidden="true"
      >
        {initials}
      </div>
      {online && (
        <span
          className="absolute rounded-full"
          title="Gerade online"
          style={{ right: -1, bottom: -1, width: Math.round(size * 0.28), height: Math.round(size * 0.28), background: '#22C55E', border: '2px solid #fff' }}
        />
      )}
    </div>
  )
}

const FILTERS: { key: ChatConversationStatus; label: string }[] = [
  { key: 'open', label: 'Offen' },
  { key: 'archived', label: 'Archiviert' },
  { key: 'blocked', label: 'Gesperrt' },
]

export function ConversationList({
  conversations, loading, status, search, selectedId, onStatus, onSearch, onSelect,
}: {
  conversations: ChatConversation[]
  loading: boolean
  status: ChatConversationStatus
  search: string
  selectedId: string | null
  onStatus: (s: ChatConversationStatus) => void
  onSearch: (q: string) => void
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Suche */}
      <div className="px-3 pt-3 pb-2 flex-shrink-0">
        <div className="relative">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="search"
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Suchen…"
            aria-label="Gespräche durchsuchen"
            className="w-full pl-10 pr-3 py-2.5 text-[15px] rounded-xl outline-none transition-colors"
            style={{ border: '1.5px solid #E5E7EB', background: '#fff' }}
            onFocus={e => (e.currentTarget.style.borderColor = '#1a1a1a')}
            onBlur={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
          />
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-1.5 px-3 pb-2 flex-shrink-0" role="tablist" aria-label="Filter">
        {FILTERS.map(f => {
          const active = status === f.key
          return (
            <button
              key={f.key}
              role="tab"
              aria-selected={active}
              onClick={() => onStatus(f.key)}
              className="px-3 py-1.5 text-[13px] font-semibold rounded-full transition-colors"
              style={{ background: active ? '#1a1a1a' : '#F3F4F6', color: active ? '#fff' : '#4B5563' }}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {/* Zeilen */}
      <div className="flex-1 min-h-0 overflow-y-auto" style={{ borderTop: '1px solid #F1F5F9' }}>
        {loading && conversations.length === 0 ? (
          <div className="flex flex-col">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 px-4 py-4 animate-pulse" style={{ borderBottom: '1px solid #F3F4F6' }}>
                <div className="w-12 h-12 rounded-full bg-gray-100 flex-shrink-0" />
                <div className="flex-1 flex flex-col gap-2">
                  <div className="h-3.5 rounded-full bg-gray-100 w-1/2" />
                  <div className="h-3 rounded-full bg-gray-100 w-4/5" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <EmptyList status={status} search={search} />
        ) : (
          <ul className="flex flex-col m-0 p-0 list-none">
            {conversations.map(c => (
              <ConversationRow key={c.id} conv={c} selected={c.id === selectedId} onSelect={() => onSelect(c.id)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function ConversationRow({ conv, selected, onSelect }: { conv: ChatConversation; selected: boolean; onSelect: () => void }) {
  const unread = conv.unread > 0
  const last = conv.lastMessage
  const preview = last
    ? (last.sender === 'owner' ? `Du: ${last.preview}` : last.sender === 'system' ? last.preview : last.preview)
    : 'Noch keine Nachricht'
  const time = last ? listTime(last.at) : listTime(conv.createdAt)

  return (
    <li>
      <button
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors"
        style={{
          background: selected ? '#F3F4F6' : 'transparent',
          borderBottom: '1px solid #F3F4F6',
          fontFamily: 'inherit',
        }}
        onMouseEnter={e => { if (!selected) e.currentTarget.style.background = '#FAFAFA' }}
        onMouseLeave={e => { e.currentTarget.style.background = selected ? '#F3F4F6' : 'transparent' }}
      >
        <Avatar seed={conv.id} initials={conv.visitor.initials} size={48} online={conv.visitor.online} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[15px] truncate m-0" style={{ color: '#111827', fontWeight: unread ? 700 : 500, letterSpacing: '-0.005em' }}>
              {conv.visitor.displayName}
            </p>
            <span className="text-xs flex-shrink-0 whitespace-nowrap" style={{ color: unread ? '#16A34A' : '#9CA3AF', fontWeight: unread ? 600 : 400 }}>
              {time}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className="text-[13.5px] truncate m-0 leading-snug" style={{ color: unread ? '#374151' : '#6B7280', fontWeight: unread ? 500 : 400 }}>
              {preview}
            </p>
            {unread && (
              <span
                className="flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center"
                style={{ background: '#16A34A', color: '#fff' }}
                aria-label={`${conv.unread} ungelesen`}
              >
                {conv.unread > 99 ? '99+' : conv.unread}
              </span>
            )}
          </div>
          <p className="text-[11px] mt-1 truncate m-0" style={{ color: '#94A3B8' }}>
            {conv.siteTitle}
            {conv.status === 'blocked' && <span style={{ color: '#DC2626' }}> · Gesperrt</span>}
            {conv.status === 'archived' && <span> · Archiviert</span>}
          </p>
        </div>
      </button>
    </li>
  )
}

function EmptyList({ status, search }: { status: ChatConversationStatus; search: string }) {
  let title = 'Noch keine Gespräche'
  let text: React.ReactNode = (
    <>Schalte den Chat zuerst im Editor deiner Webseite ein (Bereich &bdquo;Kontakt&ldquo; oder &bdquo;Profil&ldquo;). Dann können Besucher dir über das Chat-Symbol schreiben, und jedes Gespräch erscheint hier.</>
  )
  if (search) {
    title = 'Keine Ergebnisse'
    text = <>Nichts gefunden zu &bdquo;{search}&ldquo;.</>
  } else if (status === 'archived') {
    title = 'Nichts archiviert'
    text = 'Gespräche, die du archivierst, findest du hier wieder.'
  } else if (status === 'blocked') {
    title = 'Niemand gesperrt'
    text = 'Gesperrte Besucher können dir nicht mehr schreiben. Du kannst eine Sperre jederzeit aufheben.'
  }
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-16">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" aria-hidden="true">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
        </svg>
      </div>
      <h3 className="font-semibold text-gray-900 text-[16px] mb-1.5">{title}</h3>
      <p className="text-sm leading-relaxed max-w-[280px]" style={{ color: '#94A3B8' }}>{text}</p>
      {!search && status === 'open' && (
        <Link href="/sites" className="mt-5 px-4 py-2.5 text-sm font-semibold rounded-xl transition-opacity hover:opacity-90" style={{ background: '#1a1a1a', color: '#fff' }}>
          Meine Webseite ansehen
        </Link>
      )}
    </div>
  )
}
