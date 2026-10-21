import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Check, ShieldCheck } from 'lucide-react-native';
import { Fragment, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { getMe, giveConsent } from '@/api/endpoints';
import { qk } from '@/api/queries';
import { Button, Text } from '@/components/ui';
import { OnboardingFrame } from '@/features/onboarding/OnboardingFrame';
import { nextStep } from '@/features/onboarding/steps';
import { colors, fonts, radius } from '@/theme/tokens';

// Wortgleich mit src/app/(onboarding)/onboarding/consent/page.tsx (Version v1)
const CONSENT_VERSION = 'v1';
const RULES = [
  { title: 'Fotos und Bilder', text: 'Alle Bilder, die ich hochlade, darf ich verwenden. Ich habe die Rechte daran oder eine Erlaubnis des Inhabers.' },
  { title: 'Keine Heilsaussagen', text: 'Ich behaupte nicht, dass Produkte Krankheiten heilen, lindern oder verhindern. Das ist in Deutschland gesetzlich verboten (Heilmittelwerbegesetz).' },
  { title: 'Wahrheitsgemäße Texte', text: 'Alle Texte auf meiner Website sind korrekt und verstoßen nicht gegen geltende Gesetze.' },
  { title: 'Eigene Verantwortung', text: 'Ich übernehme die Verantwortung für meine Inhalte. FinestSites prüft Inhalte nach bestem Wissen, kann das aber nicht vollständig garantieren.' },
];

export default function ConsentStep() {
  const router = useRouter();
  const qc = useQueryClient();
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    setLoading(true);
    setError('');
    try {
      await giveConsent(CONSENT_VERSION);
      const me = await qc.fetchQuery({ queryKey: qk.me, queryFn: getMe, staleTime: 0 });
      router.replace(nextStep(me, 'consent'));
    } catch {
      setError('Ein Fehler ist aufgetreten. Bitte versuche es erneut.');
    }
    setLoading(false);
  }

  return (
    <OnboardingFrame
      step="consent"
      icon={ShieldCheck}
      iconBg="#F0FDF4"
      iconColor={colors.success}
      title="Kurze Bestätigung"
      text="Bevor du loslegst, brauchen wir deine Bestätigung zu einem wichtigen Punkt. Das ist nur einmal nötig und dauert eine Minute.">
      <View style={styles.rules}>
        {RULES.map((r, i) => (
          <Fragment key={r.title}>
            {i > 0 && <View style={styles.divider} />}
            <View style={styles.rule}>
              <Text style={styles.ruleTitle}>{r.title}</Text>
              <Text variant="callout" color={colors.mutedForeground}>
                {r.text}
              </Text>
            </View>
          </Fragment>
        ))}
      </View>
      <View style={styles.confirmCard}>
        <Pressable onPress={() => setChecked(c => !c)} style={styles.check} accessibilityRole="checkbox" accessibilityState={{ checked }}>
          <View style={[styles.box, checked && styles.boxOn]}>{checked && <Check size={14} color={colors.white} strokeWidth={3} />}</View>
          <Text variant="callout" color={colors.body} style={{ flex: 1 }}>
            Ja, ich habe die vier Punkte oben gelesen und bestätige sie. Ich verstehe, dass ich die Verantwortung für meine Inhalte trage.
          </Text>
        </Pressable>
        {!!error && (
          <Text variant="callout" color={colors.dangerStrong}>
            {error}
          </Text>
        )}
        <Button title={loading ? 'Wird gespeichert…' : 'Bestätigen und loslegen'} onPress={confirm} disabled={!checked} loading={loading} fullWidth />
      </View>
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({
  rules: { backgroundColor: colors.white, borderRadius: radius.card, borderWidth: 1.5, borderColor: colors.border },
  rule: { padding: 18, gap: 4 },
  ruleTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  divider: { height: 1, backgroundColor: colors.divider },
  confirmCard: { backgroundColor: colors.white, borderRadius: radius.card, borderWidth: 1.5, borderColor: colors.border, padding: 20, gap: 16 },
  check: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  boxOn: { backgroundColor: colors.ink, borderColor: colors.ink },
});
