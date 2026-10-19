-- ============================================================================
-- Almacenamiento de fotos / comprobantes y vencimiento automático por cron
-- Rutas:  products/{tenant_id}/{archivo}      (público para leer)
--         proofs/{tenant_id}/{order_id}/{archivo}  (privado)
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('products', 'products', true,  5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('proofs',   'proofs',   false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- Fotos de piezas: lectura pública, escritura de admin/live en la carpeta de su tienda
create policy products_files_read on storage.objects for select
  using (bucket_id = 'products');

create policy products_files_write on storage.objects for insert to authenticated
  with check (bucket_id = 'products'
              and public.has_role(((storage.foldername(name))[1])::uuid, '{admin,live}'));

create policy products_files_update on storage.objects for update to authenticated
  using (bucket_id = 'products'
         and public.has_role(((storage.foldername(name))[1])::uuid, '{admin,live}'));

create policy products_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'products'
         and public.has_role(((storage.foldername(name))[1])::uuid, '{admin,live}'));

-- Comprobantes: los sube la dueña del pedido; los ve ella y caja/admin
create policy proofs_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'proofs'
    and exists (
      select 1 from public.orders o
      where o.id = ((storage.foldername(name))[2])::uuid
        and o.tenant_id = ((storage.foldername(name))[1])::uuid
        and o.customer_id = auth.uid()
    )
  );

create policy proofs_read on storage.objects for select to authenticated
  using (
    bucket_id = 'proofs'
    and exists (
      select 1 from public.orders o
      where o.id = ((storage.foldername(name))[2])::uuid
        and (o.customer_id = auth.uid() or public.has_role(o.tenant_id, '{admin,caja}'))
    )
  );

-- Vencimiento de reservas y pedidos cada minuto (además del vencimiento perezoso al reservar)
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('expire-holds', '* * * * *', 'select public.expire_holds()');
exception when others then
  raise notice 'pg_cron no disponible: activar la extensión en el panel de Supabase (Database > Extensions)';
end $$;
