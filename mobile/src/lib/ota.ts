/**
 * Over-the-Air-Updates (EAS Update) – nur holen, nie mitten in der Sitzung neu laden.
 *
 * - Beim Kaltstart prüft expo-updates selbst (app.config.ts: checkAutomatically ON_LOAD, Timeout 0).
 * - Hier zusätzlich: kommt die App in den Vordergrund, höchstens alle 10 Minuten nachsehen und ein
 *   neues Bündel still herunterladen. Es läuft erst beim NÄCHSTEN Kaltstart – kein reloadAsync, damit
 *   der Nutzer nie mitten im Editor oder Chat die App unter den Fingern verliert.
 * - Nichts davon darf die App stören: in Entwicklung und ohne Updates-Konfiguration passiert gar
 *   nichts, jeder Fehler wird verschluckt, kein Aufruf blockiert die Oberfläche.
 * - Ein serverseitiger Rücksprung (eas update:roll-back-to-embedded) kommt als isRollBackToEmbedded
 *   und wird genauso heruntergeladen.
 */
import * as Updates from 'expo-updates';
import { AppState, type AppStateStatus } from 'react-native';

/** Mindestabstand zwischen zwei Prüfungen (Expo drosselt häufige Anfragen, Akku + Datenvolumen). */
const CHECK_INTERVAL_MS = 10 * 60 * 1000;

// Der Kaltstart zählt als erste Prüfung (hat expo-updates nativ schon erledigt)
let lastCheckAt = Date.now();
let running = false;

function active(): boolean {
  return !__DEV__ && Updates.isEnabled;
}

/** Einmal nachsehen und ein neues Bündel für den nächsten Kaltstart herunterladen. Wirft nie. */
export async function checkForOtaUpdate(force = false): Promise<void> {
  if (!active() || running) return;
  if (!force && Date.now() - lastCheckAt < CHECK_INTERVAL_MS) return;
  running = true;
  lastCheckAt = Date.now();
  try {
    const check = await Updates.checkForUpdateAsync();
    if (check.isAvailable || check.isRollBackToEmbedded) await Updates.fetchUpdateAsync();
  } catch {
    // Kein Netz, Drosselung, Server nicht erreichbar: beim nächsten Vordergrund erneut versuchen
  } finally {
    running = false;
  }
}

/** Beobachtet den App-Zustand; Rückgabe räumt auf (für useEffect). */
export function startOtaWatcher(): () => void {
  if (!active()) return () => {};
  try {
    const onChange = (state: AppStateStatus) => {
      if (state === 'active') void checkForOtaUpdate();
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
