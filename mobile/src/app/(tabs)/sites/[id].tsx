import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Globe, Inbox, PowerOff } from 'lucide-react-native';
import { Alert } from 'react-native';

import { humanError } from '@/api/client';
import { getSite, unpublishSite } from '@/api/endpoints';
import { qk, useOverview } from '@/api/queries';
import type { Site } from '@/api/types';
import { EmptyState, ListRow, ListSection, Pill, Screen, Skeleton, useToast } from '@/components/ui';
import { SiteCard } from '@/features/sites/SiteCard';
import { colors, radius } from '@/theme/tokens';

/**
 * Eine Seite (Ziel von Mitteilungen wie „Deine Domain ist verbunden“). Das Web hat dafür keine
 * eigene Seite – deshalb genau die Karte aus der Übersicht, darunter Anfragen, Domain und
 * „Offline schalten“ mit den Texten aus dem Web-Editor.
 */
export default function SiteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const cached = qc.getQueryData<Site[]>(qk.sites)?.find(s => s.id === id);
  const site = useQuery({ queryKey: qk.site(id), queryFn: () => getSite(id), initialData: cached });
  const s = site.data;
  const card = useOverview().data?.sites.find(c => c.id === id);
  const domain = card?.domain ?? null;
  const unread = card?.unreadSubmissions ?? s?.unread_submissions ?? 0;

  const offline = useMutation({
    mutationFn: () => unpublishSite(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.sites });
      void qc.invalidateQueries({ queryKey: qk.overview });
      void site.refetch();
    },
    onError: e => toast.show(humanError(e), 'error'),
  });

  if (!s) {
    return (
      <Screen>
        {site.isError ? <EmptyState icon={Globe} title="Seite nicht gefunden" text="Vielleicht wurde sie gelöscht." /> : <Skeleton height={240} radius={radius.card} />}
      </Screen>
    );
  }

  return (
    <Screen readable refreshing={site.isRefetching} onRefresh={() => void site.refetch()}>
      <Stack.Screen options={{ title: '' }} />
      <SiteCard site={{ ...s, thumbnail_url: s.thumbnail_url ?? cached?.thumbnail_url ?? null, templates: s.templates ? { ...s.templates, preview_images: s.templates.preview_images ?? cached?.templates?.preview_images ?? null } : null, unread_submissions: unread }} />

      <ListSection>
        <ListRow
          icon={Inbox}
          title="Anfragen"
          value={unread > 0 ? `${unread} neu` : undefined}
          onPress={() => router.navigate({ pathname: '/inbox', params: { site: id } })}
        />
        {s.status === 'published' && (
          <ListRow
            icon={Globe}
            iconBg={domain?.status === 'active' ? colors.successSoft : colors.muted}
            iconColor={domain?.status === 'active' ? colors.success : colors.ink}
            title="Eigene Domain"
            subtitle={domain?.name ?? 'Im Editor unter „Domain“ verbinden'}
            onPress={() => router.push({ pathname: '/editor/[id]', params: { id } })}
            right={
              domain?.status === 'active' ? (
                <Pill label="Verbunden" tone="online" />
              ) : domain?.status === 'pending' ? (
                <Pill label="Warte auf DNS-Eintrag" tone="changes" />
              ) : domain?.status === 'error' ? (
                <Pill label="Verbindung fehlgeschlagen" tone="offline" />
              ) : undefined
            }
          />
        )}
      </ListSection>

      {s.status === 'published' && (
        <ListSection>
          <ListRow
            icon={PowerOff}
            destructive
            iconBg={colors.dangerSoft}
            title="Offline schalten"
            chevron={false}
            disabled={offline.isPending}
            onPress={() =>
              Alert.alert('Seite offline schalten?', 'Deine Seite ist danach nicht mehr erreichbar. Im Editor kannst du sie jederzeit wieder veröffentlichen.', [
                { text: 'Abbrechen', style: 'cancel' },
                { text: 'Offline schalten', style: 'destructive', onPress: () => offline.mutate() },
              ])
            }
          />
        </ListSection>
      )}
    </Screen>
  );
}
