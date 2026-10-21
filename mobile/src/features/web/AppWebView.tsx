import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import WebViewBase, { type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

import { createOneTimeToken } from '@/api/endpoints';
import { Button, EmptyState } from '@/components/ui';
import { API_BASE, APP_HOST, APP_VERSION, CLIENT, MOCK, WEBVIEW_UA_SUFFIX } from '@/lib/config';
import { openExternal, openInBrowser } from '@/lib/links';
import { colors } from '@/theme/tokens';
import { CloudOff } from 'lucide-react-native';

import { decide, parseBridge, type BridgeMessage } from './guard';
import { mockEditorHtml } from './mockEditor';

// Die Typen von react-native-webview 14 setzen P = undefined (=> Props never unter TS 6); explizit mit object instanziieren.
const WebView = WebViewBase as typeof WebViewBase<object>;

export interface AppWebViewHandle {
  canGoBack: () => boolean;
  goBack: () => void;
}

/**
 * Web-Seite der App im App-Rahmen. Anmeldung über Einmal-Schlüssel (OTT): Die App holt mit
 * ihrem Bearer einen Schlüssel, der Server tauscht ihn gegen ein Cookie und leitet auf `next`.
 * Nicht-persistenter Speicher (incognito): nach dem Schließen bleibt keine Web-Sitzung zurück.
 */
export const AppWebView = forwardRef<AppWebViewHandle, { next: string; onBridge: (m: BridgeMessage) => void }>(function AppWebView(
  { next, onBridge },
  ref,
) {
  const webRef = useRef<WebViewBase<object>>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const canGoBack = useRef(false);

  useImperativeHandle(ref, () => ({
    canGoBack: () => canGoBack.current,
    goBack: () => webRef.current?.goBack(),
  }));

  const start = useCallback(async () => {
    setFailed(false);
    setUri(null);
    if (MOCK) return setUri('mock');
    try {
      const { token } = await createOneTimeToken();
      setUri(`${API_BASE}/api/app/v1/editor-handoff?ott=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`);
    } catch {
      setFailed(true);
    }
  }, [next]);

  useEffect(() => {
    void start();
  }, [start]);

  const onShouldStart = (req: ShouldStartLoadRequest) => {
    const top = req.isTopFrame ?? true;
    const d = decide(req.url, top);
    if (d === 'allow') return true;
    if (d === 'external') {
      if (/^(tel|mailto|sms):/.test(req.url)) void openExternal(req.url);
      else void openInBrowser(req.url);
    }
    return false;
  };

  const onMessage = (e: WebViewMessageEvent) => {
    // Nur Nachrichten von unserer eigenen Seite annehmen
    const from = e.nativeEvent.url;
    if (!MOCK) {
      try {
        if (new URL(from).host !== APP_HOST) return;
      } catch {
        return;
      }
    }
    const m = parseBridge(e.nativeEvent.data);
    if (m) onBridge(m);
  };

  if (failed) {
    return (
      <View style={styles.center}>
        <EmptyState icon={CloudOff} title="Konnte nicht geladen werden" text="Bitte prüfe deine Internetverbindung." />
        <Button title="Nochmal versuchen" onPress={start} />
      </View>
    );
  }
  if (!uri) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.faint} />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <WebView
        ref={webRef}
        source={uri === 'mock' ? { html: mockEditorHtml(next), baseUrl: API_BASE } : { uri }}
        style={styles.flex}
        applicationNameForUserAgent={WEBVIEW_UA_SUFFIX}
        injectedJavaScriptBeforeContentLoaded={`window.__FS_APP__ = { client: '${CLIENT}', version: '${APP_VERSION}' }; true;`}
        onShouldStartLoadWithRequest={onShouldStart}
        onMessage={onMessage}
        onNavigationStateChange={(n: WebViewNavigation) => (canGoBack.current = n.canGoBack)}
        onLoadEnd={() => setLoading(false)}
        onError={() => setFailed(true)}
        onHttpError={e => {
          if (e.nativeEvent.statusCode === 401) onBridge({ type: 'auth-required' });
        }}
        incognito
        sharedCookiesEnabled={false}
        thirdPartyCookiesEnabled={false}
        allowsBackForwardNavigationGestures
        allowsInlineMediaPlayback
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically={false}
        allowFileAccess={false}
        originWhitelist={['https://*', 'about:*', 'data:*', 'blob:*']}
        decelerationRate="normal"
        pullToRefreshEnabled={false}
        textZoom={100}
      />
      {loading && (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <ActivityIndicator color={colors.faint} />
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: colors.background },
});
