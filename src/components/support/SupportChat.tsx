'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

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
  unreadByUser: number
  lastMessageAt: string | null
  lastMessage: { content: string; contentType: string; senderType: string; createdAt?: string } | null
}

interface GifResult {
  id: string
  title: string
  previewUrl: string
  url: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const EMOJI_GROUPS = [
  { label: '😀 Gesichter', emojis: ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🥰','😍','🤩','😘','😗','😙','😚','🙂','🤗','🤔','🤐','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴'] },
  { label: '👍 Gesten', emojis: ['👍','👎','👏','🙌','🤝','👊','✊','🤛','🤜','🤞','✌️','🤟','🤘','👌','🤌','🤏','👈','👉','👆','👇','☝️','✋','🤚','🖐','🖖','💪','🦾','🦿'] },
  { label: '❤️ Herzen', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☯️','🕉️','🛐'] },
  { label: '🎉 Feiern', emojis: ['🎉','🎊','🥳','🎈','🎁','🎀','🎗️','🎟️','🎫','🏆','🥇','🥈','🥉','🎖️','🏅','🎯','🎪','🤹','🎭','🎨','🎬','🎤','🎵','🎶','🎸','🎹','🎺','🎻'] },
  { label: '✅ Symbole', emojis: ['✅','❌','⭕','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🔶','🔷','🔸','🔹','🔺','🔻','💠','🔘','🔲','🔳','⬛','⬜','▪️','▫️','◾','◽'] },
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
  align-self: flex-start; background: #F7F7F7; color: #111;
  border-radius: 18px 18px 18px 4px; padding: 10px 14px;
  max-width: 80%; font-size: 14px; line-height: 1.5; word-break: break-word;
}
.fs-support-messages::-webkit-scrollbar { width: 4px; }
.fs-support-messages::-webkit-scrollbar-track { background: transparent; }
.fs-support-messages::-webkit-scrollbar-thumb { background: #E0E0E0; border-radius: 4px; }
@media (max-width: 640px) {
  .fs-support-panel {
    bottom: 0; right: 0; left: 0; border-radius: 20px 20px 0 0;
    width: 100%; height: 75vh;
  }
}
`

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  if (msg.contentType === 'gif') return 'GIF'
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

// ─── SVG Icons ───────────────────────────────────────────────────────────────

function ChatIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" fill="white" />
    </svg>
  )
}

function CloseIcon({ size = 14, color = 'white' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M1 1L13 13M13 1L1 13" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function SendIcon({ color = 'white' }: { color?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 13V3M8 3L4 7M8 3L12 7" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M12 4L6 10L12 16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showGifSearch, setShowGifSearch] = useState(false)
  const [gifQuery, setGifQuery] = useState('')
  const [gifs, setGifs] = useState<GifResult[]>([])
  const [loadingGifs, setLoadingGifs] = useState(false)
  const [totalUnread, setTotalUnread] = useState(0)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const convPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastMsgTimeRef = useRef<string | null>(null)
  const isComposingRef = useRef(false)
  const gifDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Fetch conversations ──────────────────────────────────────────────────

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/support/conversation')
      const data = await res.json()
      const convs: ConversationSummary[] = data.conversations ?? []
      setConversations(convs)
      setTotalUnread(convs.reduce((sum, c) => sum + (c.unreadByUser ?? 0), 0))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // ── Auto-scroll ──────────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Polling: messages ────────────────────────────────────────────────────

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
            const newMsgs = (data.messages as Message[]).filter(m => !ids.has(m.id))
            if (newMsgs.length === 0) return prev
            lastMsgTimeRef.current = data.messages[data.messages.length - 1].createdAt
            return [...prev, ...newMsgs]
          })
        }
        if (data.conversationStatus && data.conversationStatus !== activeConvStatus) {
          setActiveConvStatus(data.conversationStatus)
        }
      } catch { /* ignore */ }
    }, 3000)

    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }
  }, [open, screen, activeConvId, activeConvStatus])

  // ── Polling: conversation list ───────────────────────────────────────────

  useEffect(() => {
    if (!open) {
      if (convPollRef.current) { clearInterval(convPollRef.current); convPollRef.current = null }
      return
    }
    convPollRef.current = setInterval(fetchConversations, 10000)
    return () => { if (convPollRef.current) { clearInterval(convPollRef.current); convPollRef.current = null } }
  }, [open, fetchConversations])

  // ── Open conversation ────────────────────────────────────────────────────

  async function openConversation(conv: ConversationSummary) {
    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unreadByUser: 0 } : c))
    setTotalUnread(prev => Math.max(0, prev - (conv.unreadByUser ?? 0)))

    setActiveConvId(conv.id)
    setActiveConvStatus(conv.status)
    setScreen('chat')
    setMessages([])
    lastMsgTimeRef.current = null

    try {
      const res = await fetch(`/api/support/messages?conversationId=${conv.id}`)
      const data = await res.json()
      const msgs: Message[] = data.messages ?? []
      setMessages(msgs)
      if (msgs.length > 0) {
        lastMsgTimeRef.current = msgs[msgs.length - 1].createdAt
      }
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
      id: tempId,
      conversationId: activeConvId ?? '',
      senderType: 'user',
      senderId: null,
      content,
      contentType: contentType as Message['contentType'],
      mediaUrl: mediaUrl ?? null,
      createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempMsg])
    if (contentType === 'text') setInput('')
    if (textareaRef.current) { textareaRef.current.style.height = 'auto' }

    try {
      let data: { message?: Message; conversation?: ConversationSummary }

      if (!activeConvId || screen === 'new') {
        const res = await fetch('/api/support/conversation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, contentType, ...(mediaUrl ? { mediaUrl } : {}) }),
        })
        data = await res.json()
        if (data.conversation) {
          const newConv = data.conversation
          setActiveConvId(newConv.id)
          setActiveConvStatus(newConv.status)
          setScreen('chat')
          setConversations(prev => [{
            ...newConv,
            lastMessage: { content, contentType, senderType: 'user', createdAt: new Date().toISOString() },
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
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/support/upload', { method: 'POST', body: formData })
      if (!res.ok) { alert('Upload fehlgeschlagen'); return }
      const { url } = await res.json()
      await sendMessage({ contentType: 'image', mediaUrl: url, content: '' })
    } catch { alert('Upload fehlgeschlagen') }
    finally { setUploading(false) }
  }

  // ── GIF search ───────────────────────────────────────────────────────────

  function handleGifQueryChange(q: string) {
    setGifQuery(q)
    if (gifDebounceRef.current) clearTimeout(gifDebounceRef.current)
    gifDebounceRef.current = setTimeout(async () => {
      if (!q.trim()) { setGifs([]); return }
      setLoadingGifs(true)
      try {
        const res = await fetch(`/api/support/gifs?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setGifs(data.gifs ?? [])
      } catch { setGifs([]) }
      finally { setLoadingGifs(false) }
    }, 400)
  }

  async function sendGif(gif: GifResult) {
    setShowGifSearch(false)
    setGifQuery('')
    setGifs([])
    await sendMessage({ contentType: 'gif', mediaUrl: gif.url, content: '' })
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

  // ── Toggle panel ─────────────────────────────────────────────────────────

  function toggleOpen() {
    if (open) {
      setOpen(false)
      setShowEmojiPicker(false)
      setShowGifSearch(false)
    } else {
      setOpen(true)
      setScreen('list')
    }
  }

  // ─── Render helpers ───────────────────────────────────────────────────────

  const canSend = (input.trim().length > 0 || false) && !sending && !uploading
  const isClosed = activeConvStatus === 'closed'

  // ── Header ───────────────────────────────────────────────────────────────

  function PanelHeader() {
    const isChat = screen === 'chat'
    const isNew = screen === 'new'

    return (
      <div style={{
        minHeight: isChat ? 60 : 72,
        background: '#111',
        borderRadius: '20px 20px 0 0',
        padding: isChat ? '0 16px' : '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        {isChat || isNew ? (
          /* Back button side */
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => {
                setScreen('list')
                fetchConversations()
                setShowEmojiPicker(false)
                setShowGifSearch(false)
              }}
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)', border: 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', flexShrink: 0,
              }}
              aria-label="Zurück"
            >
              <BackIcon />
            </button>
            {isChat && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>Gespräch</span>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: statusColor(activeConvStatus), flexShrink: 0,
                }} />
              </div>
            )}
            {isNew && (
              <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>Neues Gespräch</span>
            )}
          </div>
        ) : (
          /* Logo side */
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'linear-gradient(135deg, #8060b0, #5a3d8a)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0,
            }}>
              FS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ color: '#fff', fontSize: 15, fontWeight: 600, lineHeight: 1 }}>Support</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E' }} />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1 }}>Wir sind online</span>
              </div>
            </div>
          </div>
        )}

        {/* Close button */}
        <button
          onClick={() => { setOpen(false); setShowEmojiPicker(false); setShowGifSearch(false) }}
          style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)', border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0,
          }}
          aria-label="Chat schließen"
        >
          <CloseIcon />
        </button>
      </div>
    )
  }

  // ── Welcome card ─────────────────────────────────────────────────────────

  function WelcomeCard() {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '32px 24px',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: '#F5F0FF', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 28, userSelect: 'none',
        }}>
          👋
        </div>
        <p style={{ fontSize: 18, fontWeight: 700, color: '#111', margin: '12px 0 0 0', lineHeight: 1.3 }}>
          Wie können wir dir helfen?
        </p>
        <p style={{ fontSize: 14, color: '#666', margin: '8px 0 0 0', maxWidth: 240, lineHeight: 1.5 }}>
          Unser Team antwortet normalerweise in wenigen Stunden.
        </p>
      </div>
    )
  }

  // ── Input bar (used in NEW and CHAT) ─────────────────────────────────────

  function InputBar() {
    return (
      <div style={{ flexShrink: 0, borderTop: '1px solid #F0F0F0', position: 'relative' }}>
        {/* Emoji picker */}
        {showEmojiPicker && (
          <div style={{
            position: 'absolute', bottom: '100%', left: 0,
            background: '#fff', border: '1px solid #E8E8E8',
            borderRadius: 16, padding: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            width: 280, zIndex: 100, maxHeight: 280, overflowY: 'auto',
          }}>
            {EMOJI_GROUPS.map(group => (
              <div key={group.label} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: '#999', marginBottom: 4, fontWeight: 600 }}>{group.label}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  {group.emojis.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => setInput(prev => prev + emoji)}
                      style={{
                        width: 28, height: 28, border: 'none',
                        background: 'transparent', cursor: 'pointer',
                        fontSize: 18, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', borderRadius: 6,
                        padding: 0,
                      }}
                      title={emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* GIF search panel */}
        {showGifSearch && (
          <div style={{
            position: 'absolute', bottom: '100%', left: 0,
            background: '#fff', border: '1px solid #E8E8E8',
            borderRadius: 16, padding: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            width: 300, maxHeight: 320, overflowY: 'auto', zIndex: 100,
          }}>
            <input
              type="text"
              value={gifQuery}
              onChange={e => handleGifQueryChange(e.target.value)}
              placeholder="GIF suchen..."
              style={{
                width: '100%', border: '1px solid #E8E8E8',
                borderRadius: 8, padding: '8px 10px',
                fontSize: 13, outline: 'none',
                fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
            {loadingGifs && (
              <div style={{ fontSize: 13, color: '#999', marginTop: 8, textAlign: 'center' }}>Suche...</div>
            )}
            {!loadingGifs && gifQuery && gifs.length === 0 && (
              <div style={{ fontSize: 13, color: '#999', marginTop: 8, textAlign: 'center' }}>Keine GIFs gefunden</div>
            )}
            {gifs.length > 0 && (
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 6, marginTop: 8,
              }}>
                {gifs.map(gif => (
                  <img
                    key={gif.id}
                    src={gif.previewUrl}
                    alt={gif.title}
                    style={{ width: '100%', borderRadius: 8, cursor: 'pointer', display: 'block' }}
                    onClick={() => sendGif(gif)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Toolbar */}
        <div style={{
          height: 40, padding: '0 12px',
          display: 'flex', alignItems: 'center', gap: 8,
          borderTop: 'none',
        }}>
          {/* Emoji button */}
          <button
            onClick={() => { setShowEmojiPicker(p => !p); setShowGifSearch(false) }}
            title="Emoji"
            style={{
              width: 32, height: 32, border: 'none',
              background: 'transparent', cursor: 'pointer',
              fontSize: 18, display: 'flex', alignItems: 'center',
              justifyContent: 'center', borderRadius: 6,
              color: showEmojiPicker ? '#111' : '#666',
            }}
          >
            😀
          </button>

          {/* Image upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Bild hochladen"
            disabled={uploading}
            style={{
              width: 32, height: 32, border: 'none',
              background: 'transparent', cursor: uploading ? 'default' : 'pointer',
              fontSize: 18, display: 'flex', alignItems: 'center',
              justifyContent: 'center', borderRadius: 6, color: '#666',
              opacity: uploading ? 0.5 : 1,
            }}
          >
            📷
          </button>

          {/* GIF button */}
          <button
            onClick={() => { setShowGifSearch(p => !p); setShowEmojiPicker(false) }}
            title="GIF senden"
            style={{
              height: 24, border: `1px solid ${showGifSearch ? '#888' : '#CCC'}`,
              background: 'transparent', cursor: 'pointer',
              fontSize: 11, fontWeight: 700, borderRadius: 6,
              padding: '2px 5px', color: showGifSearch ? '#111' : '#666',
              fontFamily: 'inherit', lineHeight: 1,
            }}
          >
            GIF
          </button>

          {/* Upload indicator */}
          {uploading && (
            <span style={{ fontSize: 12, color: '#999', marginLeft: 4 }}>Lade hoch...</span>
          )}
        </div>

        {/* Textarea + send */}
        <div style={{
          padding: '0 16px 10px',
          display: 'flex', alignItems: 'flex-end', gap: 8,
        }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => { isComposingRef.current = true }}
            onCompositionEnd={() => { isComposingRef.current = false }}
            placeholder="Schreib uns eine Nachricht..."
            rows={1}
            disabled={sending || uploading || isClosed}
            style={{
              flex: 1,
              border: '1px solid #E8E8E8',
              borderRadius: 12,
              padding: '8px 12px',
              fontSize: 14,
              fontFamily: 'inherit',
              resize: 'none',
              outline: 'none',
              minHeight: 36,
              maxHeight: 90,
              overflowY: 'auto',
              lineHeight: 1.5,
              color: '#111',
              background: isClosed ? '#F9F9F9' : '#fff',
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!canSend}
            aria-label="Nachricht senden"
            style={{
              width: 36, height: 36, borderRadius: '50%',
              border: 'none', cursor: canSend ? 'pointer' : 'default',
              background: canSend ? '#111' : '#E8E8E8',
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0,
              transition: 'background 0.15s',
            }}
          >
            <SendIcon color={canSend ? 'white' : '#999'} />
          </button>
        </div>
      </div>
    )
  }

  // ── Message bubble ────────────────────────────────────────────────────────

  function MessageBubble({ msg }: { msg: Message }) {
    const isUser = msg.senderType === 'user'

    function BubbleContent() {
      if ((msg.contentType === 'image' || msg.contentType === 'gif') && msg.mediaUrl) {
        return (
          <img
            src={msg.mediaUrl}
            alt={msg.contentType === 'gif' ? 'GIF' : 'Bild'}
            style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 12, display: 'block' }}
          />
        )
      }
      return <>{msg.content}</>
    }

    if (isUser) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <div className="fs-msg-bubble-user">
            <BubbleContent />
          </div>
          <span style={{ fontSize: 11, color: '#999', marginTop: 3 }}>
            {formatTime(msg.createdAt)}
          </span>
        </div>
      )
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          background: 'linear-gradient(135deg, #8060b0, #5a3d8a)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 9, fontWeight: 700,
          flexShrink: 0, userSelect: 'none',
        }}>
          FS
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div className="fs-msg-bubble-admin">
            <BubbleContent />
          </div>
          <span style={{ fontSize: 11, color: '#999', marginTop: 3 }}>
            {formatTime(msg.createdAt)}
          </span>
        </div>
      </div>
    )
  }

  // ── LIST screen ───────────────────────────────────────────────────────────

  function ListScreen() {
    return (
      <>
        <PanelHeader />
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 16px' }} className="fs-support-messages">
          {conversations.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              height: '100%', padding: '32px 24px', textAlign: 'center',
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: '#F5F0FF', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 28, userSelect: 'none', marginBottom: 16,
              }}>
                👋
              </div>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#111', margin: '0 0 8px 0', lineHeight: 1.3 }}>
                Wie können wir dir helfen?
              </p>
              <p style={{ fontSize: 14, color: '#666', margin: '0 0 24px 0', maxWidth: 240, lineHeight: 1.5 }}>
                Unser Team antwortet normalerweise in wenigen Stunden.
              </p>
              <button
                onClick={() => { setScreen('new'); setMessages([]); setActiveConvId(null) }}
                style={{
                  width: '100%', padding: '13px 20px',
                  background: '#111', color: '#fff',
                  border: 'none', borderRadius: 12,
                  fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Neues Gespräch starten →
              </button>
            </div>
          ) : (
            <>
              {/* New conversation button */}
              <button
                onClick={() => { setScreen('new'); setMessages([]); setActiveConvId(null) }}
                style={{
                  width: '100%', textAlign: 'left',
                  border: '1px solid #E0E0E0', borderRadius: 12,
                  padding: '12px 16px', background: '#FAFAFA',
                  color: '#111', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                  marginBottom: 8,
                }}
              >
                + Neues Gespräch starten
              </button>

              {/* Conversation list */}
              {conversations.map(conv => (
                <ConvRow key={conv.id} conv={conv} />
              ))}
            </>
          )}
        </div>
      </>
    )
  }

  function ConvRow({ conv }: { conv: ConversationSummary }) {
    const [hovered, setHovered] = useState(false)

    return (
      <div
        onClick={() => openConversation(conv)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          padding: '12px 16px', cursor: 'pointer',
          borderBottom: '1px solid #F5F5F5',
          background: hovered ? '#FAFAFA' : 'transparent',
          borderRadius: 8,
          transition: 'background 0.1s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          {/* Status dot */}
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: statusColor(conv.status),
            marginTop: 5, flexShrink: 0,
          }} />

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Row 1: title + time + unread */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>Gespräch</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
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
              </div>
            </div>

            {/* Row 2: last message preview */}
            <div style={{
              fontSize: 13, color: '#666', marginTop: 2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {truncatePreview(conv.lastMessage)}
            </div>

            {/* Row 3: status pill */}
            <div style={{ marginTop: 4 }}>
              <span style={{
                fontSize: 10, color: statusColor(conv.status),
                fontWeight: 600,
              }}>
                {statusLabel(conv.status)}
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── CHAT / NEW screen ─────────────────────────────────────────────────────

  function ChatScreen() {
    return (
      <>
        <PanelHeader />

        {/* Messages */}
        <div
          className="fs-support-messages"
          style={{
            flex: 1, overflowY: 'auto',
            padding: 16, gap: 8,
            display: 'flex', flexDirection: 'column',
            background: '#FAFAFA',
          }}
        >
          {messages.length === 0 && screen === 'new' && <WelcomeCard />}

          {messages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}

          {isClosed && screen === 'chat' && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
              <span style={{
                fontSize: 12, color: '#999',
                background: '#F0F0F0', borderRadius: 20,
                padding: '4px 12px',
              }}>
                Gespräch geschlossen
              </span>
            </div>
          )}

          <div ref={messagesEndRef} style={{ height: 1, flexShrink: 0 }} />
        </div>

        {/* Input (hide when closed) */}
        {!isClosed && <InputBar />}
        {isClosed && (
          <div style={{
            padding: '12px 16px', borderTop: '1px solid #F0F0F0',
            flexShrink: 0, textAlign: 'center',
          }}>
            <button
              onClick={() => { setScreen('new'); setMessages([]); setActiveConvId(null); setActiveConvStatus('open') }}
              style={{
                background: '#111', color: '#fff',
                border: 'none', borderRadius: 10,
                padding: '8px 18px', fontSize: 13,
                fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Neues Gespräch starten →
            </button>
          </div>
        )}
      </>
    )
  }

  // ─── Main render ──────────────────────────────────────────────────────────

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_STYLES }} />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,image/gif"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      {/* Panel */}
      {open && (
        <div className="fs-support-panel">
          {screen === 'list' && <ListScreen />}
          {(screen === 'chat' || screen === 'new') && <ChatScreen />}
        </div>
      )}

      {/* Launcher */}
      <button
        className="fs-support-launcher"
        onClick={toggleOpen}
        aria-label={open ? 'Chat schließen' : 'Support Chat öffnen'}
        aria-expanded={open}
        style={{ position: 'fixed' }}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M4 4L16 16M16 4L4 16" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <ChatIcon />
        )}

        {/* Unread badge */}
        {!open && totalUnread > 0 && (
          <div
            aria-label={`${totalUnread} ungelesene Nachricht${totalUnread !== 1 ? 'en' : ''}`}
            style={{
              position: 'absolute', top: -4, right: -4,
              background: '#EF4444', color: '#fff', borderRadius: '50%',
              width: 20, height: 20, fontSize: 11, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid #fff',
            }}
          >
            {totalUnread > 9 ? '9+' : totalUnread}
          </div>
        )}
      </button>
    </>
  )
}
