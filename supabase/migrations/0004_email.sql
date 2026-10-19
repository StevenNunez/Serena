-- ============================================================================
-- Correos transaccionales: registro de lo ya enviado y aviso de la fila de espera
-- ============================================================================

-- Qué correo salió para cada pedido (evita duplicados). Solo la clave de servicio.
create table if not exists public.email_log (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  order_id   uuid not null references public.orders(id) on delete cascade,
  kind       text not null,
  created_at timestamptz not null default now(),
  unique (order_id, kind)
);
alter table public.email_log enable row level security;  -- sin políticas a propósito

-- Marca las piezas que pasaron a la primera de la fila: la app avisa por correo y apaga la marca.
alter table public.products add column if not exists notify_promoted boolean not null default false;

-- Igual que en 0002, pero marcando la pieza cuando se la lleva alguien de la fila
create or replace function public._release_product(p_product uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  p public.products;
  w public.waitlist;
  mins int;
  max_strikes int;
begin
  select * into p from public.products where id = p_product for update;
  if not found or p.status <> 'reserved' then return; end if;

  mins := public.tenant_int(p.tenant_id, 'reservation_minutes', 6);
  max_strikes := public.tenant_int(p.tenant_id, 'max_strikes', 3);

  select w2.* into w
  from public.waitlist w2
  join public.customers c on c.tenant_id = w2.tenant_id and c.user_id = w2.user_id
  where w2.product_id = p_product
    and c.blocked = false
    and c.strikes < max_strikes
  order by w2.created_at
  limit 1
  for update of w2 skip locked;

  if found then
    update public.products
       set reserved_by = w.user_id,
           reserved_until = now() + make_interval(mins => mins),
           order_id = null,
           notify_promoted = true
     where id = p_product;
    delete from public.waitlist where id = w.id;
  else
    update public.products
       set status = 'available', reserved_by = null, reserved_until = null, order_id = null,
           notify_promoted = false
     where id = p_product;
  end if;
end $$;
