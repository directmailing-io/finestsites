import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { useConversations } from '@/api/queries';
import { ChatThread } from '@/features/support/ChatThread';
import { chatTitle } from '@/lib/format';

/** Ein Gespräch (iPhone und Links aus Mitteilungen). id = "new" startet ein neues Gespräch. */
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const conv = useConversations().data?.conversations.find(c => c.id === id);
  const isNew = id === 'new';
  return (
    <>
      <Stack.Screen options={{ title: isNew ? 'Neues Gespräch' : conv ? chatTitle(conv.subject, conv.createdAt) : 'Support' }} />
      <ChatThread
        conversationId={isNew ? null : id}
        onCreated={newId => router.replace({ pathname: '/help/[id]', params: { id: newId } })}
      />
    </>
  );
}
