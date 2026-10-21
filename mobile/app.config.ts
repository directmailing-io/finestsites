import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * FinestSites – native App (iPhone + iPad, Android folgt).
 *
 * Kein EAS-Projekt verknüpft: `extra.eas.projectId` wird erst gesetzt, wenn das Projekt
 * angelegt ist (Lead). Bis dahin liefert Push im Gerät keinen Token (wird sauber übersprungen).
 */
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID;

// Icon-Grund weiß wie Sidebar/Wortmarke; Startbildschirm wie --background der Webapp
const ICON_BG = '#FFFFFF';
const SPLASH_BG = '#FAFAFA';
export const SPLASH_BG_DARK = '#1a1a1a';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'FinestSites',
  slug: 'finestsites',
  scheme: 'finestsites',
  version: '1.0.0',
  // iPhone nur hochkant. iPad bekommt alle Ausrichtungen (siehe infoPlist unten).
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  icon: './assets/brand/icon.png',
  platforms: ['ios', 'android'],
  runtimeVersion: { policy: 'fingerprint' },
  ios: {
    bundleIdentifier: 'io.finestsites.app',
    // iOS 18+: helles, dunkles und getöntes Icon (erzeugt von scripts/build-icons.mjs)
    icon: {
      light: './assets/brand/icon.png',
      dark: './assets/brand/icon-dark.png',
      tinted: './assets/brand/icon-tinted.png',
    },
    supportsTablet: true,
    requireFullScreen: false,
    associatedDomains: ['applinks:app.finestsites.io'],
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      'UISupportedInterfaceOrientations~ipad': [
        'UIInterfaceOrientationPortrait',
        'UIInterfaceOrientationPortraitUpsideDown',
        'UIInterfaceOrientationLandscapeLeft',
        'UIInterfaceOrientationLandscapeRight',
      ],
      NSCameraUsageDescription:
        'FinestSites braucht die Kamera, damit du ein Profilfoto oder ein Bild für den Support aufnehmen kannst.',
      NSPhotoLibraryUsageDescription:
        'FinestSites braucht Zugriff auf deine Fotos, damit du ein Profilfoto oder ein Bild für den Support auswählen kannst.',
      NSFaceIDUsageDescription: 'FinestSites nutzt Face ID, damit nur du deine App öffnen kannst.',
      // canOpenURL('tel:') entscheidet, ob „Anrufen“ angezeigt wird (iPad/iPod ohne Telefon: aus)
      LSApplicationQueriesSchemes: ['tel', 'mailto'],
    },
  },
  android: {
    package: 'io.finestsites.app',
    adaptiveIcon: {
      backgroundColor: ICON_BG,
      foregroundImage: './assets/brand/adaptive-foreground.png',
      monochromeImage: './assets/brand/adaptive-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: 'app.finestsites.io', pathPrefix: '/' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        // Vollständige Wortmarke, ruhig mittig. Die dunkle Fassung (splash-logo-dark.png, Grund
        // SPLASH_BG_DARK) liegt bereit, ist aber bewusst NICHT eingetragen: Die App erzwingt das helle
        // Design (userInterfaceStyle light) und expo-splash-screen meldet dann, dass ein dunkler
        // Startbildschirm nicht sauber funktioniert. Eintragen, sobald die App einen Dark Mode bekommt:
        //   dark: { backgroundColor: SPLASH_BG_DARK, image: './assets/brand/splash-logo-dark.png' }
        backgroundColor: SPLASH_BG,
        image: './assets/brand/splash-logo.png',
        imageWidth: 200,
        resizeMode: 'contain',
      },
    ],
    'expo-secure-store',
    [
      'expo-notifications',
      {
        icon: './assets/brand/notification-icon.png',
        color: '#7C3AED',
        defaultChannel: 'default',
      },
    ],
    [
      'expo-local-authentication',
      { faceIDPermission: 'FinestSites nutzt Face ID, damit nur du deine App öffnen kannst.' },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'FinestSites braucht Zugriff auf deine Fotos, damit du ein Profilfoto oder ein Bild für den Support auswählen kannst.',
        cameraPermission:
          'FinestSites braucht die Kamera, damit du ein Profilfoto oder ein Bild für den Support aufnehmen kannst.',
        microphonePermission: false,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {},
    ...(EAS_PROJECT_ID ? { eas: { projectId: EAS_PROJECT_ID } } : {}),
  },
});
