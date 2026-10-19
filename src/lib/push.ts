import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

export type Aviso = { titulo: string; texto: string; url: string };

let listo = false;
export function pushConfigurado() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  if (!listo) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:hola@teolabs.app", pub, priv);
    listo = true;
  }
  return true;
}

/**
 * Deja el aviso en la bandeja de cada persona (eso es lo que cuenta el número rojo del ícono)
 * y lo manda a sus celulares. Nunca lanza: un aviso que falla no debe romper la acción que lo originó.
 * `url` es una ruta de la propia tienda (/serena/pedido/...).
 */
export async function avisarPush(tenantId: string, userIds: string[], aviso: Aviso) {
  const destinos = [...new Set(userIds)];
  if (destinos.length === 0) return { enviados: 0 };
  try {
    const db = createAdminClient();
    const { error } = await db
      .from("notifications")
      .insert(destinos.map((user_id) => ({ tenant_id: tenantId, user_id, title: aviso.titulo, body: aviso.texto, url: aviso.url })));
    if (error) throw new Error(`notifications: ${error.message}`); // p. ej. falta aplicar la migración 0006
    if (!pushConfigurado()) return { enviados: 0 };

    const { data: subs } = await db
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .eq("tenant_id", tenantId)
      .in("user_id", destinos);
    if (!subs?.length) return { enviados: 0 };

    // Cuántos avisos sin leer tiene cada persona: es el número del ícono
    const sinLeer = new Map<string, number>();
    await Promise.all(
      destinos.map(async (id) => {
        const { count } = await db
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("user_id", id)
          .is("read_at", null);
        sinLeer.set(id, count ?? 1);
      }),
    );

    let enviados = 0;
    const muertas: string[] = [];
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ title: aviso.titulo, body: aviso.texto, url: aviso.url, badge: sinLeer.get(s.user_id) ?? 1 }),
            { TTL: 60 * 60 * 24 },
          );
          enviados++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) muertas.push(s.id); // el dispositivo ya no recibe avisos
          else console.error("[push]", code ?? e);
        }
      }),
    );
    if (muertas.length) await db.from("push_subscriptions").delete().in("id", muertas);
    return { enviados };
  } catch (e) {
    console.error("[push]", e);
    return { enviados: 0 };
  }
}

/** Equipo con permiso de ver pedidos (admin y caja) */
export async function idsDeCaja(tenantId: string) {
  const { data } = await createAdminClient().from("memberships").select("user_id").eq("tenant_id", tenantId).in("role", ["admin", "caja"]);
  return (data ?? []).map((m) => m.user_id as string);
}
