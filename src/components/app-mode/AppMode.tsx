'use client'

import React, { createContext, useContext, useEffect } from 'react'
import { postToApp, absoluteUrl, hasAppBridge } from '@/lib/app-mode/shared'

/**
 * App-Modus-Flag für Client-Komponenten. Der Wert kommt serverseitig aus dem Cookie `fs_app=1`
 * (Dashboard-Layout). Ohne Provider oder ohne Cookie: false → unverändertes Web-Verhalten.
 */
const AppModeContext = createContext(false)

export function AppModeProvider({ value, children }: { value: boolean; children: React.ReactNode }) {
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
