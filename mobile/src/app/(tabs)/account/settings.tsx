import { useLocalSearchParams, useRouter } from 'expo-router';
import { Bell, FileText, Megaphone, ScanFace, Scale, ShieldCheck, Trash2 } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { Button, ListRow, ListSection, Screen, SegmentedControl, Text } from '@/components/ui';
import { APP_VERSION, BUILD_NUMBER, WEB_LINKS } from '@/lib/config';
import { openInBrowser } from '@/lib/links';
import { biometricKind, biometricLabel, useLock, type BiometricKind } from '@/lib/lock';
import { colors, fonts } from '@/theme/tokens';

import { EmailsContent } from './emails';
import { PasswordContent } from './password';
import { ProfileContent } from './profile';

type Tab = 'profil' | 'werbung' | 'mails' | 'sicherheit';

/**
 * „Einstellungen“ wie /settings im Web: Überschrift, Segmented Control, darunter die Abschnitte mit
 * denselben Titeln und Untertiteln. Ohne „Zahlung & Plan“ und „Rechnungen“ (kein Kaufweg in der App)
 * und ohne die Tarif-Fragen im FAQ – deshalb heißt der letzte Reiter hier nur „Konto“.
 */
export default function SettingsScreen() {
  const { tab: initial } = useLocalSearchParams<{ tab?: Tab }>();
  const [tab, setTab] = useState<Tab>(initial && ['profil', 'werbung', 'mails', 'sicherheit'].includes(initial) ? initial : 'profil');

  return (
    <Screen readable>
      <View style={{ gap: 6 }}>
        <Text style={styles.h1} accessibilityRole="header">
          Einstellungen
        </Text>
        <Text style={styles.lead}>Profil, E-Mails und Sicherheit.</Text>
      </View>

      <SegmentedControl<Tab>
        items={[
          { key: 'profil', label: 'Profil' },
          { key: 'werbung', label: 'Werbung' },
          { key: 'mails', label: 'E-Mails' },
          { key: 'sicherheit', label: 'Konto' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'profil' && (
        <TabSection title="Mein Profil" subtitle="Diese Angaben werden beim Bearbeiten deiner Webseiten automatisch vorausgefüllt.">
          <ProfileContent hideIntro />
        </TabSection>
      )}
      {tab === 'werbung' && <AdsTab />}
      {tab === 'mails' && (
        <TabSection title="E-Mails von FinestSites" subtitle="Du entscheidest, welche Mails du von uns bekommst. Von Anfang an ist alles an.">
          <EmailsContent />
        </TabSection>
      )}
      {tab === 'sicherheit' && <AccountTab />}
    </Screen>
  );
}

/** Abschnitt wie TabSection im Web: h2 text-lg/xl bold, Untertitel text-sm #94A3B8, mb-5. */
function TabSection({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <View>
      <View style={{ marginBottom: 20 }}>
        <Text style={styles.h2} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function AdsTab() {
  const router = useRouter();
  return (
    <TabSection title="Werbung & Tracking" subtitle="Für Anzeigen bei Meta, Google und TikTok. Nur nötig, wenn du Werbung schaltest.">
      <Button
        title="Werbung & Tracking öffnen"
        icon={Megaphone}
        fullWidth
        onPress={() => router.push({ pathname: '/web', params: { path: '/settings?tab=werbung', title: 'Werbung & Tracking' } })}
      />
    </TabSection>
  );
}

function AccountTab() {
  const router = useRouter();
  const lock = useLock();
  const [bio, setBio] = useState<BiometricKind>('none');
  useEffect(() => void biometricKind().then(setBio), []);

  return (
    <View style={{ gap: 40 }}>
      <TabSection title="Passwort ändern" subtitle="Wähle ein starkes Passwort mit mindestens 6 Zeichen.">
        <PasswordContent />
      </TabSection>

      <TabSection title="App" subtitle="Mitteilungen und Entsperren auf diesem Gerät.">
        <ListSection>
          <ListRow icon={Bell} title="Push-Mitteilungen" subtitle="Neue Anfragen, Antworten vom Support, Ruhezeit" onPress={() => router.push('/account/notifications')} />
          {bio !== 'none' ? (
            <ListRow
              icon={ScanFace}
              title={biometricLabel(bio)}
              subtitle="App beim Öffnen entsperren"
              right={
                <Switch
                  value={lock.enabled}
                  onValueChange={v => void lock.setEnabled(v)}
                  trackColor={{ true: colors.successDot, false: '#D1D5DB' }}
                  accessibilityLabel={biometricLabel(bio)}
                />
              }
            />
          ) : null}
        </ListSection>
      </TabSection>

      <TabSection title="Konto löschen" subtitle="Löscht dein Konto mit allen Seiten und Anfragen, nach 14 Tagen Bedenkzeit.">
        <ListSection>
          <ListRow icon={Trash2} iconBg={colors.dangerSoft} destructive title="Konto löschen" onPress={() => router.push('/account/delete')} />
        </ListSection>
      </TabSection>

      <TabSection title="Rechtliches">
        <ListSection>
          <ListRow icon={FileText} title="Impressum" onPress={() => openInBrowser(WEB_LINKS.impressum)} />
          <ListRow icon={ShieldCheck} title="Datenschutz" onPress={() => openInBrowser(WEB_LINKS.datenschutz)} />
          <ListRow icon={Scale} title="AGB" onPress={() => openInBrowser(WEB_LINKS.agb)} />
        </ListSection>
      </TabSection>

      <Text variant="footnote" align="center">
        FinestSites {APP_VERSION} ({BUILD_NUMBER})
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // h1 text-2xl font-bold tracking-tight; p text-base mt-1.5 #94A3B8
  h1: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 32, letterSpacing: -0.6, color: colors.ink },
  lead: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.tertiary },
  h2: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 26, letterSpacing: -0.3, color: colors.ink },
  sub: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.tertiary, marginTop: 4 },
});
