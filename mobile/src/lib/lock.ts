/**
 * Face ID / Touch ID als freiwillige Sperre (Muster FrankenBERATER, mit 5 Minuten Schonfrist):
 * - aus = nie sperren
 * - an  = beim Kaltstart und nach mehr als 5 Minuten im Hintergrund sperren
 */
import * as LocalAuthentication from 'expo-local-authentication';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { create } from 'zustand';

import { LOCK_GRACE_MS } from './config';
import { getSecure, KEYS, setSecure, deleteSecure } from './secure';

export type BiometricKind = 'faceid' | 'touchid' | 'fingerprint' | 'none';

export async function biometricKind(): Promise<BiometricKind> {
  try {
    if (!(await LocalAuthentication.hasHardwareAsync())) return 'none';
    if (!(await LocalAuthentication.isEnrolledAsync())) return 'none';
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'faceid';
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'touchid';
    return 'none';
  } catch {
    return 'none';
  }
}

export function biometricLabel(kind: BiometricKind) {
  // Android: keine Apple-Namen (Face ID/Touch ID gibt es dort nicht)
  if (Platform.OS === 'android') return kind === 'faceid' ? 'Gesichtserkennung' : kind === 'touchid' ? 'Fingerabdruck' : 'Displaysperre';
  return kind === 'faceid' ? 'Face ID' : kind === 'touchid' ? 'Touch ID' : 'Entsperren mit Biometrie';
}

export async function authenticate(prompt = 'Entsperre FinestSites'): Promise<boolean> {
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: prompt,
      cancelLabel: 'Abbrechen',
      fallbackLabel: 'Code eingeben',
      disableDeviceFallback: false,
    });
    return res.success;
  } catch {
    return false;
  }
}

interface LockState {
  enabled: boolean;
  locked: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setEnabled: (v: boolean) => Promise<void>;
  unlock: () => Promise<boolean>;
}

export const useLock = create<LockState>((set, get) => ({
  enabled: false,
  locked: false,
  hydrated: false,
  hydrate: async () => {
    const enabled = (await getSecure(KEYS.biometricEnabled)) === '1';
    set({ enabled, locked: enabled, hydrated: true });
  },
  setEnabled: async v => {
    if (v) {
      const ok = await authenticate(`${biometricLabel(await biometricKind())} für FinestSites einschalten`);
      if (!ok) return;
      await setSecure(KEYS.biometricEnabled, '1');
    } else {
      await deleteSecure(KEYS.biometricEnabled);
    }
    set({ enabled: v, locked: false });
  },
  unlock: async () => {
    const ok = await authenticate();
    if (ok) set({ locked: false });
    return ok;
  },
}));

let backgroundSince: number | null = null;

/** Einmal im Root-Layout aufrufen. */
export function startLockWatcher() {
  const onChange = (next: AppStateStatus) => {
    const { enabled } = useLock.getState();
    if (next === 'background') backgroundSince = Date.now();
    if (next === 'active' && backgroundSince !== null) {
      if (enabled && Date.now() - backgroundSince > LOCK_GRACE_MS) useLock.setState({ locked: true });
      backgroundSince = null;
    }
  };
  const sub = AppState.addEventListener('change', onChange);
  return () => sub.remove();
}

/** Nach dem Abmelden: Sperre aus. */
export function resetLock() {
  useLock.setState({ enabled: false, locked: false });
}
