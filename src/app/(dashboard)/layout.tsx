import { redirect } from 'next/navigation'
import { getServerUser, getImpersonationState } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users, appSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { DashboardSidebar } from '@/components/dashboard/Sidebar'
import { MobileNav } from '@/components/dashboard/MobileNav'
import { PlanQuotaProvider } from '@/components/dashboard/PlanQuotaContext'
import { GettingStartedSteps } from '@/components/dashboard/GettingStartedSteps'
import SupportChat from '@/components/support/SupportChat'
import ImpersonationBanner from '@/components/dashboard/ImpersonationBanner'
import CancellationBanner from '@/components/dashboard/CancellationBanner'
import DashboardNotice from '@/components/dashboard/DashboardNotice'
import type { Viewport } from 'next'
import { isAppModeRequest } from '@/lib/app-mode/server'
import { AppModeProvider } from '@/components/app-mode/AppMode'

/**
 * App-Modus (Cookie `fs_app=1`, Dashboard in der nativen App): Inhalt bis an die Ränder
 * (viewport-fit=cover, Abstände über safe-area). Ohne Cookie exakt wie im Root-Layout.
 */
export async function generateViewport(): Promise<Viewport> {
  const appMode = await isAppModeRequest()
  return appMode
    ? { width: 'device-width', initialScale: 1, viewportFit: 'cover' }
    : { width: 'device-width', initialScale: 1 }
}

/** Hinweistext für alle Nutzer aus app_settings; leer oder Fehler = kein Hinweis (darf das Dashboard nie blockieren). */
async function loadDashboardNotice(): Promise<string> {
  try {
    const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, 'dashboard_notice') })
    return row?.value.trim() ?? ''
  } catch {
    return ''
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, impersonation] = await Promise.all([getServerUser(), getImpersonationState()])

  if (!user) redirect('/login')

  const [profile, notice] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: { username: true, subscriptionStatus: true, cancelAtPeriodEnd: true, currentPeriodEnd: true },
    }),
    loadDashboardNotice(),
  ])

  const ADMIN_EMAIL = 'info@daniel-kurzeja.de'
  const appMode = await isAppModeRequest()

  // Only enforce username setup — subscription is not required to use the dashboard.
  // The payment wall is at publish time (enforced in /api/sites/[id]/publish).
  if (!impersonation) {
    if (user.email !== ADMIN_EMAIL && !profile?.username) {
      redirect('/onboarding/username')
    }
  }

  // App-Modus: die native App liefert Navigation, Support und Hinweise selbst. Hier nur der Inhalt,
  // ohne Seitenleiste, Handy-Navigation, Support-Chat, Einstiegs-Schritte, Kündigungs-/Zahlungs-
  // und Admin-Banner sowie ohne Dashboard-Hinweis. Ohne Cookie greift unten das unveränderte Layout.
  if (appMode) {
    return (
      <AppModeProvider value>
        <PlanQuotaProvider>
          <div className="flex min-h-screen" style={{ background: 'var(--background)' }}>
            <div className="flex-1 min-w-0 flex flex-col">
              <main className="flex-1 px-5 pt-6 sm:px-8 sm:pt-8 lg:px-12 lg:pt-10"
                style={{ paddingBottom: 'max(40px, calc(env(safe-area-inset-bottom, 0px) + 24px))' }}>
                {children}
              </main>
            </div>
          </div>
        </PlanQuotaProvider>
      </AppModeProvider>
    )
  }

  return (
    <PlanQuotaProvider>
      <div className="flex min-h-screen" style={{ background: 'var(--background)' }}>
        <DashboardSidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          {notice && <DashboardNotice text={notice} />}
          {!impersonation && <ImpersonationBanner />}
          {!impersonation && (
            <CancellationBanner
              subscriptionStatus={profile?.subscriptionStatus ?? null}
              cancelAtPeriodEnd={profile?.cancelAtPeriodEnd ?? false}
              currentPeriodEnd={profile?.currentPeriodEnd ?? null}
            />
          )}
          {impersonation && (
            <div style={{
              background: '#7C3AED',
              color: '#fff',
              padding: '8px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              fontSize: 13,
              fontWeight: 500,
              position: 'sticky',
              top: 0,
              zIndex: 100,
            }}>
              <span>
                Du siehst den Account von{' '}
                <strong>@{impersonation.username ?? impersonation.userId.slice(0, 8)}</strong>
                {' '} als Admin.
              </span>
              <form action="/api/impersonate/exit" method="POST">
                <button type="submit" style={{
                  background: 'rgba(255,255,255,0.2)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.4)',
                  borderRadius: 8,
                  padding: '4px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}>
                  Sitzung beenden
                </button>
              </form>
            </div>
          )}
          <main className="flex-1 px-5 pt-6 pb-32 sm:px-8 sm:pt-8 sm:pb-32 lg:px-12 lg:py-10">
            <GettingStartedSteps />
            {children}
          </main>
        </div>
        <MobileNav />
        {!impersonation && <SupportChat />}
      </div>
    </PlanQuotaProvider>
  )
}
