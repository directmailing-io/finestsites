import { useQueryClient } from '@tanstack/react-query';
import { Moon } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, View } from 'react-native';

import { saveNotificationPreferences } from '@/api/endpoints';
import { qk, useMe, useNotificationPrefs } from '@/api/queries';
import type { NotificationPreferences } from '@/api/types';
import { Button, ListRow, ListSection, LoadError, Notice, Screen, Sheet, Skeleton, SwitchRow, Text, useToast } from '@/components/ui';
import { getPushPermission, registerPushDevice, requestPushPermission, type PushPermission } from '@/lib/push';
import { colors, fonts, radius } from '@/theme/tokens';

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;

function deviceTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/** Push-Mitteilungen je Bereich + Ruhezeit (nachts keine Töne). Inhalte von Interessenten stehen nie auf dem Sperrbildschirm. */
export default function NotificationSettingsScreen() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useNotificationPrefs();
  const chatVisible = useMe().data?.features.visitorChat === true;
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [perm, setPerm] = useState<PushPermission>('undetermined');
  const [picker, setPicker] = useState<'start' | 'end' | null>(null);

  const refreshPerm = useCallback(() => void getPushPermission().then(setPerm), []);
  useEffect(() => {
    refreshPerm();
    const sub = AppState.addEventListener('change', s => s === 'active' && refreshPerm());
    return () => sub.remove();
  }, [refreshPerm]);
  useEffect(() => {
    if (!q.data) return;
    setPrefs(q.data);
    // Ruhezeit gilt in der Ortszeit des Geräts: Zeitzone einmal mitteilen, wenn sie abweicht
    const tz = deviceTimezone();
    if (tz && tz !== q.data.timezone) {
      saveNotificationPreferences({ timezone: tz })
        .then(saved => {
          setPrefs(saved);
          qc.setQueryData(qk.notificationPrefs, saved);
        })
        .catch(() => {});
    }
  }, [q.data, qc]);

  async function update(next: NotificationPreferences) {
    const prev = prefs;
    setPrefs(next);
    try {
      const saved = await saveNotificationPreferences({
        leads: next.leads,
        support: next.support,
        account: next.account,
        partner: next.partner,
        chat: next.chat,
        news: next.news,
        quietHours: next.quietHours,
      });
      setPrefs(saved);
      qc.setQueryData(qk.notificationPrefs, saved);
    } catch {
      setPrefs(prev);
      toast.show('Konnte nicht gespeichert werden.', 'error');
    }
  }

  async function enablePush() {
    if (perm === 'denied') {
      await Linking.openSettings();
      return;
    }
    const ok = await requestPushPermission();
    setPerm(ok ? 'granted' : 'denied');
    if (ok) void registerPushDevice();
  }

  return (
    <Screen readable>
      {perm !== 'granted' && (
        <Notice
          tone="warning"
          title="Mitteilungen sind aus"
          action={
            <Button
              title={perm === 'denied' ? 'Einstellungen öffnen' : 'Mitteilungen erlauben'}
              size="sm"
              style={{ alignSelf: 'flex-start', marginTop: 8 }}
              onPress={enablePush}
            />
          }>
          {perm === 'denied'
            ? 'Erlaube Mitteilungen in den Einstellungen deines Geräts, damit du neue Anfragen sofort siehst.'
            : 'Erlaube Mitteilungen, damit du neue Anfragen sofort siehst.'}
        </Notice>
      )}

      {q.isError && !prefs ? (
        <LoadError onRetry={() => void q.refetch()} />
      ) : !prefs ? (
        <Skeleton height={260} radius={radius.input} />
      ) : (
        <>
          <ListSection title="Mitteilungen bei" footer="Auf dem Sperrbildschirm zeigen wir nie Namen oder Nachrichten deiner Interessenten.">
            <SwitchRow
              title="Neuen Anfragen"
              subtitle="Jemand hat ein Formular auf deiner Seite ausgefüllt."
              value={prefs.leads}
              onValueChange={v => update({ ...prefs, leads: v })}
            />
            {chatVisible ? (
              <SwitchRow
                title="Chat"
                subtitle="Neue Nachrichten von Besuchern deiner Webseite."
                value={prefs.chat}
                onValueChange={v => update({ ...prefs, chat: v })}
              />
            ) : null}
            <SwitchRow
              title="Antworten vom Support"
              value={prefs.support}
              onValueChange={v => update({ ...prefs, support: v })}
            />
            <SwitchRow
              title="Deinen Webseiten und deinem Konto"
              subtitle="Zum Beispiel, wenn eine Domain verbunden ist."
              value={prefs.account}
              onValueChange={v => update({ ...prefs, account: v })}
            />
            <SwitchRow
              title="Partnerprogramm"
              subtitle="Neue Provisionen und Abrechnungen."
              value={prefs.partner}
              onValueChange={v => update({ ...prefs, partner: v })}
            />
            <SwitchRow
              title="Neuigkeiten von FinestSites"
              subtitle="Neue Funktionen und Aktionen von FinestSites"
              value={prefs.news}
              onValueChange={v => update({ ...prefs, news: v })}
            />
          </ListSection>

          <ListSection title="Ruhezeit" footer="In dieser Zeit kommen Mitteilungen ohne Ton. Du siehst sie am Morgen.">
            <SwitchRow
              title="Ruhezeit"
              value={prefs.quietHours.enabled}
              onValueChange={v => update({ ...prefs, quietHours: { ...prefs.quietHours, enabled: v } })}
            />
            {prefs.quietHours.enabled ? (
              <ListRow icon={Moon} title="Von" value={hourLabel(prefs.quietHours.start)} onPress={() => setPicker('start')} />
            ) : null}
            {prefs.quietHours.enabled ? (
              <ListRow icon={Moon} title="Bis" value={hourLabel(prefs.quietHours.end)} onPress={() => setPicker('end')} />
            ) : null}
          </ListSection>

          <Sheet visible={!!picker} onClose={() => setPicker(null)} title={picker === 'start' ? 'Ruhezeit ab' : 'Ruhezeit bis'}>
            <View style={styles.hours}>
              {HOURS.map(h => {
                const active = picker && prefs.quietHours[picker] === h;
                return (
                  <Pressable
                    key={h}
                    onPress={() => {
                      if (picker) void update({ ...prefs, quietHours: { ...prefs.quietHours, [picker]: h } });
                      setPicker(null);
                    }}
                    style={[styles.hour, active && styles.hourActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: !!active }}>
                    <Text style={[styles.hourText, active && { color: colors.white }]}>{hourLabel(h)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Sheet>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hours: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hour: {
    width: '23%',
    minHeight: 44,
    borderRadius: radius.buttonSmall,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hourActive: { backgroundColor: colors.ink },
  hourText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
});
