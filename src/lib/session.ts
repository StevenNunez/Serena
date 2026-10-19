import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { barrerPendientes } from "@/lib/email/enviar";
import { limpiarSiToca } from "@/lib/limpieza";
import type { Customer, Role } from "@/lib/types";

// Quién mira la página: sesión, ficha de clienta en esta tienda y rol de equipo (si tiene)
export const getViewer = cache(async (tenantId: string) => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { supabase, user: null, customer: null as Customer | null, role: null as Role | null };

  const [c, m] = await Promise.all([
    supabase.from("customers").select("*").eq("tenant_id", tenantId).eq("user_id", user.id).maybeSingle(),
    supabase.from("memberships").select("role").eq("tenant_id", tenantId).eq("user_id", user.id).maybeSingle(),
  ]);
  return {
    supabase,
    user,
    customer: (c.data ?? null) as Customer | null,
    role: (m.data?.role ?? null) as Role | null,
  };
});

export async function requireCustomer(slug: string, tenantId: string, next: string) {
  const v = await getViewer(tenantId);
  const q = `next=${encodeURIComponent(next)}`;
  if (!v.user) redirect(`/${slug}/login?${q}`);
  if (!v.customer) redirect(`/${slug}/login?step=perfil&${q}`);
  return { ...v, user: v.user, customer: v.customer };
}

// Acceso al panel: devuelve el rol o manda a la tienda
export async function requireStaff(slug: string, tenantId: string, allowed: Role[]) {
  const v = await getViewer(tenantId);
  if (!v.user) redirect(`/${slug}/login?next=${encodeURIComponent(`/${slug}/admin`)}`);
  if (!v.role || !allowed.includes(v.role)) redirect(`/${slug}`);
  return { ...v, user: v.user, role: v.role };
}

// Vence lo que corresponda al momento de mirar (además del cron de la base)
export async function expireHolds(tenantId: string) {
  try {
    await createAdminClient().rpc("expire_holds", { p_tenant: tenantId });
    void barrerPendientes().catch((e) => console.error("[correo] barrido:", e));
    void limpiarSiToca().catch((e) => console.error("[limpieza]", e));
  } catch {
    /* el cron lo resuelve */
  }
}
