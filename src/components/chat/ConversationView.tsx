'use client'

/** Ein Gespräch: Kopf, Verlauf mit Blasen, Eingabe. Rein darstellend; Daten und Aktionen kommen aus ChatsView. */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChatConversation, ChatMessage } from '@/lib/contracts/app-v1/chat'
import { enterSends } from '@/components/support/ChatText'
import { ChatMessageText } from './ChatMessageText'
import { Avatar } from './ConversationList'
import { clockTime, groupMessages, lastSeenLabel } from './utils'

export type LocalMessage = ChatMessage & { pending?: boolean; failed?: boolean }

export interface ConversationActions {
  onBack: () => void
  onSend: (body: string) => void
  onRetry: (clientId: string) => void
  onArchive: (archived: boolean) => void
  onBlock: () => void
  onUnblock: () => void
  onReport: () => void
  onDelete: () => void
}

const NAV_H = 'calc(56px + env(safe-area-inset-bottom, 0px))'

const STYLES = `
.fs-chat-msgs::-webkit-scrollbar { width: 6px }
.fs-chat-msgs::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 6px }
.fs-chat-bubble-row .fs-chat-copy { opacity: 0; transition: opacity .12s }
.fs-chat-bubble-row:hover .fs-chat-copy, .fs-chat-bubble-row:focus-within .fs-chat-copy { opacity: 1 }
@media (pointer: coarse) { .fs-chat-bubble-row .fs-chat-copy { display: none } }
.fs-chat-input-bar { flex-shrink: 0; background: #fff; border-top: 1px solid #E5E7EB }
@media (max-width: 1023px) {
  .fs-chat-view { min-height: calc(100dvh - 56px) }
  .fs-chat-head { position: sticky; top: 0; z-index: 20 }
  .fs-chat-input-bar { position: fixed; left: 0; right: 0; bottom: ${NAV_H}; z-index: 30 }
  .fs-chat-msgs { padding-bottom: 120px !important }
}
`

export function ConversationView({ conversation, messages, loading, actions, busy }: {
  conversation: ChatConversation
  messages: LocalMessage[]
  loading: boolean
  actions: ConversationActions
  busy: boolean
}) {
  const v = conversation.visitor
  const blocked = conversation.status === 'blocked'
  const archived = conversation.status === 'archived'
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const rows = useMemo(() => groupMessages(messages), [messages])
  const lastId = messages[messages.length - 1]?.id

  // Ans Ende scrollen, wenn eine neue Nachricht kommt / das Gespräch wechselt.
  useEffect(() => {
    // Nach dem Layout, sonst greift es am Handy (Fenster scrollt, nicht der Container) nicht zuverlässig.
    const id = requestAnimationFrame(() => {
      const end = endRef.current
      const box = scrollRef.current
      if (!end || !box) return
      if (box.scrollHeight > box.clientHeight + 4) {
        box.scrollTop = box.scrollHeight
      } else {
        // Handy: das Fenster scrollt. Der Endmarker läge sonst hinter der fixen Eingabeleiste –
        // deshalb bis zum Seitenende (Innenabstand unten reserviert den Platz für Eingabe + Leiste).
        window.scrollTo({ top: document.documentElement.scrollHeight })
      }
    })
    return () => cancelAnimationFrame(id)
  }, [lastId, conversation.id])

  // …-Menü: außerhalb klicken oder Esc schließt
  useEffect(() => {
    if (!menuOpen) return
    function onDoc(e: MouseEvent) { if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false) }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [menuOpen])

  const siteUrl = `https://${conversation.siteHost}${conversation.startedOnPath ?? ''}`
  const contacts: { label: string; href: string; icon: React.ReactNode }[] = []
  if (v.email) contacts.push({ label: v.email, href: `mailto:${v.email}`, icon: <MailIcon /> })
  if (v.phone) contacts.push({ label: v.phone, href: `tel:${v.phone.replace(/[^\d+]/g, '')}`, icon: <PhoneIcon /> })
  if (v.whatsappUrl) contacts.push({ label: 'WhatsApp', href: v.whatsappUrl, icon: <WhatsAppIcon /> })

  return (
    <div className="fs-chat-view flex flex-col h-full min-h-0 bg-white">
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      {/* Kopf */}
      <div className="fs-chat-head flex-shrink-0 bg-white" style={{ borderBottom: '1px solid #F1F5F9' }}>
        <div className="flex items-center gap-3 px-3 sm:px-4 py-3">
          <button
            onClick={actions.onBack}
            className="lg:hidden w-9 h-9 -ml-1 rounded-full flex items-center justify-center flex-shrink-0 transition-colors hover:bg-gray-100"
            aria-label="Zurück zur Liste"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <Avatar seed={conversation.id} initials={v.initials} size={42} online={v.online} />
          <div className="flex-1 min-w-0">
            <p className="text-[15.5px] font-bold text-gray-900 truncate m-0 leading-tight tracking-tight">{v.displayName}</p>
            <p className="text-xs m-0 mt-0.5 truncate flex items-center gap-1.5" style={{ color: '#6B7280' }}>
              {v.online ? (
                <><span className="inline-block w-2 h-2 rounded-full" style={{ background: '#22C55E' }} /> <span style={{ color: '#16A34A', fontWeight: 600 }}>online</span></>
              ) : (
                <span>{lastSeenLabel(v.lastSeenAt) || 'noch nicht gesehen'}</span>
              )}
              <span aria-hidden="true" style={{ color: '#D1D5DB' }}>·</span>
              <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="truncate hover:underline" style={{ color: '#6B7280' }} title={`${conversation.siteTitle} – ${siteUrl}`}>
                {conversation.siteHost}
              </a>
            </p>
          </div>

          {/* …-Menü */}
          <div className="relative flex-shrink-0" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Weitere Aktionen"
              className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
              style={{ background: menuOpen ? '#F3F4F6' : 'transparent' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
              onMouseLeave={e => (e.currentTarget.style.background = menuOpen ? '#F3F4F6' : 'transparent')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>
              </svg>
            </button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 top-11 z-40 w-60 rounded-2xl bg-white py-1.5" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)' }}>
                {!blocked && (
                  <MenuItem onClick={() => { setMenuOpen(false); actions.onArchive(!archived) }} icon={<ArchiveIcon />}>
                    {archived ? 'Wiederherstellen' : 'Archivieren'}
                  </MenuItem>
                )}
                {blocked ? (
                  <MenuItem onClick={() => { setMenuOpen(false); actions.onUnblock() }} icon={<UnlockIcon />}>Sperre aufheben</MenuItem>
                ) : (
                  <MenuItem onClick={() => { setMenuOpen(false); actions.onBlock() }} icon={<BlockIcon />}>Besucher sperren</MenuItem>
                )}
                <MenuItem onClick={() => { setMenuOpen(false); actions.onReport() }} icon={<FlagIcon />}>
                  {conversation.reportedAt ? 'Erneut melden' : 'Melden'}
                </MenuItem>
                <div className="h-px mx-3 my-1" style={{ background: '#F3F4F6' }} />
                <MenuItem onClick={() => { setMenuOpen(false); actions.onDelete() }} icon={<TrashIcon />} danger>Gespräch löschen</MenuItem>
              </div>
            )}
          </div>
        </div>

        {/* Kontaktzeile */}
        {contacts.length > 0 && (
          <div className="flex items-center gap-2 px-3 sm:px-4 pb-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {contacts.map(c => (
              <a
                key={c.href}
                href={c.href}
                target={c.href.startsWith('http') ? '_blank' : undefined}
                rel={c.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-semibold whitespace-nowrap transition-colors hover:bg-gray-200"
                style={{ background: '#F3F4F6', color: '#374151' }}
              >
                <span style={{ color: '#6B7280' }}>{c.icon}</span>{c.label}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Verlauf */}
      <div ref={scrollRef} className="fs-chat-msgs flex-1 min-h-0 overflow-y-auto px-3 sm:px-5 py-4" style={{ background: '#F7F7F8' }} aria-live="polite">
        {conversation.reportedAt && (
          <Notice>Du hast dieses Gespräch gemeldet. Wir schauen es uns innerhalb von 24 Stunden an.</Notice>
        )}
        {loading && messages.length === 0 ? (
          <div className="flex flex-col gap-3 animate-pulse">
            <div className="h-10 w-2/3 rounded-2xl bg-gray-200/70" />
            <div className="h-10 w-1/2 rounded-2xl bg-gray-300/50 self-end" />
            <div className="h-10 w-3/5 rounded-2xl bg-gray-200/70" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm py-10" style={{ color: '#94A3B8' }}>Noch keine Nachrichten.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {rows.map(row => row.kind === 'day' ? (
              <div key={row.key} className="flex justify-center my-3">
                <span className="text-[11px] font-semibold px-3 py-1 rounded-full" style={{ background: '#E5E7EB', color: '#4B5563' }}>{row.label}</span>
              </div>
            ) : (
              <Bubble key={row.key} message={row.message} onRetry={() => row.message.clientId && actions.onRetry(row.message.clientId)} />
            ))}
          </div>
        )}
        <div ref={endRef} style={{ height: 1 }} />
      </div>

      {/* Eingabe */}
      <div className="fs-chat-input-bar">
        {blocked ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3.5">
            <p className="text-sm m-0 flex-1" style={{ color: '#6B7280' }}>
              <strong style={{ color: '#111' }}>Besucher gesperrt.</strong> Dieser Besucher kann dir nicht mehr schreiben.
            </p>
            <button
              onClick={actions.onUnblock}
              disabled={busy}
              className="px-4 py-2.5 text-sm font-semibold rounded-xl transition-opacity hover:opacity-90 whitespace-nowrap"
              style={{ background: '#1a1a1a', color: '#fff', opacity: busy ? 0.6 : 1 }}
            >
              Sperre aufheben
            </button>
          </div>
        ) : (
          <Composer onSend={actions.onSend} disabled={busy} archived={archived} onRestore={() => actions.onArchive(false)} />
        )}
      </div>
    </div>
  )
}

// ─── Blase ───────────────────────────────────────────────────────────────────

function Bubble({ message, onRetry }: { message: LocalMessage; onRetry: () => void }) {
  const [copied, setCopied] = useState(false)
  const own = message.sender === 'owner'
  const system = message.sender === 'system'

  if (system) {
    return (
      <div className="flex justify-center my-1">
        <span className="text-[12px] px-3 py-1.5 rounded-xl text-center max-w-[80%]" style={{ background: '#E5E7EB', color: '#4B5563' }}>
          <ChatMessageText text={message.body} linkColor="#1a1a1a" />
        </span>
      </div>
    )
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.body)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch { /* Zwischenablage nicht verfügbar */ }
  }

  const copyBtn = (
    <button
      onClick={copy}
      className="fs-chat-copy self-center w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors hover:bg-black/5"
      aria-label="Nachricht kopieren"
      title={copied ? 'Kopiert' : 'Kopieren'}
      style={{ color: '#9CA3AF' }}
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      )}
    </button>
  )

  return (
    <div className={`fs-chat-bubble-row flex items-end gap-1.5 ${own ? 'justify-end' : 'justify-start'}`}>
      {own && copyBtn}
      <div className="flex flex-col max-w-[82%] sm:max-w-[70%]" style={{ alignItems: own ? 'flex-end' : 'flex-start' }}>
        <div
          className="text-[15px] leading-[1.5] px-3.5 py-2.5"
          style={{
            background: own ? '#1a1a1a' : '#fff',
            color: own ? '#fff' : '#111',
            borderRadius: own ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
            boxShadow: own ? 'none' : '0 1px 2px rgba(0,0,0,0.06)',
            opacity: message.pending ? 0.7 : 1,
            wordBreak: 'break-word',
          }}
        >
          <ChatMessageText text={message.body} linkColor={own ? '#C7D2FE' : '#1D4ED8'} />
        </div>
        <div className="flex items-center gap-1 mt-1 px-1 text-[11px]" style={{ color: message.failed ? '#DC2626' : '#9CA3AF' }}>
          {message.failed ? (
            <>
              <span>Nicht gesendet</span>
              <span aria-hidden="true">·</span>
              <button onClick={onRetry} className="font-semibold underline underline-offset-2" style={{ color: '#DC2626' }}>Erneut senden</button>
            </>
          ) : (
            <>
              <span>{clockTime(message.createdAt)}</span>
              {own && <Ticks pending={!!message.pending} read={!!message.readAt} />}
            </>
          )}
        </div>
      </div>
      {!own && copyBtn}
    </div>
  )
}

function Ticks({ pending, read }: { pending: boolean; read: boolean }) {
  if (pending) {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-label="wird gesendet" role="img"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
    )
  }
  const color = read ? '#2563EB' : '#9CA3AF'
  return (
    <svg width="18" height="12" viewBox="0 0 32 20" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={read ? 'gelesen' : 'gesendet'}>
      <path d="M3 11l5 5L18 6"/>
      {read && <path d="M13 16l1.5 1.5L29 6"/>}
    </svg>
  )
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-center mb-3">
      <p className="text-[12px] m-0 px-3.5 py-2 rounded-xl text-center max-w-[90%]" style={{ background: '#FEF3C7', color: '#92400E' }}>{children}</p>
    </div>
  )
}

// ─── Eingabe ─────────────────────────────────────────────────────────────────

function Composer({ onSend, disabled, archived, onRestore }: { onSend: (body: string) => void; disabled: boolean; archived: boolean; onRestore: () => void }) {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  const composing = useRef(false)
  const canSend = value.trim().length > 0 && !disabled

  function send() {
    const body = value.trim()
    if (!body) return
    onSend(body.slice(0, 2000))
    setValue('')
    if (ref.current) { ref.current.style.height = 'auto'; ref.current.focus() }
  }

  return (
    <div className="px-3 sm:px-4 pt-2.5 pb-3">
      {archived && (
        <p className="text-xs m-0 mb-2 flex items-center gap-2" style={{ color: '#6B7280' }}>
          Archiviert – beim Antworten wird das Gespräch wieder geöffnet.
          <button onClick={onRestore} className="font-semibold underline underline-offset-2" style={{ color: '#1a1a1a' }}>Wiederherstellen</button>
        </p>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={ref}
          value={value}
          onChange={e => {
            setValue(e.target.value)
            const el = e.target
            el.style.height = 'auto'
            el.style.height = `${Math.min(el.scrollHeight, 120)}px`
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey && !composing.current && enterSends()) { e.preventDefault(); send() }
          }}
          onCompositionStart={() => { composing.current = true }}
          onCompositionEnd={() => { composing.current = false }}
          placeholder="Antwort schreiben…"
          aria-label="Antwort schreiben"
          rows={1}
          maxLength={2000}
          className="flex-1 rounded-2xl px-4 py-2.5 text-[16px] outline-none"
          style={{ border: '1.5px solid #E5E7EB', background: '#F9FAFB', resize: 'none', minHeight: 44, maxHeight: 120, lineHeight: 1.5, color: '#111', fontFamily: 'inherit', transition: 'border-color .15s, background .15s' }}
          onFocus={e => { e.currentTarget.style.borderColor = '#1a1a1a'; e.currentTarget.style.background = '#fff' }}
          onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.background = '#F9FAFB' }}
        />
        <button
          onClick={send}
          disabled={!canSend}
          aria-label="Senden"
          className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
          style={{ background: canSend ? '#1a1a1a' : '#E5E7EB', cursor: canSend ? 'pointer' : 'default' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={canSend ? '#fff' : '#9CA3AF'} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
        </button>
      </div>
      <p className="hidden lg:block text-[11px] m-0 mt-1.5 px-1" style={{ color: '#B0B7C3' }}>Enter sendet · Shift + Enter für eine neue Zeile</p>
    </div>
  )
}

// ─── Menü + Symbole ──────────────────────────────────────────────────────────

function MenuItem({ children, onClick, icon, danger }: { children: React.ReactNode; onClick: () => void; icon: React.ReactNode; danger?: boolean }) {
  return (
    <button role="menuitem" onClick={onClick} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors hover:bg-gray-50" style={{ color: danger ? '#DC2626' : '#111' }}>
      <span style={{ color: danger ? '#DC2626' : '#6B7280' }}>{icon}</span>{children}
    </button>
  )
}

const ico = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
function ArchiveIcon() { return <svg {...ico}><path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"/></svg> }
function BlockIcon() { return <svg {...ico}><circle cx="12" cy="12" r="10"/><path d="M4.9 4.9l14.2 14.2"/></svg> }
function UnlockIcon() { return <svg {...ico}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg> }
function FlagIcon() { return <svg {...ico}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/></svg> }
function TrashIcon() { return <svg {...ico}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg> }
function MailIcon() { return <svg {...ico} width={13} height={13}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> }
function PhoneIcon() { return <svg {...ico} width={13} height={13}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z"/></svg> }
function WhatsAppIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="#128C7E" aria-hidden="true">
      <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z"/>
    </svg>
  )
}
