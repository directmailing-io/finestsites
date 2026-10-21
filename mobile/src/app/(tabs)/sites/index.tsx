import { useLocalSearchParams, useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useSites } from '@/api/queries';
import type { Site } from '@/api/types';
import { Button, LoadError, Notice, PageHeader, Screen, SectionHeader, Skeleton, Text } from '@/components/ui';
import { SiteCard } from '@/features/sites/SiteCard';
import { useLayout } from '@/lib/layout';
import { colors, fonts, radius } from '@/theme/tokens';

/**
 * „Meine Webseiten“ wie /sites im Web: gruppiert nach Online / Offline / Entwürfe,
 * auf dem iPad als Raster mit 2–3 Spalten.
 */
export default function SitesScreen() {
  const router = useRouter();
  const { live } = useLocalSearchParams<{ live?: string }>();
  const sites = useSites();
  const { columns } = useLayout();
  const [liveId, setLiveId] = useState<string | null>(live ?? null);

  useEffect(() => {
    if (!live) return;
    setLiveId(live);
    router.setParams({ live: undefined });
    const t = setTimeout(() => setLiveId(null), 6000);
    return () => clearTimeout(t);
  }, [live, router]);

  const list = sites.data ?? [];
  const online = list.filter(s => s.status === 'published');
  const offline = list.filter(s => s.status === 'deactivated');
  const drafts = list.filter(s => s.status !== 'published' && s.status !== 'deactivated' && s.status !== 'deleted');
  const hasSites = list.length > 0;

  return (
    <Screen topInset wide refreshing={sites.isRefetching} onRefresh={() => void sites.refetch()}>
      <View style={{ gap: 20 }}>
        <PageHeader
          title="Meine Webseiten"
          subtitle={sites.isLoading ? ' ' : hasSites ? 'Hier findest du deine Webseiten.' : 'Du hast noch keine Webseite. Leg jetzt deine erste an.'}
        />
        <Button
          title="Neue Webseite erstellen"
          icon={Plus}
          variant="accent"
          size="lg"
          style={columns > 1 ? { alignSelf: 'flex-start' } : undefined}
          onPress={() => router.push('/sites/new')}
        />
      </View>

      {sites.isError && !sites.data ? (
        <LoadError onRetry={() => void sites.refetch()} />
      ) : sites.isLoading ? (
        <Grid columns={columns}>
          {[0, 1].map(i => (
            <View key={i} style={styles.skeletonCard}>
              <Skeleton height={180} radius={0} />
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
            <Notice tone="success" title="Deine Seite ist online.">
              Hier in der Übersicht findest du sie jederzeit wieder. Mit „Bearbeiten“ kannst du sie weiter anpassen.
            </Notice>
          )}
          <Group
            title="Online"
            subtitle={online.length === 1 ? 'Diese Webseite ist veröffentlicht und für alle sichtbar.' : 'Diese Webseiten sind veröffentlicht und für alle sichtbar.'}
            sites={online}
            columns={columns}
            liveId={liveId}
          />
          <Group title="Offline" subtitle="Diese Webseiten sind gerade nicht erreichbar." sites={offline} columns={columns} />
          <Group title="Entwürfe" subtitle="Angefangen, aber noch nicht veröffentlicht. Nur du siehst sie." sites={drafts} columns={columns} />

          {hasSites && (
            <Pressable onPress={() => router.push('/sites/new')} style={({ pressed }) => [styles.again, pressed && { opacity: 0.85 }]} accessibilityRole="button">
              <View style={styles.againIcon}>
                <Plus size={20} color={colors.white} strokeWidth={2.75} />
              </View>
              <Text style={styles.againTitle}>Noch eine Webseite erstellen</Text>
              <Text variant="callout">Such dir eine weitere Vorlage aus.</Text>
            </Pressable>
          )}
        </>
      )}
    </Screen>
  );
}

function Group({ title, subtitle, sites, columns, liveId }: { title: string; subtitle: string; sites: Site[]; columns: number; liveId?: string | null }) {
  if (sites.length === 0) return null;
  return (
    <View style={{ gap: 16 }}>
      <SectionHeader title={title} subtitle={subtitle} />
      <Grid columns={columns}>
        {sites.map(s => (
          <SiteCard key={s.id} site={s} highlight={s.id === liveId} />
        ))}
      </Grid>
    </View>
  );
}

/** Einfaches Raster: Zeilen mit gleich breiten Spalten (kein FlatList nötig bei wenigen Seiten). */
function Grid({ columns, children }: { columns: number; children: React.ReactNode[] }) {
  if (columns <= 1) return <View style={{ gap: 20 }}>{children}</View>;
  const rows: React.ReactNode[][] = [];
  children.forEach((c, i) => {
    if (i % columns === 0) rows.push([]);
    rows[rows.length - 1].push(c);
  });
  return (
    <View style={{ gap: 24 }}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: 24 }}>
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
  skeletonCard: { borderRadius: radius.card, borderWidth: 1.5, borderColor: colors.borderCard, backgroundColor: colors.white, overflow: 'hidden' },
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
  againTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink, marginTop: 4 },
});
