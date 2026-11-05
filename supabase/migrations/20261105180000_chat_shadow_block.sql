-- Besucher-Chat: unsichtbare Sperre + IPv6-Netzsperre (05.11.2026, Daniel). docs/chat/konzept.md
--
--  * chat_conversations.ip_net_hash      Hash des Netzes beim Start (IPv6: /64, IPv4: Adresse) – vom Worker (x-fs-ip-net-hash)
--  * chat_conversations.last_ip_hash     zuletzt benutzte IP (Hash) des Besuchers in diesem Gespräch
--  * chat_conversations.last_ip_net_hash zuletzt benutztes Netz (Hash)
--  * chat_conversations.block_reason     warum gesperrt (Betreiber, Admin, automatisch, Prüfung nicht bestanden)
--  * chat_blocks.ip_net_hash             Sperre für das ganze Netz (IPv6 /64)
--
-- Nur neue, leere Spalten. Idempotent.

BEGIN;

ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS ip_net_hash varchar(64);
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS last_ip_hash varchar(64);
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS last_ip_net_hash varchar(64);
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS block_reason text;
ALTER TABLE public.chat_blocks ADD COLUMN IF NOT EXISTS ip_net_hash varchar(64);
CREATE INDEX IF NOT EXISTS idx_chat_blocks_user_net ON public.chat_blocks (user_id, ip_net_hash);

COMMIT;
