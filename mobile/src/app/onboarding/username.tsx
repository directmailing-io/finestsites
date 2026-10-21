import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { AtSign } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { ApiError, NetworkError } from '@/api/client';
import { getMe, setUsername } from '@/api/endpoints';
import { qk } from '@/api/queries';
import { Button, Input, Notice, Text } from '@/components/ui';
import { OnboardingFrame } from '@/features/onboarding/OnboardingFrame';
import { nextStep } from '@/features/onboarding/steps';
import { colors } from '@/theme/tokens';

const clean = (v: string) =>
  v
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9-]/g, '');

export default function UsernameStep() {
  const router = useRouter();
  const qc = useQueryClient();
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError('');
    if (!first.trim()) return setError('Bitte gib deinen Vornamen ein.');
    if (!last.trim()) return setError('Bitte gib deinen Nachnamen ein.');
    if (name.length < 3 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
      return setError('Mindestens 3 Buchstaben. Nur a–z und Bindestriche (nicht am Anfang/Ende).');
    }
    setLoading(true);
    try {
      await setUsername(name, first.trim(), last.trim());
      const me = await qc.fetchQuery({ queryKey: qk.me, queryFn: getMe, staleTime: 0 });
      router.replace(nextStep(me, 'username'));
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'DUPLICATE' || e.code === '23505' || e.status === 409)) {
        setError('Dieser Username ist leider schon vergeben. Probiere eine andere Kombination, z. B. mit einem Buchstaben oder Bindestrich.');
      } else if (e instanceof NetworkError) {
        setError('Verbindungsfehler. Bitte prüfe deine Internetverbindung und versuche es nochmal.');
      } else {
        setError('Das hat leider nicht geklappt. Bitte versuche es nochmal.');
      }
    }
    setLoading(false);
  }

  return (
    <OnboardingFrame step="username" icon={AtSign} title="Wie soll deine Adresse lauten?" text="Dein Username wird Teil deiner Website-Adresse. Wähle ihn sorgfältig.">
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Input label="Vorname" value={first} onChangeText={setFirst} placeholder="Max" autoComplete="given-name" />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Nachname" value={last} onChangeText={setLast} placeholder="Mustermann" autoComplete="family-name" />
        </View>
      </View>
      <Input
        label="Username"
        value={name}
        onChangeText={v => setName(clean(v))}
        placeholder="dein-name"
        autoCapitalize="none"
        autoCorrect={false}
        hint={name ? `Deine Seiten-Adressen beginnen dann mit „${name}.“` : undefined}
      />
      <Notice tone="info">Der Username kann nach dem Speichern nicht mehr geändert werden.</Notice>
      {!!error && (
        <Text variant="callout" color={colors.dangerStrong}>
          {error}
        </Text>
      )}
      <Button title={loading ? 'Wird gespeichert…' : 'Los geht’s'} onPress={submit} loading={loading} fullWidth />
    </OnboardingFrame>
  );
}
