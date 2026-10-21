import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ApiError, humanError } from '@/api/client';
import { getDeletionInfo, requestDeletion } from '@/api/endpoints';
import { qk } from '@/api/queries';
import type { PartnerBalanceChoice } from '@/api/types';
import { Button, Card, Input, LoadError, Notice, Screen, Skeleton, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { euros, fmtDate } from '@/lib/format';
import { colors, fonts, radius } from '@/theme/tokens';

/**
 * Konto löschen (Apple 5.1.1(v)): direkt in der App, ohne Support. Passwort, ausdrückliche
 * Bestätigung, 14 Tage Bedenkzeit. Offenes Partner-Guthaben verfällt NICHT stillschweigend:
 * Auszahlung oder ausdrücklicher Verzicht (Wortlaut vom Server).
 * Nach dem Absenden sind alle Sitzungen beendet → lokal abmelden; nach erneuter Anmeldung zeigt
 * die App „Konto wird gelöscht am …“ mit „Löschung abbrechen“ (deletion-pending).
 */
const ERROR_TEXT: Record<string, string> = {
  INVALID_PASSWORD: 'Das Passwort stimmt nicht.',
  BALANCE_CHOICE_REQUIRED: 'Bitte wähle, was mit deinem Partner-Guthaben passieren soll.',
  DELETION_NOT_ALLOWED: 'Dieses Konto kann in der App nicht gelöscht werden.',
  DELETION_ALREADY_REQUESTED: 'Die Löschung ist bereits vorgemerkt.',
  RATE_LIMITED: 'Zu viele Versuche. Bitte warte eine Minute.',
};

export default function DeleteAccountScreen() {
  const signOut = useAuth(s => s.signOut);
  const info = useQuery({ queryKey: qk.deletion, queryFn: getDeletionInfo });
  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [choice, setChoice] = useState<PartnerBalanceChoice | null>(null);
  const [waiver, setWaiver] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const balance = info.data?.partnerBalance.totalCents ?? 0;
  const needsChoice = balance > 0;
  const days = info.data?.graceDays ?? 14;
  const canSubmit = !!password && confirmed && (!needsChoice || choice === 'payout' || (choice === 'waive' && waiver));

  function submit() {
    Alert.alert('Konto wirklich löschen?', `Deine Seiten gehen sofort offline. Nach ${days} Tagen werden dein Konto und deine Daten endgültig gelöscht.`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Konto löschen',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          setError('');
          try {
            const res = await requestDeletion(password, needsChoice ? choice : null, choice === 'waive' && waiver);
            // Alle Sitzungen sind beendet: Hinweis zeigen und lokal abmelden
            Alert.alert(
              'Löschung ist vorgemerkt',
              `Dein Konto wird am ${fmtDate(res.scheduledFor)} gelöscht. Du bist jetzt überall abgemeldet. Bis dahin kannst du dich wieder anmelden und die Löschung abbrechen.`,
            );
            await signOut();
          } catch (e) {
            setError(e instanceof ApiError && e.code && ERROR_TEXT[e.code] ? ERROR_TEXT[e.code] : humanError(e));
            setLoading(false);
          }
        },
      },
    ]);
  }

  if (info.isError) return <LoadError onRetry={() => void info.refetch()} />;

  if (info.data && !info.data.canDelete) {
    return (
      <Screen readable>
        <Notice tone="info">Dieses Konto kann in der App nicht gelöscht werden.</Notice>
      </Screen>
    );
  }

  return (
    <Screen readable>
      <Text variant="bodyLarge">Schade, dass du gehst. Bevor du dein Konto löschst, lies bitte kurz, was passiert:</Text>
      <Card tone="plain" style={{ gap: 10 }}>
        {[
          'Deine Webseiten gehen sofort offline.',
          'Dein Abo bei FinestSites endet sofort. Bereits bezahlte Zeit wird nicht erstattet.',
          `Du hast ${days} Tage Bedenkzeit. Melde dich in dieser Zeit wieder an, um die Löschung abzubrechen.`,
          'Danach löschen wir dein Konto, deine Seiten, Anfragen und Bilder endgültig.',
          'Eigene Domains werden getrennt. Deinen Benutzernamen vergeben wir nicht neu.',
          'Gutschriften und Provisionsbuchungen müssen wir gesetzlich aufbewahren (8 bzw. 10 Jahre).',
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
      ) : needsChoice && info.data ? (
        <View style={{ gap: 10 }}>
          <Text variant="headline">Dein Partner-Guthaben: {euros(balance)}</Text>
          <Text variant="callout">Was soll mit deinem Guthaben passieren?</Text>
          <Choice
            selected={choice === 'payout'}
            onPress={() => setChoice('payout')}
            title="Guthaben auszahlen"
            text={
              (info.data.partnerBalance.hasPayoutAccount && info.data.partnerBalance.taxProfileComplete
                ? `Wir überweisen dein Guthaben auf dein Auszahlungskonto, auch unter ${euros(1000)}. Noch nicht verfügbare Beträge folgen nach ihrer Haltefrist.`
                : 'Dir fehlt noch ein Auszahlungskonto oder die Angaben für die Abrechnung. Richte beides bis zur Löschung im Partnerprogramm ein. Sonst zahlen wir auf Anfrage an info@finestsites.io aus (bis zur Verjährung nach 3 Jahren).') +
              (info.data.partnerBalance.customerCreditCents > 0
                ? ` Schon gutgeschriebenes Guthaben (${euros(info.data.partnerBalance.customerCreditCents)}) zahlen wir auf Anfrage aus.`
                : '')
            }
          />
          <Choice selected={choice === 'waive'} onPress={() => setChoice('waive')} title="Ich verzichte auf mein Guthaben" text="Das Guthaben verfällt mit der Löschung." />
          {choice === 'waive' && (
            <Checkbox checked={waiver} onToggle={() => setWaiver(w => !w)} tone="danger" text={info.data.partnerBalance.waiverText} />
          )}
        </View>
      ) : null}

      <Input label="Passwort zur Bestätigung" value={password} onChangeText={setPassword} password autoComplete="current-password" textContentType="password" />

      <Checkbox
        checked={confirmed}
        onToggle={() => setConfirmed(c => !c)}
        text="Ich möchte mein FinestSites-Konto löschen. Mir ist klar, dass meine Seiten sofort offline gehen."
      />

      {!!error && <Notice tone="danger">{error}</Notice>}
      <Button title="Konto löschen" variant="danger" onPress={submit} loading={loading} disabled={!canSubmit} fullWidth />
    </Screen>
  );
}

function Checkbox({ checked, onToggle, text, tone }: { checked: boolean; onToggle: () => void; text: string; tone?: 'danger' }) {
  return (
    <Pressable
      onPress={onToggle}
      style={[styles.check, tone === 'danger' && { backgroundColor: colors.dangerSoft }]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}>
      <View style={[styles.box, checked && styles.boxOn]}>{checked && <Check size={14} color={colors.white} strokeWidth={3} />}</View>
      <Text variant="body" style={{ flex: 1 }}>
        {text}
      </Text>
    </Pressable>
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
