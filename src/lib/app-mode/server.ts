import { cookies } from 'next/headers'
import { APP_MODE_COOKIE, APP_MODE_VALUE } from './shared'

/** Serverseitig: läuft die Anfrage in der App-WebView? (Cookie `fs_app=1`) */
export async function isAppModeRequest(): Promise<boolean> {
  try {
    const jar = await cookies()
    return jar.get(APP_MODE_COOKIE)?.value === APP_MODE_VALUE
  } catch {
    return false
  }
}
