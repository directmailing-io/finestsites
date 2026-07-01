'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string
  conversationId: string
  senderType: 'user' | 'admin'
  senderId: string | null
  content: string
  contentType: 'text' | 'image' | 'gif'
  mediaUrl?: string | null
  createdAt: string
}

interface ConversationSummary {
  id: string
  status: string
  subject: string | null
  unreadByUser: number
  lastMessageAt: string | null
  createdAt: string
  lastMessage: { content: string; contentType: string; senderType: string } | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EMOJI_GROUPS = [
  { label: 'Gesichter', emojis: ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🥰','😍','😘','🙂','🤗','🤔','😐','😶','😏','😒','🙄','😬','😌','😔','😴','🤤','😪','😵'] },
  { label: 'Gesten', emojis: ['👍','👎','👏','🙌','🤝','👊','✊','🤞','✌️','🤟','👌','🤌','👈','👉','👆','👇','✋','🤚','🖐','💪','🦾'] },
  { label: 'Herzen', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','💕','💞','💓','💗','💖','💘','💝'] },
  { label: 'Feiern', emojis: ['🎉','🎊','🥳','🎈','🎁','🏆','🥇','🎯','🎨','🎤','🎵','🎶','✅','⭐','🔥','💯','🚀','🌟','💡','🎉'] },
  { label: 'Symbole', emojis: ['✅','❌','⭕','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','💠','🔶','🔷','🔸','🔹','▪️','▫️','➡️','⬅️','⬆️','⬇️'] },
]

const GLOBAL_STYLES = `
@keyframes supportSlideUp {
  from { opacity: 0; transform: translateY(16px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.fs-support-panel {
  animation: supportSlideUp 220ms cubic-bezier(0.34, 1.2, 0.64, 1) forwards;
  position: fixed; bottom: 96px; right: 24px;
  width: 360px; height: 560px;
  border-radius: 20px; background: #fff;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.08);
  display: flex; flex-direction: column; z-index: 9998; overflow: hidden;
}
.fs-support-launcher {
  position: fixed; bottom: 24px; right: 24px; z-index: 9999;
  width: 56px; height: 56px; border-radius: 28px;
  background: #111; border: none; cursor: pointer;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s, transform 0.15s;
}
.fs-support-launcher:hover { background: #333; transform: scale(1.05); }
.fs-msg-bubble-user {
  align-self: flex-end; background: #111; color: #fff;
  border-radius: 18px 18px 4px 18px; padding: 10px 14px;
  max-width: 80%; font-size: 14px; line-height: 1.5; word-break: break-word;
}
.fs-msg-bubble-admin {
  align-self: flex-start; background: #F0F0F0; color: #111;
  border-radius: 18px 18px 18px 4px; padding: 10px 14px;
  max-width: 80%; font-size: 14px; line-height: 1.5; word-break: break-word;
}
.fs-toolbar-btn {
  width: 32px; height: 32px; border: none; border-radius: 8px;
  background: transparent; cursor: pointer; display: flex;
  align-items: center; justify-content: center; color: #888;
  transition: background 0.12s, color 0.12s; flex-shrink: 0;
}
.fs-toolbar-btn:hover, .fs-toolbar-btn.active { background: #F0F0F0; color: #111; }
.fs-support-messages::-webkit-scrollbar { width: 4px; }
.fs-support-messages::-webkit-scrollbar-track { background: transparent; }
.fs-support-messages::-webkit-scrollbar-thumb { background: #E0E0E0; border-radius: 4px; }
.fs-conv-row { padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #F5F5F5; border-radius: 8px; transition: background 0.1s; }
.fs-conv-row:hover { background: #FAFAFA; }
@media (max-width: 640px) {
  .fs-support-panel {
    bottom: calc(56px + env(safe-area-inset-bottom, 0px));
    right: 0; left: 0; border-radius: 20px 20px 0 0;
    width: 100%;
    height: calc(100dvh - 56px - env(safe-area-inset-bottom, 0px) - 16px);
    max-height: 85vh;
  }
  .fs-support-launcher { display: none !important; }
}
`

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  if (isToday) return `${hh}:${mm}`
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}. ${hh}:${mm}`
}

function truncatePreview(msg: ConversationSummary['lastMessage']): string {
  if (!msg) return 'Noch keine Nachrichten'
  if (msg.contentType === 'image') return '📷 Bild'
  return msg.content.length > 45 ? msg.content.slice(0, 45) + '…' : msg.content
}

function statusColor(status: string): string {
  if (status === 'open') return '#22C55E'
  if (status === 'waiting') return '#F59E0B'
  return '#D1D5DB'
}

function statusLabel(status: string): string {
  if (status === 'open') return 'Offen'
  if (status === 'waiting') return 'Wartend'
  return 'Geschlossen'
}

function isLiveHours(): boolean {
  const h = new Date().getHours()
  return h >= 8 && h < 20
}

function convTitle(conv: ConversationSummary): string {
  if (conv.subject) return conv.subject
  const d = new Date(conv.createdAt)
  const months = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
  return `Chat vom ${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function ChatBubbleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="white" aria-hidden="true">
      <path d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
    </svg>
  )
}

function XIcon({ size = 14, color = 'white' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M1 1L13 13M13 1L1 13" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

function ArrowUpIcon({ color = 'white' }: { color?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 13V3M8 3L4 7M8 3L12 7" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function ChevronLeftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M11 4L6 9L11 14" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function SmileIcon({ active }: { active: boolean }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={active ? '#111' : '#888'} strokeWidth="1.75" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <path d="M8 14s1.5 2 4 2 4-2 4-2" strokeLinecap="round"/>
      <circle cx="9" cy="9.5" r="1" fill={active ? '#111' : '#888'} stroke="none"/>
      <circle cx="15" cy="9.5" r="1" fill={active ? '#111' : '#888'} stroke="none"/>
    </svg>
  )
}

function ImageIcon({ active }: { active?: boolean }) {
  const c = active ? '#111' : '#888'
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.75" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <circle cx="8.5" cy="8.5" r="1.5" fill={c} stroke="none"/>
      <polyline points="21 15 16 10 5 21" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ─── Standalone sub-components (OUTSIDE main component to preserve focus) ─────

function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [activeTab, setActiveTab] = useState(0)
  return (
    <div style={{
      position: 'absolute', bottom: 'calc(100% + 6px)', left: 8,
      background: '#fff', border: '1px solid #E8E8E8',
      borderRadius: 16, padding: '10px 10px 12px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.13)',
      width: 288, zIndex: 200,
    }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10, overflowX: 'auto' }}>
        {EMOJI_GROUPS.map((g, i) => (
          <button
            key={g.label}
            onClick={() => setActiveTab(i)}
            style={{
              fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
              padding: '3px 9px', borderRadius: 100, border: 'none',
              cursor: 'pointer', fontFamily: 'inherit',
              background: activeTab === i ? '#111' : '#F0F0F0',
              color: activeTab === i ? '#fff' : '#666',
              transition: 'background 0.12s',
            }}
          >
            {g.label}
          </button>
        ))}
      </div>
      {/* Emoji grid */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {EMOJI_GROUPS[activeTab].emojis.map(emoji => (
          <button
            key={emoji}
            onMouseDown={e => { e.preventDefault(); onSelect(emoji) }}
            style={{
              width: 34, height: 34, border: 'none',
              background: 'transparent', cursor: 'pointer',
              fontSize: 20, display: 'flex', alignItems: 'center',
              justifyContent: 'center', borderRadius: 6,
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F5F5F5')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}

function ConvRow({ conv, onClick, onDelete }: { conv: ConversationSummary; onClick: () => void; onDelete: () => void }) {
  const [hovered, setHovered] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  return (
    <div
      className="fs-conv-row"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setConfirmDelete(false) }}
      style={{ background: hovered ? '#FAFAFA' : 'transparent', position: 'relative' }}
    >
      {/* Delete confirmation overlay */}
      {confirmDelete && (
        <div style={{
          position: 'absolute', inset: 0, background: '#FEF2F2', borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, zIndex: 10, padding: '0 12px',
        }}>
          <span style={{ fontSize: 12, color: '#DC2626', fontWeight: 500 }}>Chat löschen?</span>
          <button
            onMouseDown={e => { e.stopPropagation(); onDelete() }}
            style={{ fontSize: 11, fontWeight: 700, background: '#DC2626', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
          >Ja</button>
          <button
            onMouseDown={e => { e.stopPropagation(); setConfirmDelete(false) }}
            style={{ fontSize: 11, fontWeight: 600, background: '#F1F5F9', color: '#555', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
          >Nein</button>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }} onClick={onClick}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: statusColor(conv.status),
          marginTop: 5, flexShrink: 0,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {convTitle(conv)}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
              {conv.lastMessageAt && (
                <span style={{ fontSize: 11, color: '#999' }}>{formatTime(conv.lastMessageAt)}</span>
              )}
              {(conv.unreadByUser ?? 0) > 0 && (
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: '#EF4444', color: '#fff',
                  fontSize: 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {conv.unreadByUser > 9 ? '9+' : conv.unreadByUser}
                </div>
              )}
              {/* Delete button — shown on hover */}
              {hovered && (
                <button
                  onMouseDown={e => { e.stopPropagation(); setConfirmDelete(true) }}
                  title="Gespräch löschen"
                  style={{
                    width: 20, height: 20, border: 'none', background: 'transparent',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 4, color: '#CCC', padding: 0, flexShrink: 0,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#CCC')}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {truncatePreview(conv.lastMessage)}
          </div>
          <span style={{ fontSize: 10, color: statusColor(conv.status), fontWeight: 600, marginTop: 3, display: 'inline-block' }}>
            {statusLabel(conv.status)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

function SupportAvatar({ size }: { size: number }) {
  const [imgError, setImgError] = useState(false)
  const inner = imgError ? (
    <div style={{
      width: size, height: size, borderRadius: size / 2,
      background: 'linear-gradient(135deg, #8060b0, #5a3d8a)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: size * 0.36, fontWeight: 700, flexShrink: 0,
    }}>FS</div>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/support-avatar.jpg"
      alt="Support"
      width={size}
      height={size}
      style={{ width: size, height: size, borderRadius: size / 2, objectFit: 'cover', flexShrink: 0 }}
      onError={() => setImgError(true)}
    />
  )
  return inner
}

export default function SupportChat() {
  const [open, setOpen] = useState(false)
  const [screen, setScreen] = useState<'list' | 'new' | 'chat'>('list')
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [activeConvStatus, setActiveConvStatus] = useState<string>('open')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [totalUnread, setTotalUnread] = useState(0)
  const [live, setLive] = useState(isLiveHours())

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const convPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastMsgTimeRef = useRef<string | null>(null)
  const isComposingRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Fetch conversations ──────────────────────────────────────────────────

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/support/conversation')
      const data = await res.json()
      const convs: ConversationSummary[] = data.conversations ?? []
      setConversations(convs)
      const count = convs.reduce((s, c) => s + (c.unreadByUser ?? 0), 0)
      setTotalUnread(count)
      window.dispatchEvent(new CustomEvent('supportUnreadUpdate', { detail: { count } }))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchConversations() }, [fetchConversations])

  // ── Open chat from outside (e.g. sidebar button) ─────────────────────────

  useEffect(() => {
    function handler() { setOpen(true); setScreen('list') }
    window.addEventListener('openSupportChat', handler)
    return () => window.removeEventListener('openSupportChat', handler)
  }, [])

  // ── Live hours indicator (refresh every minute) ───────────────────────────

  useEffect(() => {
    const t = setInterval(() => setLive(isLiveHours()), 60_000)
    return () => clearInterval(t)
  }, [])

  // ── Auto-scroll ──────────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Message polling ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!open || screen !== 'chat' || !activeConvId) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      return
    }
    pollRef.current = setInterval(async () => {
      try {
        const since = lastMsgTimeRef.current ? `&since=${encodeURIComponent(lastMsgTimeRef.current)}` : ''
        const res = await fetch(`/api/support/messages?conversationId=${activeConvId}${since}`)
        const data = await res.json()
        if (data.messages?.length > 0) {
          setMessages(prev => {
            const ids = new Set(prev.map((m: Message) => m.id))
            const fresh = (data.messages as Message[]).filter(m => !ids.has(m.id))
            if (!fresh.length) return prev
            lastMsgTimeRef.current = data.messages[data.messages.length - 1].createdAt
            return [...prev, ...fresh]
          })
        }
        if (data.conversationStatus && data.conversationStatus !== activeConvStatus) {
          setActiveConvStatus(data.conversationStatus)
        }
      } catch { /* ignore */ }
    }, 3000)
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }
  }, [open, screen, activeConvId, activeConvStatus])

  // ── Conversation list polling (always active for unread badge) ───────────

  useEffect(() => {
    // Poll every 5s regardless of whether panel is open — keeps unread badge live
    convPollRef.current = setInterval(fetchConversations, 5000)
    return () => { if (convPollRef.current) { clearInterval(convPollRef.current); convPollRef.current = null } }
  }, [fetchConversations])

  // ── Open conversation ────────────────────────────────────────────────────

  async function openConversation(conv: ConversationSummary) {
    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unreadByUser: 0 } : c))
    setTotalUnread(prev => {
      const next = Math.max(0, prev - (conv.unreadByUser ?? 0))
      window.dispatchEvent(new CustomEvent('supportUnreadUpdate', { detail: { count: next } }))
      return next
    })
    setActiveConvId(conv.id)
    setActiveConvStatus(conv.status)
    setScreen('chat')
    setMessages([])
    lastMsgTimeRef.current = null
    setShowEmoji(false)
    try {
      const res = await fetch(`/api/support/messages?conversationId=${conv.id}`)
      const data = await res.json()
      const msgs: Message[] = data.messages ?? []
      setMessages(msgs)
      if (msgs.length > 0) lastMsgTimeRef.current = msgs[msgs.length - 1].createdAt
      if (data.conversationStatus) setActiveConvStatus(data.conversationStatus)
    } catch { /* ignore */ }
    fetch(`/api/support/conversation/${conv.id}/read`, { method: 'PATCH' }).catch(() => {})
  }

  // ── Send message ─────────────────────────────────────────────────────────

  async function sendMessage({
    content = input.trim(),
    contentType = 'text',
    mediaUrl,
  }: { content?: string; contentType?: string; mediaUrl?: string } = {}) {
    if (sending || uploading) return
    if (contentType === 'text' && !content) return

    setSending(true)
    const tempId = `temp-${Date.now()}`
    const tempMsg: Message = {
      id: tempId, conversationId: activeConvId ?? '',
      senderType: 'user', senderId: null,
      content, contentType: contentType as Message['contentType'],
      mediaUrl: mediaUrl ?? null, createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempMsg])
    if (contentType === 'text') { setInput(''); if (textareaRef.current) textareaRef.current.style.height = 'auto' }

    try {
      let data: { message?: Message; conversation?: ConversationSummary & { status: string } }
      if (!activeConvId || screen === 'new') {
        const res = await fetch('/api/support/conversation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, contentType, ...(mediaUrl ? { mediaUrl } : {}) }),
        })
        data = await res.json()
        if (data.conversation) {
          const c = data.conversation
          setActiveConvId(c.id)
          setActiveConvStatus(c.status)
          setScreen('chat')
          setConversations(prev => [{
            ...c, unreadByUser: 0,
            lastMessage: { content, contentType, senderType: 'user' },
          }, ...prev])
        }
      } else {
        const res = await fetch('/api/support/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: activeConvId, content, contentType, ...(mediaUrl ? { mediaUrl } : {}) }),
        })
        data = await res.json()
      }
      if (data.message) {
        setMessages(prev => prev.map(m => m.id === tempId ? data.message! : m))
        lastMsgTimeRef.current = data.message.createdAt
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId))
    } finally {
      setSending(false)
    }
  }

  // ── File upload ──────────────────────────────────────────────────────────

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/support/upload', { method: 'POST', body: fd })
      if (!res.ok) { alert('Upload fehlgeschlagen'); return }
      const { url } = await res.json()
      await sendMessage({ contentType: 'image', mediaUrl: url, content: '' })
    } catch { alert('Upload fehlgeschlagen') }
    finally { setUploading(false) }
  }

  // ── Keyboard ─────────────────────────────────────────────────────────────

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !isComposingRef.current) {
      e.preventDefault()
      sendMessage()
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 90)}px`
  }

  async function deleteConversation(convId: string) {
    // Optimistic remove
    setConversations(prev => prev.filter(c => c.id !== convId))
    setTotalUnread(prev => {
      const conv = conversations.find(c => c.id === convId)
      return Math.max(0, prev - (conv?.unreadByUser ?? 0))
    })
    if (activeConvId === convId) { setScreen('list'); setActiveConvId(null) }
    try {
      await fetch(`/api/support/conversation/${convId}`, { method: 'DELETE' })
    } catch { /* ignore — will be hidden locally regardless */ }
  }

  function toggleOpen() {
    if (open) { setOpen(false); setShowEmoji(false) }
    else { setOpen(true); setScreen('list') }
  }

  // ── Derived ──────────────────────────────────────────────────────────────

  const canSend = input.trim().length > 0 && !sending && !uploading
  const isClosed = activeConvStatus === 'closed'

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_STYLES }} />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      {/* Panel */}
      {open && (
        <div className="fs-support-panel">

          {/* ── LIST screen ─────────────────────────────────────────── */}
          {screen === 'list' && (
            <>
              {/* Header */}
              <div style={{
                minHeight: 72, background: '#111', borderRadius: '20px 20px 0 0',
                padding: '16px 20px', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', flexShrink: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <SupportAvatar size={40} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ color: '#fff', fontSize: 15, fontWeight: 600, lineHeight: 1 }}>Support</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: live ? '#22C55E' : '#F97316',
                        boxShadow: live ? '0 0 0 2px rgba(34,197,94,0.3)' : '0 0 0 2px rgba(249,115,22,0.3)',
                        flexShrink: 0,
                      }} />
                      <span style={{ fontSize: 11, color: live ? '#86EFAC' : '#FED7AA' }}>
                        {live ? 'Jetzt erreichbar' : 'Außerhalb der Zeiten'}
                      </span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setOpen(false)} style={{
                  width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.1)',
                  border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <XIcon />
                </button>
              </div>

              {/* Conversation list body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px 14px' }} className="fs-support-messages">
                {conversations.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '32px 24px', textAlign: 'center' }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#F5F0FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 16 }}>👋</div>
                    <p style={{ fontSize: 18, fontWeight: 700, color: '#111', margin: '0 0 8px' }}>Wie können wir dir helfen?</p>
                    <p style={{ fontSize: 14, color: '#777', margin: '0 0 24px', maxWidth: 240, lineHeight: 1.5 }}>Unser Team antwortet normalerweise in wenigen Stunden.</p>
                    <button
                      onClick={() => { setScreen('new'); setMessages([]); setActiveConvId(null) }}
                      style={{ width: '100%', padding: '13px 20px', background: '#111', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      Neues Gespräch starten →
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => { setScreen('new'); setMessages([]); setActiveConvId(null) }}
                      style={{
                        width: '100%', textAlign: 'left', border: '1.5px dashed #E0E0E0', borderRadius: 12,
                        padding: '10px 16px', background: 'transparent', color: '#555', fontSize: 13,
                        fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 6,
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Neues Gespräch starten
                    </button>
                    {conversations.map(conv => (
                      <ConvRow key={conv.id} conv={conv} onClick={() => openConversation(conv)} onDelete={() => deleteConversation(conv.id)} />
                    ))}
                  </>
                )}
              </div>
            </>
          )}

          {/* ── CHAT / NEW screen ──────────────────────────────────── */}
          {(screen === 'chat' || screen === 'new') && (
            <>
              {/* Header */}
              <div style={{
                height: 60, background: '#111', borderRadius: '20px 20px 0 0',
                padding: '0 16px', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', flexShrink: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => { setScreen('list'); fetchConversations(); setShowEmoji(false) }}
                    style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                  >
                    <ChevronLeftIcon />
                  </button>
                  {screen === 'new' ? (
                    <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>Neues Gespräch</span>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: '#fff', fontSize: 14, fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {conversations.find(c => c.id === activeConvId) ? convTitle(conversations.find(c => c.id === activeConvId)!) : 'Chat'}
                      </span>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor(activeConvStatus), flexShrink: 0 }} />
                    </div>
                  )}
                </div>
                <button onClick={() => { setOpen(false); setShowEmoji(false) }} style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <XIcon />
                </button>
              </div>

              {/* Messages */}
              <div className="fs-support-messages" style={{ flex: 1, overflowY: 'auto', padding: 16, gap: 8, display: 'flex', flexDirection: 'column', background: '#F8F8F8' }}>
                {messages.length === 0 && screen === 'new' && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, textAlign: 'center', padding: '0 24px' }}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#F5F0FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 12 }}>💬</div>
                    <p style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: '0 0 6px' }}>Neues Gespräch</p>
                    <p style={{ fontSize: 13, color: '#888', margin: 0, lineHeight: 1.5 }}>Schreib uns deine Frage — wir melden uns bald.</p>
                  </div>
                )}

                {messages.map(msg => {
                  const isUser = msg.senderType === 'user'
                  const mediaEl = msg.contentType === 'image' && msg.mediaUrl
                    ? <img src={msg.mediaUrl} alt="Bild" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 10, display: 'block' }} />
                    : null

                  if (isUser) return (
                    <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <div className="fs-msg-bubble-user">{mediaEl ?? msg.content}</div>
                      <span style={{ fontSize: 10, color: '#AAA', marginTop: 3 }}>{formatTime(msg.createdAt)}</span>
                    </div>
                  )
                  return (
                    <div key={msg.id} style={{ display: 'flex', alignItems: 'flex-end', gap: 7 }}>
                      <SupportAvatar size={22} />
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <div className="fs-msg-bubble-admin">{mediaEl ?? msg.content}</div>
                        <span style={{ fontSize: 10, color: '#AAA', marginTop: 3 }}>{formatTime(msg.createdAt)}</span>
                      </div>
                    </div>
                  )
                })}

                {isClosed && screen === 'chat' && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: '#999', background: '#EBEBEB', borderRadius: 20, padding: '4px 12px' }}>
                      Gespräch geschlossen
                    </span>
                  </div>
                )}

                <div ref={messagesEndRef} style={{ height: 1, flexShrink: 0 }} />
              </div>

              {/* Input area */}
              {!isClosed ? (
                <div style={{ flexShrink: 0, borderTop: '1px solid #EBEBEB', background: '#fff', position: 'relative' }}>
                  {/* Popover panels */}
                  {showEmoji && <EmojiPicker onSelect={emoji => { setInput(p => p + emoji); textareaRef.current?.focus() }} />}

                  {/* Toolbar */}
                  <div style={{ height: 42, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                      className={`fs-toolbar-btn${showEmoji ? ' active' : ''}`}
                      onClick={() => setShowEmoji(p => !p)}
                      title="Emoji"
                    >
                      <SmileIcon active={showEmoji} />
                    </button>
                    <button
                      className="fs-toolbar-btn"
                      onClick={() => { fileInputRef.current?.click(); setShowEmoji(false) }}
                      disabled={uploading}
                      title="Bild hochladen"
                      style={{ opacity: uploading ? 0.4 : 1 }}
                    >
                      <ImageIcon active={false} />
                    </button>
                    {uploading && <span style={{ fontSize: 11, color: '#999', marginLeft: 6 }}>Lädt hoch…</span>}
                  </div>

                  {/* Textarea + send */}
                  <div style={{ padding: '0 14px 12px', display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      onCompositionStart={() => { isComposingRef.current = true }}
                      onCompositionEnd={() => { isComposingRef.current = false }}
                      placeholder="Schreib uns eine Nachricht…"
                      rows={1}
                      disabled={sending || uploading}
                      style={{
                        flex: 1, border: '1.5px solid #E8E8E8', borderRadius: 12,
                        padding: '8px 12px', fontSize: 16, fontFamily: 'inherit',
                        resize: 'none', outline: 'none', minHeight: 36, maxHeight: 90,
                        overflowY: 'auto', lineHeight: 1.5, color: '#111', background: '#fff',
                        transition: 'border-color 0.15s',
                      }}
                      onFocus={e => (e.currentTarget.style.borderColor = '#111')}
                      onBlur={e => (e.currentTarget.style.borderColor = '#E8E8E8')}
                    />
                    <button
                      onClick={() => sendMessage()}
                      disabled={!canSend}
                      style={{
                        width: 36, height: 36, borderRadius: '50%', border: 'none',
                        cursor: canSend ? 'pointer' : 'default',
                        background: canSend ? '#111' : '#E8E8E8',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        transition: 'background 0.15s',
                      }}
                    >
                      <ArrowUpIcon color={canSend ? 'white' : '#AAA'} />
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '12px 16px', borderTop: '1px solid #EBEBEB', flexShrink: 0, textAlign: 'center', background: '#fff' }}>
                  <button
                    onClick={() => { setScreen('new'); setMessages([]); setActiveConvId(null); setActiveConvStatus('open') }}
                    style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Neues Gespräch starten →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Launcher button */}
      <button
        className="fs-support-launcher"
        onClick={toggleOpen}
        aria-label={open ? 'Chat schließen' : 'Support Chat öffnen'}
        style={{ position: 'fixed' }}
      >
        {open
          ? <XIcon size={16} />
          : <ChatBubbleIcon />
        }
        {!open && totalUnread > 0 && (
          <div style={{
            position: 'absolute', top: -4, right: -4,
            background: '#EF4444', color: '#fff', borderRadius: '50%',
            width: 20, height: 20, fontSize: 11, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #fff',
          }}>
            {totalUnread > 9 ? '9+' : totalUnread}
          </div>
        )}
      </button>
    </>
  )
}
