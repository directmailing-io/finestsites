'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface Message {
  id: string
  conversationId: string
  senderType: 'user' | 'admin'
  senderId: string | null
  content: string
  createdAt: string
}

interface Conversation {
  id: string
  status: string
  unreadByUser: boolean
  createdAt: string
}

function formatTime(createdAt: string): string {
  const date = new Date(createdAt)
  const now = new Date()
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  if (isToday) return `${hh}:${mm}`

  const dd = String(date.getDate()).padStart(2, '0')
  const mo = String(date.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mo}. ${hh}:${mm}`
}

const GLOBAL_STYLES = `
  @keyframes supportSlideUp {
    from { opacity: 0; transform: translateY(16px) scale(0.96); }
    to   { opacity: 1; transform: translateY(0)    scale(1);    }
  }

  .fs-support-panel {
    animation: supportSlideUp 220ms cubic-bezier(0.34, 1.2, 0.64, 1) forwards;
    position: fixed;
    bottom: 96px;
    right: 24px;
    width: 360px;
    height: 520px;
    border-radius: 20px;
    background: #fff;
    box-shadow: 0 20px 60px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.08);
    display: flex;
    flex-direction: column;
    z-index: 9998;
    overflow: hidden;
  }

  .fs-support-launcher {
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: #111;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    z-index: 9999;
    transition: background 0.15s ease, transform 0.15s ease;
  }
  .fs-support-launcher:hover {
    background: #333;
    transform: scale(1.05);
  }

  .fs-support-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .fs-support-messages::-webkit-scrollbar { width: 4px; }
  .fs-support-messages::-webkit-scrollbar-track { background: transparent; }
  .fs-support-messages::-webkit-scrollbar-thumb { background: #E0E0E0; border-radius: 4px; }

  .fs-support-close-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(255,255,255,0.1);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 16px;
    flex-shrink: 0;
    transition: background 0.15s ease;
  }
  .fs-support-close-btn:hover { background: rgba(255,255,255,0.2); }

  .fs-support-send-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 0.15s ease;
  }
  .fs-support-send-btn:hover:not(:disabled) { background: #333 !important; }
  .fs-support-send-btn:disabled { cursor: default; }

  .fs-support-restart-btn {
    background: #F5F5F5;
    border: none;
    border-radius: 20px;
    padding: 6px 14px;
    font-size: 12px;
    color: #666;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s ease;
  }
  .fs-support-restart-btn:hover { background: #EBEBEB; }

  @media (max-width: 640px) {
    .fs-support-panel {
      bottom: 0 !important;
      right: 0 !important;
      left: 0 !important;
      border-radius: 20px 20px 0 0 !important;
      height: 75vh !important;
      width: 100% !important;
    }
    .fs-support-launcher {
      bottom: 20px !important;
      right: 20px !important;
    }
  }
`

export default function SupportChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scrollAnchorRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isComposingRef = useRef(false)
  const messagesRef = useRef<Message[]>([])

  // Keep ref in sync so poll callback stays stable
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load initial conversation on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/support/conversation')
        if (!res.ok) return
        const data = await res.json()
        setConversation(data.conversation ?? null)
        setMessages(data.messages ?? [])
        if (data.conversation?.unreadByUser) {
          const adminMsgs = (data.messages ?? []).filter(
            (m: Message) => m.senderType === 'admin'
          )
          setUnreadCount(Math.min(adminMsgs.length, 9))
        }
      } catch {
        // silently fail — widget is non-critical
      }
    }
    load()
  }, [])

  // Mark conversation as read
  const markAsRead = useCallback(async (convId: string) => {
    try {
      await fetch(`/api/support/conversation/${convId}/read`, { method: 'PATCH' })
      setUnreadCount(0)
      setConversation((prev) => (prev ? { ...prev, unreadByUser: false } : prev))
    } catch {
      // silently fail
    }
  }, [])

  // Poll for new messages
  const pollMessages = useCallback(async (convId: string) => {
    const current = messagesRef.current
    const lastMsg = current[current.length - 1]
    const since = lastMsg ? lastMsg.createdAt : ''
    try {
      const params = new URLSearchParams({ conversationId: convId })
      if (since) params.set('since', since)
      const res = await fetch(`/api/support/messages?${params}`)
      if (!res.ok) return
      const data = await res.json()

      if (Array.isArray(data.messages) && data.messages.length > 0) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id))
          const fresh = (data.messages as Message[]).filter((m) => !existingIds.has(m.id))
          return fresh.length > 0 ? [...prev, ...fresh] : prev
        })
      }
      if (data.conversationStatus) {
        setConversation((prev) =>
          prev && prev.status !== data.conversationStatus
            ? { ...prev, status: data.conversationStatus }
            : prev
        )
      }
    } catch {
      // silently fail
    }
  }, [])

  // Start / stop polling
  useEffect(() => {
    if (!isOpen || !conversation || conversation.status === 'closed') {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      return
    }

    const convId = conversation.id
    pollIntervalRef.current = setInterval(() => pollMessages(convId), 3000)
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [isOpen, conversation, pollMessages])

  const handleOpen = useCallback(() => {
    setIsOpen(true)
    if (unreadCount > 0 && conversation?.id) {
      markAsRead(conversation.id)
    }
  }, [conversation, unreadCount, markAsRead])

  const handleClose = useCallback(() => {
    setIsOpen(false)
  }, [])

  const handleToggle = useCallback(() => {
    if (isOpen) {
      handleClose()
    } else {
      handleOpen()
    }
  }, [isOpen, handleOpen, handleClose])

  const handleSend = useCallback(async () => {
    const content = inputValue.trim()
    if (!content || isSending) return

    setSendError(false)
    setIsSending(true)
    setInputValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    const tempId = `temp-${Date.now()}`
    const optimistic: Message = {
      id: tempId,
      conversationId: conversation?.id ?? '',
      senderType: 'user',
      senderId: null,
      content,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])

    try {
      if (!conversation) {
        // First message — create conversation
        const res = await fetch('/api/support/conversation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        })
        if (!res.ok) throw new Error('Failed to create conversation')
        const data = await res.json()
        setConversation(data.conversation)
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? (data.message as Message) : m))
        )
      } else {
        // Subsequent messages
        const res = await fetch('/api/support/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: conversation.id, content }),
        })
        if (!res.ok) throw new Error('Failed to send message')
        const data = await res.json()
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? (data.message as Message) : m))
        )
      }
    } catch {
      setSendError(true)
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setInputValue(content)
    } finally {
      setIsSending(false)
    }
  }, [inputValue, isSending, conversation])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && !isComposingRef.current) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
    // Auto-resize
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`
  }, [])

  const handleReset = useCallback(() => {
    setConversation(null)
    setMessages([])
    setInputValue('')
    setSendError(false)
  }, [])

  const hasMessages = messages.length > 0
  const isClosed = conversation?.status === 'closed'
  const canSend = inputValue.trim().length > 0 && !isSending

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_STYLES }} />

      {/* ── Chat Panel ── */}
      {isOpen && (
        <div className="fs-support-panel">

          {/* Header */}
          <div
            style={{
              minHeight: 72,
              background: '#111',
              borderRadius: '20px 20px 0 0',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Avatar */}
              <div
                aria-hidden="true"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #8060b0, #5a3d8a)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 700,
                  flexShrink: 0,
                  userSelect: 'none',
                }}
              >
                FS
              </div>

              {/* Name + status */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span
                  style={{ color: '#fff', fontSize: 15, fontWeight: 600, lineHeight: 1 }}
                >
                  Support
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div
                    aria-hidden="true"
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#22C55E',
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      color: 'rgba(255,255,255,0.6)',
                      lineHeight: 1,
                    }}
                  >
                    Wir sind online
                  </span>
                </div>
              </div>
            </div>

            {/* Close button */}
            <button
              className="fs-support-close-btn"
              onClick={handleClose}
              aria-label="Chat schließen"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M1 1L13 13M13 1L1 13"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {/* Messages Area */}
          <div className="fs-support-messages">
            {!hasMessages ? (
              /* Welcome Screen */
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  padding: '32px 20px',
                  margin: 'auto 0',
                }}
              >
                <div
                  aria-hidden="true"
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    background: '#F5F0FF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 28,
                    userSelect: 'none',
                  }}
                >
                  👋
                </div>
                <p
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: '#111',
                    margin: '12px 0 0 0',
                    lineHeight: 1.3,
                  }}
                >
                  Hallo! Wie können wir dir helfen?
                </p>
                <p
                  style={{
                    fontSize: 14,
                    color: '#666',
                    margin: '8px 0 0 0',
                    maxWidth: 240,
                    lineHeight: 1.5,
                  }}
                >
                  Unser Team antwortet normalerweise in wenigen Stunden.
                </p>
              </div>
            ) : (
              /* Message Thread */
              <>
                {messages.map((msg) =>
                  msg.senderType === 'user' ? (
                    /* User bubble */
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                      }}
                    >
                      <div
                        style={{
                          padding: '10px 14px',
                          borderRadius: '18px 18px 4px 18px',
                          background: '#111',
                          color: '#fff',
                          fontSize: 14,
                          lineHeight: 1.5,
                          maxWidth: '80%',
                          wordBreak: 'break-word',
                        }}
                      >
                        {msg.content}
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          color: '#999',
                          marginTop: 3,
                          textAlign: 'right',
                        }}
                      >
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                  ) : (
                    /* Admin bubble */
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'flex-end',
                        gap: 8,
                      }}
                    >
                      <div
                        aria-hidden="true"
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #8060b0, #5a3d8a)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: 10,
                          fontWeight: 700,
                          flexShrink: 0,
                          userSelect: 'none',
                        }}
                      >
                        FS
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          maxWidth: '75%',
                        }}
                      >
                        <div
                          style={{
                            padding: '10px 14px',
                            borderRadius: '18px 18px 18px 4px',
                            background: '#F7F7F7',
                            color: '#111',
                            fontSize: 14,
                            lineHeight: 1.5,
                            wordBreak: 'break-word',
                          }}
                        >
                          {msg.content}
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            color: '#999',
                            marginTop: 3,
                            textAlign: 'left',
                          }}
                        >
                          {formatTime(msg.createdAt)}
                        </span>
                      </div>
                    </div>
                  )
                )}

                {/* Closed conversation pill */}
                {isClosed && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      marginTop: 8,
                      marginBottom: 4,
                    }}
                  >
                    <button className="fs-support-restart-btn" onClick={handleReset}>
                      Gespräch geschlossen · Neu starten →
                    </button>
                  </div>
                )}

                {/* Scroll anchor */}
                <div ref={scrollAnchorRef} style={{ height: 1, flexShrink: 0 }} />
              </>
            )}
          </div>

          {/* Send Error */}
          {sendError && (
            <div
              role="alert"
              style={{
                padding: '6px 16px',
                fontSize: 12,
                color: '#E53E3E',
                background: '#FFF5F5',
                flexShrink: 0,
              }}
            >
              Fehler beim Senden, bitte erneut versuchen
            </div>
          )}

          {/* Input Bar */}
          <div
            style={{
              minHeight: 64,
              borderTop: '1px solid #F0F0F0',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexShrink: 0,
            }}
          >
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => { isComposingRef.current = true }}
              onCompositionEnd={() => { isComposingRef.current = false }}
              placeholder="Schreib uns eine Nachricht..."
              rows={1}
              disabled={isSending}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                resize: 'none',
                fontSize: 14,
                fontFamily: 'inherit',
                lineHeight: 1.5,
                maxHeight: 96,
                overflowY: 'auto',
                color: '#111',
                background: 'transparent',
                padding: 0,
                display: 'block',
              }}
            />
            <button
              className="fs-support-send-btn"
              onClick={handleSend}
              disabled={!canSend}
              aria-label="Nachricht senden"
              style={{
                background: canSend ? '#111' : '#E0E0E0',
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M8 13V3M8 3L4 7M8 3L12 7"
                  stroke="white"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Launcher Button ── */}
      <button
        className="fs-support-launcher"
        onClick={handleToggle}
        aria-label={isOpen ? 'Chat schließen' : 'Support Chat öffnen'}
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M4 4L16 16M16 4L4 16"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z"
              fill="white"
            />
          </svg>
        )}

        {/* Unread badge */}
        {!isOpen && unreadCount > 0 && (
          <div
            aria-label={`${unreadCount} ungelesene Nachricht${unreadCount !== 1 ? 'en' : ''}`}
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: '#EF4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 700,
              color: '#fff',
              border: '2px solid #fff',
              userSelect: 'none',
            }}
          >
            {unreadCount}
          </div>
        )}
      </button>
    </>
  )
}
