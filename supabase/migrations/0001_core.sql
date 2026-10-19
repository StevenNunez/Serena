-- ============================================================================
-- Tienda de piezas únicas · multitenant
-- Núcleo: tenants, roles, catálogo, clientes, pedidos, lista de espera
-- Toda tabla de negocio lleva tenant_id y está protegida con RLS.
-- ============================================================================

create extension if not exists pgcrypto;

create type public.member_role    as enum ('admin', 'live', 'caja');
create type public.product_status as enum ('draft', 'available', 'reserved', 'sold', 'hidden');
create type public.order_status   as enum (
  'pending_payment', 'payment_review', 'paid', 'preparing',
  'shipped', 'delivered', 'cancelled', 'expired'
);
create type public.payment_method  as enum ('transfer', 'mercadopago', 'khipu');
create type public.delivery_method as enum ('pickup', 'courier', 'delivery');

-- ----------------------------------------------------------------------------
-- Tenants (cada tienda)
-- ----------------------------------------------------------------------------
create table public.tenants (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name                text not null,
  -- {"primary":"#C10B21","accent":"#FA95B3","logo":"/brand/..","tagline":".."}
  theme               jsonb not null default '{}'::jsonb,
  settings            jsonb not null default '{
    "currency": "CLP",
    "reservation_minutes": 6,
    "payment_minutes": 15,
    "max_strikes": 3,
    "delivery": {
      "pickup":   {"enabled": true,  "cost": 0,    "label": "Retiro en tienda"},
      "courier":  {"enabled": true,  "cost": 4000, "label": "Envío por courier"},
      "delivery": {"enabled": true,  "cost": 3000, "label": "Despacho a domicilio"}
    },
    "payments": {"transfer": true, "mercadopago": false, "khipu": false}
  }'::jsonb,
  next_product_number int not null default 1,
  next_order_number   int not null default 1,
  created_at          timestamptz not null default now()
);

-- Datos bancarios (solo usuarios con sesión; nunca anónimos)
create table public.tenant_bank (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  data      jsonb not null default '{}'::jsonb
  -- {"holder":"..","rut":"..","bank":"..","account_type":"Cuenta Vista","account":"..","email":".."}
);

-- Secretos de pasarelas. RLS activo y SIN políticas: solo la clave de servicio.
create table public.tenant_secrets (
  tenant_id            uuid primary key references public.tenants(id) on delete cascade,
  mp_access_token      text,
  mp_webhook_secret    text,
  khipu_receiver_id    text,
  khipu_secret         text
);

-- ----------------------------------------------------------------------------
-- Equipo (roles por tienda)
--   admin: todo · live: publica piezas y maneja el live · caja: pagos y despachos
-- ----------------------------------------------------------------------------
create table public.memberships (
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.member_role not null,
  full_name  text,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create or replace function public.has_role(t uuid, r public.member_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.tenant_id = t and m.user_id = auth.uid() and m.role = any (r)
  );
$$;

-- ----------------------------------------------------------------------------
-- Catálogo
-- ----------------------------------------------------------------------------
create table public.categories (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name      text not null,
  slug      text not null,
  sort      int  not null default 0,
  unique (tenant_id, slug)
);

create table public.live_sessions (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  title              text not null,
  status             text not null default 'live' check (status in ('live', 'ended')),
  current_product_id uuid,
  started_at         timestamptz not null default now(),
  ended_at           timestamptz,
  created_by         uuid references auth.users(id)
);

create table public.products (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  number         int  not null,                       -- "Pieza #34", único por tienda
  title          text not null,
  description    text,
  category_id    uuid references public.categories(id) on delete set null,
  size           text,
  color          text,
  condition      text,
  price          int  not null check (price >= 0),    -- CLP, sin decimales
  photos         text[] not null default '{}',
  status         public.product_status not null default 'available',
  reserved_by    uuid references auth.users(id) on delete set null,
  reserved_until timestamptz,
  order_id       uuid,                                -- pedido que la retiene
  live_session_id uuid references public.live_sessions(id) on delete set null,
  sold_at        timestamptz,
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  unique (tenant_id, number)
);
create index products_tenant_status_idx on public.products (tenant_id, status, created_at desc);
create index products_reserved_until_idx on public.products (reserved_until) where status = 'reserved';

alter table public.live_sessions
  add constraint live_sessions_current_product_fk
  foreign key (current_product_id) references public.products(id) on delete set null;

-- Número correlativo por tienda si no viene informado
create or replace function public.products_assign_number()
returns trigger language plpgsql as $$
begin
  if new.number is null or new.number <= 0 then
    update public.tenants
       set next_product_number = next_product_number + 1
     where id = new.tenant_id
    returning next_product_number - 1 into new.number;
  end if;
  return new;
end $$;

-- "number" es NOT NULL: el trigger corre antes de validar, así que se declara default 0
alter table public.products alter column number set default 0;
create trigger products_assign_number before insert on public.products
  for each row execute function public.products_assign_number();

-- ----------------------------------------------------------------------------
-- Clientas (por tienda) y lista de espera
-- ----------------------------------------------------------------------------
create table public.customers (
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  full_name  text not null,
  phone      text,
  rut        text,
  email      text,
  address    jsonb not null default '{}'::jsonb,   -- {"street","commune","region","notes"}
  strikes    int  not null default 0,
  blocked    boolean not null default false,
  notes      text,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create table public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (product_id, user_id)
);

create table public.favorites (
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- ----------------------------------------------------------------------------
-- Pedidos
-- ----------------------------------------------------------------------------
create table public.orders (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants(id) on delete cascade,
  number               int  not null,
  customer_id          uuid not null references auth.users(id),
  status               public.order_status not null default 'pending_payment',
  payment_method       public.payment_method not null,
  payment_ref          text not null,                -- referencia única para conciliar transferencias
  delivery_method      public.delivery_method not null,
  shipping_address     jsonb not null default '{}'::jsonb,
  subtotal             int not null,
  shipping_cost        int not null default 0,
  total                int not null,
  expires_at           timestamptz,
  proof_path           text,
  proof_uploaded_at    timestamptz,
  provider_payment_id  text,
  provider_url         text,
  paid_at              timestamptz,
  confirmed_by         uuid references auth.users(id),
  tracking             text,
  notes                text,
  created_at           timestamptz not null default now(),
  unique (tenant_id, number),
  unique (tenant_id, payment_ref)
);
create index orders_tenant_status_idx on public.orders (tenant_id, status, created_at desc);
create index orders_customer_idx on public.orders (customer_id, created_at desc);

create table public.order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders(id) on delete cascade,
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  product_id     uuid references public.products(id) on delete set null,
  product_number int not null,
  title          text not null,
  photo          text,
  price          int not null
);
create index order_items_order_idx on public.order_items (order_id);

alter table public.products
  add constraint products_order_fk foreign key (order_id) references public.orders(id) on delete set null;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.tenants        enable row level security;
alter table public.tenant_bank    enable row level security;
alter table public.tenant_secrets enable row level security;
alter table public.memberships    enable row level security;
alter table public.categories     enable row level security;
alter table public.live_sessions  enable row level security;
alter table public.products       enable row level security;
alter table public.customers      enable row level security;
alter table public.waitlist       enable row level security;
alter table public.favorites      enable row level security;
alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;

-- tenants: la vitrina es pública; solo admin edita
create policy tenants_read  on public.tenants for select using (true);
create policy tenants_admin on public.tenants for update
  using (public.has_role(id, '{admin}')) with check (public.has_role(id, '{admin}'));

-- datos bancarios: cualquier usuario con sesión los ve (los necesita para transferir)
create policy bank_read  on public.tenant_bank for select to authenticated using (true);
create policy bank_admin on public.tenant_bank for all to authenticated
  using (public.has_role(tenant_id, '{admin}')) with check (public.has_role(tenant_id, '{admin}'));

-- equipo
create policy memberships_self  on public.memberships for select to authenticated
  using (user_id = auth.uid() or public.has_role(tenant_id, '{admin}'));
create policy memberships_admin on public.memberships for all to authenticated
  using (public.has_role(tenant_id, '{admin}')) with check (public.has_role(tenant_id, '{admin}'));

-- categorías
create policy categories_read  on public.categories for select using (true);
create policy categories_write on public.categories for all to authenticated
  using (public.has_role(tenant_id, '{admin,live}')) with check (public.has_role(tenant_id, '{admin,live}'));

-- live
create policy live_read  on public.live_sessions for select using (true);
create policy live_write on public.live_sessions for all to authenticated
  using (public.has_role(tenant_id, '{admin,live}')) with check (public.has_role(tenant_id, '{admin,live}'));

-- productos: el público ve lo publicado; el equipo ve todo.
-- El cambio de estado de una reserva/venta SIEMPRE pasa por funciones (ver 0002).
create policy products_read on public.products for select using (
  status in ('available', 'reserved', 'sold')
  or public.has_role(tenant_id, '{admin,live,caja}')
);
create policy products_write on public.products for all to authenticated
  using (public.has_role(tenant_id, '{admin,live}')) with check (public.has_role(tenant_id, '{admin,live}'));

-- clientas: cada una ve la suya; admin y caja ven todas
create policy customers_read on public.customers for select to authenticated
  using (user_id = auth.uid() or public.has_role(tenant_id, '{admin,caja}'));
create policy customers_staff_update on public.customers for update to authenticated
  using (public.has_role(tenant_id, '{admin,caja}')) with check (public.has_role(tenant_id, '{admin,caja}'));

-- lista de espera: la propia o el equipo
create policy waitlist_read on public.waitlist for select to authenticated
  using (user_id = auth.uid() or public.has_role(tenant_id, '{admin,live,caja}'));

-- favoritos: solo la dueña
create policy favorites_own on public.favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- pedidos: la clienta ve los suyos; admin y caja ven todos. Escritura solo por funciones.
create policy orders_read on public.orders for select to authenticated
  using (customer_id = auth.uid() or public.has_role(tenant_id, '{admin,caja}'));
create policy order_items_read on public.order_items for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and (o.customer_id = auth.uid() or public.has_role(o.tenant_id, '{admin,caja}'))
  ));

-- ----------------------------------------------------------------------------
-- Realtime (estado de piezas, pedidos y live al instante)
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table public.products;
alter publication supabase_realtime add table public.live_sessions;
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.waitlist;
