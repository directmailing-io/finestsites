import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ApiError, humanError } from '@/api/client';
import { getDeletionInfo, requestDeletion } from '@/api/endpoints';
import { qk } from '@/api/queries';
import type { PartnerBalanceChoice } from '@/api/types';
import { Button, Card, Input, Notice, Screen, Skeleton, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { euros, fmtDate } from '@/lib/format';
import { colors, fonts, radius } from '@/theme/tokens';

/**
 * Konto löschen (Apple 5.1.1(v)): Passwort, ausdrückliche Bestätigung, 14 Tage Bedenkzeit.
 * Offenes Partner-Guthaben verfällt NICHT stillschweigend: Auszahlung oder ausdrücklicher Verzicht.
 */
export default function DeleteAccountScreen() {
  const signOut = useAuth(s => s.signOut);
  const info = useQuery({ queryKey: qk.deletion, queryFn: getDeletionInfo });
  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [choice, setChoice] = useState<PartnerBalanceChoice | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [doneDate, setDoneDate] = useState<string | null>(null);

  const balance = info.data?.partner_balance_cents ?? 0;
  const needsChoice = balance > 0;
  const canSubmit = !!password && confirmed && (!needsChoice || !!choice);

  function submit() {
    Alert.alert('Konto wirklich löschen?', 'Nach 14 Tagen werden deine Seiten und Daten endgültig gelöscht.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Konto löschen',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          setError('');
          try {
            const res = await requestDeletion(password, needsChoice ? choice : null);
            setDoneDate(res.scheduled_for);
          } catch (e) {
            setError(e instanceof ApiError && e.status === 400 ? 'Das Passwort stimmt nicht.' : humanError(e));
          }
          setLoading(false);
        },
      },
    ]);
  }

  if (doneDate) {
    return (
      <Screen readable>
        <Notice tone="success" title="Löschung ist vorgemerkt">
          {`Dein Konto wird am ${fmtDate(doneDate)} endgültig gelöscht. Bis dahin kannst du es dir anders überlegen: Melde dich einfach wieder an und schreib uns im Hilfe-Chat.`}
        </Notice>
        <Button title="Abmelden" onPress={() => void signOut()} fullWidth />
      </Screen>
    );
  }

  return (
    <Screen readable>
      <Text variant="bodyLarge">Schade, dass du gehst. Bevor du dein Konto löschst, lies bitte kurz, was passiert:</Text>
      <Card tone="plain" style={{ gap: 10 }}>
        {[
          'Deine Webseiten gehen sofort offline.',
          'Du hast 14 Tage Bedenkzeit. In dieser Zeit kannst du die Löschung rückgängig machen.',
          'Danach löschen wir dein Konto, deine Seiten und deine Anfragen endgültig.',
          'Eigene Domains werden getrennt. Deinen Benutzernamen vergeben wir nicht neu.',
          'Gutschriften und Steuerdaten müssen wir gesetzlich aufbewahren (bis zu 10 Jahre).',
        ].map(t => (
          <View key={t} style={styles.bullet}>
            <View style={styles.dot} />
            <Text variant="body" style={{ flex: 1 }}>
              {t}
            </Text>
          </View>
        ))}
      </Card>

      {info.isLoading ? (
        <Skeleton height={120} radius={radius.input} />
      ) : needsChoice ? (
        <View style={{ gap: 10 }}>
          <Text variant="headline">Dein Partner-Guthaben: {euros(balance)}</Text>
          <Text variant="callout">Was soll mit deinem Guthaben passieren?</Text>
          <Choice
            selected={choice === 'payout'}
            onPress={() => setChoice('payout')}
            title="Guthaben auszahlen"
            text={
              info.data?.has_payout_account
                ? `Wir überweisen dein Guthaben auf dein Auszahlungskonto, auch unter ${euros(1000)}. Noch nicht verfügbare Beträge folgen nach Ablauf der 14 Tage.`
                : 'Du hast noch kein Auszahlungskonto. Wir melden uns per E-Mail, um die Auszahlung mit dir zu klären.'
            }
          />
          <Choice
            selected={choice === 'waive'}
            onPress={() => setChoice('waive')}
            title="Ich verzichte auf mein Guthaben"
            text={`Ich verzichte ausdrücklich auf mein Guthaben von ${euros(balance)}. Das kann nicht rückgängig gemacht werden.`}
          />
        </View>
      ) : null}

      <Input label="Passwort zur Bestätigung" value={password} onChangeText={setPassword} password autoComplete="current-password" textContentType="password" />

      <Pressable onPress={() => setConfirmed(c => !c)} style={styles.check} accessibilityRole="checkbox" accessibilityState={{ checked: confirmed }}>
        <View style={[styles.box, confirmed && styles.boxOn]}>{confirmed && <Check size={14} color={colors.white} strokeWidth={3} />}</View>
        <Text variant="body" style={{ flex: 1 }}>
          Ich möchte mein FinestSites-Konto löschen. Mir ist klar, dass meine Seiten offline gehen.
        </Text>
      </Pressable>

      {!!error && <Notice tone="danger">{error}</Notice>}
      <Button title="Konto löschen" variant="danger" onPress={submit} loading={loading} disabled={!canSubmit} fullWidth />
    </Screen>
  );
}

function Choice({ selected, onPress, title, text }: { selected: boolean; onPress: () => void; title: string; text: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.choice, selected && { borderColor: colors.ink, borderWidth: 2 }]}>
      <View style={[styles.radio, selected && styles.radioOn]}>{selected && <View style={styles.radioDot} />}</View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.ink }}>{title}</Text>
        <Text variant="callout">{text}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bullet: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.secondary, marginTop: 8 },
  check: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 14, borderRadius: radius.input, backgroundColor: colors.surfaceSubtle },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#D1D5DB', backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  boxOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  choice: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: radius.input, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  radioOn: { borderColor: colors.ink },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ink },
});
