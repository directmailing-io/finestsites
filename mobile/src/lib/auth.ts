import { create } from 'zustand';

import { setBearerToken, setTokenRotatedHandler, setUnauthorizedHandler } from '@/api/client';
import * as ep from '@/api/endpoints';
import { queryClient } from '@/api/queries';

import { resetLock } from './lock';
import { unregisterPushDevice } from './push';
import { deleteSecure, getSecure, KEYS, setSecure } from './secure';

type Status = 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: Status;
  /** Grund der letzten Abmeldung, damit der Login-Bildschirm einen Satz dazu zeigen kann */
  signedOutReason: 'expired' | null;
  bootstrap: () => Promise<void>;
  completeSignIn: (token: string) => Promise<void>;
  signOut: (reason?: 'expired') => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  status: 'loading',
  signedOutReason: null,

  bootstrap: async () => {
    const token = await getSecure(KEYS.sessionToken);
    setBearerToken(token);
    set({ status: token ? 'signedIn' : 'signedOut' });
  },

  completeSignIn: async (token: string) => {
    await setSecure(KEYS.sessionToken, token);
    setBearerToken(token);
    queryClient.clear();
    set({ status: 'signedIn', signedOutReason: null });
  },

  signOut: async reason => {
    if (get().status === 'signedOut') return;
    // Gerät abmelden, solange der Schlüssel noch gilt; Fehler dürfen das Abmelden nie blockieren.
    if (!reason) {
      await unregisterPushDevice().catch(() => {});
      await ep.signOut().catch(() => {});
    }
    await deleteSecure(KEYS.sessionToken);
    await deleteSecure(KEYS.biometricEnabled);
    setBearerToken(null);
    resetLock();
    queryClient.clear();
    set({ status: 'signedOut', signedOutReason: reason ?? null });
  },
}));

setUnauthorizedHandler(() => {
  void useAuth.getState().signOut('expired');
});

// Neues Token vom Server (verlängerte Sitzung) sofort sicher ablegen
setTokenRotatedHandler(token => {
  if (useAuth.getState().status === 'signedIn') void setSecure(KEYS.sessionToken, token);
});
