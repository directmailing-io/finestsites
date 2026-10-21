import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useEffect } from 'react';

import { useDeletionStatus, useMe, useOverview } from '@/api/queries';
import { setBadge } from '@/lib/push';
import { colors, fonts } from '@/theme/tokens';

/**
 * Tab-Leiste (native, auf dem iPad je nach Fenster oben bzw. als Seitenleiste).
 * „Neue Webseite“ ist kein eigener Tab, sondern der Hauptknopf auf Start und Seiten –
 * so bleiben es 5 Tabs und auf dem iPhone gibt es kein „Mehr“-Menü.
 */
export default function TabsLayout() {
  const me = useMe();
  const overview = useOverview();
  const deletion = useDeletionStatus();
  const unreadSubs = overview.data?.unread.submissions ?? 0;
  const unreadSupport = overview.data?.unread.support ?? 0;

  useEffect(() => {
    if (overview.data) void setBadge(unreadSubs + unreadSupport);
  }, [overview.data, unreadSubs, unreadSupport]);

  // Kontolöschung vorgemerkt: nur der Bildschirm „Konto wird gelöscht am … – Löschung abbrechen“
  if (deletion.data?.status === 'scheduled') {
    return <Redirect href="/deletion-pending" />;
  }

  if (me.data?.onboarding.needs_username || me.data?.onboarding.needs_consent) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <NativeTabs
      tintColor={colors.ink}
      iconColor={{ default: colors.faint, selected: colors.ink }}
      labelStyle={{ default: { fontFamily: fonts.medium, color: colors.mutedForeground }, selected: { fontFamily: fonts.semibold, color: colors.ink } }}
      badgeBackgroundColor={colors.unreadBadge}
      backgroundColor={colors.background}>
      <NativeTabs.Trigger name="start">
        <NativeTabs.Trigger.Label>Start</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="sites">
        <NativeTabs.Trigger.Label>Seiten</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="globe" md="language" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="inbox">
        <NativeTabs.Trigger.Label>Anfragen</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'tray', selected: 'tray.fill' }} md="inbox" />
        {unreadSubs > 0 ? <NativeTabs.Trigger.Badge>{String(Math.min(unreadSubs, 99))}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="help">
        <NativeTabs.Trigger.Label>Hilfe</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'bubble.left.and.bubble.right', selected: 'bubble.left.and.bubble.right.fill' }}
          md="chat"
        />
        {unreadSupport > 0 ? <NativeTabs.Trigger.Badge>{String(unreadSupport)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Label>Konto</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
