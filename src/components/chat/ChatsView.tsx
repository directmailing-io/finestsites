'use client'

/**
 * Bereich „Chats“ im Web-Dashboard: Liste (360 px) + Gespräch nebeneinander, am Handy Liste → Gespräch.
 * Das offene Gespräch steht in der URL (?c=<id>), damit Zurück/Neuladen funktionieren.
 *
 * Polling: Liste alle 5 s, offenes Gespräch alle 3 s (GET …/messages?after=<letzte id>),
 * beides nur bei sichtbarem Tab. Lesen (POST …/read) beim Öffnen und bei neuen Besucher-Nachrichten.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { ChatConversation, ChatConversationStatus } from '@/lib/contracts/app-v1/chat'
import { chatApi, ChatApiError, type ReportReason } from './mock'
import { useVisitorChat } from './VisitorChatContext'
import { ConversationList } from './ConversationList'
import { ConversationView, type LocalMessage } from './ConversationView'
import { ConfirmDialog, ReportDialog } from './Dialogs'
import { newClientId } from './utils'

const LIST_POLL_MS = 5000
const CHAT_POLL_MS = 3000

type Dialog =
  | { kind: 'block' }
  | { kind: 'delete' }
  | { kind: 'report' }
  | null

export default function ChatsView() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selectedId = searchParams.get('c')
  const { setUnread, refreshUnread } = useVisitorChat()

  // ── Liste ──
  const [status, setStatus] = useState<ChatConversationStatus>('open')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250)
    return () => clearTimeout(t)
  }, [search])

  const loadList = useCallback(async (quiet = false) => {
    if (!quiet) setListLoading(true)
    try {
      const res = await chatApi.listConversations({ status, q: debounced || undefined })
      setConversations(res.conversations)
      setUnread(res.unreadTotal)
      setListError(null)
    } catch (e) {
      if (e instanceof ChatApiError && e.code === 'FEATURE_DISABLED') setListError('Der Chat ist für dein Konto nicht freigeschaltet.')
      else if (!quiet) setListError('Die Gespräche konnten nicht geladen werden.')
    } finally {
      setListLoading(false)
    }
  }, [status, debounced, setUnread])

  useEffect(() => { loadList() }, [loadList])

  useEffect(() => {
    const tick = () => { if (!document.hidden) loadList(true) }
    const id = setInterval(tick, LIST_POLL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick) }
  }, [loadList])

  // ── Gespräch ──
  const [conversation, setConversation] = useState<ChatConversation | null>(null)
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const lastServerIdRef = useRef<string | null>(null)
  const openIdRef = useRef<string | null>(null)

  function showToast(text: string) {
    setToast(text)
    setTimeout(() => setToast(t => (t === text ? null : t)), 2600)
  }

  /** Gespräch in Liste + Detail aktualisieren (z. B. nach Archivieren/Sperren). */
  const applyConversation = useCallback((c: ChatConversation | null, fallback?: Partial<ChatConversation>) => {
    setConversation(prev => {
      if (!prev) return prev
      const next = c ?? { ...prev, ...fallback }
      return next.id === prev.id ? next : prev
    })
    setConversations(prev => prev.map(x => (x.id === (c?.id ?? openIdRef.current) ? (c ?? { ...x, ...fallback }) : x)))
  }, [])

  const markRead = useCallback(async (id: string) => {
    try {
      await chatApi.markRead(id)
      setConversations(prev => prev.map(x => (x.id === id ? { ...x, unread: 0 } : x)))
      setConversation(prev => (prev?.id === id ? { ...prev, unread: 0 } : prev))
      refreshUnread()
    } catch { /* beim nächsten Polling erneut */ }
  }, [refreshUnread])

  // Öffnen
  useEffect(() => {
    openIdRef.current = selectedId
    if (!selectedId) { setConversation(null); setMessages([]); setChatError(null); return }
    let cancelled = false
    setChatLoading(true)
    setChatError(null)
    setMessages([])
    lastServerIdRef.current = null
    chatApi.getConversation(selectedId)
      .then(res => {
        if (cancelled) return
        setConversation(res.conversation)
        setMessages(res.messages)
        lastServerIdRef.current = res.messages[res.messages.length - 1]?.id ?? null
        if (res.conversation.unread > 0 || res.messages.some(m => m.sender === 'visitor' && !m.readAt)) markRead(selectedId)
      })
      .catch(e => {
        if (cancelled) return
        setChatError(e instanceof ChatApiError && e.status === 404 ? 'Dieses Gespräch gibt es nicht mehr.' : 'Das Gespräch konnte nicht geladen werden.')
      })
      .finally(() => { if (!cancelled) setChatLoading(false) })
    return () => { cancelled = true }
  }, [selectedId, markRead])

  // Polling im Gespräch
  useEffect(() => {
    if (!selectedId) return
    let running = false
    const tick = async () => {
      if (document.hidden || running) return
      running = true
      try {
        const res = await chatApi.getMessages(selectedId, { after: lastServerIdRef.current ?? undefined })
        if (openIdRef.current !== selectedId) return
        setConversation(prev => (prev && prev.id === res.conversation.id ? { ...res.conversation, unread: prev.unread } : prev))
        if (res.messages.length > 0) {
          // Besucher-Nachrichten aus dem after-Polling sind immer neu (Dubletten gibt es nur bei eigenen per clientId).
          const gotVisitor = res.messages.some(m => m.sender === 'visitor')
          setMessages(prev => {
            const byId = new Set(prev.map(m => m.id))
            const byClient = new Map(prev.filter(m => m.clientId).map(m => [m.clientId as string, m]))
            let next = prev
            for (const m of res.messages) {
              if (byId.has(m.id)) {
                next = next.map(x => (x.id === m.id ? { ...m } : x))
                continue
              }
              if (m.clientId && byClient.has(m.clientId)) {
                next = next.map(x => (x.clientId === m.clientId ? { ...m } : x))
                continue
              }
              next = [...next, m]
            }
            return next
          })
          lastServerIdRef.current = res.messages[res.messages.length - 1].id
          if (gotVisitor && !document.hidden) markRead(selectedId)
        }
      } catch { /* nächster Versuch */ } finally { running = false }
    }
    const id = setInterval(tick, CHAT_POLL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick) }
  }, [selectedId, markRead])

  // ── Navigation ──
  function select(id: string | null) {
    const p = new URLSearchParams(searchParams.toString())
    if (id) p.set('c', id); else p.delete('c')
    const qs = p.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  // ── Senden ──
  async function sendBody(body: string, clientId = newClientId()) {
    if (!selectedId) return
    const optimistic: LocalMessage = {
      id: `local-${clientId}`, conversationId: selectedId, sender: 'owner', body,
      createdAt: new Date().toISOString(), readAt: null, clientId, pending: true, failed: false,
    }
    setMessages(prev => {
      const exists = prev.some(m => m.clientId === clientId)
      return exists ? prev.map(m => (m.clientId === clientId ? { ...m, pending: true, failed: false } : m)) : [...prev, optimistic]
    })
    try {
      const saved = await chatApi.sendMessage(selectedId, body, clientId)
      setMessages(prev => prev.map(m => (m.clientId === clientId ? { ...saved, clientId } : m)))
      lastServerIdRef.current = saved.id
      setConversations(prev => prev.map(c => (c.id === selectedId
        ? { ...c, status: c.status === 'archived' ? 'open' : c.status, lastMessage: { preview: body.replace(/\s+/g, ' ').slice(0, 140), sender: 'owner', at: saved.createdAt }, updatedAt: saved.createdAt }
        : c)))
      setConversation(prev => (prev?.status === 'archived' ? { ...prev, status: 'open' } : prev))
    } catch (e) {
      const rejected = e instanceof ChatApiError && e.code === 'MESSAGE_REJECTED'
      setMessages(prev => rejected
        ? prev.filter(m => m.clientId !== clientId)
        : prev.map(m => (m.clientId === clientId ? { ...m, pending: false, failed: true } : m)))
      if (rejected) showToast('Diese Nachricht kann nicht gesendet werden.')
    }
  }

  function retry(clientId: string) {
    const m = messages.find(x => x.clientId === clientId)
    if (m) sendBody(m.body, clientId)
  }

  // ── Aktionen ──
  async function archive(archived: boolean) {
    if (!conversation) return
    setBusy(true)
    try {
      const c = await chatApi.setArchived(conversation.id, archived)
      applyConversation(c, { status: archived ? 'archived' : 'open' })
      showToast(archived ? 'Gespräch archiviert' : 'Gespräch wiederhergestellt')
      loadList(true)
    } catch { showToast('Das hat nicht geklappt. Bitte versuch es noch einmal.') } finally { setBusy(false) }
  }

  async function block() {
    if (!conversation) return
    setBusy(true)
    try {
      const c = await chatApi.block(conversation.id)
      applyConversation(c, { status: 'blocked' })
      setDialog(null)
      showToast('Besucher gesperrt')
      loadList(true)
    } catch { showToast('Das hat nicht geklappt. Bitte versuch es noch einmal.') } finally { setBusy(false) }
  }

  async function unblock() {
    if (!conversation) return
    setBusy(true)
    try {
      const c = await chatApi.unblock(conversation.id)
      applyConversation(c, { status: 'open' })
      showToast('Sperre aufgehoben')
      loadList(true)
    } catch { showToast('Das hat nicht geklappt. Bitte versuch es noch einmal.') } finally { setBusy(false) }
  }

  async function newCode() {
    if (!conversation) return
    setBusy(true)
    try {
      const c = await chatApi.newCode(conversation.id)
      applyConversation(c, c ? { resumeCode: c.resumeCode } : {})
      showToast(c?.resumeCode ? `Neuer Code: ${c.resumeCode}` : 'Neuer Code erzeugt')
    } catch { showToast('Das hat nicht geklappt. Bitte versuch es noch einmal.') } finally { setBusy(false) }
  }

  async function report(input: { reason: ReportReason; note?: string; block: boolean }) {
    if (!conversation) return
    setBusy(true)
    setDialogError(null)
    try {
      const c = await chatApi.report(conversation.id, input)
      applyConversation(c, { reportedAt: new Date().toISOString(), status: input.block ? 'blocked' : conversation.status })
      setDialog(null)
      showToast('Danke, wir haben deine Meldung erhalten.')
      loadList(true)
    } catch { setDialogError('Die Meldung konnte nicht gesendet werden. Bitte versuch es noch einmal.') } finally { setBusy(false) }
  }

  async function remove() {
    if (!conversation) return
    setBusy(true)
    try {
      await chatApi.deleteConversation(conversation.id)
      setConversations(prev => prev.filter(c => c.id !== conversation.id))
      setDialog(null)
      select(null)
      showToast('Gespräch gelöscht')
      refreshUnread()
    } catch { showToast('Das hat nicht geklappt. Bitte versuch es noch einmal.') } finally { setBusy(false) }
  }

  const unreadInList = conversations.reduce((s, c) => s + c.unread, 0)
  const showConversation = !!selectedId

  return (
    <div className="max-w-6xl mx-auto">
      {/* Kopf (am Handy nur in der Liste) */}
      <div className={`${showConversation ? 'hidden lg:block' : ''} mb-5`}>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Chats</h1>
        <p className="text-base mt-1.5" style={{ color: '#94A3B8' }}>
          {listLoading && conversations.length === 0
            ? '…'
            : unreadInList > 0
              ? `${unreadInList} ${unreadInList === 1 ? 'neue Nachricht' : 'neue Nachrichten'}`
              : 'Nachrichten von Besuchern deiner Webseite'}
        </p>
      </div>

      <div
        className="fs-chat-shell lg:flex lg:rounded-3xl lg:overflow-hidden lg:bg-white"
        style={{ height: 'var(--fs-chat-h)', boxShadow: 'var(--fs-chat-shadow)' }}
      >
        <style>{`
          .fs-chat-shell { --fs-chat-h: auto; --fs-chat-shadow: none }
          @media (min-width: 1024px) {
            .fs-chat-shell { --fs-chat-h: clamp(520px, calc(100vh - 190px), 900px); --fs-chat-shadow: 0 0 0 1px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.05) }
          }
          @keyframes fsChatToast { from { opacity: 0; transform: translate(-50%, 8px) } to { opacity: 1; transform: translate(-50%, 0) } }
        `}</style>

        {/* Liste */}
        <aside
          className={`${showConversation ? 'hidden lg:flex' : 'flex'} flex-col lg:w-[360px] lg:flex-shrink-0 lg:h-full rounded-3xl lg:rounded-none bg-white`}
          style={{ borderRight: '1px solid #F1F5F9', boxShadow: 'var(--fs-chat-list-shadow, none)' }}
          aria-label="Gespräche"
        >
          <style>{`@media (max-width: 1023px) { .fs-chat-shell aside { --fs-chat-list-shadow: 0 0 0 1px rgba(0,0,0,0.06); min-height: 60vh } }`}</style>
          {listError ? (
            <p className="text-sm px-4 py-6 text-center" style={{ color: '#B91C1C' }}>{listError}</p>
          ) : (
            <ConversationList
              conversations={conversations}
              loading={listLoading}
              status={status}
              search={search}
              selectedId={selectedId}
              onStatus={s => { setStatus(s); setConversations([]) }}
              onSearch={setSearch}
              onSelect={select}
            />
          )}
        </aside>

        {/* Gespräch */}
        <section className={`${showConversation ? 'flex' : 'hidden lg:flex'} flex-col flex-1 min-w-0 lg:h-full`} aria-label="Gespräch">
          {!selectedId ? (
            <div className="hidden lg:flex flex-col items-center justify-center h-full text-center px-8" style={{ background: '#F7F7F8' }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ background: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" aria-hidden="true">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                </svg>
              </div>
              <h2 className="font-semibold text-gray-900 text-lg mb-1.5">Wähle ein Gespräch</h2>
              <p className="text-sm max-w-xs leading-relaxed" style={{ color: '#94A3B8' }}>
                Links siehst du alle Besucher, die dir geschrieben haben. Klick auf ein Gespräch, um zu antworten.
              </p>
            </div>
          ) : chatError ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[320px] text-center px-8 gap-4">
              <p className="text-sm" style={{ color: '#6B7280' }}>{chatError}</p>
              <button onClick={() => select(null)} className="px-4 py-2.5 text-sm font-semibold rounded-xl" style={{ background: '#F3F4F6', color: '#374151' }}>Zur Liste</button>
            </div>
          ) : conversation ? (
            <ConversationView
              conversation={conversation}
              messages={messages}
              loading={chatLoading}
              busy={busy}
              actions={{
                onBack: () => select(null),
                onSend: body => sendBody(body),
                onRetry: retry,
                onArchive: archive,
                onBlock: () => setDialog({ kind: 'block' }),
                onUnblock: unblock,
                onNewCode: newCode,
                onReport: () => { setDialogError(null); setDialog({ kind: 'report' }) },
                onDelete: () => setDialog({ kind: 'delete' }),
              }}
            />
          ) : (
            <div className="flex-1 min-h-[320px] animate-pulse" style={{ background: '#F7F7F8' }} />
          )}
        </section>
      </div>

      {/* Dialoge */}
      {dialog?.kind === 'block' && conversation && (
        <ConfirmDialog
          title="Besucher sperren?"
          text={`${conversation.visitor.displayName} kann dir danach auf keiner deiner Seiten mehr schreiben. Du kannst die Sperre jederzeit wieder aufheben.`}
          confirmLabel="Sperren"
          busy={busy}
          onConfirm={block}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'delete' && conversation && (
        <ConfirmDialog
          title="Gespräch löschen?"
          text="Das Gespräch und alle Nachrichten werden endgültig gelöscht. Das lässt sich nicht rückgängig machen."
          confirmLabel="Endgültig löschen"
          destructive
          busy={busy}
          onConfirm={remove}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'report' && conversation && (
        <ReportDialog
          visitorName={conversation.visitor.displayName}
          alreadyBlocked={conversation.status === 'blocked'}
          busy={busy}
          error={dialogError}
          onSubmit={report}
          onClose={() => setDialog(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className="fixed left-1/2 z-[70] px-4 py-2.5 rounded-xl text-sm font-medium text-white"
          style={{ bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))', background: '#1a1a1a', boxShadow: '0 8px 24px rgba(0,0,0,0.25)', animation: 'fsChatToast .2s ease-out', transform: 'translateX(-50%)' }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
