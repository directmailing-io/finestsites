import * as SecureStore from 'expo-secure-store';

/**
 * Schlüsselnamen für SecureStore. Nur [A-Za-z0-9._-] erlaubt, also keine Doppelpunkte.
 */
export const KEYS = {
  sessionToken: 'fs_session_token',
  biometricEnabled: 'fs_biometric_enabled',
  pushToken: 'fs_push_token',
  pushPrimed: 'fs_push_primed',
  onboardingOffered: 'fs_onboarding_offered',
} as const;

type Key = (typeof KEYS)[keyof typeof KEYS];

export async function getSecure(key: Key): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setSecure(key: Key, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY });
  } catch {
    /* Schlüsselbund nicht verfügbar: App funktioniert weiter, nur ohne Merken */
  }
}

export async function deleteSecure(key: Key): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    /* nichts zu tun */
  }
}
