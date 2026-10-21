import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ApiError } from './client';
import * as ep from './endpoints';
import type { SubmissionStatus } from './types';

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

export function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}
