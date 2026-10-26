import type { Href, useRouter } from 'expo-router';

import { markNewsCta } from '@/api/endpoints';
import type { NewsCta, NewsCtaKind } from '@/api/types';
import { openExternal } from '@/lib/links';

/** Feste Ziele des Knopfs (Spezifikation docs/news/spec.md): Bereiche der App. */
const INTERNAL: Record<Exclude<NewsCtaKind, 'url'>, Href> = {
  sites: '/',
  submissions: '/inbox',
  chats: '/chats',
  affiliate: '/account/partner',
  settings: '/account/settings',
};

/**
 * Tipp auf den Knopf: erst „Knopf getippt“ melden (ohne zu warten), dann das Ziel öffnen.
 * Interne Ziele per router.navigate, `url` im Browser (nur https:// kommt vom Server).
 */
export function openNewsCta(newsId: string, cta: NewsCta, router: ReturnType<typeof useRouter>) {
  void markNewsCta(newsId).catch(() => {});
  if (cta.kind === 'url') {
    if (cta.url && /^https:\/\//.test(cta.url)) void openExternal(cta.url);
    return;
  }
  router.navigate(INTERNAL[cta.kind]);
}
