import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useEffect } from 'react';

import { useConfig, useDeletionStatus, useMe, useOverview } from '@/api/queries';
import { setBadge } from '@/lib/push';
import { colors, fonts } from '@/theme/tokens';

/**
 * Tab-Leiste exakt wie die Handy-Navigation der Webapp (src/components/dashboard/MobileNav.tsx):
 * Webseite · Anfragen · (Chats) · Partner · Mehr – gleiche Reihenfolge, gleiche Namen, gleiche Symbole.
 * „Mehr“ enthält wie im Web Support, Einstellungen und Abmelden (dazu Neuigkeiten und die App-Mitteilungen).
 * Support liegt als Bildschirm im „Mehr“-Stapel (/account/help), Mitteilungen und Links zeigen dorthin.
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
  // Partnerbereich in der Leiste (Daniel 02.11.2026), Support dafür unter „Mehr“; nur wenn das Konto teilnehmen darf
  const config = useConfig();
  const partnerVisible = !!me.data?.features.partnerProgram && config.data?.features.partnerProgram !== false;

  useEffect(() => {
    if (overview.data) void setBadge(unreadSubs + unreadSupport + (chatVisible ? unreadChat : 0));
  }, [overview.data, unreadSubs, unreadSupport, unreadChat, chatVisible]);

  // Ein nachträglich ein-/ausgeblendeter Tab baut die Tab-Leiste neu auf (Zustand weg, Deep-Link verloren) –
  // deshalb erst zeichnen, wenn /me einmal da ist (oder fehlgeschlagen; dann ohne „Chats“).
  if (me.isPending && !me.data) return null;

  // Kontolöschung „sofort“ vorgemerkt: nur der Bildschirm „Konto wird gelöscht am … – Löschung abbrechen“.
  // „Zum Laufzeitende“: App bleibt nutzbar, Hinweis unter „Mehr“ (account/index.tsx).
  if (deletion.data?.status === 'scheduled' && deletion.data.mode !== 'period_end') {
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
      backgroundColor={colors.background}
      // Android: Beschriftung unter allen Symbolen, nicht nur unter dem aktiven (Daniel 02.11.2026)
      labelVisibilityMode="labeled">
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
      <NativeTabs.Trigger name="partner" hidden={!partnerVisible}>
        <NativeTabs.Trigger.Label>Partner</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} md="group" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Label>Mehr</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="ellipsis" md="more_horiz" />
        {unreadSupport > 0 ? (
          <NativeTabs.Trigger.Badge>{unreadSupport > 99 ? '99+' : String(unreadSupport)}</NativeTabs.Trigger.Badge>
        ) : null}
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
