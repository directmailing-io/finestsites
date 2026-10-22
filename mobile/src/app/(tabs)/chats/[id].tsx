import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { useChatConversation } from '@/api/queries';
import { Text } from '@/components/ui';
import { MenuButton, useConversationMenu } from '@/features/chat/ConversationMenu';
import { ThreadHeader } from '@/features/chat/ThreadHeader';
import { VisitorThread } from '@/features/chat/VisitorThread';
import { fonts } from '@/theme/tokens';

/** Ein Besucher-Gespräch (iPhone, Mitteilungen, Links). Kopf (Avatar, Name, online) und „…“ in der nativen Kopfzeile. */
export default function ChatConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const q = useChatConversation(id);
  const c = q.data?.conversation ?? null;
  const { openMenu, sheets, anchorRef, hasItems } = useConversationMenu(c, { onLeave: () => router.back() });

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (c ? <ThreadHeader conversation={c} compact /> : <Text style={{ fontFamily: fonts.semibold, fontSize: 17 }}>Chat</Text>),
          headerRight: () => (hasItems ? <MenuButton onPress={openMenu} anchorRef={anchorRef} /> : null),
        }}
      />
      <VisitorThread conversationId={id} />
      {sheets}
    </>
  );
}
