import { useQuery } from '@tanstack/react-query';
import { KeyRound, Lock, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { approveImpersonation, getImpersonationState, rejectImpersonation } from '@/api/endpoints';
import { qk } from '@/api/queries';
import type { ImpersonationState } from '@/api/types';
import { Button, Text } from '@/components/ui';
import { colors, fonts, radius } from '@/theme/tokens';

/**
 * Freigabe für den Support-Zugriff (wie ImpersonationCard im Web). Das Web nutzt einen
 * Server-Stream; die App fragt alle 4 Sekunden nach, solange etwas offen ist.
 */
export function ImpersonationCard({ token }: { token: string }) {
  const [acting, setActing] = useState(false);
  const [override, setOverride] = useState<ImpersonationState | null>(null);
  const q = useQuery({
    queryKey: qk.impersonation,
    queryFn: getImpersonationState,
    refetchInterval: query => {
      const d = query.state.data;
      const s = d?.request?.token === token ? d.state : null;
      return s === 'pending' || s === 'approved' || s === 'active' ? 4000 : false;
    },
  });

  const serverState: ImpersonationState | 'loading' = q.isLoading
    ? 'loading'
    : q.data?.request?.token === token && q.data.state
      ? q.data.state
      : 'expired';
  const status = override ?? serverState;

  async function act(approve: boolean) {
    setActing(true);
    try {
      await (approve ? approveImpersonation(token) : rejectImpersonation(token));
      setOverride(approve ? 'approved' : 'rejected');
      void q.refetch();
    } catch {
      /* Karte bleibt offen, Nutzer kann erneut tippen */
    }
    setActing(false);
  }

  if (status === 'loading') {
    return (
      <View style={[styles.card, styles.grey]}>
        <Text variant="callout" color={colors.tertiary}>
          Lädt…
        </Text>
      </View>
    );
  }
  if (status === 'pending') {
    return (
      <View style={[styles.card, { backgroundColor: '#F0F7FF', borderColor: '#BAD4F5' }]}>
        <View style={styles.titleRow}>
          <KeyRound size={15} color="#1E40AF" />
          <Text style={[styles.title, { color: '#1E40AF' }]}>Zugriff auf deinen Account</Text>
        </View>
        <Text style={styles.text}>Der Support möchte kurz in deinen Account schauen, um dir zu helfen. Bist du damit einverstanden?</Text>
        <View style={styles.actions}>
          <Button title={acting ? 'Bitte warten…' : 'Freigabe erteilen'} size="sm" variant="primary" style={{ backgroundColor: '#059669' }} onPress={() => act(true)} disabled={acting} />
          <Button title="Ablehnen" size="sm" variant="outline" onPress={() => act(false)} disabled={acting} />
        </View>
      </View>
    );
  }
  if (status === 'approved' || status === 'active') {
    return (
      <View style={[styles.card, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
        <View style={styles.titleRow}>
          <ShieldCheck size={15} color={colors.success} />
          <Text style={[styles.title, { color: colors.success }]}>{status === 'active' ? 'Support-Session aktiv' : 'Freigabe erteilt'}</Text>
        </View>
        <Text style={styles.text}>
          {status === 'active' ? 'Der Support sieht deinen Account, um dir zu helfen.' : 'Der Support schaut gleich in deinen Account.'}
        </Text>
      </View>
    );
  }
  return (
    <View style={[styles.card, styles.grey]}>
      <View style={styles.titleRow}>
        <Lock size={14} color={colors.secondary} />
        <Text variant="callout" color={colors.tertiary}>
          {status === 'ended'
            ? 'Session beendet. Dein Account ist wieder nur für dich zugänglich.'
            : status === 'rejected'
              ? 'Zugriff abgelehnt.'
              : 'Diese Zugriffsanfrage ist abgelaufen.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.buttonSmall, borderWidth: 1, padding: 14, gap: 6, maxWidth: '90%', alignSelf: 'flex-start' },
  grey: { backgroundColor: colors.surfaceSubtle, borderColor: colors.borderCard },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  title: { fontFamily: fonts.semibold, fontSize: 14 },
  text: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.body },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
});
