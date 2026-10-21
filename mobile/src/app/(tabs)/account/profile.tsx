import { useQueryClient } from '@tanstack/react-query';
import { Camera } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, useWindowDimensions } from 'react-native';

import { humanError } from '@/api/client';
import { updateProfile } from '@/api/endpoints';
import { qk, useMe } from '@/api/queries';
import type { Socials } from '@/api/types';
import { Button, Input, Notice, ProfilePhoto, Screen, SectionHeader, Skeleton, Text, useToast } from '@/components/ui';
import { pickAndUploadAvatar } from '@/features/account/avatar';
import { ImageRulesHint } from '@/features/account/ImageRulesHint';
import { colors, fonts, radius } from '@/theme/tokens';

const SOCIALS: { key: keyof Socials; label: string; prefix: string; ph: string }[] = [
  { key: 'instagram', label: 'Instagram', prefix: 'instagram.com/', ph: 'deinname' },
  { key: 'tiktok', label: 'TikTok', prefix: 'tiktok.com/@', ph: 'deinname' },
  { key: 'facebook', label: 'Facebook', prefix: 'facebook.com/', ph: 'deinname' },
  { key: 'linkedin', label: 'LinkedIn', prefix: 'linkedin.com/in/', ph: 'dein-name' },
  { key: 'youtube', label: 'YouTube', prefix: 'youtube.com/@', ph: 'deinkanal' },
];

const toHandle = (url: string | null, prefix: string) =>
  (url ?? '').replace(/^https?:\/\/(www\.)?/, '').replace(prefix, '').replace(/\/$/, '');
const toUrl = (handle: string, prefix: string) => {
  const h = handle.trim().replace(/^@/, '');
  return h ? `https://${prefix}${h}` : '';
};

/** „Mein Profil“ als eigener Bildschirm (z. B. aus dem Onboarding/Partnerbereich). */
export default function ProfileScreen() {
  return (
    <Screen readable>
      <ProfileContent />
    </Screen>
  );
}

/** Inhalt des Web-Tabs „Profil“ (Einstellungen), plus Teampartner-Nummer. */
export function ProfileContent({ hideIntro }: { hideIntro?: boolean } = {}) {
  const qc = useQueryClient();
  const { width } = useWindowDimensions();
  const toast = useToast();
  const me = useMe();
  const u = me.data;
  const [form, setForm] = useState({ first_name: '', last_name: '', company_name: '', phone: '', team_partner_number: '' });
  const [socials, setSocials] = useState<Record<string, string>>({});
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!u) return;
    setForm({
      first_name: u.user.firstName ?? '',
      last_name: u.user.lastName ?? '',
      company_name: u.user.companyName ?? '',
      phone: u.user.phone ?? '',
      team_partner_number: u.user.teamPartnerNumber ?? '',
    });
    setSocials(Object.fromEntries(SOCIALS.map(s => [s.key, toHandle(u.user.socials[s.key], s.prefix)])));
    setPhoto(u.user.profileImageUrl);
  }, [u]);

  async function save() {
    setSaving(true);
    setError('');
    try {
      await updateProfile({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        company_name: form.company_name.trim(),
        phone: form.phone.trim(),
        team_partner_number: form.team_partner_number.trim() || null,
        ...Object.fromEntries(SOCIALS.map(s => [s.key, toUrl(socials[s.key] ?? '', s.prefix)])),
      });
      await qc.invalidateQueries({ queryKey: qk.me });
      void qc.invalidateQueries({ queryKey: qk.overview });
      toast.show('Profil gespeichert.', 'success');
    } catch (e) {
      setError(humanError(e));
    }
    setSaving(false);
  }

  if (!u) return <Skeleton height={300} radius={radius.card} />;

  const set = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));
  const wide = width >= 640;

  return (
    <View style={{ gap: 24 }}>
      {!hideIntro && <Text variant="callout">Diese Angaben werden beim Bearbeiten deiner Webseiten automatisch vorausgefüllt.</Text>}

      <View style={styles.photoRow}>
        <View>
          <ProfilePhoto url={photo} size={80} />
          {uploading && (
            <View style={styles.photoBusy}>
              <ActivityIndicator color={colors.ink} />
            </View>
          )}
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Button
            title={photo ? 'Foto ändern' : 'Foto hochladen'}
            icon={Camera}
            variant="muted"
            size="sm"
            style={{ alignSelf: 'flex-start' }}
            disabled={uploading}
            onPress={() =>
              pickAndUploadAvatar(
                () => setUploading(true),
                url => {
                  setUploading(false);
                  if (url) {
                    setPhoto(url);
                    void qc.invalidateQueries({ queryKey: qk.me });
                  }
                },
              )
            }
          />
          <Text variant="footnote">JPG, PNG, WebP · max. 5 MB · wird zugeschnitten</Text>
        </View>
      </View>
      <ImageRulesHint />

      {/* wie im Web: ab 640 pt zwei Spalten (sm:grid-cols-2) */}
      <View style={[styles.readonlyGrid, wide && styles.pair]}>
        <View style={wide && styles.half}>
          <Input label="E-Mail-Adresse" value={u.user.email} editable={false} />
        </View>
        <View style={wide && styles.half}>
          <Input label="Benutzername" value={u.user.username ? `@${u.user.username}` : '–'} editable={false} />
        </View>
      </View>

      <View style={{ gap: 16 }}>
        <View style={[{ gap: 16 }, wide && styles.pair]}>
          <View style={wide && styles.half}>
            <Input label="Vorname" value={form.first_name} onChangeText={set('first_name')} placeholder="Max" autoComplete="given-name" />
          </View>
          <View style={wide && styles.half}>
            <Input label="Nachname" value={form.last_name} onChangeText={set('last_name')} placeholder="Mustermann" autoComplete="family-name" />
          </View>
        </View>
        <Input
          label="Firma (freiwillig)"
          value={form.company_name}
          onChangeText={set('company_name')}
          placeholder="z. B. Mustermann & Müller GbR"
          hint="Nur wenn du als Firma auftrittst. Steht dann im Impressum und in der Datenschutzerklärung aller deiner Webseiten."
        />
        <Input
          label="Telefon / WhatsApp"
          value={form.phone}
          onChangeText={set('phone')}
          placeholder="+49 151 12345678"
          keyboardType="phone-pad"
          autoComplete="tel"
          hint="Mit Ländervorwahl, z. B. +49 für Deutschland."
        />
      </View>

      <View style={{ gap: 10 }}>
        <Text style={styles.label}>Social Media</Text>
        {SOCIALS.map(s => (
          <Input
            key={s.key}
            value={socials[s.key] ?? ''}
            onChangeText={v => setSocials(p => ({ ...p, [s.key]: v }))}
            placeholder={s.ph}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel={s.label}
            left={
              <View style={styles.prefix}>
                <Text style={styles.prefixLabel}>{s.label}</Text>
                <Text variant="footnote">{s.prefix}</Text>
              </View>
            }
          />
        ))}
      </View>

      <View style={{ gap: 8 }}>
        <SectionHeader title="Teampartner-Nummer" subtitle="Wird automatisch in deine Shop-Links eingebaut." />
        <View style={{ height: 8 }} />
        <Input
          value={form.team_partner_number}
          onChangeText={v => set('team_partner_number')(v.replace(/\D/g, ''))}
          placeholder="z. B. 40237198"
          keyboardType="number-pad"
          accessibilityLabel="Teampartner-Nummer"
        />
      </View>

      {!!error && <Notice tone="danger">{error}</Notice>}
      <Button title="Profil speichern" onPress={save} loading={saving} fullWidth />
    </View>
  );
}

const styles = StyleSheet.create({
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  photoBusy: {
    ...StyleSheet.absoluteFill,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readonlyGrid: { gap: 16 },
  pair: { flexDirection: 'row' },
  half: { flex: 1 },
  label: { fontFamily: fonts.semibold, fontSize: 14, color: colors.label },
  prefix: {
    paddingHorizontal: 12,
    alignSelf: 'stretch',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderRightWidth: 1,
    borderRightColor: colors.divider,
    minWidth: 120,
  },
  prefixLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.body },
});
