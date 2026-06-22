import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { getResend, FROM_EMAIL } from '@/lib/resend'
import { verificationEmail, passwordResetEmail } from '@/lib/email/templates'

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
    requireEmailVerification: false, // false for easier migration — can be toggled later
    sendResetPassword: async ({ user, url }: { user: { email: string; name?: string }; url: string }) => {
      await getResend().emails.send({
        from: FROM_EMAIL,
        to: user.email,
        subject: 'Passwort zurücksetzen – FinestSites',
        html: passwordResetEmail({ url }),
      })
    },
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url }: { user: { email: string; name?: string }; url: string }) => {
      await getResend().emails.send({
        from: FROM_EMAIL,
        to: user.email,
        subject: 'Bitte bestätige deine E-Mail-Adresse – FinestSites',
        html: verificationEmail({ url }),
      })
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30,  // 30 days
    updateAge: 60 * 60 * 24,        // refresh daily
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,               // 5 minute client-side cache
    },
  },

  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL!,

  advanced: {
    // users.id is uuid type — generate proper UUIDs app-side (not DB default)
    // so all BetterAuth tables (users/sessions/accounts/verifications) get valid UUIDs
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },
})

export type AuthSession = typeof auth.$Infer.Session
export type AuthUser = typeof auth.$Infer.Session.user
