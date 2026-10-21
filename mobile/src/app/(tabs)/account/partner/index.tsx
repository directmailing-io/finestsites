import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Copy, FileText, Handshake, History, Landmark, QrCode, Share2, Users } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View, type HostInstance } from 'react-native';

import { humanError } from '@/api/client';
import { requestPayout, setPayoutMode, startConnect } from '@/api/endpoints';
import { qk, useAffiliate } from '@/api/queries';
import type { PayoutMode } from '@/api/types';
import { Button, Card, EmptyState, ListRow, ListSection, LoadError, Notice, Pill, Screen, SectionHeader, Skeleton, Text, useToast } from '@/components/ui';
import { QrSheet } from '@/features/sites/QrSheet';
import { CONNECT_RETURN_URL } from '@/lib/config';
import { euros } from '@/lib/format';
import { shareLink } from '@/lib/share';
import { colors, fonts, radius } from '@/theme/tokens';

/**
 * Partnerprogramm in der App – neutrale Fassung (Plan v2): keine Vorteile für Empfohlene,
 * keine Tarifnamen, keine Hinweise auf das eigene Konto-Modell. Der Empfehlungslink wird nur kopiert/geteilt,
 * nie in der App geöffnet (er führt auf die Marketing-Startseite).
 */
export default function PartnerScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useAffiliate();
  const a = q.data;
  const shareRef = useRef<HostInstance>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: qk.affiliate });

  if (q.isError && !a) return <Screen readable><LoadError onRetry={() => void q.refetch()} /></Screen>;
  if (!a) {
    return (
      <Screen readable>
        <Skeleton height={180} radius={radius.card} />
        <Skeleton height={120} radius={radius.card} />
      </Screen>
    );
  }
  if (!a.eligible) {
    return (
      <Screen readable>
        <EmptyState icon={Handshake} title="Partnerprogramm nicht verfügbar" text="Für dein Konto ist das Partnerprogramm gerade nicht verfügbar." />
      </Screen>
    );
  }

  const canPayout =
    a.payout_mode === 'payout' && a.payout_account.status === 'active' && a.tax_profile.complete && a.earnings.available_cents >= a.min_payout_cents;
  const belowMin = a.payout_mode === 'payout' && a.earnings.available_cents > 0 && a.earnings.available_cents < a.min_payout_cents;

  async function changeMode(mode: PayoutMode) {
    if (mode === a!.payout_mode) return;
    setBusy('mode');
    try {
      await setPayoutMode(mode);
      await refresh();
    } catch (e) {
      toast.show(humanError(e), 'error');
    }
    setBusy(null);
  }

  async function connect() {
    setBusy('connect');
    try {
      const { url } = await startConnect(); // jedes Mal ein frischer Link mit signiertem Rückweg
      await WebBrowser.openAuthSessionAsync(url, CONNECT_RETURN_URL, { preferEphemeralSession: false });
      await refresh();
    } catch (e) {
      toast.show(humanError(e), 'error');
    }
    setBusy(null);
  }

  function payout() {
    Alert.alert(`${euros(a!.earnings.available_cents)} auszahlen?`, 'Das Geld ist in der Regel in 2 bis 3 Werktagen auf deinem Konto.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Auszahlen',
        onPress: async () => {
          setBusy('payout');
          try {
            const res = await requestPayout();
            toast.show(`${euros(res.amount_cents)} werden überwiesen.`, 'success');
            await refresh();
          } catch (e) {
            toast.show(humanError(e), 'error');
          }
          setBusy(null);
        },
      },
    ]);
  }

  return (
    <Screen readable refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      {!a.tax_profile.complete && (
        <Notice
          tone="warning"
          action={<Button title="Angaben ausfüllen" size="sm" style={{ alignSelf: 'flex-start', marginTop: 8 }} onPress={() => router.push('/account/partner/tax')} />}>
          Damit wir deine Provision verrechnen oder auszahlen können, brauchen wir noch kurz deine Angaben für die Abrechnung.
        </Notice>
      )}

      <Card tone="plain" style={{ gap: 14 }}>
        <Text variant="overline">Dein Empfehlungslink</Text>
        <View style={styles.linkBox}>
          <Text style={styles.link} selectable numberOfLines={2}>
            {a.link.replace(/^https:\/\//, '')}
          </Text>
        </View>
        <View style={styles.row}>
          <Button
            title="Link kopieren"
            icon={Copy}
            style={styles.flex}
            onPress={async () => {
              await Clipboard.setStringAsync(a.link);
              toast.show('Link kopiert', 'success');
            }}
          />
          <Button ref={shareRef} title="Link teilen" icon={Share2} variant="secondary" style={styles.flex} onPress={() => shareLink(a.link, shareRef, 'Mein Empfehlungslink')} />
        </View>
        <View style={styles.row}>
          <Button title="QR-Code" icon={QrCode} variant="secondary" style={styles.flex} onPress={() => setQrOpen(true)} />
          <Button
            title={`Code kopieren: ${a.code}`}
            variant="secondary"
            style={styles.flex}
            onPress={async () => {
              await Clipboard.setStringAsync(a.code);
              toast.show('Code kopiert', 'success');
            }}
          />
        </View>
        <Text variant="callout">
          {a.pitch} Du erhältst {a.commission_percent} % Provision auf die Zahlungen deiner Empfehlungen, solange sie dabei sind.
        </Text>
      </Card>

      <View style={{ gap: 12 }}>
        <SectionHeader title="Deine Provisionen" />
        <View style={styles.tiles}>
          <Tile label="Verfügbar" value={euros(a.earnings.available_cents)} strong />
          <Tile label="In 14 Tagen" value={euros(a.earnings.pending_cents)} />
          <Tile label="Bereits erhalten" value={euros(a.earnings.paid_cents)} />
        </View>
        {canPayout && (
          <Button title={`${euros(a.earnings.available_cents)} jetzt auszahlen`} onPress={payout} loading={busy === 'payout'} fullWidth />
        )}
        {belowMin && (
          <Text variant="callout">
            Noch {euros(a.min_payout_cents - a.earnings.available_cents)} bis zur Auszahlung. Dein Guthaben verfällt nicht und wandert einfach in den nächsten Monat.
          </Text>
        )}
      </View>

      <View style={{ gap: 12 }}>
        <SectionHeader title="So bekommst du deine Provision" />
        <ModeChoice
          selected={a.payout_mode === 'credit'}
          disabled={busy === 'mode'}
          onPress={() => changeMode('credit')}
          title="Mit meinem Konto verrechnen"
          text="Deine Provision wird jeden Monat automatisch mit deinem FinestSites-Konto verrechnet. Kein Auszahlungskonto nötig."
        />
        <ModeChoice
          selected={a.payout_mode === 'payout'}
          disabled={busy === 'mode'}
          onPress={() => changeMode('payout')}
          title="Aufs Bankkonto auszahlen"
          text={`Ab ${euros(a.min_payout_cents)} einmal im Monat. Dafür richtest du einmal ein Auszahlungskonto bei Stripe ein.`}
        />
      </View>

      {a.payout_mode === 'payout' && (
        <ListSection title="Auszahlungskonto" footer="Das läuft sicher über Stripe. FinestSites sieht deine Bankdaten nicht.">
          {a.payout_account.status === 'active' ? (
            <ListRow
              icon={Landmark}
              iconBg={colors.successSoft}
              iconColor={colors.success}
              title="Bankkonto eingerichtet"
              subtitle={[a.payout_account.bank_name, a.payout_account.bank_last4 && `•••• ${a.payout_account.bank_last4}`].filter(Boolean).join(' ')}
              right={<Pill label="Aktiv" tone="online" dot={false} />}
            />
          ) : (
            <ListRow
              icon={Landmark}
              title={a.payout_account.status === 'incomplete' ? 'Einrichtung fortsetzen' : 'Auszahlungskonto einrichten (über Stripe)'}
              subtitle="Dauert ca. 3–5 Minuten. Du brauchst Name, Adresse und IBAN."
              onPress={connect}
              disabled={busy === 'connect'}
            />
          )}
        </ListSection>
      )}

      <ListSection title="Unterlagen">
        <ListRow
          icon={FileText}
          title="Angaben für die Abrechnung"
          right={<Pill label={a.tax_profile.complete ? 'Vollständig' : 'Fehlt noch'} tone={a.tax_profile.complete ? 'online' : 'changes'} dot={false} />}
          onPress={() => router.push('/account/partner/tax')}
        />
        <ListRow icon={FileText} title="Gutschriften" onPress={() => router.push('/account/partner/credit-notes')} />
        <ListRow icon={History} title="Verlauf" onPress={() => router.push('/account/partner/history')} />
        <ListRow
          icon={Users}
          title="Deine Empfehlungen"
          value={`${a.referrals.active} aktiv · ${a.referrals.paused} pausiert`}
          onPress={() => router.push('/account/partner/referrals')}
        />
      </ListSection>

      <Card tone="subtle" style={{ gap: 10 }}>
        <Text variant="overline">Gut zu wissen</Text>
        {[
          `Du bekommst ${a.commission_percent} % Provision auf jede Zahlung deiner Empfehlungen, Monat für Monat, solange sie dabei sind.`,
          'Neue Provisionen haben eine Schutzfrist von 14 Tagen. Danach ist das Geld fest für dich reserviert.',
          'Pro Monat gibt es eine Abrechnung. Die läuft automatisch, du musst nichts tun.',
          'Für jede Abrechnung bekommst du eine Gutschrift. Stimmt etwas nicht, sag uns bitte innerhalb von 4 Wochen Bescheid.',
        ].map(t => (
          <Text key={t} variant="callout" color={colors.body}>
            {`• ${t}`}
          </Text>
        ))}
      </Card>

      <QrSheet visible={qrOpen} onClose={() => setQrOpen(false)} url={a.link} title="Dein Empfehlungslink" />
    </Screen>
  );
}

function Tile({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={[styles.tile, strong && { backgroundColor: colors.ink, borderColor: colors.ink }]}>
      <Text variant="calloutStrong" color={strong ? 'rgba(255,255,255,0.75)' : colors.secondary}>
        {label}
      </Text>
      <Text style={[styles.tileValue, strong && { color: colors.white }]} adjustsFontSizeToFit numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function ModeChoice({ selected, onPress, title, text, disabled }: { selected: boolean; onPress: () => void; title: string; text: string; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      style={[styles.choice, selected && styles.choiceOn]}>
      <View style={[styles.radio, selected && { borderColor: colors.ink }]}>{selected && <View style={styles.radioDot} />}</View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.ink }}>{title}</Text>
        <Text variant="callout">{text}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  linkBox: { backgroundColor: colors.surfaceSubtle, borderRadius: radius.input, borderWidth: 1.5, borderColor: colors.border, padding: 14 },
  link: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  flex: { flexGrow: 1, flexBasis: 140 },
  tiles: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  tile: {
    flexGrow: 1,
    flexBasis: 140,
    backgroundColor: colors.white,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 16,
    gap: 4,
  },
  tileValue: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.5, color: colors.ink },
  choice: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: radius.input, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white },
  choiceOn: { borderColor: colors.ink, borderWidth: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ink },
});
