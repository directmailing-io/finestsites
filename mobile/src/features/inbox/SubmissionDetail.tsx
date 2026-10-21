import * as Device from 'expo-device';
import { Archive, ArchiveRestore, Mail, MailOpen, MessageCircle, Phone, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { useSubmissionActions } from '@/api/queries';
import type { Submission } from '@/api/types';
import { Button, InitialsAvatar, Pill, Text, useToast } from '@/components/ui';
import { fullDate } from '@/lib/format';
import { callUrl, canCall, mailUrl, openExternal, whatsappUrl } from '@/lib/links';
import { colors, fonts, radius } from '@/theme/tokens';

import { contactInfo, formLabel, isLongValue, processFields } from './helpers';

/**
 * Anfrage-Ansicht: Kopf wie das Web-Fenster (Avatar 56, Name, Datum, Pills), darunter
 * die Kontaktwege als große Knöpfe (Anrufen nur, wenn das Gerät telefonieren kann),
 * dann alle Felder, unten Löschen / Als ungelesen / Archivieren.
 */
export function SubmissionDetail({ submission, onRemoved }: { submission: Submission; onRemoved?: () => void }) {
  const toast = useToast();
  const { update, remove } = useSubmissionActions();
  const [phoneCapable, setPhoneCapable] = useState(false);
  const [local, setLocal] = useState(submission);
  useEffect(() => setLocal(submission), [submission]);

  useEffect(() => {
    void canCall().then(ok => setPhoneCapable(ok && Device.deviceType === Device.DeviceType.PHONE));
  }, []);

  // Beim Öffnen als gelesen markieren
  useEffect(() => {
    if (!submission.read_at) update.mutate({ siteId: submission.user_site_id, id: submission.id, read: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submission.id]);

  const { name, phone, email } = contactInfo(local.data);
  const fields = processFields(local.data);
  const archived = !!local.archived_at;
  const subject = `Deine Anfrage${local.site ? ` über ${local.site.title}` : ''}`;

  return (
    <View style={{ gap: 20 }}>
      <View style={styles.header}>
        <InitialsAvatar name={name} size={56} />
        <View style={{ flex: 1, gap: 4, paddingTop: 2 }}>
          <Text variant="title" numberOfLines={2} selectable>
            {name}
          </Text>
          <Text variant="callout" color={colors.tertiary}>
            {fullDate(local.created_at)}
          </Text>
          <View style={styles.pills}>
            <Pill label={formLabel(local.form_name)} tone="neutral" />
            {local.site && <Pill label={local.site.title} tone="neutral" />}
            {archived && <Pill label="Archiviert" tone="archived" />}
          </View>
        </View>
      </View>

      {(phone || email) && (
        <View style={styles.contact}>
          {phone && phoneCapable && (
            <Button title="Anrufen" icon={Phone} style={styles.contactBtn} onPress={() => openExternal(callUrl(phone))} />
          )}
          {phone && (
            <Button
              title="WhatsApp"
              icon={MessageCircle}
              variant="success"
              style={styles.contactBtn}
              onPress={() => openExternal(whatsappUrl(phone))}
            />
          )}
          {email && (
            <Button title="E-Mail" icon={Mail} variant="secondary" style={styles.contactBtn} onPress={() => openExternal(mailUrl(email, subject))} />
          )}
        </View>
      )}

      <View style={styles.fields}>
        {fields.map(f => (
          <View key={f.key} style={[styles.field, isLongValue(f.value) && styles.fieldWide]}>
            <Text variant="overline">{f.label}</Text>
            {f.value ? (
              <Text style={styles.value} selectable>
                {f.value}
              </Text>
            ) : (
              <Text style={[styles.value, { color: colors.hairline, fontStyle: 'italic' }]}>Leer</Text>
            )}
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <Button
          title="Löschen"
          icon={Trash2}
          variant="dangerText"
          size="sm"
          onPress={() =>
            Alert.alert('Anfrage löschen?', 'Die Anfrage wird endgültig gelöscht.', [
              { text: 'Abbrechen', style: 'cancel' },
              {
                text: 'Löschen',
                style: 'destructive',
                onPress: () =>
                  remove.mutate(
                    { siteId: local.user_site_id, id: local.id },
                    {
                      onSuccess: () => {
                        toast.show('Anfrage gelöscht', 'success');
                        onRemoved?.();
                      },
                    },
                  ),
              },
            ])
          }
        />
        <View style={{ flex: 1 }} />
        <Button
          title="Als ungelesen"
          icon={MailOpen}
          variant="muted"
          size="sm"
          disabled={!local.read_at}
          onPress={() => {
            setLocal(l => ({ ...l, read_at: null }));
            update.mutate({ siteId: local.user_site_id, id: local.id, read: false });
            toast.show('Als ungelesen markiert');
          }}
        />
        <Button
          title={archived ? 'Wiederherstellen' : 'Archivieren'}
          icon={archived ? ArchiveRestore : Archive}
          size="sm"
          onPress={() => {
            update.mutate({ siteId: local.user_site_id, id: local.id, archived: !archived });
            toast.show(archived ? 'Wiederhergestellt' : 'Archiviert', 'success');
            onRemoved?.();
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  contact: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  contactBtn: { flexGrow: 1, flexBasis: 110 },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  field: {
    flexGrow: 1,
    flexBasis: 220,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.input,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  fieldWide: { flexBasis: '100%' },
  value: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: colors.ink },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
});
