import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Plus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useMe, useSites } from '@/api/queries';
import type { Site } from '@/api/types';
import { LoadError, Screen, Skeleton, Text } from '@/components/ui';
import { SiteCard } from '@/features/sites/SiteCard';
import { greeting } from '@/lib/format';
import { useLayout } from '@/lib/layout';
import { colors, fonts, radius, shadows } from '@/theme/tokens';

/**
 * Startseite der App = 1:1 die Startseite der Webapp „/sites“ (src/app/(dashboard)/sites/page.tsx):
 * Begrüßung, „Neue Webseite erstellen“, Abschnitte Online / Offline / Entwürfe mit denselben Karten,
 * am Ende „Noch eine Webseite erstellen“. Raster wie im Web: 1 Spalte, ab 768 pt 2, ab 1280 pt 3.
 */
// Welche Veröffentlichung schon angezeigt wurde (Tab-Routen behalten ihre Parameter, auch nach
// setParams – ohne dieses Merkmal käme „Deine Seite ist online.“ bei jedem Tab-Wechsel wieder).
let shownLiveKey = '';

export default function SitesScreen() {
  const router = useRouter();
  const { live, at } = useLocalSearchParams<{ live?: string; at?: string }>();
  const sites = useSites();
  const me = useMe();
  const { width } = useLayout();
  const liveKey = live ? `${live}:${at ?? ''}` : '';
  const [liveId, setLiveId] = useState<string | null>(live && liveKey !== shownLiveKey ? live : null);
  const [hour, setHour] = useState(() => new Date().getHours());

  // Begrüßung folgt der Uhr (wie im Web, auch wenn die App offen bleibt)
  useEffect(() => {
    const t = setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Nach dem Veröffentlichen (…/sites?live=<id>): Hinweis oben + die Karte leuchtet kurz grün
  useEffect(() => {
    if (!live || liveKey === shownLiveKey) return;
    shownLiveKey = liveKey;
    setLiveId(live);
    const t = setTimeout(() => setLiveId(null), 6000);
    return () => clearTimeout(t);
  }, [live, liveKey]);

  const loading = sites.isLoading || me.isLoading;
  const list = (sites.data ?? []).filter(s => s.status !== 'deleted');
  const online = list.filter(s => s.status === 'published');
  const offline = list.filter(s => s.status === 'deactivated');
  const drafts = list.filter(s => s.status !== 'published' && s.status !== 'deactivated');
  const hasSites = list.length > 0;
  const name = me.data?.user.firstName || me.data?.user.username;
  const columns = width >= 1280 ? 3 : width >= 768 ? 2 : 1;
  const gap = width >= 640 ? 24 : 20;
  const sm = width >= 640;

  return (
    <Screen
      topInset
      wide
      refreshing={sites.isRefetching}
      onRefresh={() => {
        void sites.refetch();
        void me.refetch();
      }}
      contentStyle={{ gap: 0 }}>
      {/* Begrüßung + die eine Hauptaktion, ganz oben */}
      <View style={{ marginBottom: sm ? 40 : 32 }}>
        <Text style={[styles.h1, sm && styles.h1Large]} accessibilityRole="header">
          {loading ? ' ' : greeting(name, hour)}
        </Text>
        <Text style={styles.lead}>
          {loading ? ' ' : hasSites ? 'Hier findest du deine Webseiten.' : 'Du hast noch keine Webseite. Leg jetzt deine erste an.'}
        </Text>
        {!loading && (
          <Pressable
            onPress={() => router.push('/sites/new')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.newBtn, sm && styles.newBtnInline, pressed && styles.pressed]}>
            <Plus size={20} color={colors.white} strokeWidth={2.75} />
            <Text style={styles.newBtnText}>Neue Webseite erstellen</Text>
          </Pressable>
        )}
      </View>

      {sites.isError && !sites.data ? (
        <LoadError onRetry={() => void sites.refetch()} />
      ) : loading ? (
        <Grid columns={columns} gap={gap}>
          {[0, 1].map(i => (
            <View key={i} style={styles.skeletonCard}>
              <View style={{ aspectRatio: 16 / 10, backgroundColor: colors.muted }} />
              <View style={{ padding: 20, gap: 12 }}>
                <Skeleton width="66%" height={16} />
                <Skeleton width="50%" height={12} />
                <Skeleton height={48} radius={radius.button} />
              </View>
            </View>
          ))}
        </Grid>
      ) : (
        <>
          {liveId && online.some(s => s.id === liveId) && (
            <View style={styles.liveNotice} accessibilityRole="alert">
              <View style={styles.liveCheck}>
                <Check size={14} color={colors.white} strokeWidth={3} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.liveText, { fontFamily: fonts.bold }]}>Deine Seite ist online.</Text>
                <Text style={styles.liveText}>Hier in der Übersicht findest du sie jederzeit wieder. Mit „Bearbeiten“ kannst du sie weiter anpassen.</Text>
              </View>
            </View>
          )}
          <Section
            title="Online"
            subtitle={online.length === 1 ? 'Diese Webseite ist veröffentlicht und für alle sichtbar.' : 'Diese Webseiten sind veröffentlicht und für alle sichtbar.'}
            sites={online}
            columns={columns}
            gap={gap}
            liveId={liveId}
          />
          <Section title="Offline" subtitle="Diese Webseiten sind gerade nicht erreichbar." sites={offline} columns={columns} gap={gap} />
          <Section title="Entwürfe" subtitle="Angefangen, aber noch nicht veröffentlicht. Nur du siehst sie." sites={drafts} columns={columns} gap={gap} />

          {/* Zweite Chance für die Hauptaktion, nach der Liste */}
          {hasSites && (
            <Pressable onPress={() => router.push('/sites/new')} style={({ pressed }) => [styles.again, pressed && { opacity: 0.85 }]} accessibilityRole="button">
              <View style={styles.againIcon}>
                <Plus size={20} color={colors.white} strokeWidth={2.75} />
              </View>
              <Text style={styles.againTitle}>Noch eine Webseite erstellen</Text>
              <Text style={styles.againText}>Such dir eine weitere Vorlage aus.</Text>
            </Pressable>
          )}
        </>
      )}
    </Screen>
  );
}

function Section({
  title,
  subtitle,
  sites,
  columns,
  gap,
  liveId,
}: {
  title: string;
  subtitle: string;
  sites: Site[];
  columns: number;
  gap: number;
  liveId?: string | null;
}) {
  if (sites.length === 0) return null;
  return (
    <View style={{ marginBottom: 40 }}>
      <Text style={styles.h2} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.sectionText}>{subtitle}</Text>
      <Grid columns={columns} gap={gap}>
        {sites.map(s => (
          <SiteCard key={s.id} site={s} highlight={s.id === liveId} />
        ))}
      </Grid>
    </View>
  );
}

/** Raster mit gleich breiten Spalten (wenige Seiten, kein FlatList nötig). */
function Grid({ columns, gap, children }: { columns: number; gap: number; children: React.ReactNode[] }) {
  if (columns <= 1) return <View style={{ gap }}>{children}</View>;
  const rows: React.ReactNode[][] = [];
  children.forEach((c, i) => {
    if (i % columns === 0) rows.push([]);
    rows[rows.length - 1].push(c);
  });
  return (
    <View style={{ gap }}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap, alignItems: 'flex-start' }}>
          {Array.from({ length: columns }).map((_, i) => (
            <View key={i} style={{ flex: 1 }}>
              {row[i] ?? null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // h1: text-2xl sm:text-3xl font-bold tracking-tight text-gray-900
  h1: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 32, letterSpacing: -0.6, color: colors.ink },
  h1Large: { fontSize: 30, lineHeight: 36, letterSpacing: -0.75 },
  // text-base mt-1.5 mb-5 #64748B
  lead: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.secondary, marginTop: 6, marginBottom: 20 },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 28,
    borderRadius: radius.button,
    backgroundColor: colors.accent,
    ...shadows.accentButton,
  },
  newBtnInline: { alignSelf: 'flex-start' },
  newBtnText: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22, color: colors.white },
  pressed: { transform: [{ scale: 0.98 }] },
  // h2: text-xl font-bold; p: text-sm mt-0.5 mb-4 #64748B
  h2: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 28, color: colors.ink },
  sectionText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.secondary, marginTop: 2, marginBottom: 16 },
  skeletonCard: { borderRadius: radius.card, borderWidth: 1.5, borderColor: colors.borderCard, backgroundColor: colors.white, overflow: 'hidden' },
  liveNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: radius.input,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
    backgroundColor: colors.successSoft,
    borderWidth: 1.5,
    borderColor: colors.successBorder,
  },
  liveCheck: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.successDot, alignItems: 'center', justifyContent: 'center' },
  liveText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.successInk },
  again: {
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.card,
    paddingHorizontal: 20,
    paddingVertical: 28,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.accentDashed,
    backgroundColor: colors.accentWash,
  },
  againIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  againTitle: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 24, color: colors.ink, marginTop: 4 },
  againText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.secondary, textAlign: 'center' },
});
