'use client'

import React, { createContext, useContext, useEffect } from 'react'
import { postToApp, absoluteUrl, hasAppBridge } from '@/lib/app-mode/shared'

/**
 * App-Modus-Flag für Client-Komponenten. Der Wert kommt serverseitig aus dem Cookie `fs_app=1`
 * (Dashboard-Layout). Ohne Provider oder ohne Cookie: false → unverändertes Web-Verhalten.
 */
const AppModeContext = createContext(false)

export function AppModeProvider({ value, children }: { value: boolean; children: React.ReactNode }) {
  // Im App-WebView gibt es keine sichtbare Konsole: JS-Fehler ans Server-Log melden (max. 5 je Seite) und bei
  // veraltetem Android System WebView (< Chrome 111, Mindestversion von Next.js) einen Hinweis zeigen, statt
  // dass die Seite leer bleibt oder „Etwas ist schiefgelaufen“ erscheint (Daniels Samsung, 02.11.2026).
  useEffect(() => {
    if (!value || typeof window === 'undefined') return
    let sent = 0
    const report = (message: string, stack?: string) => {
      if (sent++ >= 5) return
      try {
        void fetch('/api/client-error', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
          body: JSON.stringify({ message: message.slice(0, 500), stack, url: window.location.href, extra: 'app-mode window' }),
        }).catch(() => {})
      } catch { /* egal */ }
    }
    const onError = (e: ErrorEvent) => report(`${e.message} (${e.filename}:${e.lineno})`, e.error?.stack)
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason as { message?: string; stack?: string } | string | undefined
      report(`unhandledrejection: ${typeof r === 'string' ? r : r?.message ?? String(r)}`, typeof r === 'object' ? r?.stack : undefined)
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    const m = /Chrome\/(\d+)/.exec(navigator.userAgent)
    if (m && Number(m[1]) < 111 && !document.getElementById('fs-old-webview')) {
      const box = document.createElement('div')
      box.id = 'fs-old-webview'
      box.setAttribute('style', 'position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#111;color:#fff;padding:14px 16px calc(14px + env(safe-area-inset-bottom));font:14px/1.5 -apple-system,Roboto,sans-serif')
      box.innerHTML = 'Dein Android-Browser ist veraltet (Chrome ' + m[1] + '), darum kann diese Seite hier nicht richtig laufen. Bitte im Play Store <a href="https://play.google.com/store/apps/details?id=com.google.android.webview" target="_blank" rel="noopener" style="color:#a78bfa;font-weight:600">„Android System WebView“ aktualisieren</a> und die App neu öffnen.'
      document.body.appendChild(box)
      report(`alter WebView: Chrome ${m[1]}`)
    }
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [value])
  return <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>
}

export function useAppMode(): boolean {
  return useContext(AppModeContext)
}

/**
 * Klick-Handler für Links nach außen (target=_blank): im App-Modus an die App melden
 * ({type:'open-url'}), die öffnet sie im Safari-Fenster. Ohne App-Modus oder ohne Brücke
 * passiert nichts Besonderes – der Link funktioniert wie bisher.
 */
export function useOpenExternal() {
  const appMode = useAppMode()
  return React.useCallback((e: React.MouseEvent, url: string) => {
    if (!appMode) return
    if (postToApp({ type: 'open-url', url: absoluteUrl(url) })) e.preventDefault()
  }, [appMode])
}

/** Auf Anmelde-Seiten im App-Modus: der App sagen, dass sie neu anmelden muss. Rendert nichts. */
export function AppAuthRequiredSignal() {
  useEffect(() => {
    if (hasAppBridge()) postToApp({ type: 'auth-required' })
  }, [])
  return null
}
