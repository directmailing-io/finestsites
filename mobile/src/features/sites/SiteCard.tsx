import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Check, Copy, ExternalLink, Globe, PenLine, QrCode } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { humanError } from '@/api/client';
import { deleteSite } from '@/api/endpoints';
import { qk } from '@/api/queries';
import type { Site } from '@/api/types';
import { Card, Pill, Text, useToast } from '@/components/ui';
import { useCopyState } from '@/lib/clipboard';
import { assetUrl, openInBrowser, siteUrlOf } from '@/lib/links';
import { colors, fonts, radius } from '@/theme/tokens';

import { QrSheet } from './QrSheet';

export const STATUS_META = {
  published: { label: 'Online', tone: 'online' },
  draft: { label: 'Entwurf', tone: 'draft' },
  deactivated: { label: 'Offline', tone: 'offline' },
  deleted: { label: 'Offline', tone: 'offline' },
} as const;

/**
 * Eine Webseite = eine Karte exakt wie im Web-Dashboard (src/app/(dashboard)/sites/page.tsx, SiteCard):
 * Vorschau 16:10 (Antippen öffnet den Editor), Status, Name, Adresse, „Bearbeiten“, darunter für
 * Live-Seiten „Seite ansehen“, „Link kopieren“, „QR-Code speichern“, bei Entwürfen „Entwurf löschen“.
 */
export function SiteCard({ site, highlight }: { site: Site; highlight?: boolean }) {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const meta = STATUS_META[site.status];
  const { display, hasCustom, url } = siteUrlOf(site);
  // wie im Web: Vorschaubild der Vorlage, sonst Bildschirmfoto der Live-Seite
  const preview = assetUrl(site.templates?.preview_images?.[0]) ?? (url ? `https://image.thum.io/get/width/800/crop/500/${url}` : null);
  const title = site.templates?.title ?? 'Meine Webseite';
  const isDraft = site.status === 'draft';
  const unread = site.unread_submissions ?? 0;
  const [qrOpen, setQrOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { state: copyState, copy } = useCopyState();

  const openEditor = () => router.push({ pathname: '/editor/[id]', params: { id: site.id } });

  const remove = useMutation({
    mutationFn: () => deleteSite(site.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.sites });
      void qc.invalidateQueries({ queryKey: qk.overview });
    },
    onError: e => {
      setConfirmDelete(false);
      toast.show(humanError(e), 'error');
    },
  });

  async function copyLink() {
    if (!url) return;
    if (await copy(url)) toast.show('Link kopiert', 'success');
  }

  const bodyPad = width >= 640 ? 20 : 16;
  const copied = copyState === 'copied';

  return (
    <Card padded={false} highlight={highlight} style={styles.card}>
      <Pressable onPress={openEditor} accessibilityRole="button" accessibilityLabel={`${title} bearbeiten`}>
        <View style={styles.preview}>
          {preview ? (
            <Image source={{ uri: preview }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" transition={150} />
          ) : (
            <View style={styles.placeholder}>
              <Globe size={36} color={colors.hairline} strokeWidth={1.5} />
            </View>
          )}
          {unread > 0 && (
            <View style={styles.unread}>
              <Text style={styles.unreadText}>
                {unread} neue Anfrage{unread === 1 ? '' : 'n'}
              </Text>
            </View>
          )}
        </View>
      </Pressable>

      <View style={[styles.body, { padding: bodyPad }]}>
        <View>
          <View style={styles.pills}>
            <Pill label={meta.label} tone={meta.tone} />
            {site.status === 'published' && site.has_unpublished_changes && <Pill label="Änderungen nicht online" tone="changes" />}
          </View>
          <Text style={styles.title}>{title}</Text>
          {display && (
            <Text style={[styles.url, { color: hasCustom ? colors.success : colors.secondary }]} selectable>
              {display}
            </Text>
          )}
          {isDraft && <Text style={styles.note}>Noch nicht online. Nur du siehst diese Seite.</Text>}
          {site.status === 'deactivated' && <Text style={[styles.note, { color: colors.danger }]}>Diese Seite ist gerade nicht erreichbar.</Text>}
        </View>

        {/* Hauptaktion – immer gleich, immer ein echter Knopf */}
        <Pressable
          onPress={openEditor}
          accessibilityRole="button"
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
          <PenLine size={17} color={colors.white} strokeWidth={2.25} />
          <Text style={styles.primaryText}>{isDraft ? 'Weiter bearbeiten' : 'Bearbeiten'}</Text>
        </Pressable>

        {/* Live-Seite: ansehen + teilen */}
        {url && (
          <View style={styles.wrap}>
            <SecondaryButton icon={<ExternalLink size={16} color={colors.ink} strokeWidth={2} />} label="Seite ansehen" onPress={() => openInBrowser(url)} />
            <SecondaryButton
              icon={copied ? <Check size={16} color={colors.success} strokeWidth={2.5} /> : <Copy size={16} color={colors.ink} strokeWidth={2} />}
              label={copied ? 'Link kopiert' : copyState === 'failed' ? 'Kopieren fehlgeschlagen' : 'Link kopieren'}
              done={copied}
              onPress={copyLink}
            />
            <SecondaryButton icon={<QrCode size={16} color={colors.ink} strokeWidth={2} />} label="QR-Code speichern" onPress={() => setQrOpen(true)} />
          </View>
        )}

        {/* Entwurf: kann wieder entfernt werden (zweistufig) */}
        {isDraft &&
          (confirmDelete ? (
            <View style={styles.confirm}>
              <Text style={styles.confirmText}>Diesen Entwurf wirklich löschen?</Text>
              <View style={styles.wrap}>
                <Pressable
                  onPress={() => remove.mutate()}
                  disabled={remove.isPending}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.confirmBtn, styles.confirmYes, (pressed || remove.isPending) && { opacity: 0.6 }]}>
                  <Text style={styles.confirmYesText}>{remove.isPending ? 'Wird gelöscht…' : 'Ja, löschen'}</Text>
                </Pressable>
                <Pressable
                  onPress={() => setConfirmDelete(false)}
                  disabled={remove.isPending}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.confirmBtn, styles.confirmNo, pressed && { opacity: 0.7 }]}>
                  <Text style={styles.confirmNoText}>Abbrechen</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable onPress={() => setConfirmDelete(true)} accessibilityRole="button" style={styles.deleteLink} hitSlop={6}>
              <Text style={styles.deleteLinkText}>Entwurf löschen</Text>
            </Pressable>
          ))}
      </View>
      {url && <QrSheet visible={qrOpen} onClose={() => setQrOpen(false)} url={url} title={title} />}
    </Card>
  );
}

function SecondaryButton({ icon, label, onPress, done }: { icon: React.ReactNode; label: string; onPress: () => void; done?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.secondary, done && { backgroundColor: colors.successSoft }, pressed && { opacity: 0.85 }]}>
      {icon}
      <Text numberOfLines={1} style={[styles.secondaryText, done && { color: colors.success }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  preview: { aspectRatio: 16 / 10, backgroundColor: colors.muted, borderBottomWidth: 1, borderBottomColor: colors.borderCard },
  placeholder: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSoft },
  unread: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: colors.unreadBadge,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    shadowColor: colors.unreadBadge,
    shadowOpacity: 0.4,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  unreadText: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16, color: colors.white },
  body: { gap: 12 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  title: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 25, color: colors.ink },
  url: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, marginTop: 2 },
  note: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, marginTop: 6, color: colors.secondary },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: radius.button,
    backgroundColor: colors.ink,
  },
  pressed: { transform: [{ scale: 0.98 }] },
  primaryText: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.white },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  secondary: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 150,
    // wie whitespace-nowrap im Web: Knopf bricht in die nächste Zeile statt den Text abzuschneiden
    minWidth: 150,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.button,
    backgroundColor: colors.surfaceSoft,
  },
  secondaryText: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18, color: colors.ink, flexShrink: 1 },
  confirm: { gap: 8, borderRadius: radius.input, padding: 12, backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.dangerBorder },
  confirmText: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: colors.dangerInk },
  confirmBtn: { flexGrow: 1, flexShrink: 1, flexBasis: 120, minHeight: 44, paddingHorizontal: 12, borderRadius: radius.buttonSmall, alignItems: 'center', justifyContent: 'center' },
  confirmYes: { backgroundColor: colors.dangerStrong },
  confirmYesText: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
  confirmNo: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  confirmNoText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  deleteLink: { alignSelf: 'center', minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
  deleteLinkText: { fontFamily: fonts.medium, fontSize: 14, color: colors.secondary, textDecorationLine: 'underline' },
});
