import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useEffect } from 'react';

import { useDeletionStatus, useMe, useOverview } from '@/api/queries';
import { setBadge } from '@/lib/push';
import { colors, fonts } from '@/theme/tokens';

/**
 * Tab-Leiste exakt wie die Handy-Navigation der Webapp (src/components/dashboard/MobileNav.tsx):
 * Webseite · Anfragen · Support · Mehr – gleiche Reihenfolge, gleiche Namen, gleiche Symbole.
 * „Mehr“ enthält wie im Web Partnerbereich, Einstellungen und Abmelden (dazu die App-Mitteilungen).
 * Dazwischen „Chats“ (Besucher-Chat) – nur für freigeschaltete Konten (me.features.visitorChat).
 * Auf dem iPad je nach Fenster oben bzw. als Seitenleiste (native Tab-Leiste).
 */
export default function TabsLayout() {
  const me = useMe();
  const overview = useOverview();
  const deletion = useDeletionStatus();
  const unreadSubs = overview.data?.unread.submissions ?? 0;
  const unreadSupport = overview.data?.unread.support ?? 0;
  const unreadChat = overview.data?.unread.chat ?? 0;
  const chatVisible = me.data?.features.visitorChat === true;

  useEffect(() => {
    if (overview.data) void setBadge(unreadSubs + unreadSupport + (chatVisible ? unreadChat : 0));
  }, [overview.data, unreadSubs, unreadSupport, unreadChat, chatVisible]);

  // Ein nachträglich ein-/ausgeblendeter Tab baut die Tab-Leiste neu auf (Zustand weg, Deep-Link verloren) –
  // deshalb erst zeichnen, wenn /me einmal da ist (oder fehlgeschlagen; dann ohne „Chats“).
  if (me.isPending && !me.data) return null;

  // Kontolöschung vorgemerkt: nur der Bildschirm „Konto wird gelöscht am … – Löschung abbrechen“
  if (deletion.data?.status === 'scheduled') {
    return <Redirect href="/deletion-pending" />;
  }

  if (me.data && !me.data.onboarding.complete) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <NativeTabs
      tintColor={colors.foreground}
      iconColor={{ default: colors.faint, selected: colors.foreground }}
      labelStyle={{
        default: { fontFamily: fonts.medium, fontSize: 10, color: colors.faint },
        selected: { fontFamily: fonts.medium, fontSize: 10, color: colors.foreground },
      }}
      badgeBackgroundColor={colors.dangerStrong}
      backgroundColor={colors.background}>
      <NativeTabs.Trigger name="sites">
        <NativeTabs.Trigger.Label>Webseite</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="globe" md="language" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="inbox">
        <NativeTabs.Trigger.Label>Anfragen</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'tray', selected: 'tray.fill' }} md="inbox" />
        {unreadSubs > 0 ? <NativeTabs.Trigger.Badge>{unreadSubs > 99 ? '99+' : String(unreadSubs)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chats" hidden={!chatVisible}>
        <NativeTabs.Trigger.Label>Chats</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'bubble.left.and.bubble.right', selected: 'bubble.left.and.bubble.right.fill' }} md="forum" />
        {chatVisible && unreadChat > 0 ? <NativeTabs.Trigger.Badge>{unreadChat > 99 ? '99+' : String(unreadChat)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="help">
        <NativeTabs.Trigger.Label>Support</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'bubble.left', selected: 'bubble.left.fill' }} md="chat_bubble" />
        {unreadSupport > 0 ? (
          <NativeTabs.Trigger.Badge>{unreadSupport > 99 ? '99+' : String(unreadSupport)}</NativeTabs.Trigger.Badge>
        ) : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Label>Mehr</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="ellipsis" md="more_horiz" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
