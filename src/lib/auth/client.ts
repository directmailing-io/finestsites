'use client'

import { createAuthClient } from 'better-auth/react'

// Do NOT set baseURL here — BetterAuth derives it from window.location.origin automatically.
// A hardcoded baseURL causes cross-origin requests on Safari iOS (ITP blocks credentialed
// cross-origin fetch, and CSRF check rejects requests with origin: null).
export const authClient = createAuthClient({})

export const { signIn, signUp, signOut, useSession, getSession } = authClient
