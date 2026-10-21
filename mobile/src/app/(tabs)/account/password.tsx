import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ApiError, humanError } from '@/api/client';
import { changePassword } from '@/api/endpoints';
import { Button, Input, Notice, Screen, Text, useToast } from '@/components/ui';
import { WEB_LINKS } from '@/lib/config';
import { openInBrowser } from '@/lib/links';

export default function PasswordScreen() {
  const router = useRouter();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError('');
    if (next.length < 6) return setError('Das neue Passwort braucht mindestens 6 Zeichen.');
    if (next !== confirm) return setError('Die neuen Passwörter stimmen nicht überein.');
    setLoading(true);
    try {
      await changePassword(current, next);
      toast.show('Passwort erfolgreich geändert.', 'success');
      router.back();
    } catch (e) {
      setError(e instanceof ApiError && e.status === 400 ? 'Aktuelles Passwort ist falsch.' : humanError(e));
    }
    setLoading(false);
  }

  return (
    <Screen readable>
      <Text variant="callout">Wähle ein starkes Passwort mit mindestens 6 Zeichen.</Text>
      <View style={{ gap: 16 }}>
        <Input label="Aktuelles Passwort" value={current} onChangeText={setCurrent} password placeholder="••••••••" autoComplete="current-password" textContentType="password" />
        <Input label="Neues Passwort" value={next} onChangeText={setNext} password placeholder="Mindestens 6 Zeichen" autoComplete="new-password" textContentType="newPassword" />
        <Input label="Neues Passwort bestätigen" value={confirm} onChangeText={setConfirm} password placeholder="••••••••" autoComplete="new-password" textContentType="newPassword" />
      </View>
      {!!error && <Notice tone="danger">{error}</Notice>}
      <Button title="Passwort ändern" onPress={submit} loading={loading} fullWidth disabled={!current || !next || !confirm} />
      <Button title="Aktuelles Passwort vergessen?" variant="link" onPress={() => openInBrowser(WEB_LINKS.forgotPassword)} />
    </Screen>
  );
}
