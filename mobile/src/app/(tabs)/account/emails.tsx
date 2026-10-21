import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { updateProfile } from '@/api/endpoints';
import { qk, useMe } from '@/api/queries';
import type { EmailCategoryKey } from '@/api/types';
import { ListSection, Screen, Skeleton, SwitchRow, Text, useToast } from '@/components/ui';
import { radius } from '@/theme/tokens';

/**
 * E-Mail-Kategorien wie src/lib/email/categories.ts. Für die App neutral formuliert:
 * keine Wörter zu Rechnungen oder Zahlungen.
 */
const CATEGORIES: { key: EmailCategoryKey; label: string; description: string; locked?: boolean }[] = [
  { key: 'system', label: 'Konto und Sicherheit', description: 'Passwort, Status deiner Seite und wichtige Hinweise zu deinem Konto. Kommt immer.', locked: true },
  { key: 'updates', label: 'Neues bei FinestSites', description: 'Neue Vorlagen, neue Funktionen und Verbesserungen.' },
  { key: 'tips', label: 'Tipps und Anleitungen', description: 'Ideen, wie du mehr aus deiner Seite holst, Schritt für Schritt erklärt.' },
  { key: 'offers', label: 'Aktionen', description: 'Hinweise auf Aktionen von FinestSites.' },
];

export default function EmailsScreen() {
  return (
    <Screen readable>
      <Text variant="callout">Du entscheidest, welche Mails du von uns bekommst. Von Anfang an ist alles an.</Text>
      <EmailsContent />
    </Screen>
  );
}

/** Inhalt des Web-Tabs „E-Mails“ (Einstellungen). */
export function EmailsContent() {
  const qc = useQueryClient();
  const toast = useToast();
  const me = useMe();
  const [optOut, setOptOut] = useState<EmailCategoryKey[] | null>(null);
  useEffect(() => {
    if (me.data) setOptOut(me.data.emailOptOut);
  }, [me.data]);

  async function toggle(key: EmailCategoryKey, on: boolean) {
    if (!optOut) return;
    const prev = optOut;
    const next = on ? optOut.filter(k => k !== key) : [...optOut, key];
    setOptOut(next);
    try {
      await updateProfile({ email_opt_out: next });
      void qc.invalidateQueries({ queryKey: qk.me });
      toast.show('Gespeichert.', 'success');
    } catch {
      setOptOut(prev);
      toast.show('Konnte nicht gespeichert werden.', 'error');
    }
  }

  return (
    <View>
      {!optOut ? (
        <Skeleton height={280} radius={radius.input} />
      ) : (
        <ListSection footer="Alles außer „Konto und Sicherheit“ kannst du hier oder unten in jeder Mail abbestellen.">
          {CATEGORIES.map(c => (
            <SwitchRow
              key={c.key}
              title={c.label}
              subtitle={c.description}
              badge={c.locked ? 'Immer an' : undefined}
              disabled={c.locked}
              value={!!c.locked || !optOut.includes(c.key)}
              onValueChange={v => toggle(c.key, v)}
            />
          ))}
        </ListSection>
      )}
    </View>
  );
}
