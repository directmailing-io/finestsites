import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { ApiError } from './client';
import * as ep from './endpoints';
import type { ChatConversation, ChatConversationDetail, ChatConversationStatus, ChatMessage, ReportChatRequest, SubmissionStatus } from './types';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
      refetchOnWindowFocus: true,
    },
    mutations: { retry: 0 },
  },
});

export const qk = {
  config: ['config'] as const,
  me: ['me'] as const,
  overview: ['overview'] as const,
  sites: ['sites'] as const,
  site: (id: string) => ['sites', id] as const,
  templates: ['templates'] as const,
  submissions: (status: SubmissionStatus, search: string, siteId?: string) =>
    ['submissions', status, search, siteId ?? 'all'] as const,
  submissionsAll: ['submissions'] as const,
  conversations: ['support', 'conversations'] as const,
  messages: (id: string) => ['support', 'messages', id] as const,
  impersonation: ['support', 'impersonation'] as const,
  notifications: ['notifications'] as const,
  notificationPrefs: ['notification-prefs'] as const,
  affiliate: ['affiliate'] as const,
  creditNotes: ['affiliate', 'credit-notes'] as const,
  taxProfile: ['affiliate', 'tax-profile'] as const,
  deletion: ['account', 'deletion'] as const,
  chatAll: ['chat'] as const,
  chatConversations: (status: ChatConversationStatus, q: string) => ['chat', 'conversations', status, q] as const,
  chatConversation: (id: string) => ['chat', 'conversation', id] as const,
  chatUnread: ['chat', 'unread'] as const,
};

export const useConfig = () => useQuery({ queryKey: qk.config, queryFn: ep.getConfig, staleTime: 10 * 60_000 });
export const useMe = (enabled = true) => useQuery({ queryKey: qk.me, queryFn: ep.getMe, enabled });
/** Bedenkzeit einer Kontolöschung? (status 'scheduled' → Tabs leiten zu /deletion-pending) */
export const useDeletionStatus = () => useQuery({ queryKey: qk.deletion, queryFn: ep.getDeletionInfo, staleTime: 60_000 });
export const useOverview = () => useQuery({ queryKey: qk.overview, queryFn: ep.getOverview, refetchInterval: 60_000 });
export const useSites = () => useQuery({ queryKey: qk.sites, queryFn: ep.getSites });
export const useTemplates = () => useQuery({ queryKey: qk.templates, queryFn: ep.getTemplates, staleTime: 5 * 60_000 });

export const useSubmissions = (status: SubmissionStatus, search: string, siteId?: string) =>
  useQuery({
    queryKey: qk.submissions(status, search, siteId),
    queryFn: () => ep.getSubmissions({ status, search: search || undefined, siteId }),
    placeholderData: prev => prev,
  });

export const useConversations = (poll = false) =>
  useQuery({ queryKey: qk.conversations, queryFn: ep.getConversations, refetchInterval: poll ? 5_000 : 30_000 });

export const useMessages = (id: string | null) =>
  useQuery({
    queryKey: qk.messages(id ?? 'none'),
    queryFn: () => ep.getMessages(id!),
    enabled: !!id,
    refetchInterval: 3_000,
  });

export const useNotifications = () => useQuery({ queryKey: qk.notifications, queryFn: () => ep.getNotifications() });
export const useNotificationPrefs = () =>
  useQuery({ queryKey: qk.notificationPrefs, queryFn: ep.getNotificationPreferences });
export const useAffiliate = (enabled = true) => useQuery({ queryKey: qk.affiliate, queryFn: ep.getAffiliate, enabled });
export const useCreditNotes = () => useQuery({ queryKey: qk.creditNotes, queryFn: ep.getCreditNotes });
export const useTaxProfile = () => useQuery({ queryKey: qk.taxProfile, queryFn: ep.getTaxProfile });

/** Anfrage lesen/archivieren/löschen: Liste, Zähler und Übersicht sofort aktualisieren. */
export function useSubmissionActions() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.submissionsAll });
    qc.invalidateQueries({ queryKey: qk.overview });
    qc.invalidateQueries({ queryKey: qk.sites });
  };
  return {
    update: useMutation({
      mutationFn: (v: { siteId: string; id: string; read?: boolean; archived?: boolean }) =>
        ep.updateSubmission(v.siteId, v.id, { read: v.read, archived: v.archived }),
      onSettled: invalidate,
    }),
    remove: useMutation({
      mutationFn: (v: { siteId: string; id: string }) => ep.deleteSubmission(v.siteId, v.id),
      onSettled: invalidate,
    }),
  };
}

// ── Besucher-Chat ─────────────────────────────────────────────────────────────
// refetchInterval läuft nur im Vordergrund (refetchIntervalInBackground ist aus) – wie der Support-Chat.

/** Gesprächsliste (offen/archiviert/gesperrt, Suche), alle 5 s im Vordergrund. */
export const useChatConversations = (status: ChatConversationStatus, q: string, enabled = true) =>
  useQuery({
    queryKey: qk.chatConversations(status, q),
    queryFn: () => ep.chat.conversations({ status, q: q || undefined }),
    enabled,
    refetchInterval: 5_000,
    placeholderData: prev => prev,
  });

/** Gespräch + letzte 100 Nachrichten, alle 3 s im Vordergrund (Muster useMessages). */
export const useChatConversation = (id: string | null) =>
  useQuery({
    queryKey: qk.chatConversation(id ?? 'none'),
    queryFn: () => ep.chat.conversation(id!),
    enabled: !!id,
    refetchInterval: 3_000,
  });

/** Leichter Zähler für Badges (z. B. wenn die Übersicht gerade nicht geladen ist). */
export const useChatUnread = (enabled = true) =>
  useQuery({ queryKey: qk.chatUnread, queryFn: ep.chat.unread, enabled, refetchInterval: 30_000 });

function dedupeById(list: ChatMessage[]): ChatMessage[] {
  const seen = new Set<string>();
  return list.filter(m => (seen.has(m.id) ? false : (seen.add(m.id), true)));
}

/**
 * Nachrichten eines Gesprächs: die letzten 100 vom Server (Polling) plus ältere Seiten,
 * die über „Ältere Nachrichten“ (GET …/messages?before=) nachgeladen wurden.
 */
export function useChatMessages(id: string | null) {
  const q = useChatConversation(id);
  const [older, setOlder] = useState<{ id: string | null; messages: ChatMessage[]; hasMore: boolean | null }>({ id: null, messages: [], hasMore: null });
  const [loadingOlder, setLoadingOlder] = useState(false);
  const olderForThis = older.id === id ? older : null;

  const messages = useMemo(
    () => dedupeById([...(olderForThis?.messages ?? []), ...(q.data?.messages ?? [])]),
    [olderForThis, q.data?.messages],
  );
  const hasMore = olderForThis?.hasMore ?? q.data?.hasMore ?? false;

  const loadOlder = useCallback(async () => {
    const first = messages[0];
    if (!id || !first || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await ep.chat.messages(id, { before: first.id });
      setOlder(prev => ({ id, messages: [...page.messages, ...(prev.id === id ? prev.messages : [])], hasMore: page.hasMore }));
    } finally {
      setLoadingOlder(false);
    }
  }, [id, messages, loadingOlder]);

  return { query: q, conversation: q.data?.conversation ?? null, messages, hasMore, loadOlder, loadingOlder };
}

/** Gespräch im Cache aktualisieren (Antwort der Aktionen enthält meist das neue Gespräch). */
function applyConversation(qc: ReturnType<typeof useQueryClient>, id: string, conversation: ChatConversation | undefined) {
  if (!conversation) return;
  qc.setQueryData<ChatConversationDetail>(qk.chatConversation(id), prev => (prev ? { ...prev, conversation } : prev));
}

/**
 * Aktionen im Besucher-Chat. Senden hängt die Server-Nachricht sofort an den Verlauf;
 * die optimistische Anzeige (temp-/clientId) übernimmt der Bildschirm wie in ChatThread.
 */
export function useChatActions() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: qk.chatAll });
    void qc.invalidateQueries({ queryKey: qk.overview });
  };
  const useSimple = (fn: (id: string) => Promise<{ ok: true; conversation?: ChatConversation }>) =>
    useMutation({
      mutationFn: fn,
      onSuccess: (res, id) => applyConversation(qc, id, res.conversation),
      onSettled: invalidate,
    });
  return {
    send: useMutation({
      mutationFn: (v: { id: string; body: string; clientId: string }) => ep.chat.send(v.id, { body: v.body, clientId: v.clientId }),
      onSuccess: (res, v) => {
        qc.setQueryData<ChatConversationDetail>(qk.chatConversation(v.id), prev => {
          if (!prev || prev.messages.some(m => m.id === res.message.id)) return prev;
          const m = res.message;
          return {
            ...prev,
            messages: [...prev.messages, m],
            conversation: { ...prev.conversation, lastMessage: { preview: m.body.slice(0, 140), sender: m.sender, at: m.createdAt }, updatedAt: m.createdAt },
          };
        });
        void qc.invalidateQueries({ queryKey: ['chat', 'conversations'] });
      },
    }),
    read: useMutation({
      mutationFn: (id: string) => ep.chat.read(id),
      onMutate: id => {
        qc.setQueryData<ChatConversationDetail>(qk.chatConversation(id), prev =>
          prev ? { ...prev, conversation: { ...prev.conversation, unread: 0 }, messages: prev.messages.map(m => (m.sender === 'visitor' && !m.readAt ? { ...m, readAt: new Date().toISOString() } : m)) } : prev,
        );
      },
      onSettled: invalidate,
    }),
    archive: useSimple(ep.chat.archive),
    unarchive: useSimple(ep.chat.unarchive),
    block: useSimple(id => ep.chat.block(id)),
    unblock: useSimple(ep.chat.unblock),
    newCode: useSimple(ep.chat.newCode),
    report: useMutation({
      mutationFn: (v: { id: string } & ReportChatRequest) => ep.chat.report(v.id, { reason: v.reason, note: v.note, block: v.block }),
      onSuccess: (res, v) => applyConversation(qc, v.id, res.conversation),
      onSettled: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => ep.chat.remove(id),
      onSuccess: (_res, id) => qc.removeQueries({ queryKey: qk.chatConversation(id) }),
      onSettled: invalidate,
    }),
  };
}

export function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}
