import { useRouter } from 'expo-router';
import { ArrowUp, Check, CheckCheck, Clock, Globe, MessagesSquare, ShieldBan } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { useChatActions, useChatMessages } from '@/api/queries';
import type { ChatConversation, ChatMessage } from '@/api/types';
import { Button, EmptyState, Text, useToast } from '@/components/ui';
import { copyText } from '@/lib/clipboard';
import { openInBrowser } from '@/lib/links';
import { shouldPrimePush } from '@/lib/push';
import { colors, fonts, radius } from '@/theme/tokens';

import { buildThreadItems, hhmm, startedOnUrl, type ThreadItem } from './helpers';
import { LinkedText } from './LinkedText';

/**
 * Gespräch mit einem Besucher (Gefühl wie WhatsApp, Werte wie ChatThread): Tag-Trenner, Blasen
 * (eigene rechts dunkel, Besucher links grau), Zeit + Haken ✓/✓✓ bei eigenen, Links anklickbar,
 * langes Drücken kopiert, Eingabe unten mit Tastatur-Vermeidung, optimistisches Senden,
 * „Gelesen“ beim Öffnen und bei neuen Nachrichten im Vordergrund. Gesperrt: Eingabe aus + „Sperre aufheben“.
 *
 * header: eigene Kopfzeile (iPad-Fenster); auf dem iPhone kommt der Kopf aus der nativen Kopfzeile.
 */
export function VisitorThread({ conversationId, header, bottomInset = 0 }: { conversationId: string; header?: ReactNode; bottomInset?: number }) {
  const router = useRouter();
  const toast = useToast();
  const actions = useChatActions();
  const { query, conversation, messages, hasMore, loadOlder, loadingOlder } = useChatMessages(conversationId);
  const [pending, setPending] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const insets = useSafeAreaInsets();
  const tabBarSpace = insets.bottom;
  const listRef = useRef<FlatList<ThreadItem>>(null);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboard(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Optimistische Nachrichten verschwinden, sobald der Server dieselbe clientId liefert
  const all = useMemo(
    () => [...messages, ...pending.filter(p => !messages.some(m => m.id === p.id || (p.clientId && m.clientId === p.clientId)))],
    [messages, pending],
  );
  // Umgekehrte Liste: neueste unten, Tastatur und neue Nachrichten brauchen kein Scrollen von Hand
  const items = useMemo(() => buildThreadItems(all).reverse(), [all]);

  // Als gelesen markieren: beim Öffnen und sobald neue Besucher-Nachrichten im Vordergrund ankommen
  const unread = conversation?.unread ?? 0;
  const reading = useRef(false);
  const readMutate = actions.read.mutate;
  useEffect(() => {
    if (unread <= 0 || reading.current) return;
    reading.current = true;
    readMutate(conversationId, { onSettled: () => { reading.current = false; } });
  }, [unread, conversationId, readMutate]);

  const blocked = conversation?.status === 'blocked';

  async function sendText() {
    const text = input.trim();
    if (!text || sending || !conversation) return;
    const clientId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const temp: ChatMessage = { id: clientId, conversationId, sender: 'owner', body: text, createdAt: new Date().toISOString(), readAt: null, clientId };
    const firstReply = !messages.some(m => m.sender === 'owner');
    setSending(true);
    setInput('');
    setPending(p => [...p, temp]);
    try {
      await actions.send.mutateAsync({ id: conversationId, body: text, clientId });
      setPending(p => p.filter(m => m.id !== clientId));
      if (firstReply && (await shouldPrimePush())) router.push({ pathname: '/push-priming', params: { reason: 'chat' } });
    } catch (err) {
      setPending(p => p.filter(m => m.id !== clientId));
      setInput(text);
      const code = err instanceof ApiError ? err.code : null;
      toast.show(code === 'CONVERSATION_BLOCKED' ? 'Der Besucher ist gesperrt.' : 'Nachricht konnte nicht gesendet werden.', 'error');
    } finally {
      setSending(false);
    }
  }

  const copy = useCallback(
    async (m: ChatMessage) => {
      if (await copyText(m.body)) toast.show('Kopiert');
    },
    [toast],
  );

  const renderItem = useCallback(
    ({ item }: { item: ThreadItem }) => {
      if (item.kind === 'day') {
        return (
          <View style={styles.dayWrap}>
            <View style={styles.dayPill}>
              <Text style={styles.dayText}>{item.label}</Text>
            </View>
          </View>
        );
      }
      return <Bubble m={item.m} follow={item.follow} tail={item.tail} name={conversation?.visitor.displayName ?? 'Besucher'} onCopy={() => void copy(item.m)} />;
    },
    [conversation?.visitor.displayName, copy],
  );

  // Oben im Verlauf (Fuß der umgekehrten Liste): Seite, auf der der Chat begann, und „Ältere Nachrichten“
  const top = conversation ? (
    <View style={styles.top}>
      <Pressable
        onPress={() => void openInBrowser(startedOnUrl(conversation))}
        style={({ pressed }) => [styles.sitePill, pressed && { opacity: 0.7 }]}
        accessibilityRole="link"
        accessibilityLabel={`Seite öffnen: ${conversation.siteTitle}, ${conversation.siteHost}`}>
        <Globe size={12} color={colors.secondary} strokeWidth={2} />
        <Text numberOfLines={1} style={styles.siteText}>
          {conversation.siteTitle} · {conversation.siteHost}
          {conversation.startedOnPath && conversation.startedOnPath !== '/' ? conversation.startedOnPath : ''}
        </Text>
      </Pressable>
      {hasMore && <Button title="Ältere Nachrichten laden" variant="muted" size="sm" loading={loadingOlder} onPress={() => void loadOlder().catch(() => toast.show('Konnte nicht geladen werden.', 'error'))} />}
    </View>
  ) : null;

  if (query.isError && !conversation) {
    const code = query.error instanceof ApiError ? query.error.code : null;
    return (
      <View style={styles.flex}>
        {header}
        <EmptyState
          icon={MessagesSquare}
          title={code === 'FEATURE_DISABLED' ? 'Chat nicht freigeschaltet' : 'Gespräch nicht gefunden'}
          text={code === 'FEATURE_DISABLED' ? 'Der Besucher-Chat ist für dein Konto nicht freigeschaltet.' : 'Vielleicht wurde es gelöscht.'}
          actionTitle={code === 'FEATURE_DISABLED' ? undefined : 'Nochmal versuchen'}
          onAction={code === 'FEATURE_DISABLED' ? undefined : () => void query.refetch()}
        />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      {header}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <FlatList
          ref={listRef}
          data={items}
          inverted
          keyExtractor={i => i.key}
          renderItem={renderItem}
          ListFooterComponent={top ?? undefined}
          ListEmptyComponent={query.isLoading ? <ActivityIndicator color={colors.faint} style={{ marginTop: 24 }} /> : undefined}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          initialNumToRender={30}
          maxToRenderPerBatch={30}
        />
        {blocked ? (
          <View style={[styles.blockedBar, { paddingBottom: 12 + bottomInset + (keyboard ? 0 : tabBarSpace) }]} accessibilityRole="summary">
            <ShieldBan size={18} color={colors.dangerInk} strokeWidth={2} />
            <Text style={styles.blockedText}>Besucher gesperrt – er kann dir nicht mehr schreiben.</Text>
            <Button
              title="Sperre aufheben"
              variant="secondary"
              size="sm"
              loading={actions.unblock.isPending}
              onPress={() => actions.unblock.mutate(conversationId, { onSuccess: () => toast.show('Sperre aufgehoben', 'success'), onError: () => toast.show('Das hat leider nicht geklappt.', 'error') })}
            />
          </View>
        ) : (
          <View style={[styles.composer, { paddingBottom: 10 + bottomInset + (keyboard ? 0 : tabBarSpace) }]}>
            <TextInput
              value={input}
              onChangeText={t => setInput(t.slice(0, 2000))}
              placeholder="Schreib eine Nachricht…"
              placeholderTextColor={colors.placeholder}
              multiline
              editable={!!conversation}
              style={styles.input}
              accessibilityLabel="Nachricht"
            />
            <Pressable
              onPress={sendText}
              disabled={!input.trim() || sending || !conversation}
              style={[styles.send, (!input.trim() || sending || !conversation) && { backgroundColor: '#D1D5DB' }]}
              accessibilityRole="button"
              accessibilityLabel="Senden"
              accessibilityState={{ disabled: !input.trim() || sending }}>
              <ArrowUp size={18} color={colors.white} strokeWidth={2.25} />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

function Bubble({ m, follow, tail, name, onCopy }: { m: ChatMessage; follow: boolean; tail: boolean; name: string; onCopy: () => void }) {
  if (m.sender === 'system') {
    return (
      <View style={styles.systemWrap}>
        <Text style={styles.systemText}>{m.body}</Text>
      </View>
    );
  }
  const mine = m.sender === 'owner';
  const pendingMsg = m.id.startsWith('temp-');
  const time = hhmm(m.createdAt);
  const tickColor = m.readAt ? colors.infoBorder : 'rgba(255,255,255,0.6)';
  return (
    <View style={[styles.bubbleWrap, mine ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }, follow && { marginTop: -5 }]}>
      <Pressable
        onLongPress={onCopy}
        delayLongPress={350}
        accessibilityRole="text"
        accessibilityLabel={`${mine ? 'Du' : name}, ${time}${mine ? (pendingMsg ? ', wird gesendet' : m.readAt ? ', gelesen' : ', zugestellt') : ''}: ${m.body}`}
        accessibilityHint="Lange drücken, um den Text zu kopieren"
        style={({ pressed }) => [
          styles.bubble,
          mine ? styles.mine : styles.theirs,
          tail && (mine ? { borderBottomRightRadius: 4 } : { borderBottomLeftRadius: 4 }),
          pressed && { opacity: 0.85 },
        ]}>
        <LinkedText text={m.body} style={{ ...styles.bubbleText, color: mine ? colors.white : colors.ink }} linkColor={mine ? colors.white : colors.info} />
        <View style={styles.meta}>
          <Text style={[styles.time, { color: mine ? 'rgba(255,255,255,0.65)' : colors.faint }]}>{time}</Text>
          {mine &&
            (pendingMsg ? (
              <Clock size={12} color="rgba(255,255,255,0.65)" strokeWidth={2} />
            ) : m.readAt ? (
              <CheckCheck size={14} color={tickColor} strokeWidth={2.25} />
            ) : (
              <Check size={14} color={tickColor} strokeWidth={2.25} />
            ))}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.white },
  messages: { flex: 1, backgroundColor: colors.chatBackground },
  messagesContent: { paddingHorizontal: 14, paddingVertical: 12, flexGrow: 1 },
  top: { alignItems: 'center', gap: 12, paddingBottom: 8, paddingTop: 4 },
  sitePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '92%',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  siteText: { fontFamily: fonts.medium, fontSize: 12, color: colors.secondary, flexShrink: 1 },
  dayWrap: { alignItems: 'center', paddingVertical: 10 },
  dayPill: { backgroundColor: colors.white, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: colors.divider },
  dayText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.secondary, letterSpacing: 0.2 },
  bubbleWrap: { marginBottom: 8 },
  bubble: { maxWidth: '82%', paddingHorizontal: 13, paddingTop: 8, paddingBottom: 6, borderRadius: 18 },
  mine: { backgroundColor: colors.foreground },
  theirs: { backgroundColor: colors.chatAdminBubble },
  bubbleText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 2 },
  time: { fontFamily: fonts.regular, fontSize: 10.5, lineHeight: 14 },
  systemWrap: { alignSelf: 'center', backgroundColor: '#EBEBEB', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginVertical: 6, maxWidth: '88%' },
  systemText: { fontFamily: fonts.regular, fontSize: 12, color: '#777', textAlign: 'center' },
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
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 11,
    borderRadius: 22,
    backgroundColor: '#F5F5F5',
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.ink,
  },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.foreground, alignItems: 'center', justifyContent: 'center' },
  blockedBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.dangerBorder,
    backgroundColor: colors.dangerSoft,
  },
  blockedText: { flex: 1, minWidth: 160, fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.dangerInk },
});
