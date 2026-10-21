import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { BadgeCheck } from 'lucide-react-native';
import { useState } from 'react';

import { getMe, setCompany, updateProfile } from '@/api/endpoints';
import { qk } from '@/api/queries';
import { Button, Input } from '@/components/ui';
import { OnboardingFrame } from '@/features/onboarding/OnboardingFrame';
import { nextStep } from '@/features/onboarding/steps';

export default function TeamPartnerStep() {
  const router = useRouter();
  const qc = useQueryClient();
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);

  async function next() {
    setLoading(true);
    await setCompany().catch(() => {});
    if (value.trim()) await updateProfile({ team_partner_number: value.trim() }).catch(() => {});
    const me = await qc.fetchQuery({ queryKey: qk.me, queryFn: getMe, staleTime: 0 }).catch(() => null);
    router.replace(me ? nextStep(me, 'team-partner') : '/start');
    setLoading(false);
  }

  return (
    <OnboardingFrame
      step="team-partner"
      icon={BadgeCheck}
      title="Deine Teampartner-Nummer"
      text="Wir bauen sie automatisch in die Shop-Links auf deiner Seite ein. Du kannst sie auch später unter „Konto“ eintragen.">
      <Input value={value} onChangeText={v => setValue(v.replace(/\D/g, ''))} placeholder="z. B. 40237198" keyboardType="number-pad" accessibilityLabel="Teampartner-Nummer" />
      <Button title={loading ? 'Wird gespeichert…' : value.trim() ? 'Weiter' : 'Später eintragen'} onPress={next} loading={loading} fullWidth />
    </OnboardingFrame>
  );
}
