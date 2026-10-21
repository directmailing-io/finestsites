import { useRouter } from 'expo-router';
import { Bell, CheckCircle2, ChevronRight, Plus, TrendingDown, TrendingUp } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { useMe, useOverview, useSites } from '@/api/queries';
import { Button, Card, ListRow, ListSection, LoadError, Notice, PageHeader, Screen, SectionHeader, Skeleton, Text } from '@/components/ui';
import { SiteCard } from '@/features/sites/SiteCard';
import { accountStatusView, todoView } from '@/features/start/todos';
import { greeting } from '@/lib/format';
import { useLayout } from '@/lib/layout';
import { colors, fonts, hit, radius } from '@/theme/tokens';

export default function StartScreen() {
  const router = useRouter();
  const { columns } = useLayout();
  const me = useMe();
  const overview = useOverview();
  const sites = useSites();
  const loading = overview.isLoading || me.isLoading;
  const o = overview.data;
  const name = me.data?.first_name || me.data?.username;
  const unreadNotifications = o?.unread.notifications ?? 0;
  const previewSites = (sites.data ?? []).filter(s => s.status !== 'deleted').slice(0, columns >= 2 ? 2 : 1);

  const refresh = () => {
    void overview.refetch();
    void sites.refetch();
    void me.refetch();
  };

  return (
    <Screen topInset refreshing={overview.isRefetching} onRefresh={refresh}>
      <PageHeader
        title={loading ? ' ' : greeting(name)}
        subtitle="Hier siehst du, was gerade wichtig ist."
        right={
          <Pressable
            onPress={() => router.push('/start/notifications')}
            style={styles.bell}
            accessibilityRole="button"
            accessibilityLabel={unreadNotifications ? `Mitteilungen, ${unreadNotifications} neu` : 'Mitteilungen'}>
            <Bell size={20} color={colors.ink} strokeWidth={2} />
            {unreadNotifications > 0 && <View style={styles.bellDot} />}
          </Pressable>
        }
      />

      {overview.isError && !o ? (
        <LoadError onRetry={refresh} />
      ) : loading || !o ? (
        <View style={{ gap: 16 }}>
          <Skeleton height={92} radius={radius.card} />
          <Skeleton height={160} radius={radius.card} />
          <Skeleton height={120} radius={radius.card} />
        </View>
      ) : (
        <>
          {(() => {
            const s = accountStatusView(o.account_status.code, o.account_status.online_count, o.account_status.offline_count);
            return (
              <Notice tone={s.tone} title={s.title}>
                {s.text}
              </Notice>
            );
          })()}

          <View style={{ gap: 12 }}>
            <SectionHeader title="Zu erledigen" />
            {o.todos.length === 0 ? (
              <Card tone="plain" style={styles.done}>
                <CheckCircle2 size={20} color={colors.successDot} />
                <Text variant="bodyStrong">Alles erledigt. Schön!</Text>
              </Card>
            ) : (
              <ListSection>
                {o.todos.map(t => {
                  const v = todoView(t);
                  return (
                    <ListRow
                      key={t.id}
                      icon={v.icon}
                      iconBg={colors.accentSoft}
                      iconColor={colors.accent}
                      title={v.title}
                      subtitle={v.text}
                      onPress={() => router.push(v.href)}
                    />
                  );
                })}
              </ListSection>
            )}
          </View>

          <View style={{ gap: 12 }}>
            <SectionHeader title="Diese Woche" subtitle="Alle deine Seiten zusammen, letzte 7 Tage." />
            <View style={styles.stats}>
              <Stat label="Besucher" value={o.week.visitors} prev={o.week.visitors_prev} />
              <Stat label="Anfragen" value={o.week.submissions} prev={o.week.submissions_prev} onPress={() => router.push('/inbox')} />
            </View>
          </View>

          <View style={{ gap: 12 }}>
            <SectionHeader
              title="Deine Webseiten"
              right={
                (sites.data?.length ?? 0) > 0 ? (
                  <Pressable onPress={() => router.navigate('/sites')} hitSlop={10} style={styles.allLink} accessibilityRole="link">
                    <Text style={styles.allLinkText}>Alle ansehen</Text>
                    <ChevronRight size={16} color={colors.accent} />
                  </Pressable>
                ) : undefined
              }
            />
            {previewSites.length > 0 && (
              <View style={[styles.grid, columns >= 2 && styles.gridRow]}>
                {previewSites.map(s => (
                  <View key={s.id} style={columns >= 2 ? styles.gridItem : undefined}>
                    <SiteCard site={s} />
                  </View>
                ))}
              </View>
            )}
            <Button title="Neue Webseite erstellen" icon={Plus} variant="accent" size="lg" onPress={() => router.push('/sites/new')} />
          </View>
        </>
      )}
    </Screen>
  );
}

function Stat({ label, value, prev, onPress }: { label: string; value: number; prev: number; onPress?: () => void }) {
  const diff = prev > 0 ? Math.round(((value - prev) / prev) * 100) : null;
  const up = diff !== null && diff >= 0;
  const Trend = up ? TrendingUp : TrendingDown;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.stat, pressed && { opacity: 0.8 }]}
      accessibilityLabel={`${label}: ${value}`}>
      <Text variant="calloutStrong" color={colors.secondary}>
        {label}
      </Text>
      <Text style={styles.statValue}>{value.toLocaleString('de-DE')}</Text>
      {diff !== null && (
        <View style={styles.trend}>
          <Trend size={14} color={up ? colors.success : colors.secondary} />
          <Text variant="footnote" color={up ? colors.success : colors.secondary}>
            {up ? '+' : ''}
            {diff} % zur Vorwoche
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bell: {
    width: hit.min,
    height: hit.min,
    borderRadius: hit.min / 2,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.unreadBadge,
    borderWidth: 2,
    borderColor: colors.white,
  },
  done: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: radius.input },
  stats: { flexDirection: 'row', gap: 12 },
  stat: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.input,
    padding: 16,
    gap: 4,
  },
  statValue: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 36, letterSpacing: -0.8, color: colors.ink },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  allLink: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: hit.min },
  allLinkText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.accent },
  grid: { gap: 16 },
  gridRow: { flexDirection: 'row' },
  gridItem: { flex: 1 },
});
