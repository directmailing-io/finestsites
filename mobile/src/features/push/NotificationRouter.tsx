import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useLock } from '@/lib/lock';
import { routeFromNotification } from '@/lib/push';

/**
 * Tippen auf eine Mitteilung → passender Bildschirm.
 * - Kaltstart: useLastNotificationResponse liefert die Mitteilung, die die App geöffnet hat.
 * - Laufende App: derselbe Hook aktualisiert sich bei jedem Tippen.
 * - Bei aktiver Face-ID-Sperre wird erst nach dem Entsperren navigiert.
 * - Jede Mitteilung wird nur einmal ausgewertet.
 */
export function NotificationRouter() {
  const router = useRouter();
  const qc = useQueryClient();
  const response = Notifications.useLastNotificationResponse();
  const locked = useLock(s => s.enabled && s.locked);
  const handled = useRef<string | null>(null);

  useEffect(() => {
    // Neue Mitteilung im Vordergrund: Zähler und Listen auffrischen
    const sub = Notifications.addNotificationReceivedListener(() => {
      void qc.invalidateQueries({ queryKey: ['overview'] });
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      void qc.invalidateQueries({ queryKey: ['submissions'] });
      void qc.invalidateQueries({ queryKey: ['support'] });
      void qc.invalidateQueries({ queryKey: ['chat'] });
    });
    return () => sub.remove();
  }, [qc]);

  useEffect(() => {
    if (!response || locked) return;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const href = routeFromNotification(response.notification.request.content.data);
    if (href) {
      // kurz warten, bis die Tab-Navigation steht (Kaltstart)
      setTimeout(() => router.navigate(href as Href), 50);
    }
    Notifications.clearLastNotificationResponse();
  }, [response, locked, router]);

  return null;
}
