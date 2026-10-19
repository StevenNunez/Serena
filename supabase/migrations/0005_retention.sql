-- ============================================================================
-- Piezas vendidas: dejan de verse en la tienda. Solo las ve quien las compró
-- (el tiempo que la app las conserve) y el equipo.
-- ============================================================================

drop policy if exists products_read on public.products;

create policy products_read on public.products for select using (
  status in ('available', 'reserved')
  or public.has_role(tenant_id, '{admin,live,caja}')
  or (
    status = 'sold'
    and exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.product_id = products.id and o.customer_id = auth.uid()
    )
  )
);

create index if not exists products_sold_at_idx on public.products (sold_at) where status = 'sold';
create index if not exists orders_closed_proof_idx on public.orders (created_at) where proof_path is not null;
