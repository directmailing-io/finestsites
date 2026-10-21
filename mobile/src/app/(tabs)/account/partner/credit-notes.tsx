import { Directory, File, Paths } from 'expo-file-system';
import { FileText, Share2 } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type HostInstance } from 'react-native';

import { baseHeaders } from '@/api/client';
import { creditNotePdfPath } from '@/api/endpoints';
import { useCreditNotes } from '@/api/queries';
import type { CreditNote } from '@/api/types';
import { EmptyState, LoadError, Pill, Screen, Skeleton, Text, useToast } from '@/components/ui';
import { API_BASE, MOCK } from '@/lib/config';
import { euros, fmtDate } from '@/lib/format';
import { shareFile } from '@/lib/share';
import { colors, fonts, radius } from '@/theme/tokens';

/** PDF mit Bearer laden (nie über einen Browser ohne Anmeldung) und im Zwischenspeicher ablegen. */
async function downloadPdf(note: CreditNote): Promise<File> {
  const dir = new Directory(Paths.cache, 'gutschriften');
  if (!dir.exists) dir.create({ intermediates: true });
  const target = new File(dir, `${note.number}.pdf`);
  if (MOCK) {
    // Beispielmodus: kleine Platzhalter-PDF, damit Vorschau und Teilen geprüft werden können
    await target.write(MOCK_PDF, { encoding: 'base64' });
    return target;
  }
  return File.downloadFileAsync(`${API_BASE}${creditNotePdfPath(note.id)}`, target, { headers: baseHeaders(), idempotent: true });
}

export default function CreditNotesScreen() {
  const q = useCreditNotes();
  const items = q.data?.items ?? [];
  return (
    <Screen readable refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Text variant="callout">Für jede Abrechnung bekommst du eine Gutschrift. Stimmt etwas nicht, sag uns bitte innerhalb von 4 Wochen Bescheid.</Text>
      {q.isError && !q.data ? (
        <LoadError onRetry={() => void q.refetch()} />
      ) : q.isLoading ? (
        <Skeleton height={140} radius={radius.input} />
      ) : items.length === 0 ? (
        <EmptyState icon={FileText} title="Noch keine Gutschriften" text="Nach deiner ersten Abrechnung findest du sie hier." />
      ) : (
        <View style={styles.group}>
          {items.map((n, i) => (
            <NoteRow key={n.id} note={n} first={i === 0} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function NoteRow({ note, first }: { note: CreditNote; first: boolean }) {
  const toast = useToast();
  const shareRef = useRef<HostInstance>(null);
  const [busy, setBusy] = useState<'open' | 'share' | null>(null);

  async function open() {
    setBusy('open');
    try {
      const file = await downloadPdf(note);
      await File.preview(file, { title: note.number, mimeType: 'application/pdf' });
    } catch {
      toast.show('PDF konnte nicht geöffnet werden.', 'error');
    }
    setBusy(null);
  }
  async function share() {
    setBusy('share');
    try {
      const file = await downloadPdf(note);
      await shareFile(file.uri, shareRef, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', title: note.number });
    } catch {
      toast.show('PDF konnte nicht geteilt werden.', 'error');
    }
    setBusy(null);
  }

  return (
    <View style={[styles.row, !first && styles.border]}>
      <Pressable onPress={open} disabled={!note.ready || !!busy} style={styles.main} accessibilityRole="button" accessibilityLabel={`Gutschrift ${note.number} öffnen`}>
        <View style={styles.icon}>
          <FileText size={18} color={colors.ink} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.number}>{note.number}</Text>
          <Text variant="callout">
            {fmtDate(note.date)} · {note.method === 'credit' ? 'Verrechnet' : 'Ausgezahlt'}
          </Text>
        </View>
        <Text style={styles.amount}>{euros(note.amount_cents)}</Text>
      </Pressable>
      {note.ready ? (
        <Pressable ref={shareRef} onPress={share} disabled={!!busy} style={styles.share} accessibilityRole="button" accessibilityLabel="PDF teilen">
          <Share2 size={18} color={busy === 'share' ? colors.faint : colors.ink} />
        </Pressable>
      ) : (
        <Pill label="Wird erstellt" tone="neutral" />
      )}
    </View>
  );
}

// Winzige gültige PDF-Datei (eine leere Seite) für den Beispielmodus
const MOCK_PDF =
  'JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA1OTUgODQyXSA+PgplbmRvYmoKdHJhaWxlcgo8PCAvUm9vdCAxIDAgUiA+PgolJUVPRgo=';

const styles = StyleSheet.create({
  group: { backgroundColor: colors.white, borderRadius: radius.input, borderWidth: 1.5, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingRight: 8 },
  border: { borderTopWidth: 1, borderTopColor: colors.divider },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  icon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  number: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  amount: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  share: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
});
