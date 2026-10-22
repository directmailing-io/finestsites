import * as Device from 'expo-device';
import * as Linking from 'expo-linking';
import { Archive, ArchiveRestore, Flag, Mail, MessageCircle, Phone, ShieldBan, ShieldCheck, Trash2, type LucideIcon } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ActionSheetIOS, Alert, findNodeHandle, Platform, Pressable, StyleSheet, View, type HostInstance } from 'react-native';

import { useChatActions } from '@/api/queries';
import type { ChatConversation, ChatReportReason } from '@/api/types';
import { Button, Input, ListRow, ListSection, Sheet, SwitchRow, Text, useToast } from '@/components/ui';
import { callUrl, canCall, mailUrl } from '@/lib/links';
import { colors, fonts } from '@/theme/tokens';

import { dialable } from './helpers';

interface MenuItem {
  label: string;
  icon: LucideIcon;
  destructive?: boolean;
  run: () => void;
}

const REASONS: { key: ChatReportReason; label: string; hint: string }[] = [
  { key: 'spam', label: 'Spam oder Werbung', hint: 'Unerwünschte Nachrichten oder Links.' },
  { key: 'abuse', label: 'Beleidigung oder Belästigung', hint: 'Drohungen, Hass oder Belästigung.' },
  { key: 'illegal', label: 'Rechtswidriger Inhalt', hint: 'Betrug, verbotene Inhalte oder Ähnliches.' },
  { key: 'other', label: 'Etwas anderes', hint: 'Beschreib es kurz in der Notiz.' },
];

export const CHAT_ACTION_FAILED = 'Das hat leider nicht geklappt. Bitte versuche es nochmal.';

/**
 * Bestätigung „Gespräch löschen?“ – gleicher Text und Ablauf im „…“-Menü und beim Wegwischen.
 * onCancel: nach Abbrechen (Wisch-Zeile schließen). onError: nach Fehler (Toast zeigt diese Funktion selbst).
 */
export function confirmDelete(
  c: ChatConversation,
  actions: ReturnType<typeof useChatActions>,
  toast: ReturnType<typeof useToast>,
  opts: { onCancel?: () => void; onSuccess?: () => void; onError?: () => void } = {},
) {
  Alert.alert(
    'Gespräch löschen?',
    'Das Gespräch und alle Nachrichten werden endgültig gelöscht.',
    [
      { text: 'Abbrechen', style: 'cancel', onPress: opts.onCancel },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: () =>
          actions.remove.mutate(c.id, {
            onSuccess: () => {
              toast.show('Gespräch gelöscht', 'success');
              opts.onSuccess?.();
            },
            onError: () => {
              toast.show(CHAT_ACTION_FAILED, 'error');
              opts.onError?.();
            },
          }),
      },
    ],
    { cancelable: true, onDismiss: opts.onCancel },
  );
}

/**
 * „…“-Menü eines Gesprächs: Anrufen, E-Mail, WhatsApp (nur mit Daten), Archivieren/Wiederherstellen,
 * Besucher sperren/Sperre aufheben (Bestätigung), Melden (eigener Punkt, Apple/Google UGC), Gespräch löschen.
 * iOS: natives ActionSheet (am Knopf verankert, iPad). Android: Sheet mit Zeilen (Alert kann nur 3 Knöpfe).
 *
 * onLeave: nach Archivieren/Wiederherstellen/Löschen (iPhone: zurück zur Liste).
 */
export function useConversationMenu(c: ChatConversation | null, opts: { onLeave?: () => void; onDeleted?: () => void } = {}) {
  const actions = useChatActions();
  const toast = useToast();
  const anchorRef = useRef<HostInstance>(null);
  const [report, setReport] = useState(false);
  const [androidMenu, setAndroidMenu] = useState(false);
  const [phoneCapable, setPhoneCapable] = useState(false);

  useEffect(() => {
    void canCall().then(ok => setPhoneCapable(ok && Device.deviceType === Device.DeviceType.PHONE));
  }, []);

  const open = (url: string) => Linking.openURL(url).catch(() => toast.show('Konnte nicht geöffnet werden.', 'error'));
  const failed = () => toast.show(CHAT_ACTION_FAILED, 'error');

  const items = useMemo<MenuItem[]>(() => {
    if (!c) return [];
    const list: MenuItem[] = [];
    const phone = dialable(c.visitor.phone);
    if (phone && phoneCapable) list.push({ label: 'Anrufen', icon: Phone, run: () => void open(callUrl(phone)) });
    if (c.visitor.email) {
      const email = c.visitor.email;
      list.push({ label: 'E-Mail', icon: Mail, run: () => void open(mailUrl(email, `Dein Chat über ${c.siteTitle}`)) });
    }
    if (c.visitor.whatsappUrl) {
      const wa = c.visitor.whatsappUrl;
      list.push({ label: 'WhatsApp', icon: MessageCircle, run: () => void open(wa) });
    }
    if (c.status === 'archived') {
      list.push({
        label: 'Wiederherstellen',
        icon: ArchiveRestore,
        run: () => actions.unarchive.mutate(c.id, { onSuccess: () => { toast.show('Wiederhergestellt', 'success'); opts.onLeave?.(); }, onError: failed }),
      });
    } else if (c.status === 'open') {
      list.push({
        label: 'Archivieren',
        icon: Archive,
        run: () => actions.archive.mutate(c.id, { onSuccess: () => { toast.show('Archiviert', 'success'); opts.onLeave?.(); }, onError: failed }),
      });
    }
    if (c.status === 'blocked') {
      list.push({
        label: 'Sperre aufheben',
        icon: ShieldCheck,
        run: () => actions.unblock.mutate(c.id, { onSuccess: () => toast.show('Sperre aufgehoben', 'success'), onError: failed }),
      });
    } else {
      list.push({
        label: 'Besucher sperren',
        icon: ShieldBan,
        run: () =>
          Alert.alert('Besucher sperren?', 'Der Besucher kann dir auf keiner deiner Webseiten mehr schreiben. Du kannst die Sperre jederzeit aufheben.', [
            { text: 'Abbrechen', style: 'cancel' },
            { text: 'Sperren', style: 'destructive', onPress: () => actions.block.mutate(c.id, { onSuccess: () => toast.show('Besucher gesperrt', 'success'), onError: failed }) },
          ]),
      });
    }
    list.push({ label: c.reportedAt ? 'Erneut melden' : 'Melden', icon: Flag, run: () => setReport(true) });
    list.push({
      label: 'Gespräch löschen',
      icon: Trash2,
      destructive: true,
      run: () =>
        confirmDelete(c, actions, toast, {
          onSuccess: () => {
            opts.onDeleted?.();
            opts.onLeave?.();
          },
        }),
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, phoneCapable]);

  const openMenu = () => {
    if (!c || items.length === 0) return;
    if (Platform.OS === 'ios') {
      const tag = anchorRef.current ? findNodeHandle(anchorRef.current) : null;
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: c.visitor.displayName,
          options: [...items.map(i => i.label), 'Abbrechen'],
          cancelButtonIndex: items.length,
          destructiveButtonIndex: items.findIndex(i => i.destructive),
          anchor: tag ?? undefined,
        },
        i => {
          if (i < items.length) items[i].run();
        },
      );
    } else {
      setAndroidMenu(true);
    }
  };

  const sheets = c ? (
    <>
      {Platform.OS !== 'ios' && (
        <Sheet visible={androidMenu} onClose={() => setAndroidMenu(false)} title={c.visitor.displayName} subtitle={c.siteTitle}>
          <ListSection>
            {items.map(i => (
              <ListRow
                key={i.label}
                icon={i.icon}
                title={i.label}
                destructive={i.destructive}
                chevron={false}
                onPress={() => {
                  setAndroidMenu(false);
                  // erst schließen, dann Alert/Sheet der Aktion öffnen
                  setTimeout(i.run, 250);
                }}
              />
            ))}
          </ListSection>
        </Sheet>
      )}
      <ReportSheet
        visible={report}
        onClose={() => setReport(false)}
        loading={actions.report.isPending}
        onSubmit={(reason, note, block) =>
          actions.report.mutate(
            { id: c.id, reason, note: note || undefined, block },
            {
              onSuccess: () => {
                setReport(false);
                toast.show(block ? 'Gemeldet und gesperrt. Danke für den Hinweis.' : 'Gemeldet. Danke für den Hinweis.', 'success');
              },
              onError: failed,
            },
          )
        }
      />
    </>
  ) : null;

  return { openMenu, sheets, anchorRef, hasItems: items.length > 0 };
}

/** Melden: Grund wählen, Notiz optional, zusätzlich sperren (Standard an). */
function ReportSheet({
  visible,
  onClose,
  loading,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  loading: boolean;
  onSubmit: (reason: ChatReportReason, note: string, block: boolean) => void;
}) {
  const [reason, setReason] = useState<ChatReportReason | null>(null);
  const [note, setNote] = useState('');
  const [block, setBlock] = useState(true);

  useEffect(() => {
    if (visible) {
      setReason(null);
      setNote('');
      setBlock(true);
    }
  }, [visible]);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Gespräch melden"
      subtitle="Wir schauen uns das innerhalb von 24 Stunden an. Der Verlauf geht als Kopie an FinestSites."
      footer={
        <View style={{ gap: 8, paddingBottom: 4 }}>
          <Button title="Melden" onPress={() => reason && onSubmit(reason, note.trim(), block)} disabled={!reason} loading={loading} fullWidth />
          <Button title="Abbrechen" variant="link" onPress={onClose} />
        </View>
      }>
      <ListSection title="Grund">
        {REASONS.map(r => (
          <ListRow
            key={r.key}
            title={r.label}
            subtitle={r.hint}
            chevron={false}
            onPress={() => setReason(r.key)}
            accessibilityHint={reason === r.key ? 'Ausgewählt' : 'Auswählen'}
            right={
              <View style={[styles.radio, reason === r.key && styles.radioOn]} accessibilityElementsHidden>
                {reason === r.key && <View style={styles.radioDot} />}
              </View>
            }
          />
        ))}
      </ListSection>
      <Input
        label="Notiz (optional)"
        value={note}
        onChangeText={t => setNote(t.slice(0, 500))}
        placeholder="Was ist passiert?"
        multiline
        multilineHeight={88}
        hint={`${note.length}/500`}
      />
      <ListSection footer="Gesperrte Besucher können dir auf keiner deiner Webseiten mehr schreiben.">
        <SwitchRow title="Besucher zusätzlich sperren" value={block} onValueChange={setBlock} />
      </ListSection>
      <Text style={styles.legal}>Melde nur Inhalte, die gegen Regeln oder Gesetze verstoßen. Deine Meldung wird vertraulich behandelt.</Text>
    </Sheet>
  );
}

/** Knopf „…“ für die native Kopfzeile (iPhone). */
export function MenuButton({ onPress, anchorRef }: { onPress: () => void; anchorRef: RefObject<HostInstance | null> }) {
  return (
    <Pressable
      ref={anchorRef}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.menuBtn, pressed && { backgroundColor: colors.muted }]}
      accessibilityRole="button"
      accessibilityLabel="Mehr Aktionen">
      <Text style={styles.menuDots} accessibilityElementsHidden>
        •••
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.hairline, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.ink },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.ink },
  legal: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.tertiary, paddingHorizontal: 4 },
  menuBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  menuDots: { fontFamily: fonts.bold, fontSize: 13, letterSpacing: 1, color: colors.ink },
});
