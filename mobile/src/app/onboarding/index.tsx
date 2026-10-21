import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useMe } from '@/api/queries';
import { LoadError } from '@/components/ui';
import { nextStep } from '@/features/onboarding/steps';
import { colors } from '@/theme/tokens';

export default function OnboardingIndex() {
  const me = useMe();
  if (me.data) return <Redirect href={nextStep(me.data)} />;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.background }}>
      {me.isError ? <LoadError onRetry={() => void me.refetch()} /> : <ActivityIndicator color={colors.faint} />}
    </View>
  );
}
