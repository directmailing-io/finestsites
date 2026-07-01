'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  if (isToday) return `${hh}:${mm}`
  return `${d.getDate()}.${d.getMonth() + 1}. ${hh}:${mm}`
}

function truncatePreview(msg: ConversationSummary['lastMessage']): string {
  if (!msg) return 'Kein Inhalt'
  if (msg.contentType === 'image') return '📷 Bild'
  return msg.content.length > 80 ? msg.content.slice(0, 80) + '…' : msg.content
}

function statusColor(status: string) {
  return status === 'open' ? '#22C55E' : '#9CA3AF'
}

function convTitle(conv: ConversationSummary): string {
  if (conv.subject) return conv.subject
  if (conv.lastMessage?.content) {
    const t = conv.lastMessage.content.trim()
    return t.length > 40 ? t.slice(0, 40) + '…' : t
  }
  return 'Gespräch'
}

function isLiveHours(): boolean {
  const h = new Date().getHours()
  return h >= 9 && h < 18
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SupportAvatar({ size }: { size: number }) {
  const [err, setErr] = useState(false)
  if (!err) {
    return (
      <img
        src="/support-avatar.png"
        alt="Support"
        width={size} height={size}
        style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        onError={() => setErr(true)}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg,#6366F1,#8B5CF6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, color: '#fff', fontSize: size * 0.4, fontWeight: 700,
    }}>S</div>
  )
}

const EMOJI_GROUPS = [
  { label: 'Gesichter', emojis: ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🥰','😍','😘','🙂','🤗','🤔','😐','😶','😏','😒','🙄','😬','😌','😔','😴'] },
  { label: 'Gesten', emojis: ['👍','👎','👏','🙌','🤝','👊','✊','🤞','✌️','🤟','👌','🤌','👈','👉','👆','👇','✋','🤚','🖐','💪'] },
  { label: 'Herzen', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','💕','💞','💓','💗','💖','💘','💝'] },
  { label: 'Feiern', emojis: ['🎉','🎊','🥳','🎈','🎁','🏆','🥇','🎯','🎨','🎤','🎵','🎶','✅','⭐','🔥','💯','🚀','🌟','💡'] },
]

function EmojiPicker({ onSelect }: { onSelect: (e: string) => void }) {
  const [tab, setTab] = useState(0)
  return (
    <div style={{
      position: 'absolute', bottom: '100%', left: 0, right: 0,
      background: '#fff', borderTop: '1px solid #EBEBEB',
      maxHeight: 220, display: 'flex', flexDirection: 'column', zIndex: 10,
    }}>
      <div style={{ display: 'flex', borderBottom: '1px solid #F0F0F0', overflowX: 'auto', flexShrink: 0 }}>
        {EMOJI_GROUPS.map((g, i) => (
          <button key={i} onClick={() => setTab(i)} style={{
            padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: tab === i ? 700 : 400,
            color: tab === i ? '#111' : '#888',
            borderBottom: tab === i ? '2px solid #111' : '2px solid transparent',
            whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'inherit',
          }}>{g.label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, padding: 10, overflowY: 'auto' }}>
        {EMOJI_GROUPS[tab].emojis.map(e => (
          <button key={e} onClick={() => onSelect(e)} style={{
            fontSize: 24, background: 'none', border: 'none', cursor: 'pointer',
            padding: '4px 6px', borderRadius: 8, lineHeight: 1,
          }}>{e}</button>
        ))}
      </div>
    </div>
  )
}

// ─── ConvRow ──────────────────────────────────────────────────────────────────

function ConvRow({ conv, onOpen, onDelete }: {
  conv: ConversationSummary
  onOpen: () => void
  onDelete: () => void
}) {
  const [confirmDel, setConfirmDel] = useState(false)
  return (
    <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <button
        onClick={onOpen}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
      >
        <SupportAvatar size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {convTitle(conv)}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {conv.unreadByUser > 0 && (
                <span style={{ background: '#111', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>
                  {conv.unreadByUser}
                </span>
              )}
              <span style={{ fontSize: 11, color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                {conv.lastMessageAt ? formatTime(conv.lastMessageAt) : ''}
              </span>
            </div>
          </div>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: '#777', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {truncatePreview(conv.lastMessage)}
          </p>
        </div>
      </button>
      {confirmDel ? (
        <div style={{ display: 'flex', gap: 8, padding: '0 16px 12px' }}>
          <button onClick={() => setConfirmDel(false)} style={{ flex: 1, padding: '8px', border: 'none', borderRadius: 10, background: '#F3F4F6', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Abbrechen
          </button>
          <button onClick={onDelete} style={{ flex: 1, padding: '8px', border: 'none', borderRadius: 10, background: '#FEE2E2', color: '#DC2626', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Löschen
          </button>
        </div>
      ) : (
        <button onClick={() => setConfirmDel(true)} style={{ width: '100%', padding: '8px 16px', border: 'none', borderTop: '1px solid #F5F5F5', background: 'none', color: '#9CA3AF', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
          Gespräch löschen
        </button>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SupportPage() {
  const router = useRouter()
  const [screen, setScreen] = useState<'list' | 'new' | 'chat'>('list')
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [activeConvStatus, setActiveConvStatus] = useState<string>('open')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [live] = useState(isLiveHours())

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const convPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastMsgTimeRef = useRef<string | null>(null)
  const isComposingRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/support/conversation')
      const data = await res.json()
      const convs: ConversationSummary[] = data.conversations ?? []
      setConversations(convs)
      const count = convs.reduce((s, c) => s + (c.unreadByUser ?? 0), 0)
      window.dispatchEvent(new CustomEvent('supportUnreadUpdate', { detail: { count } }))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchConversations() }, [fetchConversations])

  useEffect(() => {
    convPollRef.current = setInterval(fetchConversations, 5000)
    return () => { if (convPollRef.current) clearInterval(convPollRef.current) }
  }, [fetchConversations])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (screen !== 'chat' || !activeConvId) {
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
            const fresh = (data.messages as Message[]).filter((m: Message) => !ids.has(m.id))
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
  }, [screen, activeConvId, activeConvStatus])

  async function openConversation(conv: ConversationSummary) {
    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unreadByUser: 0 } : c))
    const count = Math.max(0, conversations.reduce((s, c) => s + (c.unreadByUser ?? 0), 0) - (conv.unreadByUser ?? 0))
    window.dispatchEvent(new CustomEvent('supportUnreadUpdate', { detail: { count } }))
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
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, contentType, ...(mediaUrl ? { mediaUrl } : {}) }),
        })
        data = await res.json()
        if (data.conversation) {
          const c = data.conversation
          setActiveConvId(c.id)
          setActiveConvStatus(c.status)
          setScreen('chat')
          setConversations(prev => [{ ...c, unreadByUser: 0, lastMessage: { content, contentType, senderType: 'user' } }, ...prev])
        }
      } else {
        const res = await fetch('/api/support/messages', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
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

  async function deleteConversation(convId: string) {
    setConversations(prev => prev.filter(c => c.id !== convId))
    if (activeConvId === convId) { setScreen('list'); setActiveConvId(null) }
    try { await fetch(`/api/support/conversation/${convId}`, { method: 'DELETE' }) } catch { /* ignore */ }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !isComposingRef.current) {
      e.preventDefault(); sendMessage()
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 90)}px`
  }

  const canSend = input.trim().length > 0 && !sending && !uploading
  const isClosed = activeConvStatus === 'closed'
  const activeConv = conversations.find(c => c.id === activeConvId)

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: '#F8F8F8',
      display: 'flex', flexDirection: 'column',
    }}>
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp"
        style={{ display: 'none' }} onChange={handleFileUpload} />

      {/* ── Top bar ── */}
      <div style={{
        background: '#111', flexShrink: 0,
        paddingTop: 'env(safe-area-inset-top, 0px)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          height: 56, padding: '0 16px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          {/* Back button */}
          <button
            onClick={() => {
              if (screen === 'list') router.back()
              else { setScreen('list'); fetchConversations(); setShowEmoji(false) }
            }}
            style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(255,255,255,0.12)', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>

          {screen === 'list' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
              <SupportAvatar size={34} />
              <div>
                <p style={{ margin: 0, color: '#fff', fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>Support</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: live ? '#22C55E' : '#F97316',
                  }} />
                  <span style={{ fontSize: 11, color: live ? '#86EFAC' : '#FED7AA' }}>
                    {live ? 'Jetzt erreichbar' : 'Außerhalb der Zeiten'}
                  </span>
                </div>
              </div>
            </div>
          ) : screen === 'new' ? (
            <p style={{ margin: 0, color: '#fff', fontSize: 15, fontWeight: 700, flex: 1 }}>Neues Gespräch</p>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <p style={{ margin: 0, color: '#fff', fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeConv ? convTitle(activeConv) : 'Chat'}
              </p>
              <div style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: statusColor(activeConvStatus),
              }} />
            </div>
          )}
        </div>
      </div>

      {/* ── LIST screen ── */}
      {screen === 'list' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 0' }}>
          {conversations.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '32px 24px', textAlign: 'center' }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#F5F0FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, marginBottom: 20 }}>👋</div>
              <p style={{ fontSize: 20, fontWeight: 700, color: '#111', margin: '0 0 10px' }}>Wie können wir helfen?</p>
              <p style={{ fontSize: 14, color: '#777', margin: '0 0 32px', maxWidth: 260, lineHeight: 1.55 }}>Unser Team antwortet normalerweise innerhalb weniger Stunden.</p>
              <button
                onClick={() => { setScreen('new'); setMessages([]); setActiveConvId(null) }}
                style={{ width: '100%', maxWidth: 320, padding: '15px 20px', background: '#111', color: '#fff', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Gespräch starten →
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => { setScreen('new'); setMessages([]); setActiveConvId(null) }}
                style={{
                  width: '100%', textAlign: 'left', border: '1.5px dashed #D1D5DB', borderRadius: 14,
                  padding: '12px 16px', background: '#fff', color: '#555', fontSize: 14,
                  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                <span style={{ fontSize: 20, lineHeight: 1 }}>+</span> Neues Gespräch starten
              </button>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 24 }}>
                {conversations.map(conv => (
                  <ConvRow
                    key={conv.id}
                    conv={conv}
                    onOpen={() => openConversation(conv)}
                    onDelete={() => deleteConversation(conv.id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── CHAT / NEW screen ── */}
      {(screen === 'chat' || screen === 'new') && (
        <>
          {/* Messages area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.length === 0 && screen === 'new' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, textAlign: 'center', padding: '0 24px' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F5F0FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, marginBottom: 14 }}>💬</div>
                <p style={{ fontSize: 17, fontWeight: 700, color: '#111', margin: '0 0 6px' }}>Neues Gespräch</p>
                <p style={{ fontSize: 14, color: '#888', margin: 0, lineHeight: 1.5 }}>Schreib uns deine Frage — wir melden uns bald.</p>
              </div>
            )}

            {messages.map(msg => {
              const isUser = msg.senderType === 'user'
              const mediaEl = msg.contentType === 'image' && msg.mediaUrl
                ? <img src={msg.mediaUrl} alt="Bild" style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 12, display: 'block' }} />
                : null

              if (isUser) return (
                <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <div style={{
                    background: '#111', color: '#fff',
                    borderRadius: '18px 18px 4px 18px', padding: '10px 14px',
                    maxWidth: '80%', fontSize: 15, lineHeight: 1.5, wordBreak: 'break-word',
                  }}>{mediaEl ?? msg.content}</div>
                  <span style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>{formatTime(msg.createdAt)}</span>
                </div>
              )
              return (
                <div key={msg.id} style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                  <SupportAvatar size={26} />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <div style={{
                      background: '#fff', color: '#111',
                      borderRadius: '18px 18px 18px 4px', padding: '10px 14px',
                      maxWidth: '80%', fontSize: 15, lineHeight: 1.5, wordBreak: 'break-word',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                    }}>{mediaEl ?? msg.content}</div>
                    <span style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>{formatTime(msg.createdAt)}</span>
                  </div>
                </div>
              )
            })}

            {isClosed && screen === 'chat' && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                <span style={{ fontSize: 12, color: '#999', background: '#E5E7EB', borderRadius: 20, padding: '4px 14px' }}>
                  Gespräch geschlossen
                </span>
              </div>
            )}

            <div ref={messagesEndRef} style={{ height: 1, flexShrink: 0 }} />
          </div>

          {/* Input area */}
          {!isClosed ? (
            <div style={{
              flexShrink: 0, borderTop: '1px solid #E5E7EB',
              background: '#fff', position: 'relative',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}>
              {showEmoji && <EmojiPicker onSelect={emoji => { setInput(p => p + emoji); textareaRef.current?.focus() }} />}

              {/* Toolbar */}
              <div style={{ height: 44, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  onClick={() => setShowEmoji(p => !p)}
                  style={{
                    width: 34, height: 34, border: 'none', borderRadius: 8,
                    background: showEmoji ? '#F0F0F0' : 'transparent',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={showEmoji ? '#111' : '#888'} strokeWidth="1.75">
                    <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
                  </svg>
                </button>
                <button
                  onClick={() => { fileInputRef.current?.click(); setShowEmoji(false) }}
                  disabled={uploading}
                  style={{
                    width: 34, height: 34, border: 'none', borderRadius: 8,
                    background: 'transparent', cursor: uploading ? 'default' : 'pointer',
                    opacity: uploading ? 0.4 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.75">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                  </svg>
                </button>
                {uploading && <span style={{ fontSize: 12, color: '#999' }}>Lädt hoch…</span>}
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
                    flex: 1, border: '1.5px solid #E5E7EB', borderRadius: 14,
                    padding: '10px 14px', fontSize: 16, fontFamily: 'inherit',
                    resize: 'none', outline: 'none', minHeight: 42, maxHeight: 90,
                    overflowY: 'auto', lineHeight: 1.5, color: '#111', background: '#F9FAFB',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#111'; e.currentTarget.style.background = '#fff' }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.background = '#F9FAFB' }}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!canSend}
                  style={{
                    width: 42, height: 42, borderRadius: '50%', border: 'none', flexShrink: 0,
                    cursor: canSend ? 'pointer' : 'default',
                    background: canSend ? '#111' : '#E5E7EB',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.15s',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 13V3M8 3L3 8M8 3l5 5" stroke={canSend ? '#fff' : '#9CA3AF'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <div style={{
              padding: '14px 16px', borderTop: '1px solid #E5E7EB',
              flexShrink: 0, textAlign: 'center', background: '#fff',
              paddingBottom: 'env(safe-area-inset-bottom, 14px)',
            }}>
              <button
                onClick={() => { setScreen('new'); setMessages([]); setActiveConvId(null); setActiveConvStatus('open') }}
                style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 12, padding: '11px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Neues Gespräch starten →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
