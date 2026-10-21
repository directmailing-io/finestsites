import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { BarChart3, ExternalLink, Globe, Inbox, Pencil, PowerOff, QrCode, Share2, Trash2 } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Alert, StyleSheet, View, type HostInstance } from 'react-native';

import { humanError } from '@/api/client';
import { deleteSite, getSite, unpublishSite } from '@/api/endpoints';
import { qk, useDomain } from '@/api/queries';
import type { Site } from '@/api/types';
import { Button, Card, EmptyState, ListRow, ListSection, Pill, Screen, Skeleton, Text, useToast } from '@/components/ui';
import { QrSheet } from '@/features/sites/QrSheet';
import { STATUS_META } from '@/features/sites/SiteCard';
import { useLayout } from '@/lib/layout';
import { openInBrowser, siteUrlOf } from '@/lib/links';
import { shareLink } from '@/lib/share';
import { colors, radius } from '@/theme/tokens';

export default function SiteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { regular } = useLayout();
  const cached = qc.getQueryData<Site[]>(qk.sites)?.find(s => s.id === id);
  const site = useQuery({ queryKey: qk.site(id), queryFn: () => getSite(id), initialData: cached });
  const s = site.data;
  const domain = useDomain(id, s?.status === 'published');
  const shareRef = useRef<HostInstance>(null);
  const [qrOpen, setQrOpen] = useState(false);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: qk.sites });
    void qc.invalidateQueries({ queryKey: qk.overview });
  };
  const offline = useMutation({
    mutationFn: () => unpublishSite(id),
    onSuccess: () => {
      invalidate();
      toast.show('Seite ist jetzt offline', 'success');
    },
    onError: e => toast.show(humanError(e), 'error'),
  });
  const remove = useMutation({
    mutationFn: () => deleteSite(id),
    onSuccess: () => {
      invalidate();
      toast.show('Entwurf gelöscht', 'success');
      router.back();
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

  const meta = STATUS_META[s.status];
  const { display, hasCustom, url } = siteUrlOf(s);
  const title = s.templates?.title ?? 'Meine Webseite';
  const preview = s.templates?.preview_images?.[0];
  const isDraft = s.status === 'draft';

  return (
    <Screen readable refreshing={site.isRefetching} onRefresh={() => void site.refetch()}>
      <Stack.Screen options={{ title }} />
      <Card padded={false} style={{ overflow: 'hidden' }}>
        <View style={[styles.preview, regular && { aspectRatio: 16 / 8 }]}>
          {preview ? (
            <Image source={{ uri: preview }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" />
          ) : (
            <View style={styles.placeholder}>
              <Globe size={36} color={colors.hairline} strokeWidth={1.5} />
            </View>
          )}
        </View>
        <View style={{ padding: 20, gap: 6 }}>
          <View style={styles.pills}>
            <Pill label={meta.label} tone={meta.tone} />
            {s.status === 'published' && s.has_unpublished_changes && <Pill label="Änderungen nicht online" tone="changes" />}
          </View>
          <Text variant="title">{title}</Text>
          {display && (
            <Text variant="callout" color={hasCustom ? colors.success : colors.secondary} selectable>
              {display}
            </Text>
          )}
          {isDraft && <Text variant="callout">Noch nicht online. Nur du siehst diese Seite.</Text>}
          {s.status === 'deactivated' && (
            <Text variant="callout" color={colors.danger}>
              Diese Seite ist gerade nicht erreichbar.
            </Text>
          )}
          {s.status === 'published' && s.has_unpublished_changes && (
            <Text variant="callout">Du hast gespeicherte Änderungen. Tippe im Editor auf „Änderungen veröffentlichen“, damit sie online sind.</Text>
          )}
          <View style={{ gap: 8, marginTop: 12 }}>
            <Button
              title={isDraft ? 'Weiter bearbeiten' : 'Bearbeiten'}
              icon={Pencil}
              fullWidth
              onPress={() => router.push({ pathname: '/editor/[id]', params: { id } })}
            />
            {url && (
              <View style={styles.row}>
                <Button title="Seite ansehen" icon={ExternalLink} variant="secondary" style={styles.full} onPress={() => openInBrowser(url)} />
                <Button ref={shareRef} title="Link teilen" icon={Share2} variant="secondary" style={styles.flex} onPress={() => shareLink(url, shareRef, title)} />
                <Button title="QR-Code" icon={QrCode} variant="secondary" style={styles.flex} onPress={() => setQrOpen(true)} />
              </View>
            )}
          </View>
        </View>
      </Card>

      <ListSection title="Überblick">
        <ListRow
          icon={Inbox}
          title="Anfragen"
          value={(s.unread_submissions ?? 0) > 0 ? `${s.unread_submissions} neu` : undefined}
          onPress={() => router.navigate({ pathname: '/inbox', params: { site: id } })}
        />
        <ListRow
          icon={BarChart3}
          title="Besucher"
          subtitle="Letzte 7 Tage"
          value={s.status === 'published' ? (s.visitors_7d ?? 0).toLocaleString('de-DE') : '–'}
        />
      </ListSection>

      {s.status === 'published' && (
        <ListSection
          title="Adresse"
          footer={
            domain.data?.status === 'active'
              ? undefined
              : 'Eine eigene Domain richtest du im Editor unter „Eigene Domain“ ein.'
          }>
          <ListRow icon={Globe} title="FinestSites-Adresse" subtitle={s.username && s.templates ? `${s.username}.${s.templates.domain}` : '–'} />
          <ListRow
            icon={Globe}
            iconBg={domain.data?.status === 'active' ? colors.successSoft : colors.muted}
            iconColor={domain.data?.status === 'active' ? colors.success : colors.ink}
            title="Eigene Domain"
            subtitle={domain.data?.domain ?? 'Keine eigene Domain verbunden'}
            right={
              domain.data?.status === 'active' ? (
                <Pill label="Verbunden" tone="online" />
              ) : domain.data?.status === 'pending' ? (
                <Pill label="Wird verbunden" tone="changes" />
              ) : domain.data?.status === 'error' ? (
                <Pill label="Prüfen" tone="offline" />
              ) : undefined
            }
          />
        </ListSection>
      )}

      {(s.status === 'published' || isDraft) && (
        <ListSection>
          {s.status === 'published' ? (
            <ListRow
              icon={PowerOff}
              destructive
              iconBg={colors.dangerSoft}
              title="Offline schalten"
              subtitle="Die Seite ist danach nicht mehr erreichbar."
              chevron={false}
              disabled={offline.isPending}
              onPress={() =>
                Alert.alert(
                  'Seite offline schalten?',
                  'Deine Seite ist danach nicht mehr erreichbar. Im Editor kannst du sie jederzeit wieder veröffentlichen.',
                  [
                    { text: 'Abbrechen', style: 'cancel' },
                    { text: 'Offline schalten', style: 'destructive', onPress: () => offline.mutate() },
                  ],
                )
              }
            />
          ) : (
            <ListRow
              icon={Trash2}
              destructive
              iconBg={colors.dangerSoft}
              title="Entwurf löschen"
              chevron={false}
              disabled={remove.isPending}
              onPress={() =>
                Alert.alert('Diesen Entwurf wirklich löschen?', undefined, [
                  { text: 'Abbrechen', style: 'cancel' },
                  { text: 'Ja, löschen', style: 'destructive', onPress: () => remove.mutate() },
                ])
              }
            />
          )}
        </ListSection>
      )}
      {url && <QrSheet visible={qrOpen} onClose={() => setQrOpen(false)} url={url} title={title} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: { aspectRatio: 16 / 10, backgroundColor: colors.muted, borderBottomWidth: 1, borderBottomColor: colors.borderCard },
  placeholder: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSoft },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  flex: { flexGrow: 1, flexBasis: 130 },
  full: { flexBasis: '100%' },
});
