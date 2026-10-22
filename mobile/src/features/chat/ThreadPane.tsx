import { useChatConversation } from '@/api/queries';

import { useConversationMenu } from './ConversationMenu';
import { ThreadHeader } from './ThreadHeader';
import { VisitorThread } from './VisitorThread';

/** iPad: rechtes Fenster der geteilten Ansicht – eigene Kopfzeile mit „…“-Menü + Verlauf. */
export function ThreadPane({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const q = useChatConversation(id);
  const c = q.data?.conversation ?? null;
  const { openMenu, sheets } = useConversationMenu(c, { onDeleted });
  return (
    <>
      <VisitorThread conversationId={id} header={c ? <ThreadHeader conversation={c} onMenu={openMenu} /> : null} />
      {sheets}
    </>
  );
}
