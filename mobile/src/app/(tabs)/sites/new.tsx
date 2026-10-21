import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Eye, LayoutTemplate } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { humanError } from '@/api/client';
import { createSite } from '@/api/endpoints';
import { qk, useSites, useTemplates } from '@/api/queries';
import type { Template } from '@/api/types';
import { Button, Card, EmptyState, LoadError, PageHeader, Pill, Screen, Skeleton, Text, useToast } from '@/components/ui';
import { API_BASE } from '@/lib/config';
import { useLayout } from '@/lib/layout';
import { assetUrl, openInBrowser } from '@/lib/links';
import { colors, fonts, radius } from '@/theme/tokens';

/**
 * Vorlagen wie /sites/new – bewusst OHNE die Abzeichen zur Tarif-Zuordnung und
 * ohne Filter. Gibt es schon eine Seite mit der Vorlage, führt der Knopf dorthin.
 */
export default function NewSiteScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const templates = useTemplates();
  const sites = useSites();
  const { columns } = useLayout();
  const [busy, setBusy] = useState<string | null>(null);

  const siteMap = Object.fromEntries((sites.data ?? []).filter(s => s.status !== 'deleted').map(s => [s.template_id, s]));
  const list = (templates.data ?? []).filter(t => !t.is_coming_soon);

  async function select(tpl: Template) {
    const existing = siteMap[tpl.id];
    if (existing) {
      router.push({ pathname: '/editor/[id]', params: { id: existing.id } });
      return;
    }
    setBusy(tpl.id);
    try {
      const { id } = await createSite(tpl.id);
      void qc.invalidateQueries({ queryKey: qk.sites });
      void qc.invalidateQueries({ queryKey: qk.overview });
      router.push({ pathname: '/editor/[id]', params: { id } });
    } catch (e) {
      toast.show(humanError(e), 'error');
    }
    setBusy(null);
  }

  return (
    <Screen wide refreshing={templates.isRefetching} onRefresh={() => void templates.refetch()}>
      <PageHeader title="Neue Webseite erstellen" subtitle="Such dir eine Vorlage aus. Mit „Ansehen“ kannst du sie dir vorher in Ruhe anschauen." />
      {templates.isError && !templates.data ? (
        <LoadError onRetry={() => void templates.refetch()} />
      ) : templates.isLoading ? (
        <View style={{ gap: 20 }}>
          <Skeleton height={300} radius={radius.card} />
          <Skeleton height={300} radius={radius.card} />
        </View>
      ) : list.length === 0 ? (
        <EmptyState icon={LayoutTemplate} title="Keine Vorlagen verfügbar" text="Bitte versuche es später erneut." />
      ) : (
        <View style={[styles.grid, columns > 1 && styles.gridWrap]}>
          {list.map(tpl => {
            const existing = siteMap[tpl.id];
            const isDraft = existing?.status === 'draft';
            const preview = assetUrl(tpl.preview_images?.[0]);
            return (
              <View key={tpl.id} style={columns > 1 ? { width: columns === 3 ? '31.5%' : '48.5%' } : undefined}>
                <Card padded={false} style={{ overflow: 'hidden', flex: 1 }}>
                  <View style={styles.preview}>
                    {preview ? (
                      <Image source={{ uri: preview }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" transition={150} />
                    ) : (
                      <View style={styles.placeholder}>
                        <LayoutTemplate size={28} color={colors.hairline} strokeWidth={1.5} />
                      </View>
                    )}
                    {tpl.badge === 'brandneu' && !existing && (
                      <View style={styles.newBadge}>
                        <Text style={styles.newBadgeText}>Neu</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.body}>
                    {existing && <Pill label={isDraft ? 'Entwurf vorhanden' : 'Schon online'} tone={isDraft ? 'draft' : 'online'} />}
                    <Text variant="headline">{tpl.title}</Text>
                    {tpl.description ? <Text variant="callout">{tpl.description}</Text> : null}
                    <View style={{ flex: 1 }} />
                    {existing ? (
                      <Button title={isDraft ? 'Weiter bearbeiten' : 'Bearbeiten'} fullWidth onPress={() => select(tpl)} style={{ marginTop: 12 }} />
                    ) : (
                      <View style={styles.actions}>
                        <Button
                          title="Ansehen"
                          icon={Eye}
                          variant="secondary"
                          style={{ flexGrow: 1, flexBasis: 110 }}
                          onPress={() => openInBrowser(`${API_BASE}/api/templates/${tpl.id}/public-preview`)}
                        />
                        <Button
                          title={busy === tpl.id ? 'Wird angelegt…' : 'Diese Vorlage verwenden'}
                          variant="accent"
                          loading={busy === tpl.id}
                          disabled={!!busy && busy !== tpl.id}
                          style={{ flexGrow: 2, flexBasis: 190 }}
                          onPress={() => select(tpl)}
                        />
                      </View>
                    )}
                  </View>
                </Card>
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 20 },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 24 },
  preview: { aspectRatio: 16 / 10, backgroundColor: colors.muted, borderBottomWidth: 1, borderBottomColor: colors.borderCard },
  placeholder: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSoft },
  newBadge: { position: 'absolute', top: 12, left: 12, backgroundColor: colors.accent, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  newBadgeText: { fontFamily: fonts.bold, fontSize: 12, color: colors.white },
  body: { padding: 16, gap: 6, flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
});
