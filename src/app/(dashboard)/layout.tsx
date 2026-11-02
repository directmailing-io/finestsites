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
import AppTeaser from '@/components/dashboard/AppTeaser'
import { getAppUsageForUser } from '@/lib/admin/app-usage'
import type { Viewport } from 'next'
import { isAppModeRequest } from '@/lib/app-mode/server'
import { AppModeProvider } from '@/components/app-mode/AppMode'
import { DeletionPendingScreen, DeletionPeriodEndBanner } from '@/components/settings/AccountDeletionSection'
import { VisitorChatProvider } from '@/components/chat/VisitorChatContext'
import { isVisitorChatEnabledForUser } from '@/lib/chat/flags'

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

const OLD_WEBVIEW_SCRIPT = `(function(){try{var m=/Chrome\\/(\\d+)/.exec(navigator.userAgent);if(!m||Number(m[1])>=90)return;function show(){if(document.getElementById('fs-old-webview'))return;var b=document.createElement('div');b.id='fs-old-webview';b.setAttribute('style','position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#111;color:#fff;padding:14px 16px 28px;font:14px/1.5 Roboto,sans-serif');b.innerHTML='Dein Android-Browser ist veraltet (Chrome '+m[1]+'), darum kann diese Seite hier nicht laufen. Bitte im Play Store <a href="https://play.google.com/store/apps/details?id=com.google.android.webview" target="_blank" rel="noopener" style="color:#a78bfa;font-weight:600">\u201eAndroid System WebView\u201c aktualisieren</a>, dann die App neu \u00f6ffnen.';document.body.appendChild(b)}if(document.body)show();else document.addEventListener('DOMContentLoaded',show);try{var x=new XMLHttpRequest();x.open('POST','/api/client-error');x.setRequestHeader('Content-Type','application/json');x.send(JSON.stringify({message:'alter WebView: Chrome '+m[1],url:location.href,extra:'inline'}))}catch(e){}}catch(e){}})();`

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, impersonation] = await Promise.all([getServerUser(), getImpersonationState()])

  if (!user) redirect('/login')

  const [profile, notice, visitorChat, hasApp] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: { username: true, subscriptionStatus: true, cancelAtPeriodEnd: true, currentPeriodEnd: true, deletionScheduledFor: true, deletionMode: true, deletedAt: true },
    }),
    loadDashboardNotice(),
    // Besucher-Chat freigeschaltet? Fehler = aus (darf das Dashboard nie blockieren).
    isVisitorChatEnabledForUser(user.id).catch(() => false),
    // App schon in Nutzung? Dann kein App-Hinweis. Fehler = Hinweis zeigen (unkritisch).
    getAppUsageForUser(user.id).then(a => a.installed).catch(() => false),
  ])

  const ADMIN_EMAIL = 'info@daniel-kurzeja.de'
  const appMode = await isAppModeRequest()

  // Kontolöschung vorgemerkt – Weg „sofort“: nur „Konto wird gelöscht am … – Löschung abbrechen“ (Web und
  // App-Modus). Weg „zum Laufzeitende“: Dashboard bleibt nutzbar, oben ein Banner mit „Löschung abbrechen“.
  // Admin-Impersonation sieht das normale Dashboard.
  if (!impersonation && profile?.deletedAt) redirect('/login')
  const deletionPeriodEnd = !impersonation && !!profile?.deletionScheduledFor && profile.deletionMode === 'period_end'
  if (!impersonation && profile?.deletionScheduledFor && !deletionPeriodEnd) {
    return <DeletionPendingScreen scheduledFor={profile.deletionScheduledFor.toISOString()} />
  }

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
        {/* Reines ES5, läuft auch wenn das React-Bündel (braucht in der Praxis Chrome 90+) gar nicht startet: alter Android
            System WebView → Hinweis statt leerer Seite, dazu eine Meldung ans Server-Log (02.11.2026, Samsung). */}
        <script dangerouslySetInnerHTML={{ __html: OLD_WEBVIEW_SCRIPT }} />
        <PlanQuotaProvider>
          <VisitorChatProvider enabled={visitorChat}>
            <div className="flex min-h-screen" style={{ background: 'var(--background)' }}>
              <div className="flex-1 min-w-0 flex flex-col">
                <main className="flex-1 px-5 pt-6 sm:px-8 sm:pt-8 lg:px-12 lg:pt-10"
                  style={{ paddingBottom: 'max(40px, calc(env(safe-area-inset-bottom, 0px) + 24px))' }}>
                  {children}
                </main>
              </div>
            </div>
          </VisitorChatProvider>
        </PlanQuotaProvider>
      </AppModeProvider>
    )
  }

  return (
    <PlanQuotaProvider>
    <VisitorChatProvider enabled={visitorChat}>
      <div className="flex min-h-screen" style={{ background: 'var(--background)' }}>
        <DashboardSidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          {notice && <DashboardNotice text={notice} />}
          {deletionPeriodEnd && profile?.deletionScheduledFor && <DeletionPeriodEndBanner scheduledFor={profile.deletionScheduledFor.toISOString()} />}
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
            <AppTeaser hasApp={hasApp} />
            <GettingStartedSteps />
            {children}
          </main>
        </div>
        <MobileNav />
        {!impersonation && <SupportChat />}
      </div>
    </VisitorChatProvider>
    </PlanQuotaProvider>
  )
}
