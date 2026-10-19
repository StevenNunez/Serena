import { getTenant } from "@/lib/tenant";
import { requireStaff } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import StoreSettings from "@/components/StoreSettings";
import TeamManager, { type Member } from "@/components/TeamManager";
import type { Bank, Role } from "@/lib/types";

export default async function AdminStore({ params }: PageProps<"/[tenant]/admin/tienda">) {
  const { tenant: slug } = await params;
  const t = await getTenant(slug);
  const v = await requireStaff(slug, t.id, ["admin"]);

  const { data } = await v.supabase.from("tenant_bank").select("data").eq("tenant_id", t.id).maybeSingle();

  // Los correos viven en auth.users: se leen con la clave de servicio, solo para esta pantalla de administración
  const db = createAdminClient();
  const { data: rows } = await v.supabase.from("memberships").select("user_id, role, full_name").eq("tenant_id", t.id);
  const members: Member[] = await Promise.all(
    (rows ?? []).map(async (m) => ({
      user_id: m.user_id,
      role: m.role as Role,
      full_name: m.full_name,
      email: (await db.auth.admin.getUserById(m.user_id)).data.user?.email ?? null,
    })),
  );

  return (
    <div className="space-y-5 px-4 pt-3">
      <StoreSettings tenantId={t.id} settings={t.settings} bank={(data?.data ?? {}) as Bank} />
      <TeamManager tenantId={t.id} members={members} meId={v.user.id} />
    </div>
  );
}
