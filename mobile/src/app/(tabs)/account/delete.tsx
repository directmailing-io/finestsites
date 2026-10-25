import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ApiError, humanError } from '@/api/client';
import { getDeletionInfo, requestDeletion } from '@/api/endpoints';
import { qk } from '@/api/queries';
import type { DeletionTiming, PartnerBalanceChoice } from '@/api/types';
import { Button, Card, Input, LoadError, Notice, Screen, Skeleton, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { openExternal } from '@/lib/links';
import { euros, fmtDate } from '@/lib/format';
import { colors, fonts, radius } from '@/theme/tokens';

/**
 * Konto löschen (Apple 5.1.1(v), Google Play): direkt in der App, ohne Support. Passwort, ausdrückliche
 * Bestätigung, bei Partner-Guthaben Auszahlung oder ausdrücklicher Verzicht (Wortlaut vom Server).
 * Zeitpunkt (nur mit laufendem Abo wählbar, sonst immer „sofort“):
 *   • zum Laufzeitende (Standard): Seiten bleiben online, Abo gekündigt, Löschung am Laufzeitende, Konto bleibt nutzbar
 *   • sofort: Seiten offline, Abo endet sofort, 14 Tage Bedenkzeit, alle Sitzungen beendet → lokal abmelden
 * In beiden Fällen wird bereits bezahlte Zeit nicht erstattet.
 */
const ERROR_TEXT: Record<string, string> = {
  INVALID_PASSWORD: 'Das Passwort stimmt nicht.',
  BALANCE_CHOICE_REQUIRED: 'Bitte wähle, was mit deinem Partner-Guthaben passieren soll.',
  PERIOD_END_NOT_AVAILABLE: 'Löschen zum Laufzeitende geht gerade nicht. Bitte wähle „Sofort löschen“ oder versuch es später nochmal.',
  DELETION_NOT_ALLOWED: 'Dieses Konto kann in der App nicht gelöscht werden.',
  DELETION_ALREADY_REQUESTED: 'Die Löschung ist bereits vorgemerkt.',
  RATE_LIMITED: 'Zu viele Versuche. Bitte warte eine Minute.',
};

export default function DeleteAccountScreen() {
  const signOut = useAuth(s => s.signOut);
  const router = useRouter();
  const queryClient = useQueryClient();
  const info = useQuery({ queryKey: qk.deletion, queryFn: getDeletionInfo });
  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [choice, setChoice] = useState<PartnerBalanceChoice | null>(null);
  const [waiver, setWaiver] = useState(false);
  const [timing, setTiming] = useState<DeletionTiming>('now');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const periodEnd = info.data?.periodEnd.available ? info.data.periodEnd.at : null;
  useEffect(() => {
    if (periodEnd) setTiming('period_end');
  }, [periodEnd]);

  const balance = info.data?.partnerBalance.totalCents ?? 0;
  const needsChoice = balance > 0;
  const days = info.data?.graceDays ?? 14;
  const immediate = !periodEnd || timing === 'now';
  const canSubmit = !!password && confirmed && (!needsChoice || choice === 'payout' || (choice === 'waive' && waiver));

  function submit() {
    const question = immediate
      ? `Deine Seiten gehen sofort offline und dein Abo endet heute. Bezahlte Zeit wird nicht erstattet. Nach ${days} Tagen werden dein Konto und deine Daten endgültig gelöscht.`
      : `Dein Abo endet am ${fmtDate(periodEnd!)}, deine Seiten bleiben bis dahin online. Danach werden dein Konto und deine Daten endgültig gelöscht.`;
    Alert.alert('Konto wirklich löschen?', question, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: immediate ? 'Sofort löschen' : 'Zum Laufzeitende löschen',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          setError('');
          try {
            const res = await requestDeletion(password, periodEnd ? timing : 'now', needsChoice ? choice : null, choice === 'waive' && waiver);
            if (res.signedOut) {
              // Alle Sitzungen sind beendet: Hinweis zeigen und lokal abmelden
              Alert.alert(
                'Löschung ist vorgemerkt',
                `Dein Konto wird am ${fmtDate(res.scheduledFor)} gelöscht. Du bist jetzt überall abgemeldet. Bis dahin kannst du dich wieder anmelden und die Löschung abbrechen.`,
              );
              await signOut();
            } else {
              await queryClient.invalidateQueries();
              Alert.alert(
                'Löschung ist vorgemerkt',
                `Dein Konto wird am ${fmtDate(res.scheduledFor)} gelöscht. Bis dahin bleibt alles wie gewohnt – und du kannst die Löschung unter „Mehr“ jederzeit abbrechen.`,
              );
              router.replace('/account');
            }
          } catch (e) {
            setError(e instanceof ApiError && e.code && ERROR_TEXT[e.code] ? ERROR_TEXT[e.code] : humanError(e));
            setLoading(false);
          }
        },
      },
    ]);
  }

  if (info.isError) return <LoadError onRetry={() => void info.refetch()} />;

  if (info.data?.blockedReason === 'disabled') {
    return (
      <Screen readable>
        <Notice tone="info">Du möchtest dein Konto löschen? Schreib uns an info@finestsites.io, wir kümmern uns darum.</Notice>
        <Button title="E-Mail schreiben" variant="secondary" onPress={() => void openExternal('mailto:info@finestsites.io?subject=Konto%20l%C3%B6schen')} />
      </Screen>
    );
  }

  if (info.data && !info.data.canDelete) {
    return (
      <Screen readable>
        <Notice tone="info">Dieses Konto kann in der App nicht gelöscht werden.</Notice>
      </Screen>
    );
  }

  if (info.data?.status === 'scheduled') {
    return (
      <Screen readable>
        <Notice tone="info">
          {`Die Löschung ist bereits vorgemerkt: Dein Konto wird am ${info.data.scheduledFor ? fmtDate(info.data.scheduledFor) : '…'} gelöscht.`}
        </Notice>
        <Button title="Löschung ansehen oder abbrechen" variant="secondary" onPress={() => router.push('/deletion-pending')} fullWidth />
      </Screen>
    );
  }

  const bullets = immediate
    ? [
        'Deine Webseiten gehen sofort offline.',
        'Dein Abo bei FinestSites endet sofort. Bereits bezahlte Zeit wird nicht erstattet.',
        `Du hast ${days} Tage Bedenkzeit. Melde dich in dieser Zeit wieder an, um die Löschung abzubrechen.`,
        'Danach löschen wir dein Konto, deine Seiten, Anfragen und Bilder endgültig.',
      ]
    : [
        `Dein Abo endet am ${fmtDate(periodEnd!)}. Es wird nichts mehr abgebucht, bereits bezahlte Zeit wird nicht erstattet.`,
        'Deine Webseiten bleiben bis dahin online, und du kannst die App wie gewohnt nutzen.',
        `Am ${fmtDate(periodEnd!)} löschen wir dein Konto, deine Seiten, Anfragen und Bilder endgültig.`,
        'Bis dahin kannst du die Löschung jederzeit abbrechen – dann läuft dein Abo einfach weiter.',
      ];

  return (
    <Screen readable>
      <Text variant="bodyLarge">Schade, dass du gehst. {periodEnd ? 'Wann soll dein Konto gelöscht werden?' : 'Bevor du dein Konto löschst, lies bitte kurz, was passiert:'}</Text>

      {info.isLoading ? (
        <Skeleton height={120} radius={radius.input} />
      ) : periodEnd ? (
        <View style={{ gap: 10 }} accessibilityRole="radiogroup">
          <Choice
            selected={timing === 'period_end'}
            onPress={() => setTiming('period_end')}
            title={`Zum Laufzeitende (${fmtDate(periodEnd)})`}
            text="Deine Seiten bleiben bis dahin online, es wird nichts mehr abgebucht. Bis dahin kannst du die Löschung abbrechen."
          />
          <Choice
            selected={timing === 'now'}
            onPress={() => setTiming('now')}
            title="Sofort"
            text={`Seiten sofort offline, Abo endet heute – bezahlte Restzeit wird nicht erstattet. Endgültig gelöscht nach ${days} Tagen Bedenkzeit.`}
          />
        </View>
      ) : null}

      <Card tone="plain" style={{ gap: 10 }}>
        {[...bullets, 'Eigene Domains werden getrennt. Deinen Benutzernamen vergeben wir nicht neu.', 'Gutschriften und Provisionsbuchungen müssen wir gesetzlich aufbewahren (8 bzw. 10 Jahre).'].map(t => (
          <View key={t} style={styles.bullet}>
            <View style={styles.dot} />
            <Text variant="body" style={{ flex: 1 }}>
              {t}
            </Text>
          </View>
        ))}
      </Card>

      {info.isLoading ? null : needsChoice && info.data ? (
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
        text={
          immediate
            ? 'Ich möchte mein FinestSites-Konto löschen. Mir ist klar, dass meine Seiten sofort offline gehen, mein Abo sofort endet und bezahlte Zeit nicht erstattet wird.'
            : 'Ich möchte mein FinestSites-Konto zum Laufzeitende löschen. Mir ist klar, dass mein Abo dann endet und bezahlte Zeit nicht erstattet wird.'
        }
      />

      {!!error && <Notice tone="danger">{error}</Notice>}
      <Button title={immediate ? 'Sofort löschen' : 'Zum Laufzeitende löschen'} variant="danger" onPress={submit} loading={loading} disabled={!canSubmit} fullWidth />
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
