import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ApiError, humanError } from '@/api/client';
import { saveTaxProfile } from '@/api/endpoints';
import { qk, useTaxProfile } from '@/api/queries';
import type { TaxStatus } from '@/api/types';
import { Button, Input, Notice, Screen, Text, useToast } from '@/components/ui';
import { colors, fonts, radius } from '@/theme/tokens';

// Wortgleich mit src/lib/affiliate/tax.ts (Nachweistext)
const TAX_CONSENT_TEXT =
  'Ich bin einverstanden, dass FinestSites meine Provisionen per Gutschrift abrechnet (§ 14 Abs. 2 Satz 2 UStG). Ich prüfe jede Gutschrift und melde mich sofort, wenn etwas nicht stimmt.';
const ENTREPRENEUR_CONFIRMATION_TEXT = 'Ich handle als Unternehmer (§ 14 BGB) im Rahmen meiner selbständigen Tätigkeit.';

const STATUS_OPTIONS: { key: TaxStatus; title: string; desc: string }[] = [
  { key: 'kleinunternehmer', title: 'Kleinunternehmer', desc: 'Du weist auf deinen Rechnungen keine Umsatzsteuer aus (§ 19 UStG).' },
  { key: 'regelbesteuert', title: 'Mit Umsatzsteuer', desc: 'Du berechnest Umsatzsteuer. Du bekommst 19 % Umsatzsteuer zusätzlich.' },
];

export default function TaxProfileScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const tp = useTaxProfile();
  const existing = tp.data?.profile;
  const [status, setStatus] = useState<TaxStatus | null>(null);
  const [f, setF] = useState({ full_name: '', street: '', zip: '', city: '', tax_id: '' });
  const [entrepreneur, setEntrepreneur] = useState(false);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!existing) return;
    setStatus(existing.taxStatus);
    setF({ full_name: existing.fullName, street: existing.street, zip: existing.zip, city: existing.city, tax_id: existing.taxId });
    setEntrepreneur(existing.entrepreneurConfirmed);
    setConsent(!!existing.consentAt);
  }, [existing]);

  async function save() {
    const e: Record<string, string> = {};
    if (!status) e.status = 'Bitte wähle aus, was auf dich zutrifft.';
    if (!f.full_name.trim()) e.full_name = 'Bitte gib deinen Namen oder Firmennamen ein.';
    if (!f.street.trim()) e.street = 'Bitte gib Straße und Hausnummer ein.';
    if (!/^\d{5}$/.test(f.zip)) e.zip = 'Bitte gib eine 5-stellige PLZ ein.';
    if (!f.city.trim()) e.city = 'Bitte gib deinen Ort ein.';
    if (f.tax_id.trim().length < 8) e.tax_id = 'Bitte gib deine Steuernummer oder USt-IdNr. ein.';
    if (!entrepreneur) e.entrepreneur = 'Bitte bestätige diesen Punkt.';
    if (!consent) e.consent = 'Bitte bestätige diesen Punkt.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    setError('');
    try {
      const saved = await saveTaxProfile({
        taxStatus: status,
        fullName: f.full_name,
        street: f.street,
        zip: f.zip,
        city: f.city,
        taxId: f.tax_id,
        entrepreneurConfirmed: entrepreneur,
        consent,
      });
      qc.setQueryData(qk.taxProfile, saved);
      await qc.invalidateQueries({ queryKey: qk.affiliate });
      toast.show('Gespeichert.', 'success');
      router.back();
    } catch (err) {
      // Server prüft wie im Web und meldet je Feld, was fehlt
      const fields = err instanceof ApiError ? err.fields : null;
      if (fields) {
        setErrors({
          status: fields.taxStatus,
          full_name: fields.fullName,
          street: fields.street,
          zip: fields.zip,
          city: fields.city,
          tax_id: fields.taxId,
          entrepreneur: fields.entrepreneurConfirmed,
          consent: fields.consent,
        } as Record<string, string>);
        setError('Bitte prüfe deine Angaben.');
      } else {
        setError(humanError(err));
      }
    }
    setSaving(false);
  }

  const set = (k: keyof typeof f) => (v: string) => setF(p => ({ ...p, [k]: v }));

  return (
    <Screen readable>
      <Text variant="callout">Damit wir deine Provision per Gutschrift abrechnen können. Änderungen gelten ab der nächsten Abrechnung.</Text>
      <View style={{ gap: 10 }}>
        <Text style={styles.label}>Was trifft auf dich zu?</Text>
        {STATUS_OPTIONS.map(o => {
          const on = status === o.key;
          return (
            <Pressable key={o.key} onPress={() => setStatus(o.key)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[styles.choice, on && styles.choiceOn]}>
              <View style={[styles.radio, on && { borderColor: colors.ink }]}>{on && <View style={styles.radioDot} />}</View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.choiceTitle}>{o.title}</Text>
                <Text variant="callout">{o.desc}</Text>
              </View>
            </Pressable>
          );
        })}
        {errors.status && <Text style={styles.err}>{errors.status}</Text>}
      </View>
      <View style={{ gap: 16 }}>
        <Input label="Vollständiger Name oder Firmenname" value={f.full_name} onChangeText={set('full_name')} placeholder="z. B. Maria Muster" error={errors.full_name} autoComplete="name" />
        <Input label="Straße und Hausnummer" value={f.street} onChangeText={set('street')} placeholder="z. B. Hauptstraße 12" error={errors.street} autoComplete="street-address" />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ width: 120 }}>
            <Input label="PLZ" value={f.zip} onChangeText={v => set('zip')(v.replace(/\D/g, '').slice(0, 5))} placeholder="97437" keyboardType="number-pad" error={errors.zip} autoComplete="postal-code" />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="Ort" value={f.city} onChangeText={set('city')} placeholder="z. B. Haßfurt" error={errors.city} />
          </View>
        </View>
        <Input label="Land" value="Deutschland" editable={false} />
        <Input
          label="Steuernummer oder USt-IdNr."
          value={f.tax_id}
          onChangeText={set('tax_id')}
          placeholder="z. B. 123/456/78901"
          autoCapitalize="characters"
          error={errors.tax_id}
          hint="Steht auf deinem Steuerbescheid oder in Briefen vom Finanzamt."
        />
      </View>
      <CheckRow checked={entrepreneur} onChange={setEntrepreneur} error={errors.entrepreneur} text={ENTREPRENEUR_CONFIRMATION_TEXT} />
      <CheckRow checked={consent} onChange={setConsent} error={errors.consent} text={TAX_CONSENT_TEXT} />
      {!!error && <Notice tone="danger">{error}</Notice>}
      <Button title={saving ? 'Wird gespeichert…' : 'Speichern'} onPress={save} loading={saving} fullWidth />
    </Screen>
  );
}

function CheckRow({ checked, onChange, text, error }: { checked: boolean; onChange: (v: boolean) => void; text: string; error?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Pressable
        onPress={() => onChange(!checked)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        style={[styles.check, error ? { borderColor: '#FCA5A5' } : null]}>
        <View style={[styles.box, checked && styles.boxOn]}>{checked && <Check size={14} color={colors.white} strokeWidth={3} />}</View>
        <Text variant="callout" color={colors.body} style={{ flex: 1 }}>
          {text}
        </Text>
      </Pressable>
      {error && <Text style={styles.err}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.semibold, fontSize: 14, color: colors.label },
  choice: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: radius.input, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white },
  choiceOn: { borderColor: colors.ink, borderWidth: 2 },
  choiceTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ink },
  check: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: radius.input, backgroundColor: colors.surfaceSubtle, borderWidth: 1.5, borderColor: colors.divider },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#D1D5DB', backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  boxOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  err: { fontFamily: fonts.medium, fontSize: 13, color: colors.dangerStrong, paddingHorizontal: 4 },
});
