import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { pathsFromUrls } from "@/lib/storage";
import type { Tenant } from "@/lib/types";

// Lo que ya no sirve no ocupa espacio:
//  · una pieza vendida se conserva `sold_retention_hours` (24 h por defecto) solo para quien la compró;
//    pasado ese plazo se borran sus fotos del almacenamiento y la pieza. El pedido guarda nombre, número y precio.
//  · el comprobante de un pedido cerrado se borra a los `proof_retention_days` (30 días por defecto).
type Ajustes = Partial<Pick<Tenant["settings"], "sold_retention_hours" | "proof_retention_days">>;

const horas = (n: number) => new Date(Date.now() - n * 3600 * 1000).toISOString();

export async function limpiarAlmacenamiento() {
  const db = createAdminClient();
  const { data: tenants } = await db.from("tenants").select("id, settings");
  let piezas = 0;
  let fotos = 0;
  let comprobantes = 0;

  for (const t of tenants ?? []) {
    const a = (t.settings ?? {}) as Ajustes;

    // 1) Piezas vendidas que ya pasaron su plazo
    const { data: vendidas } = await db
      .from("products")
      .select("id, photos")
      .eq("tenant_id", t.id)
      .eq("status", "sold")
      .lt("sold_at", horas(a.sold_retention_hours ?? 24))
      .limit(100);

    for (const p of vendidas ?? []) {
      const rutas = pathsFromUrls(p.photos ?? []);
      if (rutas.length) {
        const { error } = await db.storage.from("products").remove(rutas);
        if (error) continue; // si falla, se reintenta en la próxima pasada
        fotos += rutas.length;
      }
      await db.from("order_items").update({ photo: null }).eq("product_id", p.id);
      const { error } = await db.from("products").delete().eq("id", p.id);
      if (!error) piezas++;
    }

    // 2) Comprobantes de pedidos cerrados
    const { data: viejos } = await db
      .from("orders")
      .select("id, proof_path")
      .eq("tenant_id", t.id)
      .in("status", ["delivered", "cancelled", "expired"])
      .not("proof_path", "is", null)
      .lt("created_at", horas((a.proof_retention_days ?? 30) * 24))
      .limit(100);

    for (const o of viejos ?? []) {
      const { error } = await db.storage.from("proofs").remove([o.proof_path!]);
      if (error) continue;
      await db.from("orders").update({ proof_path: null }).eq("id", o.id);
      comprobantes++;
    }
  }
  // 3) Avisos de más de 30 días: ya no cuentan para el número del ícono y solo ocupan espacio
  await db.from("notifications").delete().lt("created_at", horas(30 * 24));
  return { piezas, fotos, comprobantes };
}

// Al mirar la tienda se revisa como mucho cada 15 minutos; el cron (barrido) lo hace sin depender de visitas.
let ultima = 0;
export async function limpiarSiToca() {
  if (Date.now() - ultima < 15 * 60 * 1000) return;
  ultima = Date.now();
  await limpiarAlmacenamiento();
}
