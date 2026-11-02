import { useRouter, type Href } from 'expo-router';
import { Bell, ChevronRight, LogOut, MessageCircle, Settings, Megaphone, type LucideIcon } from 'lucide-react-native';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { useDeletionStatus, useMe, useOverview } from '@/api/queries';
import { fmtDate } from '@/lib/format';
import { Notice, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { colors, fonts, radius, shadows } from '@/theme/tokens';

/**
 * „Mehr“ wie das Mehr-Fenster der Handy-Navigation im Web (MobileNav.tsx): Support,
 * Einstellungen, Trennlinie, Abmelden – gleiche Namen, Symbole und Reihenfolge. Dazu (nur App)
 * „Mitteilungen“, die Liste der Push-Mitteilungen, und „Neuigkeiten“ (im Web in der Seitenleiste)
 * mit Zähler für Ungelesenes.
 */
export default function MoreScreen() {
  const router = useRouter();
  const me = useMe();
  const overview = useOverview();
  const deletion = useDeletionStatus();
  const signOut = useAuth(s => s.signOut);
  const u = me.data;
  const unreadSupport = overview.data?.unread.support ?? 0;
  const unreadNotifications = overview.data?.unread.notifications ?? 0;
  const unreadNews = overview.data?.news.unread ?? 0;

  const logout = () =>
    Alert.alert('Abmelden?', 'Du kannst dich jederzeit wieder anmelden.', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Abmelden', style: 'destructive', onPress: () => void signOut() },
    ]);

  return (
    <Screen topInset readable refreshing={me.isRefetching} onRefresh={() => void me.refetch()}>
      <Text style={styles.h1} accessibilityRole="header">
        Mehr
      </Text>

      {deletion.data?.status === 'scheduled' && deletion.data.mode === 'period_end' && deletion.data.scheduledFor ? (
        <Pressable onPress={() => router.push('/deletion-pending')} accessibilityRole="button">
          <Notice tone="danger">
            {`Dein Konto wird am ${fmtDate(deletion.data.scheduledFor)} gelöscht. Bis dahin bleiben deine Seiten online. Tippen, um die Löschung abzubrechen.`}
          </Notice>
        </Pressable>
      ) : null}

      <View style={styles.card}>
        <Row icon={MessageCircle} label="Support" href="/account/help" badge={unreadSupport} />
        <Row icon={Settings} label="Einstellungen" href="/account/settings" />
        <Row icon={Megaphone} label="Neuigkeiten" href="/account/news" badge={unreadNews} tone="accent" />
        <Row icon={Bell} label="Mitteilungen" href="/account/messages" badge={unreadNotifications} />

        <View style={styles.divider} />

        <Pressable onPress={logout} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.dangerSoft }]}>
          <LogOut size={20} color={colors.dangerStrong} strokeWidth={1.75} />
          <Text style={[styles.label, { color: colors.dangerStrong }]}>Abmelden</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

/** tone 'accent': violette Zähl-Badge und sanft getönte Zeile, solange etwas ungelesen ist (Neuigkeiten, Konzept Bild 3). */
function Row({ icon: Icon, label, href, badge = 0, tone = 'danger' }: { icon: LucideIcon; label: string; href: Href; badge?: number; tone?: 'danger' | 'accent' }) {
  const router = useRouter();
  const accent = tone === 'accent' && badge > 0;
  return (
    <Pressable
      onPress={() => router.push(href)}
      accessibilityRole="button"
      accessibilityLabel={badge > 0 ? `${label}, ${badge} neu` : label}
      style={({ pressed }) => [styles.row, accent && { backgroundColor: colors.accentWash }, pressed && { backgroundColor: accent ? colors.accentSoft : '#F9FAFB' }]}>
      <Icon size={20} color={accent ? colors.accent : colors.mutedForeground} strokeWidth={1.75} />
      <Text style={[styles.label, accent && { fontFamily: fonts.semibold }]}>{label}</Text>
      {badge > 0 && (
        <View style={[styles.badge, accent && { backgroundColor: colors.accent }]}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
      <ChevronRight size={14} color="#D1D5DB" strokeWidth={2.5} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 32, letterSpacing: -0.6, color: colors.ink },
  // Mehr-Fenster: weiß, rounded-3xl, px-3 pb-3, Zeilen px-4 py-4 rounded-2xl
  card: { backgroundColor: colors.white, borderRadius: radius.card, padding: 12, ...shadows.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingVertical: 16, borderRadius: radius.input, minHeight: 56 },
  label: { flex: 1, fontFamily: fonts.medium, fontSize: 16, lineHeight: 22, color: '#1F2937' },
  divider: { height: 1, marginHorizontal: 16, marginVertical: 4, backgroundColor: colors.muted },
  badge: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: colors.dangerStrong, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.bold, fontSize: 11, color: colors.white },
});
