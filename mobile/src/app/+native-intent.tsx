import { redirectWebLink } from '@/lib/web-links';

/** Links auf app.finestsites.io öffnen den passenden Bildschirm (src/lib/web-links.ts). */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return redirectWebLink(path);
  } catch {
    return '/';
  }
}
