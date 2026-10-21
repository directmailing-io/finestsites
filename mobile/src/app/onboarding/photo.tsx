import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Camera, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { qk } from '@/api/queries';
import { Button, ProfilePhoto } from '@/components/ui';
import { pickAndUploadAvatar } from '@/features/account/avatar';
import { OnboardingFrame } from '@/features/onboarding/OnboardingFrame';
import { colors } from '@/theme/tokens';

export default function PhotoStep() {
  const router = useRouter();
  const qc = useQueryClient();
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const finish = () => {
    void qc.invalidateQueries({ queryKey: qk.me });
    router.replace('/sites');
  };

  return (
    <OnboardingFrame
      step="photo"
      icon={UserRound}
      title="Profil vervollständigen"
      text="Dein Foto wird beim Erstellen deiner Webseiten automatisch vorausgefüllt. Du kannst diesen Schritt auch überspringen.">
      <View style={{ alignSelf: 'center', marginVertical: 8 }}>
        <ProfilePhoto url={url} size={112} />
        {busy && <ActivityIndicator color={colors.ink} style={{ position: 'absolute', top: 46, left: 46 }} />}
      </View>
      <Button
        title={url ? 'Foto ändern' : 'Foto hochladen'}
        icon={Camera}
        variant="muted"
        disabled={busy}
        onPress={() =>
          pickAndUploadAvatar(
            () => setBusy(true),
            u => {
              setBusy(false);
              if (u) setUrl(u);
            },
          )
        }
      />
      <Button title={url ? 'Speichern & loslegen' : 'Überspringen'} onPress={finish} fullWidth variant={url ? 'primary' : 'outline'} />
    </OnboardingFrame>
  );
}
