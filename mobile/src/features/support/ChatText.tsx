import type { ReactNode } from 'react';
import { Text as RNText, type TextStyle } from 'react-native';

import { Text } from '@/components/ui';
import { fonts } from '@/theme/tokens';

/**
 * Port von src/components/support/ChatText.tsx: Zeilenumbrüche bleiben, bei Support-Nachrichten
 * wird **fett** und *kursiv* dargestellt. Nur Text-Knoten, nie HTML.
 */
const FORMAT_RE = /\*\*(?=\S)([^\n]*?\S)\*\*|\*(?=[^\s*])([^*\n]*?[^\s*])\*/g;

export function ChatText({ text, formatted, style }: { text: string; formatted?: boolean; style?: TextStyle }) {
  return (
    <Text style={style} selectable>
      {formatted ? formatNodes(text) : text}
    </Text>
  );
}

function formatNodes(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(FORMAT_RE)) {
    const start = m.index ?? 0;
    if (start > last) nodes.push(text.slice(last, start));
    if (m[1] !== undefined) {
      nodes.push(
        <RNText key={key++} style={{ fontFamily: fonts.bold }}>
          {m[1]}
        </RNText>,
      );
    } else {
      nodes.push(
        <RNText key={key++} style={{ fontStyle: "italic" }}>
          {m[2]}
        </RNText>,
      );
    }
    last = start + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function chatPreviewText(text: string, formatted?: boolean): string {
  const plain = formatted ? text.replace(FORMAT_RE, (_m, bold, italic) => bold ?? italic) : text;
  return plain.replace(/\s*\n\s*/g, ' ');
}
