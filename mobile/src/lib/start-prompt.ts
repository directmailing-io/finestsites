/**
 * „Mitteilungen erlauben?“ einmal beim ersten App-Start nach dem Login (Daniel 03.11.2026):
 * 14 von 16 App-Nutzern hatten Push nie erlaubt, weil die Frage nur nach dem ersten Veröffentlichen,
 * der ersten Chat-Antwort oder dem ersten Support-Chat kam. Jetzt zusätzlich beim Start – aber erst,
 * wenn Logo-Intro und Face-ID-Sperre durch sind und die Tab-Leiste steht (nie über Onboarding/Login).
 * Nur einmal je Installation (gleiches Merkmal wie die anderen Stellen: shouldPrimePush/markPushPrimed).
 */
import { create } from 'zustand';

interface StartGate {
  /** Logo-Intro vorbei (bzw. gar nicht gespielt) und App bereit */
  introDone: boolean;
  setIntroDone: (v: boolean) => void;
}

export const useStartGate = create<StartGate>(set => ({
  introDone: false,
  setIntroDone: v => set({ introDone: v }),
}));

let askedThisLaunch = false;

/** Einmal je App-Lauf; true = jetzt fragen (Aufrufer prüft shouldPrimePush selbst). */
export function claimStartPrompt(): boolean {
  if (askedThisLaunch) return false;
  askedThisLaunch = true;
  return true;
}

/** Nur für Tests */
export function resetStartPrompt() {
  askedThisLaunch = false;
}
