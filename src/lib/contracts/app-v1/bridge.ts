/**
 * Nachrichten des Web-Editors an die App (WebView: window.ReactNativeWebView.postMessage, JSON).
 * Absender ist src/lib/app-mode/shared.ts (postToApp); dort prüft ein Typ-Abgleich, dass dieser
 * Vertrag und der Web-Typ übereinstimmen. Die App prüft jede Nachricht zur Laufzeit dagegen.
 *
 * `close` schickt der Web-Editor nur, wenn die App ihn ankündigt (`window.__FS_APP__.caps` enthält 'close').
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
  // Zurück-Knopf des Web-Editors im App-Modus: die App schließt den Editor (mit Rückfrage bei ungespeicherten Änderungen)
  z.object({ type: z.literal('close') }),
])
export type AppBridgeMessage = z.infer<typeof AppBridgeMessage>
