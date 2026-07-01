'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string
  conversationId: string
  senderType: 'user' | 'admin'
  senderId: string | null
  content: string
  contentType: 'text' | 'image' | 'gif'
  mediaUrl: string | null
  createdAt: string
}

interface ConversationWithUser {
  id: string
  userId: string
  status: 'open' | 'closed' | 'waiting'
  subject: string | null
  lastMessageAt: string | null
  unreadByAdmin: number
  createdAt: string
  user: {
    email: string
    username: string | null
    firstName: string | null
    lastName: string | null
    plan: string
  }
  lastMessage: { content: string; senderType: string; createdAt: string; contentType?: 'text' | 'image' | 'gif' } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  if (isToday) return `${hh}:${mm}`
  const dd = d.getDate().toString().padStart(2, '0')
  const mo = (d.getMonth() + 1).toString().padStart(2, '0')
  return `${dd}.${mo}. ${hh}:${mm}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatShortDate(iso: string): string {
  const d = new Date(iso)
  const dd = d.getDate().toString().padStart(2, '0')
  const mo = (d.getMonth() + 1).toString().padStart(2, '0')
  const yy = d.getFullYear().toString().slice(2)
  return `${dd}.${mo}.${yy}`
}

function renderMessageContent(msg: Message) {
  if (msg.contentType === 'image' && msg.mediaUrl) {
    return (
      <div>
        <img
          src={msg.mediaUrl}
          alt="Bild"
          style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 10, display: 'block', cursor: 'pointer' }}
          onClick={() => window.open(msg.mediaUrl!, '_blank')}
        />
        {msg.content && <div style={{ marginTop: 6, fontSize: 13 }}>{msg.content}</div>}
      </div>
    )
  }
  if (msg.contentType === 'gif' && msg.mediaUrl) {
    return (
      <img
        src={msg.mediaUrl}
        alt="GIF"
        style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 10, display: 'block' }}
      />
    )
  }
  return <span>{msg.content}</span>
}

function getInitials(user: ConversationWithUser['user']): string {
  if (user.firstName && user.lastName) return (user.firstName[0] + user.lastName[0]).toUpperCase()
  if (user.firstName) return user.firstName[0].toUpperCase()
  return (user.email[0] ?? '?').toUpperCase()
}

const AVATAR_COLORS = ['#8060b0', '#E85D75', '#3B82F6', '#10B981', '#F59E0B']

function getAvatarColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getDisplayName(user: ConversationWithUser['user']): string {
  if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`
  if (user.firstName) return user.firstName
  if (user.username) return user.username
  return user.email
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ user, size }: { user: ConversationWithUser['user']; size: number }) {
  const color = getAvatarColor(user.email)
  const initials = getInitials(user)
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: '#fff',
        fontSize: size * 0.37,
        fontWeight: 600,
        letterSpacing: '0.02em',
      }}
    >
      {initials}
    </div>
  )
}

function StatusPill({ status }: { status: 'open' | 'closed' | 'waiting' }) {
  const styles: Record<string, { background: string; color: string; label: string }> = {
    open: { background: '#F0FDF4', color: '#16A34A', label: 'Offen' },
    waiting: { background: '#FFF7ED', color: '#C2410C', label: 'Wartend' },
    closed: { background: '#F5F5F5', color: '#999', label: 'Geschlossen' },
  }
  const s = styles[status]
  return (
    <span
      style={{
        background: s.background,
        color: s.color,
        fontSize: 10,
        padding: '2px 8px',
        borderRadius: 100,
        fontWeight: 600,
        display: 'inline-block',
      }}
    >
      {s.label}
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

type FilterTab = 'all' | 'open' | 'waiting' | 'closed'

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'open', label: 'Offen' },
  { key: 'waiting', label: 'Wartend' },
  { key: 'closed', label: 'Geschlossen' },
]

export default function SupportAdminPanel() {
  const [conversations, setConversations] = useState<ConversationWithUser[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [editingSubject, setEditingSubject] = useState<string | null>(null)
  const [subjectDraft, setSubjectDraft] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pollMessagesRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollConvsRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Fetch conversations ──────────────────────────────────────────────────────

  const fetchConversations = useCallback(async (filter: FilterTab) => {
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('status', filter)
      const res = await fetch(`/api/admin/support/conversations?${params}`)
      if (!res.ok) return
      const data = await res.json()
      setConversations(data.conversations ?? [])
    } catch {
      // ignore
    }
  }, [])

  // Initial load + filter changes
  useEffect(() => {
    fetchConversations(activeFilter)
  }, [activeFilter, fetchConversations])

  // Poll conversation list every 15s
  useEffect(() => {
    if (pollConvsRef.current) clearInterval(pollConvsRef.current)
    pollConvsRef.current = setInterval(() => {
      fetchConversations(activeFilter)
    }, 15000)
    return () => {
      if (pollConvsRef.current) clearInterval(pollConvsRef.current)
    }
  }, [activeFilter, fetchConversations])

  // ── Fetch messages ───────────────────────────────────────────────────────────

  const fetchMessages = useCallback(async (conversationId: string) => {
    try {
      const res = await fetch(`/api/admin/support/messages?conversationId=${conversationId}`)
      if (!res.ok) return
      const data = await res.json()
      setMessages(data.messages ?? [])
    } catch {
      // ignore
    }
  }, [])

  // When conversation selected
  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      return
    }

    setLoadingMessages(true)
    fetchMessages(selectedId).finally(() => setLoadingMessages(false))

    // Mark as read in local state
    setConversations(prev =>
      prev.map(c => (c.id === selectedId ? { ...c, unreadByAdmin: 0 } : c))
    )

    // Poll for new messages every 5s
    if (pollMessagesRef.current) clearInterval(pollMessagesRef.current)
    pollMessagesRef.current = setInterval(() => {
      fetchMessages(selectedId)
    }, 5000)

    return () => {
      if (pollMessagesRef.current) clearInterval(pollMessagesRef.current)
    }
  }, [selectedId, fetchMessages])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Search (client-side filter with debounce) ────────────────────────────────

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      setSearchQuery(val)
    }, 300)
    // Also set input value immediately for responsiveness
    e.target.value = val
  }

  const filteredConversations = conversations.filter(c => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    const name = getDisplayName(c.user).toLowerCase()
    const email = c.user.email.toLowerCase()
    const subject = (c.subject ?? '').toLowerCase()
    const lastMsg = (c.lastMessage?.content ?? '').toLowerCase()
    return name.includes(q) || email.includes(q) || subject.includes(q) || lastMsg.includes(q)
  })

  // ── Status change ────────────────────────────────────────────────────────────

  const handleStatusChange = async (conversationId: string, status: 'open' | 'closed' | 'waiting') => {
    setConversations(prev =>
      prev.map(c => (c.id === conversationId ? { ...c, status } : c))
    )
    try {
      await fetch(`/api/admin/support/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
    } catch {
      // ignore
    }
  }

  // ── Edit subject ─────────────────────────────────────────────────────────────

  const startEditSubject = (conv: ConversationWithUser) => {
    setEditingSubject(conv.id)
    setSubjectDraft(conv.subject ?? '')
  }

  const saveSubject = async (convId: string) => {
    const subject = subjectDraft.trim() || null
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, subject } : c))
    setEditingSubject(null)
    try {
      await fetch(`/api/admin/support/conversations/${convId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject }),
      })
    } catch { /* ignore */ }
  }

  // ── Delete conversation ───────────────────────────────────────────────────────

  const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation()
    if (!window.confirm('Gespräch wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return
    try {
      await fetch(`/api/admin/support/conversations/${convId}`, { method: 'DELETE' })
    } catch {
      // ignore
    }
    setConversations(prev => prev.filter(c => c.id !== convId))
    if (selectedId === convId) {
      setSelectedId(null)
      setMessages([])
    }
  }

  // ── Send message ─────────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!selectedId || !inputText.trim() || sending) return
    const content = inputText.trim()
    setInputText('')
    setSending(true)

    // Optimistic add
    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      conversationId: selectedId,
      senderType: 'admin',
      senderId: null,
      content,
      contentType: 'text',
      mediaUrl: null,
      createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])

    try {
      const res = await fetch('/api/admin/support/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selectedId, content }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages(prev => prev.map(m => (m.id === optimistic.id ? data.message : m)))
        // Update last message in conversation list
        setConversations(prev =>
          prev.map(c =>
            c.id === selectedId
              ? {
                  ...c,
                  lastMessage: { content, senderType: 'admin', createdAt: data.message.createdAt },
                  lastMessageAt: data.message.createdAt,
                }
              : c
          )
        )
      }
    } catch {
      // keep optimistic message
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── Selected conversation data ───────────────────────────────────────────────

  const selectedConversation = conversations.find(c => c.id === selectedId) ?? null

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        display: 'flex',
        height: 'calc(100vh - 88px)',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid #EBEBEB',
        background: '#fff',
      }}
    >
      {/* ── LEFT COLUMN ── */}
      <div
        style={{
          width: 320,
          flexShrink: 0,
          borderRight: '1px solid #EBEBEB',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 16px 12px' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#111' }}>Support</div>
          <div style={{ fontSize: 13, color: '#999', marginTop: 2 }}>Kundenanfragen verwalten</div>
        </div>

        {/* Search */}
        <div style={{ padding: '0 12px 12px' }}>
          <input
            type="text"
            placeholder="Suchen..."
            onChange={handleSearchChange}
            style={{
              width: '100%',
              height: 36,
              border: '1px solid #EBEBEB',
              borderRadius: 8,
              padding: '0 12px',
              fontSize: 13,
              background: '#F7F7F7',
              outline: 'none',
              boxSizing: 'border-box',
              color: '#111',
            }}
          />
        </div>

        {/* Filter tabs */}
        <div style={{ padding: '0 12px 12px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              style={{
                background: activeFilter === tab.key ? '#111' : '#F5F5F5',
                color: activeFilter === tab.key ? '#fff' : '#666',
                borderRadius: 100,
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Conversation list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredConversations.length === 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 120,
                color: '#BBB',
                fontSize: 14,
              }}
            >
              Keine Anfragen
            </div>
          ) : (
            filteredConversations.map(conv => {
              const isSelected = conv.id === selectedId
              const isHovered = hoveredId === conv.id

              let lastMsgPreview = conv.subject ?? '—'
              if (conv.lastMessage) {
                if (conv.lastMessage.contentType === 'image') {
                  lastMsgPreview = '📷 Bild'
                } else if (conv.lastMessage.contentType === 'gif') {
                  lastMsgPreview = '🎬 GIF'
                } else {
                  const txt = conv.lastMessage.content ?? ''
                  lastMsgPreview = txt.length > 50 ? txt.slice(0, 50) + '…' : txt
                }
              }

              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedId(conv.id)}
                  onMouseEnter={() => setHoveredId(conv.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #F5F5F5',
                    background: isSelected ? '#F7F7F7' : isHovered ? '#FAFAFA' : '#fff',
                    transition: 'background 0.1s',
                    position: 'relative',
                  }}
                >
                  {isHovered && (
                    <button
                      onClick={e => handleDeleteConversation(e, conv.id)}
                      title="Gespräch löschen"
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        width: 28,
                        height: 28,
                        background: 'rgba(239,68,68,0.08)',
                        border: 'none',
                        borderRadius: 6,
                        cursor: 'pointer',
                        color: '#EF4444',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                        zIndex: 1,
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  )}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <Avatar user={conv.user} size={38} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Row 1: name + time + unread dot */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: '#111',
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {getDisplayName(conv.user)}
                        </span>
                        {conv.unreadByAdmin > 0 && (
                          <div
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 4,
                              background: '#3B82F6',
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <span style={{ fontSize: 11, color: '#999', flexShrink: 0 }}>
                          {conv.lastMessageAt ? formatTime(conv.lastMessageAt) : formatTime(conv.createdAt)}
                        </span>
                      </div>
                      {/* Row 2: last message preview */}
                      <div
                        style={{
                          fontSize: 13,
                          color: '#666',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 200,
                          marginTop: 2,
                        }}
                      >
                        {lastMsgPreview}
                      </div>
                      {/* Row 3: status pill + started date */}
                      <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <StatusPill status={conv.status} />
                        <span style={{ fontSize: 10, color: '#BBB' }}>
                          Gestartet am {formatShortDate(conv.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── RIGHT COLUMN ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {!selectedConversation ? (
          /* Empty state */
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#CCC',
              gap: 12,
            }}
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span style={{ fontSize: 15, color: '#BBB' }}>Wähle ein Gespräch aus</span>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div
              style={{
                height: 60,
                borderBottom: '1px solid #EBEBEB',
                padding: '0 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexShrink: 0,
              }}
            >
              <Avatar user={selectedConversation.user} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111', lineHeight: 1.2 }}>
                  {getDisplayName(selectedConversation.user)}
                </div>
                <div style={{ fontSize: 12, color: '#999', lineHeight: 1.2 }}>
                  {selectedConversation.user.email}
                </div>
              </div>
              {selectedConversation.unreadByAdmin > 0 && (
                <span style={{ fontSize: 12, color: '#C2410C', fontWeight: 500 }}>
                  ({selectedConversation.unreadByAdmin} ungelesen)
                </span>
              )}
              <select
                value={selectedConversation.status}
                onChange={e =>
                  handleStatusChange(
                    selectedConversation.id,
                    e.target.value as 'open' | 'closed' | 'waiting'
                  )
                }
                style={{
                  border: '1px solid #EBEBEB',
                  borderRadius: 8,
                  padding: '5px 10px',
                  fontSize: 13,
                  background: '#fff',
                  cursor: 'pointer',
                  outline: 'none',
                  color: '#111',
                }}
              >
                <option value="open">Offen</option>
                <option value="waiting">Wartend</option>
                <option value="closed">Geschlossen</option>
              </select>
            </div>

            {/* User Info Card */}
            <div
              style={{
                background: '#F7F7F7',
                padding: '10px 20px',
                borderBottom: '1px solid #EBEBEB',
                fontSize: 12,
                color: '#666',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                flexWrap: 'wrap',
                flexShrink: 0,
              }}
            >
              <span>
                <strong style={{ color: '#444' }}>E-Mail:</strong> {selectedConversation.user.email}
              </span>
              <span
                style={{
                  background: selectedConversation.user.plan === 'pro' ? '#EFF6FF' : '#F5F5F5',
                  color: selectedConversation.user.plan === 'pro' ? '#1D4ED8' : '#666',
                  borderRadius: 100,
                  padding: '2px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {selectedConversation.user.plan?.toUpperCase() ?? 'FREE'}
              </span>
              {selectedConversation.user.username && (
                <span>
                  <strong style={{ color: '#444' }}>@</strong>
                  {selectedConversation.user.username}
                </span>
              )}
              <span>
                <strong style={{ color: '#444' }}>Seit:</strong>{' '}
                {formatDate(selectedConversation.createdAt)}
              </span>
              {/* Editable subject/title */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <strong style={{ color: '#444' }}>Titel:</strong>
                {editingSubject === selectedConversation.id ? (
                  <input
                    autoFocus
                    value={subjectDraft}
                    onChange={e => setSubjectDraft(e.target.value)}
                    onBlur={() => saveSubject(selectedConversation.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveSubject(selectedConversation.id)
                      if (e.key === 'Escape') setEditingSubject(null)
                    }}
                    placeholder="Kein Titel"
                    style={{ border: 'none', outline: 'none', fontSize: 12, color: '#111', background: 'transparent', borderBottom: '1px solid #999', minWidth: 80, maxWidth: 180 }}
                  />
                ) : (
                  <button
                    onClick={() => startEditSubject(selectedConversation)}
                    title="Titel bearbeiten"
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: selectedConversation.subject ? '#444' : '#BBB', fontFamily: 'inherit', textDecoration: 'underline dotted' }}
                  >
                    {selectedConversation.subject ?? 'Kein Titel'}
                  </button>
                )}
              </div>
              <Link
                href={`/admin/users/${selectedConversation.userId}`}
                style={{ color: '#3B82F6', textDecoration: 'none', fontWeight: 500 }}
              >
                Nutzerprofil →
              </Link>
            </div>

            {/* Messages area */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                background: '#FAFAFA',
              }}
            >
              {selectedConversation?.status === 'closed' && (
                <div
                  style={{
                    background: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderRadius: 8,
                    padding: '8px 16px',
                    margin: '0 0 12px',
                    fontSize: 13,
                    color: '#DC2626',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span>🔒</span>
                  <span>Dieses Gespräch ist geschlossen.</span>
                  <button
                    onClick={() => handleStatusChange(selectedId!, 'open')}
                    style={{
                      marginLeft: 'auto',
                      background: 'none',
                      border: '1px solid #DC2626',
                      borderRadius: 6,
                      padding: '2px 10px',
                      fontSize: 12,
                      color: '#DC2626',
                      cursor: 'pointer',
                    }}
                  >
                    Wieder öffnen
                  </button>
                </div>
              )}
              {loadingMessages ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 1,
                    color: '#CCC',
                    fontSize: 14,
                  }}
                >
                  Laden…
                </div>
              ) : messages.length === 0 ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 1,
                    color: '#CCC',
                    fontSize: 14,
                  }}
                >
                  Noch keine Nachrichten
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isAdmin = msg.senderType === 'admin'
                  const prevMsg = idx > 0 ? messages[idx - 1] : null
                  const showLabel = !prevMsg || prevMsg.senderType !== msg.senderType

                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isAdmin ? 'flex-end' : 'flex-start',
                      }}
                    >
                      {showLabel && (
                        <div
                          style={{
                            fontSize: 10,
                            textTransform: 'uppercase',
                            color: '#999',
                            marginBottom: 2,
                            letterSpacing: '0.06em',
                            fontWeight: 600,
                            textAlign: isAdmin ? 'right' : 'left',
                          }}
                        >
                          {isAdmin ? 'Du' : 'Nutzer'}
                        </div>
                      )}
                      <div
                        style={{
                          background: isAdmin ? '#111' : '#fff',
                          color: isAdmin ? '#fff' : '#111',
                          border: isAdmin ? 'none' : '1px solid #EBEBEB',
                          borderRadius: isAdmin ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                          padding: '10px 14px',
                          maxWidth: '70%',
                          wordBreak: 'break-word',
                          lineHeight: 1.5,
                          fontSize: 14,
                        }}
                      >
                        {renderMessageContent(msg)}
                        <div
                          style={{
                            fontSize: 11,
                            marginTop: 4,
                            color: isAdmin ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)',
                            textAlign: isAdmin ? 'right' : 'left',
                          }}
                        >
                          {formatTime(msg.createdAt)}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            {selectedConversation.status !== 'closed' ? (
              <div
                style={{
                  borderTop: '1px solid #EBEBEB',
                  padding: '16px 20px',
                  background: '#fff',
                  flexShrink: 0,
                }}
              >
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Antwort schreiben…"
                  rows={3}
                  style={{
                    width: '100%',
                    minHeight: 72,
                    maxHeight: 144,
                    border: '1px solid #EBEBEB',
                    borderRadius: 12,
                    padding: 12,
                    fontSize: 14,
                    fontFamily: 'inherit',
                    resize: 'none',
                    outline: 'none',
                    boxSizing: 'border-box',
                    color: '#111',
                    background: '#fff',
                    lineHeight: 1.5,
                  }}
                />
                <div
                  style={{
                    marginTop: 10,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 11, color: '#BBB' }}>
                    Enter zum Senden, Shift+Enter für Zeilenumbruch
                  </span>
                  <button
                    onClick={handleSend}
                    disabled={!inputText.trim() || sending}
                    style={{
                      background: '#111',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '8px 20px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: !inputText.trim() || sending ? 'not-allowed' : 'pointer',
                      opacity: !inputText.trim() || sending ? 0.4 : 1,
                      transition: 'opacity 0.15s',
                    }}
                  >
                    {sending ? 'Sende…' : 'Antworten'}
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  borderTop: '1px solid #EBEBEB',
                  padding: '14px 20px',
                  background: '#F7F7F7',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 13, color: '#999' }}>
                  Dieses Gespräch ist geschlossen.
                </span>
                <button
                  onClick={() => handleStatusChange(selectedConversation.id, 'open')}
                  style={{
                    background: 'none',
                    border: '1px solid #EBEBEB',
                    borderRadius: 8,
                    padding: '5px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#444',
                    cursor: 'pointer',
                  }}
                >
                  Wieder öffnen
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
