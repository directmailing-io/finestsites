import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { sendEmail } from '@/lib/resend'
import { verificationEmail, passwordResetEmail } from '@/lib/email/templates'
import { bearer } from 'better-auth/plugins/bearer'
import { oneTimeToken } from 'better-auth/plugins/one-time-token'
import { isAppClientHeaders } from '@/lib/app-mode'

// ── Native App (Expo) ─────────────────────────────────────────────────────────
// Die App sendet nur `Authorization: Bearer <token>` (fetch mit credentials:'omit', keine Cookies,
// kein Origin). Der bearer-Hook setzt daraus intern das Session-Cookie; ohne Cookie in der echten
// Anfrage greift BetterAuths Origin-Prüfung nicht (origin-check.mjs: nur wenn `cookie` gesendet wird).
//
// requireSignature: nur das signierte Token (wie im Cookie) gilt, nie die rohe Session-ID aus der DB.
//
// Der Antwort-Header `set-auth-token` (das Token für die App) wird NUR an native App-Anfragen
// gegeben (Header `X-FS-Client: ios|android` bzw. User-Agent `FinestSitesApp/`). Browser bekommen
// ihn nicht – für Web-Nutzer ändert sich dadurch nichts (keine neuen Antwort-Header).
const bearerBase = bearer({ requireSignature: true })
type BearerAfterHook = (typeof bearerBase.hooks.after)[number]
const appBearer: typeof bearerBase = {
  ...bearerBase,
  hooks: {
    before: bearerBase.hooks.before,
    after: bearerBase.hooks.after.map((h: BearerAfterHook) => ({
      ...h,
      // Typ im Plugin ist `() => true`; wir schränken bewusst auf App-Anfragen ein.
      matcher: ((ctx: Parameters<BearerAfterHook['matcher']>[0]) =>
        isAppClientHeaders(ctx.request?.headers ?? ctx.headers ?? null)) as unknown as BearerAfterHook['matcher'],
    })),
  },
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true, // Hard DOI -- required before dashboard access
    sendResetPassword: async ({ user, url }: { user: { email: string; name?: string }; url: string }) => {
      await sendEmail({ to: user.email, subject: 'Passwort zurücksetzen – FinestSites', html: passwordResetEmail({ url }), type: 'password_reset' })
    },
  },

  emailVerification: {
    expiresIn: 60 * 60 * 24,           // 24 hours — matches the email copy
    autoSignInAfterVerification: true,  // creates session on click → redirects to callbackURL (onboarding)
    sendVerificationEmail: async ({ user, url }: { user: { email: string; name?: string }; url: string }) => {
      await sendEmail({ to: user.email, subject: 'Bitte bestätige deine E-Mail-Adresse – FinestSites', html: verificationEmail({ url }), type: 'verification' })
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30,  // 30 days
    updateAge: 60 * 60 * 24,        // refresh daily
    // cookieCache disabled: Safari ITP can create split-brain state where the
    // server cookie is valid but the cached client-side cookie is stale/missing,
    // causing false "not authenticated" responses on iOS Safari.
    cookieCache: {
      enabled: false,
    },
  },

  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL!,

  // Explicitly trust all domains where the app is served.
  // BetterAuth's CSRF middleware rejects requests from untrusted origins — on Safari iOS,
  // the Origin header can be set to unexpected values (e.g. the bare domain instead of
  // the scheme+host, or missing entirely). Listing all valid origins prevents 403 FORBIDDEN
  // being thrown instead of returned as {error}, which manifests as "Verbindungsfehler".
  trustedOrigins: [
    // Dynamic app URL — covers staging.app.finestsites.io, localhost, and any future env
    ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
    'https://app.finestsites.io',
    'https://finestsites.io',
    'https://www.finestsites.io',
    'https://finestsites.de',
    'https://www.finestsites.de',
    // Native App (Deep-Links / Rücksprünge). Custom-Schemes vergleicht BetterAuth per Präfix.
    'finestsites://',
    // Vercel canonical URL (used if NEXT_PUBLIC_APP_URL points here)
    ...(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000', 'http://localhost:3001']),
  ],

  plugins: [
    appBearer,
    // Einmal-Schlüssel für die Übergabe App → Editor-WebView (/api/app/v1/editor-handoff):
    // 1 Minute gültig, nur gehasht gespeichert, einmalig einlösbar.
    oneTimeToken({ expiresIn: 1, storeToken: 'hashed' }),
  ],

  advanced: {
    // Hinter Cloudflare ist cf-connecting-ip die echte Client-IP (Origin ist nur aus CF-Netzen erreichbar)
    ipAddress: { ipAddressHeaders: ['cf-connecting-ip', 'x-forwarded-for'] },
    // users.id is uuid type — generate proper UUIDs app-side (not DB default)
    // so all BetterAuth tables (users/sessions/accounts/verifications) get valid UUIDs
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },
})

export type AuthSession = typeof auth.$Infer.Session
export type AuthUser = typeof auth.$Infer.Session.user
