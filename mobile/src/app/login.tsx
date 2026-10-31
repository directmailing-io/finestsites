import { MailCheck } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View, type TextInputInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NetworkError } from '@/api/client';
import { sendVerificationEmail, signIn } from '@/api/endpoints';
import { Button, Input, Logo, Notice, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { MOCK, WEB_LINKS } from '@/lib/config';
import { openInBrowser } from '@/lib/links';
import { colors, fonts, radius } from '@/theme/tokens';

/**
 * Anmelden wie /login im Web (Karte 400 pt, „Willkommen zurück“) – ohne Link zum Konto-Anlegen
 * (Version 1: Konto anlegen erst nach Apples Freigabe per Update).
 */
export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const completeSignIn = useAuth(s => s.completeSignIn);
  const expired = useAuth(s => s.signedOutReason === 'expired');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [unverified, setUnverified] = useState(false);
  const [resent, setResent] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);

  async function submit() {
    if (!email.trim() || !password) {
      setError('Bitte gib deine E-Mail und dein Passwort ein.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await signIn(email, password);
      if (res.ok) {
        await completeSignIn(res.token);
        return;
      }
      if (res.reason === 'unverified') setUnverified(true);
      else if (res.reason === 'invalid') setError('E-Mail oder Passwort falsch.');
      else if (res.reason === 'rate_limited') setError('Zu viele Versuche. Bitte warte kurz.');
      else setError('Anmeldung fehlgeschlagen. Bitte versuche es erneut.');
    } catch (err) {
      setError(
        err instanceof NetworkError && err.timeout
          ? 'Zeitüberschreitung. Bitte versuche es erneut.'
          : 'Verbindungsfehler. Bitte prüfe deine Internetverbindung.',
      );
    }
    setLoading(false);
  }

  async function resend() {
    await sendVerificationEmail(email).catch(() => {});
    setResent(true);
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.logo}>
          <Logo height={26} />
        </View>

        <View style={styles.card}>
          {unverified ? (
            <View style={{ gap: 14 }}>
              <View style={styles.mailIcon}>
                <MailCheck size={26} color={colors.success} strokeWidth={2} />
              </View>
              <Text variant="headline">Bitte bestätige deine E-Mail</Text>
              <Text variant="callout" color={colors.mutedForeground}>
                Wir haben dir an {email.trim()} einen Link geschickt. Tippe in der E-Mail auf „Bestätigen“ und melde dich
                dann hier an.
              </Text>
              {resent ? (
                <Notice tone="success">Neue E-Mail ist unterwegs. Schau auch im Spam-Ordner nach.</Notice>
              ) : (
                <Button title="E-Mail erneut senden" variant="secondary" onPress={resend} />
              )}
              <Button
                title="Zurück zur Anmeldung"
                variant="primary"
                onPress={() => {
                  setUnverified(false);
                  setResent(false);
                  setLoading(false);
                }}
              />
            </View>
          ) : (
            <>
              <Text style={styles.title}>Willkommen zurück</Text>
              <Text variant="callout" color={colors.mutedForeground} style={{ marginBottom: 24 }}>
                Melde dich mit deinem FinestSites-Konto an.
              </Text>

              {expired && !error && (
                <View style={{ marginBottom: 16 }}>
                  <Notice tone="info">Du wurdest abgemeldet. Bitte melde dich erneut an.</Notice>
                </View>
              )}
              {!!error && (
                <Text style={styles.error} accessibilityLiveRegion="polite">
                  {error}
                </Text>
              )}

              <View style={{ gap: 16 }}>
                <Input
                  label="E-Mail"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="deine@email.de"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="username"
                  keyboardType="email-address"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
                <View style={{ gap: 6 }}>
                  <Input
                    ref={passwordRef}
                    label="Passwort"
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    password
                    autoComplete="current-password"
                    textContentType="password"
                    returnKeyType="go"
                    onSubmitEditing={submit}
                  />
                  <Button
                    title="Passwort vergessen?"
                    variant="link"
                    size="sm"
                    style={{ alignSelf: 'flex-end' }}
                    onPress={() => openInBrowser(WEB_LINKS.forgotPassword)}
                  />
                </View>
                <Button title={loading ? 'Anmelden…' : 'Anmelden'} onPress={submit} loading={loading} fullWidth />
              </View>
            </>
          )}
        </View>
        {MOCK && (
          <Text variant="footnote" align="center" style={{ marginTop: 20, maxWidth: 360 }}>
            Beispielmodus: beliebige E-Mail. „neu@…“ zeigt die Ersteinrichtung, „ohne-tarif@…“ ein Konto ohne Tarif,
            Passwort „falsch“ einen Fehler.
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  logo: { marginBottom: 40 },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  title: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26, color: colors.ink, marginBottom: 4 },
  error: { fontFamily: fonts.regular, fontSize: 14, color: colors.dangerStrong, marginBottom: 12 },
  mailIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.input,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
