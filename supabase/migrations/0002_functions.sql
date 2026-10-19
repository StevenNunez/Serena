-- ============================================================================
-- Lógica de negocio atómica: reservar, comprar, confirmar, liberar.
-- Todo cambio de estado de una pieza pasa por aquí, con bloqueo de fila:
-- dos personas nunca pueden quedarse con la misma pieza.
-- ============================================================================

create or replace function public.tenant_int(t uuid, key text, def int)
returns int language sql stable security definer set search_path = public as $$
  select coalesce((select (settings ->> key)::int from public.tenants where id = t), def);
$$;

-- ----------------------------------------------------------------------------
-- Interna: libera una pieza y se la pasa a la primera de la fila de espera
-- ----------------------------------------------------------------------------
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

  -- siguiente en la fila que pueda reservar
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
           order_id = null
     where id = p_product;
    delete from public.waitlist where id = w.id;
  else
    update public.products
       set status = 'available', reserved_by = null, reserved_until = null, order_id = null
     where id = p_product;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Interna: vence reservas y pedidos sin pagar. Se llama por cron y "perezosamente".
-- ----------------------------------------------------------------------------
create or replace function public.expire_holds(p_tenant uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  -- 1) pedidos sin pagar cuyo plazo venció
  for r in
    select id, tenant_id, customer_id from public.orders
    where status = 'pending_payment' and expires_at is not null and expires_at < now()
      and (p_tenant is null or tenant_id = p_tenant)
    for update skip locked
  loop
    update public.orders set status = 'expired' where id = r.id;
    update public.customers set strikes = strikes + 1
     where tenant_id = r.tenant_id and user_id = r.customer_id;
    perform public._release_product(pr.id)
      from public.products pr where pr.order_id = r.id and pr.status = 'reserved';
  end loop;

  -- 2) reservas sueltas (sin pedido) cuyo plazo venció
  for r in
    select id, tenant_id, reserved_by from public.products
    where status = 'reserved' and order_id is null
      and reserved_until is not null and reserved_until < now()
      and (p_tenant is null or tenant_id = p_tenant)
    for update skip locked
  loop
    update public.customers set strikes = strikes + 1
     where tenant_id = r.tenant_id and user_id = r.reserved_by;
    perform public._release_product(r.id);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- Clienta: crear/actualizar su ficha en una tienda
-- ----------------------------------------------------------------------------
create or replace function public.upsert_customer(
  p_tenant uuid, p_name text, p_phone text, p_rut text default null, p_address jsonb default null
) returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'auth_required'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'name_required'; end if;

  insert into public.customers (tenant_id, user_id, full_name, phone, rut, email, address)
  values (p_tenant, uid, trim(p_name), nullif(trim(p_phone), ''), nullif(trim(p_rut), ''),
          (select email from auth.users where id = uid), coalesce(p_address, '{}'::jsonb))
  on conflict (tenant_id, user_id) do update
     set full_name = excluded.full_name,
         phone     = coalesce(excluded.phone, public.customers.phone),
         rut       = coalesce(excluded.rut, public.customers.rut),
         address   = case when p_address is null then public.customers.address else excluded.address end;
end $$;

-- ----------------------------------------------------------------------------
-- "¡Es mía!": reserva atómica. El primero gana; el resto entra a la fila.
-- Devuelve {result: reserved|mine|waitlisted|sold|blocked, until, position}
-- ----------------------------------------------------------------------------
create or replace function public.reserve_product(p_product uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p   public.products;
  c   public.customers;
  mins int;
  pos int;
begin
  if uid is null then raise exception 'auth_required'; end if;

  select tenant_id into strict p.tenant_id from public.products where id = p_product;
  perform public.expire_holds(p.tenant_id);

  select * into c from public.customers where tenant_id = p.tenant_id and user_id = uid;
  if not found then raise exception 'profile_required'; end if;
  if c.blocked or c.strikes >= public.tenant_int(p.tenant_id, 'max_strikes', 3) then
    return jsonb_build_object('result', 'blocked');
  end if;

  select * into p from public.products where id = p_product for update;
  if p.status in ('draft', 'hidden') then raise exception 'not_found'; end if;
  if p.status = 'sold' then return jsonb_build_object('result', 'sold'); end if;

  mins := public.tenant_int(p.tenant_id, 'reservation_minutes', 6);

  if p.status = 'available' then
    update public.products
       set status = 'reserved', reserved_by = uid,
           reserved_until = now() + make_interval(mins => mins), order_id = null
     where id = p_product
    returning reserved_until into p.reserved_until;
    delete from public.waitlist where product_id = p_product and user_id = uid;
    return jsonb_build_object('result', 'reserved', 'until', p.reserved_until);
  end if;

  -- status = reserved
  if p.reserved_by = uid then
    return jsonb_build_object('result', 'mine', 'until', p.reserved_until);
  end if;

  insert into public.waitlist (tenant_id, product_id, user_id)
  values (p.tenant_id, p_product, uid) on conflict (product_id, user_id) do nothing;
  select count(*) into pos from public.waitlist
   where product_id = p_product
     and created_at <= (select created_at from public.waitlist where product_id = p_product and user_id = uid);
  return jsonb_build_object('result', 'waitlisted', 'position', pos);
end $$;

-- La clienta suelta su reserva (o sale de la fila)
create or replace function public.release_my_reservation(p_product uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'auth_required'; end if;
  delete from public.waitlist where product_id = p_product and user_id = uid;
  if exists (select 1 from public.products
             where id = p_product and status = 'reserved' and reserved_by = uid and order_id is null) then
    perform public._release_product(p_product);
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Checkout: junta las reservas vigentes de la clienta en un pedido
-- ----------------------------------------------------------------------------
create or replace function public.create_order(
  p_tenant uuid, p_method public.payment_method, p_delivery public.delivery_method, p_address jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  t   public.tenants;
  ids uuid[];
  sub int;
  ship int;
  num int;
  oid uuid;
  pay_mins int;
  ref text;
begin
  if uid is null then raise exception 'auth_required'; end if;
  perform public.expire_holds(p_tenant);

  select * into t from public.tenants where id = p_tenant;
  if not found then raise exception 'tenant_not_found'; end if;
  if not exists (select 1 from public.customers where tenant_id = p_tenant and user_id = uid) then
    raise exception 'profile_required';
  end if;

  if coalesce((t.settings -> 'payments' ->> p_method::text)::boolean, false) = false then
    raise exception 'payment_method_disabled';
  end if;
  if coalesce((t.settings -> 'delivery' -> p_delivery::text ->> 'enabled')::boolean, false) = false then
    raise exception 'delivery_method_disabled';
  end if;

  select array_agg(id), coalesce(sum(price), 0) into ids, sub
  from (
    select id, price from public.products
    where tenant_id = p_tenant and status = 'reserved' and reserved_by = uid
      and order_id is null and reserved_until > now()
    for update
  ) q;
  if ids is null then raise exception 'empty_cart'; end if;

  ship := coalesce((t.settings -> 'delivery' -> p_delivery::text ->> 'cost')::int, 0);
  pay_mins := public.tenant_int(p_tenant, 'payment_minutes', 15);

  update public.tenants set next_order_number = next_order_number + 1
   where id = p_tenant returning next_order_number - 1 into num;

  -- referencia: 3 letras de la tienda + nº de pedido + 2 letras al azar
  ref := upper(left(regexp_replace(t.slug, '[^a-z]', '', 'g'), 3)) || '-' || lpad(num::text, 4, '0') || '-' ||
         substr(translate(upper(replace(gen_random_uuid()::text, '-', '')), '0123456789', 'ABCDEFGHJK'), 1, 2);

  insert into public.orders (tenant_id, number, customer_id, payment_method, payment_ref, delivery_method,
                             shipping_address, subtotal, shipping_cost, total, expires_at)
  values (p_tenant, num, uid, p_method, ref, p_delivery, coalesce(p_address, '{}'::jsonb),
          sub, ship, sub + ship, now() + make_interval(mins => pay_mins))
  returning id into oid;

  insert into public.order_items (order_id, tenant_id, product_id, product_number, title, photo, price)
  select oid, tenant_id, id, number, title, photos[1], price from public.products where id = any (ids);

  update public.products
     set order_id = oid, reserved_until = now() + make_interval(mins => pay_mins)
   where id = any (ids);

  return oid;
end $$;

-- La clienta sube el comprobante de transferencia
create or replace function public.attach_proof(p_order uuid, p_path text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  update public.orders
     set proof_path = p_path, proof_uploaded_at = now(), status = 'payment_review'
   where id = p_order and customer_id = uid and status = 'pending_payment'
     and payment_method = 'transfer';
  if not found then raise exception 'order_not_payable'; end if;
end $$;

-- La clienta cancela su pedido antes de pagar
create or replace function public.cancel_my_order(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  update public.orders set status = 'cancelled'
   where id = p_order and customer_id = uid and status = 'pending_payment';
  if not found then raise exception 'order_not_cancellable'; end if;
  perform public._release_product(pr.id) from public.products pr where pr.order_id = p_order and pr.status = 'reserved';
end $$;

-- ----------------------------------------------------------------------------
-- Pago confirmado (interna, la usan caja y los webhooks)
-- ----------------------------------------------------------------------------
create or replace function public._mark_paid(p_order uuid, p_by uuid, p_provider_id text default null)
returns text language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'order_not_found'; end if;
  if o.status in ('paid', 'preparing', 'shipped', 'delivered') then return 'already_paid'; end if;

  -- pago llegó tarde (pedido vencido o cancelado): las piezas pueden haber vuelto a la venta
  if o.status in ('expired', 'cancelled') then
    update public.orders
       set status = 'payment_review', provider_payment_id = coalesce(p_provider_id, provider_payment_id),
           notes = coalesce(notes || E'\n', '') || 'Pago recibido con el pedido vencido: revisar disponibilidad.'
     where id = p_order;
    return 'needs_review';
  end if;

  update public.orders
     set status = 'paid', paid_at = now(), confirmed_by = p_by, expires_at = null,
         provider_payment_id = coalesce(p_provider_id, provider_payment_id)
   where id = p_order;
  update public.products
     set status = 'sold', sold_at = now(), reserved_until = null
   where order_id = p_order;
  return 'paid';
end $$;

-- Caja / admin confirma una transferencia
create or replace function public.confirm_payment(p_order uuid)
returns text language plpgsql security definer set search_path = public as $$
declare tid uuid;
begin
  select tenant_id into tid from public.orders where id = p_order;
  if tid is null or not public.has_role(tid, '{admin,caja}') then raise exception 'forbidden'; end if;
  return public._mark_paid(p_order, auth.uid());
end $$;

-- Caja / admin rechaza el pago: las piezas vuelven a la venta (o a la fila)
create or replace function public.reject_order(p_order uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order for update;
  if not found or not public.has_role(o.tenant_id, '{admin,caja}') then raise exception 'forbidden'; end if;
  if o.status not in ('pending_payment', 'payment_review') then raise exception 'order_not_open'; end if;
  update public.orders set status = 'cancelled',
         notes = coalesce(notes || E'\n', '') || coalesce('Rechazado: ' || p_reason, 'Rechazado')
   where id = p_order;
  perform public._release_product(pr.id) from public.products pr where pr.order_id = p_order and pr.status = 'reserved';
end $$;

-- Caja / admin avanza el despacho
create or replace function public.set_order_status(p_order uuid, p_status public.order_status, p_tracking text default null)
returns void language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order for update;
  if not found or not public.has_role(o.tenant_id, '{admin,caja}') then raise exception 'forbidden'; end if;
  if p_status not in ('preparing', 'shipped', 'delivered') or o.status not in ('paid', 'preparing', 'shipped') then
    raise exception 'invalid_transition';
  end if;
  update public.orders set status = p_status, tracking = coalesce(p_tracking, tracking) where id = p_order;
end $$;

-- Webhooks de pasarelas (solo clave de servicio)
create or replace function public.mark_order_paid_system(p_order uuid, p_provider_id text)
returns text language sql security definer set search_path = public as $$
  select public._mark_paid(p_order, null, p_provider_id);
$$;

-- ----------------------------------------------------------------------------
-- Permisos de ejecución: nada para anónimos salvo lo explícito
-- ----------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.has_role(uuid, public.member_role[]) to anon, authenticated;
grant execute on function public.upsert_customer(uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.reserve_product(uuid) to authenticated;
grant execute on function public.release_my_reservation(uuid) to authenticated;
grant execute on function public.create_order(uuid, public.payment_method, public.delivery_method, jsonb) to authenticated;
grant execute on function public.attach_proof(uuid, text) to authenticated;
grant execute on function public.cancel_my_order(uuid) to authenticated;
grant execute on function public.confirm_payment(uuid) to authenticated;
grant execute on function public.reject_order(uuid, text) to authenticated;
grant execute on function public.set_order_status(uuid, public.order_status, text) to authenticated;
grant execute on function public.expire_holds(uuid) to service_role;
grant execute on function public.mark_order_paid_system(uuid, text) to service_role;
