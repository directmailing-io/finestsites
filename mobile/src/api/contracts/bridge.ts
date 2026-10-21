// GENERIERT von mobile/scripts/sync-contracts.mjs aus src/lib/contracts/app-v1/ – NICHT BEARBEITEN.
// Änderungen immer im Server-Vertrag machen und danach `npm run sync:contracts` ausführen.
/**
 * Nachrichten des Web-Editors an die App (WebView: window.ReactNativeWebView.postMessage, JSON).
 * Absender ist src/lib/app-mode/shared.ts (postToApp); dort prüft ein Typ-Abgleich, dass dieser
 * Vertrag und der Web-Typ übereinstimmen. Die App prüft jede Nachricht zur Laufzeit dagegen.
 *
 * `publish-blocked.code` ist ein PublishErrorCode (siehe errors.ts) – die App zeigt eigene Texte.
 */
import { z } from 'zod'

export const AppBridgeMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('published'), siteId: z.string(), url: z.string(), firstTime: z.boolean() }),
  z.object({ type: z.literal('publish-blocked'), code: z.string() }),
  z.object({ type: z.literal('save-state'), state: z.enum(['saving', 'saved', 'error']) }),
  z.object({ type: z.literal('share'), url: z.string() }),
  z.object({ type: z.literal('qr'), url: z.string() }),
  z.object({ type: z.literal('open-url'), url: z.string() }),
  z.object({ type: z.literal('auth-required') }),
  z.object({ type: z.literal('dirty'), value: z.boolean(), unpublished: z.boolean().optional() }),
])
export type AppBridgeMessage = z.infer<typeof AppBridgeMessage>
