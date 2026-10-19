-- ============================================================================
-- Avisos en el celular (notificaciones push) y número rojo sobre el ícono de la app
-- ============================================================================

-- Un registro por dispositivo que aceptó recibir avisos. Se guarda por servidor (clave de servicio).
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (tenant_id, user_id);
alter table public.push_subscriptions enable row level security;  -- sin políticas: solo el servidor

-- Bandeja de avisos: lo que no se ha leído es el número que se ve sobre el ícono.
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  body       text not null default '',
  url        text not null,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index if not exists notifications_unread_idx on public.notifications (tenant_id, user_id) where read_at is null;
alter table public.notifications enable row level security;

drop policy if exists notifications_own_read on public.notifications;
create policy notifications_own_read on public.notifications
  for select using (user_id = auth.uid());

drop policy if exists notifications_own_update on public.notifications;
create policy notifications_own_update on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Los avisos los crea solo el servidor (clave de servicio): nadie inserta desde el navegador.
