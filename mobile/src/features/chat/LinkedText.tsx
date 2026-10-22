import * as Linking from 'expo-linking';
import type { ReactNode } from 'react';
import { Text as RNText, type TextStyle } from 'react-native';

import { Text, useToast } from '@/components/ui';
import { openInBrowser } from '@/lib/links';
import { fonts } from '@/theme/tokens';

/**
 * Nachrichtentext mit anklickbaren Links (http/https, www., E-Mail). Nur Text-Knoten, nie HTML
 * (Ergänzung zu ChatText, das die Support-Formatierung fett und kursiv übernimmt).
 * Webadressen öffnen im Safari-Fenster, E-Mail-Adressen im Mail-Programm.
 */
const LINK_RE = /(https?:\/\/[^\s<>"'„“]+|www\.[^\s<>"'„“]+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)/gi;
const TRAILING = /[.,;:!?)\]]+$/;

export function LinkedText({ text, style, linkColor }: { text: string; style?: TextStyle; linkColor: string }) {
  const toast = useToast();

  const open = async (raw: string) => {
    try {
      if (raw.includes('@') && !/^https?:\/\//i.test(raw)) {
        const ok = await Linking.openURL(`mailto:${raw}`).then(() => true).catch(() => false);
        if (!ok) toast.show('Kein Mail-Programm gefunden.', 'error');
        return;
      }
      await openInBrowser(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    } catch {
      toast.show('Link konnte nicht geöffnet werden.', 'error');
    }
  };

  return <Text style={style}>{splitLinks(text, linkColor, open)}</Text>;
}

function splitLinks(text: string, linkColor: string, open: (raw: string) => void): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(LINK_RE)) {
    const start = m.index ?? 0;
    let raw = m[0];
    const trail = raw.match(TRAILING)?.[0] ?? '';
    raw = raw.slice(0, raw.length - trail.length);
    if (start > last) nodes.push(text.slice(last, start));
    nodes.push(
      <RNText
        key={key++}
        onPress={() => open(raw)}
        accessibilityRole="link"
        style={{ color: linkColor, fontFamily: fonts.medium, textDecorationLine: 'underline' }}>
        {raw}
      </RNText>,
    );
    if (trail) nodes.push(trail);
    last = start + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}
