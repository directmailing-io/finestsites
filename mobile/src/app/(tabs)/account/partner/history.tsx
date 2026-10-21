import { History } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useAffiliate } from '@/api/queries';
import type { AffiliateHistoryItem } from '@/api/types';
import { EmptyState, Pill, Screen, Skeleton, Text, type PillTone } from '@/components/ui';
import { euros, fmtDate } from '@/lib/format';
import { colors, fonts, radius } from '@/theme/tokens';

const STATUS: Record<AffiliateHistoryItem['status'], { label: string; tone: PillTone }> = {
  pending: { label: 'Wartezeit 14 Tage', tone: 'warning' },
  available: { label: 'Verfügbar', tone: 'success' },
  paid: { label: 'Ausgezahlt', tone: 'info' },
  credited: { label: 'Verrechnet', tone: 'info' },
  reversed: { label: 'Storniert', tone: 'neutral' },
};

export default function HistoryScreen() {
  const q = useAffiliate();
  const items = q.data?.history ?? [];
  return (
    <Screen readable refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      {q.isLoading ? (
        <Skeleton height={200} radius={radius.input} />
      ) : items.length === 0 ? (
        <EmptyState icon={History} title="Noch keine Einnahmen" text="Sobald deine erste Empfehlung dabei ist, siehst du hier deine Provisionen." />
      ) : (
        <View style={styles.group}>
          {items.map((h, i) => {
            const s = STATUS[h.status];
            const negative = h.amount_cents < 0;
            return (
              <View key={h.id} style={[styles.row, i > 0 && styles.border]}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.amount}>{euros(h.amount_cents)}</Text>
                  <Text variant="callout">
                    {fmtDate(h.date)}
                    {h.status === 'pending' && h.available_at ? ` · verfügbar ab ${fmtDate(h.available_at)}` : ''}
                    {negative ? ' · wird mit neuen Provisionen verrechnet' : ''}
                  </Text>
                </View>
                <Pill label={negative ? 'Rückbuchung' : s.label} tone={negative ? 'offline' : s.tone} dot={false} />
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { backgroundColor: colors.white, borderRadius: radius.input, borderWidth: 1.5, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  border: { borderTopWidth: 1, borderTopColor: colors.divider },
  amount: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
});
