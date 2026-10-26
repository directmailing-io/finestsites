/**
 * Schnittstellen-Verträge der FinestSites-App, Version 1 (/api/app/v1/*).
 * Nur zod. Server-Routen prüfen ihre Antworten außerhalb der Produktion dagegen,
 * scripts/app-api-contract-test.ts prüft sie gegen den laufenden Server.
 */
export * from './errors'
export * from './common'
export * from './auth'
export * from './config'
export * from './me'
export * from './overview'
export * from './notifications'
export * from './push'
export * from './preferences'
export * from './affiliate'
export * from './impersonation'
export * from './templates'
export * from './bridge'
export * from './account-deletion'
export * from './chat'
export * from './news'
