import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Eye, LayoutTemplate, Search, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { humanError } from '@/api/client';
import { createSite } from '@/api/endpoints';
import { qk, useSites, useTemplates } from '@/api/queries';
import type { Template } from '@/api/types';
import { Card, Input, LoadError, Pill, Screen, Skeleton, Text, useToast } from '@/components/ui';
import { API_BASE } from '@/lib/config';
import { useLayout } from '@/lib/layout';
import { assetUrl, openInBrowser } from '@/lib/links';
import { colors, fonts, radius } from '@/theme/tokens';

/**
 * „Neue Webseite erstellen“ wie /sites/new im Web-App-Modus: Suche, Anzahl, Vorlagen-Karten mit
 * „Ansehen“ und „Diese Vorlage verwenden“, darunter „Diese Vorlagen nutzt du schon“. Ohne
 * Tarif-Abzeichen und Filter nach Tarif (kein Kaufweg in der App).
 */
export default function NewSiteScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const templates = useTemplates();
  const sites = useSites();
  const { width } = useLayout();
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const siteMap = useMemo(
    () => Object.fromEntries((sites.data ?? []).filter(s => s.status !== 'deleted').map(s => [s.template_id, s])),
    [sites.data],
  );
  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = (templates.data ?? []).filter(t => !t.is_coming_soon);
    if (!q) return base;
    return base.filter(t => t.title.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q));
  }, [templates.data, search]);
  const fresh = searched.filter(t => !siteMap[t.id]);
  const used = searched.filter(t => siteMap[t.id]);
  const columns = width >= 640 ? 2 : 1;

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

  const grid = (list: Template[]) => (
    <View style={[styles.grid, columns > 1 && styles.gridWrap]}>
      {list.map(tpl => (
        <View key={tpl.id} style={columns > 1 ? { width: '48.6%' } : undefined}>
          <TemplateCard tpl={tpl} existing={siteMap[tpl.id]} busy={busy} onSelect={() => select(tpl)} />
        </View>
      ))}
    </View>
  );

  return (
    <Screen wide refreshing={templates.isRefetching} onRefresh={() => void templates.refetch()} contentStyle={{ gap: 0 }}>
      <View style={{ marginBottom: 24 }}>
        <Text style={styles.h1} accessibilityRole="header">
          Neue Webseite erstellen
        </Text>
        <Text style={styles.lead}>Such dir eine Vorlage aus. Mit „Ansehen“ kannst du sie dir vorher in Ruhe anschauen.</Text>
      </View>

      <View style={{ marginBottom: 16 }}>
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Vorlage suchen…"
          returnKeyType="search"
          autoCorrect={false}
          left={<Search size={16} color={colors.tertiary} style={{ marginLeft: 14 }} />}
          right={
            search ? (
              <Pressable onPress={() => setSearch('')} hitSlop={10} style={{ paddingHorizontal: 14 }} accessibilityLabel="Suche leeren">
                <X size={14} color={colors.faint} strokeWidth={2.5} />
              </Pressable>
            ) : undefined
          }
        />
      </View>

      {templates.isError && !templates.data ? (
        <LoadError onRetry={() => void templates.refetch()} />
      ) : templates.isLoading ? (
        <View style={{ gap: 16 }}>
          <Skeleton height={300} radius={radius.card} />
          <Skeleton height={300} radius={radius.card} />
        </View>
      ) : searched.length === 0 ? (
        <View style={styles.empty}>
          <LayoutTemplate size={28} color={colors.hairline} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>{search ? 'Keine Vorlagen gefunden' : 'Keine Vorlagen verfügbar'}</Text>
          <Text style={styles.emptyText}>{search ? 'Versuche einen anderen Suchbegriff.' : 'Bitte versuche es später erneut.'}</Text>
        </View>
      ) : (
        <>
          <Text style={styles.count}>
            {searched.length} {searched.length === 1 ? 'Vorlage' : 'Vorlagen'} gefunden
          </Text>
          {fresh.length > 0 && grid(fresh)}
          {used.length > 0 && (
            <View style={{ marginTop: fresh.length > 0 ? 40 : 0 }}>
              <Text style={styles.h2} accessibilityRole="header">
                Diese Vorlagen nutzt du schon
              </Text>
              <Text style={styles.sectionText}>Du findest sie auch auf deiner Startseite unter „Online“ oder „Entwürfe“.</Text>
              {grid(used)}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

function TemplateCard({
  tpl,
  existing,
  busy,
  onSelect,
}: {
  tpl: Template;
  existing?: { status: string };
  busy: string | null;
  onSelect: () => void;
}) {
  const { width } = useLayout();
  const preview = assetUrl(tpl.preview_images?.[0]);
  const isDraft = existing?.status === 'draft';
  const isBusy = busy === tpl.id;
  const dim = !!busy && !isBusy;
  return (
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
      <View style={[styles.body, { padding: width >= 640 ? 20 : 16 }]}>
        <View style={{ flex: 1 }}>
          {existing && (
            <View style={{ marginBottom: 8 }}>
              <Pill label={isDraft ? 'Entwurf vorhanden' : 'Schon online'} tone={isDraft ? 'draft' : 'online'} />
            </View>
          )}
          <Text style={styles.title}>{tpl.title}</Text>
          {tpl.description ? <Text style={styles.desc}>{tpl.description}</Text> : null}
        </View>
        {existing ? (
          <Pressable onPress={onSelect} disabled={!!busy} style={[styles.dark, dim && { opacity: 0.5 }]} accessibilityRole="button">
            <Text style={styles.darkText}>{isBusy ? 'Wird geöffnet…' : isDraft ? 'Weiter bearbeiten' : 'Bearbeiten'}</Text>
          </Pressable>
        ) : (
          <View style={styles.actions}>
            <Pressable
              onPress={() => openInBrowser(`${API_BASE}/api/templates/${tpl.id}/public-preview`)}
              style={({ pressed }) => [styles.view, pressed && { opacity: 0.85 }]}
              accessibilityRole="button">
              <Eye size={16} color={colors.ink} strokeWidth={2} />
              <Text style={styles.viewText}>Ansehen</Text>
            </Pressable>
            <Pressable onPress={onSelect} disabled={!!busy} style={[styles.use, dim && { opacity: 0.5 }]} accessibilityRole="button">
              {isBusy && <ActivityIndicator size="small" color={colors.white} />}
              <Text style={styles.useText} numberOfLines={1}>
                {isBusy ? 'Wird angelegt…' : 'Diese Vorlage verwenden'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 32, letterSpacing: -0.6, color: colors.ink },
  lead: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.secondary, marginTop: 6 },
  h2: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 28, color: colors.ink },
  sectionText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.secondary, marginTop: 4, marginBottom: 16 },
  count: { fontFamily: fonts.regular, fontSize: 12, color: colors.faint, marginBottom: 16, paddingHorizontal: 2 },
  grid: { gap: 20 },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 20 },
  preview: { aspectRatio: 16 / 10, backgroundColor: colors.muted, borderBottomWidth: 1, borderBottomColor: colors.borderCard },
  placeholder: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSoft },
  newBadge: { position: 'absolute', top: 12, left: 12, backgroundColor: colors.accent, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  newBadgeText: { fontFamily: fonts.bold, fontSize: 12, color: colors.white },
  body: { gap: 12, flex: 1 },
  title: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 25, color: colors.ink },
  desc: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.secondary, marginTop: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  view: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 120,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: radius.button,
    backgroundColor: colors.surfaceSoft,
  },
  viewText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  use: {
    flexGrow: 2,
    flexShrink: 1,
    flexBasis: 190,
    // wie whitespace-nowrap im Web: lieber umbrechen als den Text abschneiden
    minWidth: 224,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: radius.button,
    backgroundColor: colors.accent,
  },
  useText: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
  dark: { minHeight: 48, borderRadius: radius.button, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  darkText: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 64 },
  emptyTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.body, marginTop: 8 },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, color: colors.faint },
});
