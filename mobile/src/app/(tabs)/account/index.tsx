import { useRouter } from 'expo-router';
import { Bell, FileText, Handshake, KeyRound, LogOut, Mail, Megaphone, ScanFace, Scale, ShieldCheck, Trash2, UserRound } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';

import { useConfig, useMe } from '@/api/queries';
import { Card, ListRow, ListSection, LoadError, PageHeader, ProfilePhoto, Screen, Skeleton, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { APP_VERSION, BUILD_NUMBER, WEB_LINKS } from '@/lib/config';
import { openInBrowser } from '@/lib/links';
import { biometricKind, biometricLabel, useLock, type BiometricKind } from '@/lib/lock';
import { colors, radius } from '@/theme/tokens';

/** Konto: Einstellungen im iOS-Stil, Werte und Texte wie /settings im Web – ohne Zahlung & Plan. */
export default function AccountScreen() {
  const router = useRouter();
  const me = useMe();
  const config = useConfig();
  const signOut = useAuth(s => s.signOut);
  const lock = useLock();
  const [bio, setBio] = useState<BiometricKind>('none');
  useEffect(() => void biometricKind().then(setBio), []);

  const u = me.data;
  // Partnerprogramm nur, wenn das Konto teilnehmen darf UND der Bereich nicht per Notschalter aus ist
  const partnerVisible = !!u?.features.partnerProgram && config.data?.features.partnerProgram !== false;
  const fullName = [u?.user.firstName, u?.user.lastName].filter(Boolean).join(' ');
  const plan = u?.account.planLabel ? { name: u.account.planLabel, quota: u.account.quota } : null;

  return (
    <Screen topInset readable refreshing={me.isRefetching} onRefresh={() => void me.refetch()}>
      <PageHeader title="Konto" subtitle="Profil, Mitteilungen und Sicherheit." />

      {me.isError && !u ? (
        <LoadError onRetry={() => void me.refetch()} />
      ) : !u ? (
        <Skeleton height={110} radius={radius.card} />
      ) : (
        <Card tone="plain" style={styles.profile}>
          <ProfilePhoto url={u.user.profileImageUrl} size={64} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="headline">{fullName || `@${u.user.username ?? ''}`}</Text>
            <Text variant="callout">{u.user.email}</Text>
            {u.user.username && <Text variant="callout">@{u.user.username}</Text>}
          </View>
        </Card>
      )}

      {plan && (
        <View
          style={styles.plan}
          accessibilityLabel={`Tarif ${plan.name}${plan.quota ? `, ${plan.quota.used} von ${plan.quota.limit ?? 'beliebig vielen'} Webseiten` : ''}`}>
          <Text variant="callout" color={colors.body}>
            Tarif: {plan.name}
            {plan.quota ? ` · ${plan.quota.used}${plan.quota.limit ? ` von ${plan.quota.limit}` : ''} Webseiten` : ''}
          </Text>
        </View>
      )}

      <ListSection title="Konto">
        <ListRow
          icon={UserRound}
          title="Mein Profil"
          subtitle={u?.user.teamPartnerNumber ? `Teampartner-Nummer ${u.user.teamPartnerNumber}` : 'Foto, Name, Kontakt, Teampartner-Nummer'}
          onPress={() => router.push('/account/profile')}
        />
        {partnerVisible ? (
          <ListRow
            icon={Handshake}
            iconBg={colors.accentSoft}
            iconColor={colors.accent}
            title="Partnerprogramm"
            subtitle="Empfehlungslink, Provisionen, Gutschriften"
            onPress={() => router.push('/account/partner')}
          />
        ) : null}
      </ListSection>

      <ListSection title="Einstellungen">
        <ListRow icon={Bell} title="Mitteilungen" subtitle="Push-Mitteilungen und Ruhezeit" onPress={() => router.push('/account/notifications')} />
        <ListRow icon={Mail} title="E-Mails" subtitle="Welche E-Mails du von uns bekommst" onPress={() => router.push('/account/emails')} />
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
        <ListRow icon={KeyRound} title="Passwort ändern" onPress={() => router.push('/account/password')} />
        <ListRow
          icon={Megaphone}
          title="Werbung & Tracking"
          subtitle="Für Anzeigen bei Meta, Google und TikTok"
          onPress={() => router.push({ pathname: '/web', params: { path: '/settings?tab=werbung', title: 'Werbung & Tracking' } })}
        />
      </ListSection>

      <ListSection title="Rechtliches">
        <ListRow icon={FileText} title="Impressum" onPress={() => openInBrowser(WEB_LINKS.impressum)} />
        <ListRow icon={ShieldCheck} title="Datenschutz" onPress={() => openInBrowser(WEB_LINKS.datenschutz)} />
        <ListRow icon={Scale} title="AGB" onPress={() => openInBrowser(WEB_LINKS.agb)} />
      </ListSection>

      <ListSection>
        <ListRow
          icon={LogOut}
          title="Abmelden"
          chevron={false}
          onPress={() =>
            Alert.alert('Abmelden?', 'Du kannst dich jederzeit wieder anmelden.', [
              { text: 'Abbrechen', style: 'cancel' },
              { text: 'Abmelden', style: 'destructive', onPress: () => void signOut() },
            ])
          }
        />
        <ListRow icon={Trash2} iconBg={colors.dangerSoft} destructive title="Konto löschen" onPress={() => router.push('/account/delete')} />
      </ListSection>

      <Text variant="footnote" align="center">
        FinestSites {APP_VERSION} ({BUILD_NUMBER})
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18 },
  plan: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: -8,
  },
});
