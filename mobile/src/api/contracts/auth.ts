// GENERIERT von mobile/scripts/sync-contracts.mjs aus src/lib/contracts/app-v1/ – NICHT BEARBEITEN.
// Änderungen immer im Server-Vertrag machen und danach `npm run sync:contracts` ausführen.
/**
 * Anmeldung der App (BetterAuth, Basis /api/auth). Version 1: nur Anmelden, kein Registrieren.
 *
 * Ablauf:
 *  1. POST /api/auth/sign-in/email  Body { email, password }
 *     Header `X-FS-Client: ios` (Pflicht, sonst kein Token), KEIN Cookie, KEIN Origin
 *     (fetch mit credentials: 'omit').
 *     → Antwort-Header `set-auth-token` = Bearer-Token (signiert). In SecureStore ablegen.
 *  2. Jede weitere Anfrage: `Authorization: Bearer <token>` + `X-FS-Client: ios`.
 *     Liefert eine Antwort wieder `set-auth-token` (Session verlängert), das neue Token speichern.
 *  3. GET  /api/auth/get-session        → Session prüfen
 *     POST /api/auth/sign-out           → Abmelden (Body {} reicht)
 *     POST /api/auth/change-password    → { currentPassword, newPassword, revokeOtherSessions? }
 *     GET  /api/auth/one-time-token/generate → { token } (1 Minute gültig) für die Editor-Übergabe
 *  4. Editor im WebView: GET /api/app/v1/editor-handoff?ott=<token>&next=/sites/<id>/edit
 */
import { z } from 'zod'

export const SignInEmailRequest = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
})

export const SignInEmailResponse = z.object({
  redirect: z.boolean().optional(),
  token: z.string().optional(),
  user: z.object({ id: z.string(), email: z.string(), emailVerified: z.boolean() }).passthrough(),
}).passthrough()

export const ChangePasswordRequest = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
  revokeOtherSessions: z.boolean().optional(),
})

export const OneTimeTokenResponse = z.object({ token: z.string().min(16) })

/** GET /api/app/v1/editor-handoff – `next` nur aus der Positivliste, sonst /sites. */
export const EditorHandoffQuery = z.object({
  ott: z.string().min(16).max(256),
  next: z.string().max(512).optional(),
})

/** Antwort-Header-Name, unter dem der Server das Bearer-Token liefert. */
export const AUTH_TOKEN_HEADER = 'set-auth-token'
/** Header, mit dem die App sich zu erkennen gibt. */
export const APP_CLIENT_HEADER = 'X-FS-Client'
