import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ExternalLink, Globe, Pencil, QrCode, Share2 } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type HostInstance } from 'react-native';

import type { Site } from '@/api/types';
import { Button, Card, Pill, Text } from '@/components/ui';
import { assetUrl, openInBrowser, siteUrlOf } from '@/lib/links';
import { shareLink } from '@/lib/share';
import { colors, fonts, radius } from '@/theme/tokens';

import { QrSheet } from './QrSheet';

export const STATUS_META = {
  published: { label: 'Online', tone: 'online' },
  draft: { label: 'Entwurf', tone: 'draft' },
  deactivated: { label: 'Offline', tone: 'offline' },
  deleted: { label: 'Offline', tone: 'offline' },
} as const;

/**
 * Eine Webseite = eine klar umrandete Karte wie im Dashboard: Vorschau 16:10, Status,
 * Name, Adresse, beschriftete Knöpfe. Antippen der Karte öffnet die Detailansicht.
 */
export function SiteCard({ site, highlight }: { site: Site; highlight?: boolean }) {
  const router = useRouter();
  const meta = STATUS_META[site.status];
  const { display, hasCustom, url } = siteUrlOf(site);
  const preview = assetUrl(site.templates?.preview_images?.[0]);
  const title = site.templates?.title ?? 'Meine Webseite';
  const isDraft = site.status === 'draft';
  const unread = site.unread_submissions ?? 0;
  const shareRef = useRef<HostInstance>(null);
  const [qrOpen, setQrOpen] = useState(false);

  const openDetail = () => router.push({ pathname: '/sites/[id]', params: { id: site.id } });

  return (
    <Card padded={false} highlight={highlight} style={styles.card}>
      <Pressable onPress={openDetail} accessibilityRole="button" accessibilityLabel={`${title} öffnen`}>
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
        <View style={styles.body}>
          <View style={styles.pills}>
            <Pill label={meta.label} tone={meta.tone} />
            {site.status === 'published' && site.has_unpublished_changes && <Pill label="Änderungen nicht online" tone="changes" />}
          </View>
          <Text variant="headline">{title}</Text>
          {display && (
            <Text variant="callout" color={hasCustom ? colors.success : colors.secondary} selectable>
              {display}
            </Text>
          )}
          {isDraft && <Text variant="callout">Noch nicht online. Nur du siehst diese Seite.</Text>}
          {site.status === 'deactivated' && (
            <Text variant="callout" color={colors.danger}>
              Diese Seite ist gerade nicht erreichbar.
            </Text>
          )}
        </View>
      </Pressable>

      <View style={styles.actions}>
        <Button
          title={isDraft ? 'Weiter bearbeiten' : 'Bearbeiten'}
          icon={Pencil}
          fullWidth
          onPress={() => router.push({ pathname: '/editor/[id]', params: { id: site.id } })}
        />
        {url && (
          <View style={styles.row}>
            <Button title="Ansehen" icon={ExternalLink} variant="secondary" style={styles.flex} onPress={() => openInBrowser(url)} />
            <Button
              ref={shareRef}
              title="Teilen"
              icon={Share2}
              variant="secondary"
              style={styles.flex}
              onPress={() => shareLink(url, shareRef, title)}
            />
            <Button title="QR" icon={QrCode} variant="secondary" style={styles.flex} onPress={() => setQrOpen(true)} accessibilityLabel="QR-Code" />
          </View>
        )}
      </View>
      {url && <QrSheet visible={qrOpen} onClose={() => setQrOpen(false)} url={url} title={title} />}
    </Card>
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
  },
  unreadText: { fontFamily: fonts.bold, fontSize: 12, color: colors.white },
  body: { paddingHorizontal: 16, paddingTop: 16, gap: 4 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  actions: { padding: 16, gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1, paddingHorizontal: 8 },
});
