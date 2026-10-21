import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
import { Geist_700Bold } from '@expo-google-fonts/geist/700Bold';
import { focusManager, onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import * as Network from 'expo-network';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient } from '@/api/queries';
import { LockScreen } from '@/components/LockScreen';
import { ToastProvider } from '@/components/ui';
import { NotificationRouter } from '@/features/push/NotificationRouter';
import { useAuth } from '@/lib/auth';
import { startLockWatcher, useLock } from '@/lib/lock';
import { registerPushDevice } from '@/lib/push';
import { colors, fonts } from '@/theme/tokens';

// Startbildschirm bleibt stehen, bis Schriften, Sitzung und Face-ID-Einstellung geladen sind,
// dann sanft ausblenden (kein Spinner dazwischen).
void SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 250, fade: true });

// TanStack Query an App-Vordergrund und Netz koppeln
focusManager.setEventListener(handleFocus => {
  const sub = AppState.addEventListener('change', s => handleFocus(s === 'active'));
  return () => sub.remove();
});
onlineManager.setEventListener(setOnline => {
  const sub = Network.addNetworkStateListener(state => setOnline(!!state.isConnected));
  return () => sub.remove();
});

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.background, primary: colors.ink, card: colors.background, text: colors.ink },
};

export const unstable_settings = { anchor: '(tabs)' };

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold });
  const status = useAuth(s => s.status);
  const bootstrap = useAuth(s => s.bootstrap);
  const lock = useLock();

  useEffect(() => {
    void bootstrap();
    void useLock.getState().hydrate();
    return startLockWatcher();
  }, [bootstrap]);

  const ready = fontsLoaded && status !== 'loading' && lock.hydrated;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  useEffect(() => {
    if (status === 'signedIn') void registerPushDevice();
  }, [status]);

  if (!ready) return null;
  const signedIn = status === 'signedIn';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider value={theme}>
            <ToastProvider>
              <StatusBar style="dark" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.background },
                  headerTitleStyle: { fontFamily: fonts.semibold, color: colors.ink },
                  headerTransparent: false,
                  headerShadowVisible: false,
                  headerStyle: { backgroundColor: colors.background },
                  headerTintColor: colors.ink,
                }}>
                <Stack.Protected guard={!signedIn} redirectTo="/sites">
                  <Stack.Screen name="login" />
                </Stack.Protected>
                <Stack.Protected guard={signedIn} redirectTo="/login">
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
                  <Stack.Screen name="deletion-pending" options={{ gestureEnabled: false }} />
                  <Stack.Screen
                    name="editor/[id]"
                    options={{ presentation: 'fullScreenModal', headerShown: false, gestureEnabled: false }}
                  />
                  <Stack.Screen name="web" options={{ presentation: 'fullScreenModal', headerShown: true, gestureEnabled: false }} />
                  <Stack.Screen
                    name="published"
                    options={{ presentation: 'transparentModal', animation: 'fade', gestureEnabled: false, contentStyle: { backgroundColor: 'transparent' } }}
                  />
                  <Stack.Screen name="push-priming" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.62, 1], sheetGrabberVisible: true }} />
                </Stack.Protected>
              </Stack>
              {signedIn && <NotificationRouter />}
              {signedIn && lock.enabled && lock.locked && <LockScreen />}
            </ToastProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
