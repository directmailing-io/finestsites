import { Users } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useAffiliate } from '@/api/queries';
import { EmptyState, InitialsAvatar, Pill, Screen, Skeleton, Text } from '@/components/ui';
import { fmtDate } from '@/lib/format';
import { colors, fonts, radius } from '@/theme/tokens';

/** Empfehlungen: nur Name, seit wann, aktiv/pausiert – keine Tarife, keine Beträge pro Person. */
export default function ReferralsScreen() {
  const q = useAffiliate();
  const r = q.data?.referrals;
  return (
    <Screen readable refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      {!r ? (
        <Skeleton height={200} radius={radius.input} />
      ) : r.items.length === 0 ? (
        <EmptyState icon={Users} title="Noch keine Empfehlungen" text="Teile deinen Empfehlungslink. Wer sich darüber anmeldet, erscheint hier." />
      ) : (
        <>
          <Text variant="bodyLarge">
            Deine Empfehlungen: {r.items.length} · {r.active} aktiv · {r.paused} pausiert
          </Text>
          <View style={styles.group}>
            {r.items.map((p, i) => (
              <View key={p.id} style={[styles.row, i > 0 && styles.border]}>
                <InitialsAvatar name={p.name} size={40} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.name}>{p.name}</Text>
                  <Text variant="callout">dabei seit {fmtDate(p.since)}</Text>
                </View>
                <Pill label={p.status === 'active' ? 'aktiv' : 'pausiert'} tone={p.status === 'active' ? 'online' : 'draft'} />
              </View>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { backgroundColor: colors.white, borderRadius: radius.input, borderWidth: 1.5, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  border: { borderTopWidth: 1, borderTopColor: colors.divider },
  name: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
});
