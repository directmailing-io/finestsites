import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { ArrowUp, ImagePlus } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { markConversationRead, sendMessage, startConversation, uploadSupportImage } from '@/api/endpoints';
import { qk, useMessages } from '@/api/queries';
import type { Message } from '@/api/types';
import { Text, useToast } from '@/components/ui';
import { chatTime } from '@/lib/format';
import { useKeyboardInset } from '@/lib/keyboard';
import { shouldPrimePush } from '@/lib/push';
import { colors, fonts, radius } from '@/theme/tokens';

import { ChatText } from './ChatText';
import { ImpersonationCard } from './ImpersonationCard';

/**
 * Support-Chat (wie SupportChat.tsx): Blasen schwarz (du) / grau (Support), Bilder, Freigabe-Karte.
 * conversationId = null → neues Gespräch, das mit der ersten Nachricht entsteht.
 */
export function ChatThread({
  conversationId,
  onCreated,
  bottomInset = 0,
}: {
  conversationId: string | null;
  onCreated: (id: string) => void;
  bottomInset?: number;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const q = useMessages(conversationId);
  const [pending, setPending] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  // In den Tabs enthält der untere Sicherheitsabstand schon die (schwebende) Tab-Leiste – das Eingabefeld
  // sitzt darüber statt dahinter. Mit offener Tastatur sitzt es direkt über der Tastatur.
  const insets = useSafeAreaInsets();
  const tabBarSpace = insets.bottom;
  // Tastatur-Abstand gemessen statt fester keyboardVerticalOffset=90 (siehe lib/keyboard)
  const kb = useKeyboardInset();
  const keyboard = kb.visible;
  const scrollRef = useRef<ScrollViewInstance>(null);

  const messages = [...(q.data?.messages ?? []), ...pending.filter(p => !(q.data?.messages ?? []).some(m => m.id === p.id))];
  const closed = q.data?.conversationStatus === 'closed';

  useEffect(() => {
    if (!conversationId) return;
    void markConversationRead(conversationId).catch(() => {});
    void qc.invalidateQueries({ queryKey: qk.conversations });
    void qc.invalidateQueries({ queryKey: qk.overview });
  }, [conversationId, qc, q.data?.messages.length]);

  async function send(payload: { content: string; contentType: 'text' | 'image'; mediaUrl?: string }) {
    const temp: Message = {
      id: `temp-${Date.now()}`,
      conversationId: conversationId ?? '',
      senderType: 'user',
      senderId: null,
      content: payload.content,
      contentType: payload.contentType,
      mediaUrl: payload.mediaUrl ?? null,
      createdAt: new Date().toISOString(),
    };
    setPending(p => [...p, temp]);
    try {
      const firstEver = (qc.getQueryData<{ conversations: unknown[] }>(qk.conversations)?.conversations.length ?? 0) === 0;
      if (!conversationId) {
        const res = await startConversation(payload);
        setPending([]);
        void qc.invalidateQueries({ queryKey: qk.conversations });
        onCreated(res.conversation.id);
      } else {
        await sendMessage({ conversationId, ...payload });
        await q.refetch();
        setPending(p => p.filter(m => m.id !== temp.id));
      }
      if (firstEver && (await shouldPrimePush())) router.push({ pathname: '/push-priming', params: { reason: 'support' } });
    } catch {
      setPending(p => p.filter(m => m.id !== temp.id));
      toast.show('Nachricht konnte nicht gesendet werden.', 'error');
      if (payload.contentType === 'text') setInput(payload.content);
    }
  }

  async function sendText() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput('');
    await send({ content: text, contentType: 'text' });
    setSending(false);
  }

  async function pickImage(source: 'camera' | 'library') {
    const perm =
      source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.show('Bitte erlaube den Zugriff in den Einstellungen.', 'error');
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8 };
    const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    const asset = res.canceled ? null : res.assets[0];
    if (!asset) return;
    setUploading(true);
    try {
      const { url } = await uploadSupportImage(asset.uri, asset.mimeType ?? 'image/jpeg', asset.fileName ?? 'bild.jpg');
      await send({ content: '', contentType: 'image', mediaUrl: url });
    } catch {
      toast.show('Upload fehlgeschlagen', 'error');
    }
    setUploading(false);
  }

  function chooseImage() {
    Alert.alert('Bild senden', undefined, [
      { text: 'Foto aufnehmen', onPress: () => void pickImage('camera') },
      { text: 'Aus Fotos wählen', onPress: () => void pickImage('library') },
      { text: 'Abbrechen', style: 'cancel' },
    ]);
  }

  return (
    <View ref={kb.ref} style={styles.flex}>
    <View style={[styles.flex, { paddingBottom: kb.inset }]}>
      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        keyboardDismissMode="interactive">
        {messages.length === 0 && !q.isLoading && (
          <View style={styles.intro}>
            <View style={styles.introIcon}>
              <Text style={{ fontSize: 24 }}>💬</Text>
            </View>
            <Text variant="headline">Neues Gespräch</Text>
            <Text variant="callout" align="center" color="#888">
              Schreib uns deine Frage. Wir melden uns bald.
            </Text>
          </View>
        )}
        {q.isLoading && conversationId && <ActivityIndicator color={colors.faint} style={{ marginTop: 24 }} />}
        {messages.map(m => (
          <Bubble key={m.id} m={m} />
        ))}
        {closed && (
          <View style={styles.closedPill}>
            <Text style={styles.closedText}>Dieses Gespräch ist geschlossen. Schreib einfach, dann öffnen wir es wieder.</Text>
          </View>
        )}
      </ScrollView>
      {/* Mit Tastatur: 8 pt Luft über der Tastatur (sie verdeckt die Home-Indicator-Zone), sonst über der Tab-Leiste */}
      <View style={[styles.composer, { paddingBottom: keyboard ? 8 : 10 + bottomInset + tabBarSpace }]}>
        <Pressable
          onPress={chooseImage}
          disabled={uploading}
          style={styles.tool}
          accessibilityRole="button"
          accessibilityLabel="Bild senden">
          {uploading ? <ActivityIndicator size="small" color={colors.faint} /> : <ImagePlus size={21} color="#888" strokeWidth={1.75} />}
        </Pressable>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Schreib uns eine Nachricht…"
          placeholderTextColor={colors.placeholder}
          multiline
          style={styles.input}
          accessibilityLabel="Nachricht"
        />
        <Pressable
          onPress={sendText}
          disabled={!input.trim() || sending}
          style={[styles.send, (!input.trim() || sending) && { backgroundColor: '#D1D5DB' }]}
          accessibilityRole="button"
          accessibilityLabel="Senden">
          <ArrowUp size={18} color={colors.white} strokeWidth={2.25} />
        </Pressable>
      </View>
    </View>
    </View>
  );
}

function Bubble({ m }: { m: Message }) {
  if (m.contentType === 'system') {
    try {
      const p = JSON.parse(m.content) as { type?: string; token?: string };
      if (p.type === 'impersonation_request' && p.token) return <ImpersonationCard token={p.token} />;
    } catch {
      /* unbekannte Systemnachricht */
    }
    return null;
  }
  const mine = m.senderType === 'user';
  return (
    <View style={[styles.bubbleWrap, mine ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs, m.contentType === 'image' && { padding: 4 }]}>
        {m.contentType === 'image' && m.mediaUrl ? (
          <Image source={{ uri: m.mediaUrl }} style={styles.image} contentFit="cover" accessibilityLabel="Bild" />
        ) : (
          <ChatText text={m.content} formatted={!mine} style={{ ...styles.bubbleText, color: mine ? colors.white : '#111' }} />
        )}
      </View>
      <Text style={styles.time}>{m.id.startsWith('temp-') ? 'Wird gesendet…' : chatTime(m.createdAt)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.white },
  messages: { flex: 1, backgroundColor: colors.chatBackground },
  messagesContent: { padding: 16, gap: 8, flexGrow: 1 },
  intro: { alignItems: 'center', gap: 6, paddingVertical: 48 },
  introIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#F5F0FF', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  bubbleWrap: { gap: 3 },
  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10 },
  mine: { backgroundColor: '#111', borderRadius: 18, borderBottomRightRadius: 4 },
  theirs: { backgroundColor: colors.chatAdminBubble, borderRadius: 18, borderBottomLeftRadius: 4 },
  bubbleText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  image: { width: 220, height: 220, borderRadius: 14 },
  time: { fontFamily: fonts.regular, fontSize: 10, color: '#AAA' },
  closedPill: { alignSelf: 'center', backgroundColor: '#EBEBEB', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginTop: 8 },
  closedText: { fontFamily: fonts.regular, fontSize: 12, color: '#777', textAlign: 'center' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EBEBEB',
    backgroundColor: colors.white,
  },
  tool: { width: 44, height: 44, borderRadius: radius.buttonSmall, alignItems: 'center', justifyContent: 'center' },
  // 12 + 20 + 12 = 44 → eine Zeile füllt die Mindesthöhe exakt, nichts wird abgeschnitten; ab 5 Zeilen scrollt das Feld
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: 22,
    backgroundColor: '#F5F5F5',
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 20,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
});
