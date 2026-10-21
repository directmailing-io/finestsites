import type { Href } from 'expo-router';
import { BadgeCheck, Bell, FileText, Globe, Inbox, MessageCircle, Plus, UserRound, type LucideIcon } from 'lucide-react-native';

import type { AccountStatusCode, Todo } from '@/api/types';
import { plural } from '@/lib/format';

/**
 * Texte für „Zu erledigen“ und den Konto-Status. Der Server liefert nur Codes,
 * die Sätze stehen hier – neutral, ohne Kauf- oder Zahlungshinweise.
 */
export function todoView(t: Todo): { icon: LucideIcon; title: string; text: string; href: Href } {
  switch (t.code) {
    case 'first_site':
      return { icon: Plus, title: 'Erste Webseite anlegen', text: 'Such dir eine Vorlage aus. Das dauert nur ein paar Minuten.', href: '/sites/new' };
    case 'unread_submissions':
      return {
        icon: Inbox,
        title: plural(t.count ?? 0, 'neue Anfrage', 'neue Anfragen'),
        text: 'Melde dich am besten heute noch zurück.',
        href: '/inbox',
      };
    case 'support_reply':
      return { icon: MessageCircle, title: 'Antwort vom Support', text: 'Du hast eine neue Nachricht im Hilfe-Chat.', href: '/help' };
    case 'unpublished_changes':
      return {
        icon: Globe,
        title: 'Änderungen noch nicht online',
        text: `${t.site_title ?? 'Eine Seite'}: Tippe im Editor auf „Änderungen veröffentlichen“.`,
        href: t.site_id ? { pathname: '/sites/[id]', params: { id: t.site_id } } : '/sites',
      };
    case 'complete_profile':
      return { icon: UserRound, title: 'Profil vervollständigen', text: 'Foto und Kontaktdaten werden in deine Seiten übernommen.', href: '/account/profile' };
    case 'team_partner_missing':
      return { icon: BadgeCheck, title: 'Teampartner-Nummer eintragen', text: 'Wir bauen sie automatisch in deine Shop-Links ein.', href: '/account/profile' };
    case 'tax_profile_missing':
      return { icon: FileText, title: 'Angaben für die Abrechnung', text: 'Damit wir deine Provision abrechnen können.', href: '/account/partner/tax' };
    case 'domain_pending':
      return { icon: Globe, title: 'Domain wird verbunden', text: 'Das kann bis zu einem Tag dauern. Du musst nichts tun.', href: '/sites' };
    default:
      return { icon: Bell, title: 'Hinweis', text: '', href: '/start' };
  }
}

export function accountStatusView(code: AccountStatusCode, online: number, offline: number) {
  switch (code) {
    case 'ok':
      return { tone: 'success' as const, title: 'Alles läuft', text: online === 1 ? 'Deine Webseite ist online.' : `${online} Webseiten sind online.` };
    case 'no_sites':
      return { tone: 'accent' as const, title: 'Los geht’s', text: 'Du hast noch keine Webseite. Leg jetzt deine erste an.' };
    case 'drafts_only':
      return { tone: 'accent' as const, title: 'Fast geschafft', text: 'Deine Seite ist noch ein Entwurf. Veröffentliche sie im Editor.' };
    case 'site_offline':
      return {
        tone: 'warning' as const,
        title: offline === 1 ? 'Eine Seite ist offline' : `${offline} Seiten sind offline`,
        text: 'Wir haben dir dazu eine E-Mail geschickt. Bei Fragen hilft dir der Support.',
      };
    case 'account_notice':
    default:
      return { tone: 'warning' as const, title: 'Hinweis zu deinem Konto', text: 'Wir haben dir dazu eine E-Mail geschickt. Bei Fragen hilft dir der Support.' };
  }
}
