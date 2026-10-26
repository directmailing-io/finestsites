# FinestSites – native App (Expo)

Expo SDK 58, expo-router, EAS-Projekt `@frankenberater/finestsites`. Regeln für die Arbeit am Code stehen in
`AGENTS.md`; Store-Start und Build-Ablauf in `../docs/app/`.

## Over-the-Air-Updates (EAS Update)

Seit Build 9 ist `expo-updates` eingebaut. Änderungen an JavaScript, Oberfläche, Texten und Bildern lassen sich
damit ohne neuen Store-Build ausliefern. Die Nutzer bekommen das neue Bündel beim nächsten Kaltstart.

**Grundregel: Ein OTA-Update wird nur nach Daniels ausdrücklicher Freigabe veröffentlicht** – wie jeder
EAS-Build oder -Submit (siehe `AGENTS.md`). Vorher lokal prüfen: `npm run check` (Verträge, TypeScript,
Kauf-Wörter, expo-doctor).

### Update veröffentlichen

```bash
cd mobile
npx eas-cli update --channel production --environment production --message "Kurz, was sich ändert"
```

- `--channel preview` für interne Testbuilds (Profil `preview` in `eas.json`), `--channel production` für den Store-Build.
  `--environment` (EAS-Umgebungsvariablen) ist seit SDK 55 Pflicht; die App braucht daraus derzeit nichts.
- Beim ersten `eas update` legt EAS den Branch zum Kanal automatisch an (Branch = Kanalname); im Expo-Dashboard
  muss dafür nichts vorbereitet werden.
- Rücksprung im Notfall: `npx eas-cli update:rollback` (Alias `update:roll-back-to-embedded` – Nutzer landen wieder
  auf dem im Build enthaltenen Bündel) oder `npx eas-cli update:republish --branch production` für ein früheres Update.
  `npx eas-cli channel:pause production` hält die Auslieferung an, `channel:resume` setzt sie fort.
- Die App prüft beim Kaltstart (nativ, `checkAutomatically: ON_LOAD`, `fallbackToCacheTimeout: 0`) und beim Wechsel in den
  Vordergrund höchstens alle 10 Minuten (`src/lib/ota.ts`). Sie lädt nur herunter, nie wird mitten in der Sitzung neu
  geladen – das neue Bündel läuft ab dem nächsten Kaltstart.

### Was per OTA geht – und was nicht

| Geht per `eas update`                                             | Braucht einen Store-Build (`eas build`)                                   |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| TypeScript/JS-Code, Bildschirme, Komponenten, Logik                | Neue oder aktualisierte native Module (`npx expo install …` mit nativem Teil) |
| Texte, Farben, Abstände, Schriften (als Asset)                     | Berechtigungen und Info.plist/Manifest-Texte (`ios.infoPlist`, Plugin-Optionen) |
| Bilder, Videos, Icons innerhalb von `src/` und `assets/` (als Asset) | App-Icon, Splash-Screen, Adaptive Icon                                  |
| API-Aufrufe (abwärtskompatibel zum Server)                         | Alles Native in `app.config.ts` (bundleIdentifier, Plugins, Schema, Associated Domains) |
|                                                                   | Expo-SDK- oder React-Native-Upgrade                                       |

### Laufzeitversion = Fingerprint

`runtimeVersion: { policy: 'fingerprint' }` berechnet aus allen nativen Bestandteilen (Module, Plugins, Konfiguration)
einen Fingerabdruck. **Ein OTA-Update erreicht nur Builds mit genau diesem Fingerabdruck.** Praktisch heißt das:

- Ändert sich etwas Natives, ist der Fingerprint neu → ein Store-Build ist nötig, und Updates für den alten
  Fingerprint laufen dort weiter, bis alle Nutzer aktualisiert haben.
- Vor einem Update prüfen, dass der Fingerprint zum laufenden Store-Build passt:
  `npx expo-updates runtimeversion:resolve --platform ios` (bzw. `android`) berechnet die Laufzeitversion lokal;
  im Expo-Dashboard unter *Updates* steht, welche Builds ein Update erreicht. `npx expo-updates fingerprint:generate`
  zeigt den vollständigen Fingerabdruck.
- Wird ein Update für einen Fingerprint veröffentlicht, den kein Build hat, passiert bei den Nutzern einfach nichts.

### Code Signing (optional)

Updates lassen sich zusätzlich signieren (`npx expo-updates codesigning:generate` + `codesigning:configure`, danach
`eas update --private-key-path …`; schreibt `updates.codeSigningCertificate`/`codeSigningMetadata` in die Config).
Nur in den EAS-Tarifen Production/Enterprise verfügbar, derzeit nicht eingerichtet; die Übertragung läuft über HTTPS
von `u.expo.dev`.
