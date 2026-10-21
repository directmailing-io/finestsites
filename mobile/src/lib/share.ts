/**
 * Teilen mit Ankerpunkt. Auf dem iPad stürzt ein Teilen-Fenster ohne Anker ab
 * (häufigster Ablehnungsgrund) – deshalb geht JEDES Teilen über diese Datei.
 */
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { findNodeHandle, Platform, Share, type HostInstance } from 'react-native';

export type AnchorRef = RefObject<HostInstance | null>;

function measure(ref: AnchorRef): Promise<{ x: number; y: number; width: number; height: number } | undefined> {
  return new Promise(resolve => {
    const node = ref.current;
    if (!node) return resolve(undefined);
    node.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
  });
}

/** Link teilen (Seite, Empfehlungslink). */
export async function shareLink(url: string, anchor: AnchorRef, title?: string) {
  const tag = anchor.current ? findNodeHandle(anchor.current) : null;
  await Share.share(
    Platform.OS === 'ios' ? { url, title } : { message: url, title },
    { anchor: tag ?? undefined, dialogTitle: title, subject: title },
  ).catch(() => {});
}

/** Datei teilen (QR-Code-Bild, Gutschrift-PDF). */
export async function shareFile(fileUri: string, anchor: AnchorRef, opts: { mimeType: string; UTI?: string; title?: string }) {
  if (!(await Sharing.isAvailableAsync())) return false;
  const rect = await measure(anchor);
  await Sharing.shareAsync(fileUri, { mimeType: opts.mimeType, UTI: opts.UTI, dialogTitle: opts.title, anchor: rect }).catch(
    () => {},
  );
  return true;
}
