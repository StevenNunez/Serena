-- ============================================================================
-- En vivo retransmitido: en qué red se transmite y el enlace (opcional)
-- ============================================================================
alter table public.live_sessions
  add column if not exists platform   text check (platform in ('instagram', 'tiktok', 'youtube', 'facebook')),
  add column if not exists stream_url text;
