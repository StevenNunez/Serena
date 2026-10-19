import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Alta y baja de personas del equipo. Solo un admin de la tienda puede llamarlo:
// crear o buscar una cuenta por correo requiere la clave de servicio, que no sale del servidor.
const ROLES = ["admin", "live", "caja"] as const;
type Role = (typeof ROLES)[number];

async function adminDe(tenantId: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: m } = await supabase
    .from("memberships").select("role").eq("tenant_id", tenantId).eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
  return m ? data.user : null;
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { tenantId?: string; email?: string; role?: string; name?: string } | null;
  const email = b?.email?.trim().toLowerCase();
  if (!b?.tenantId || !email || !/^\S+@\S+\.\S+$/.test(email) || !ROLES.includes(b.role as Role)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!(await adminDe(b.tenantId))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const db = createAdminClient();
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
  let id = list?.users.find((u) => u.email?.toLowerCase() === email)?.id;
  if (!id) {
    const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: b.name ?? "" } });
    if (error || !data.user) return NextResponse.json({ error: "create_failed" }, { status: 502 });
    id = data.user.id;
  }
  const { error } = await db
    .from("memberships")
    .upsert({ tenant_id: b.tenantId, user_id: id, role: b.role, full_name: b.name?.trim() || null });
  if (error) return NextResponse.json({ error: "save_failed" }, { status: 502 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const b = (await req.json().catch(() => null)) as { tenantId?: string; userId?: string } | null;
  if (!b?.tenantId || !b.userId) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (!(await adminDe(b.tenantId))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const db = createAdminClient();
  // Nunca dejar la tienda sin administradora
  const { data: admins } = await db.from("memberships").select("user_id").eq("tenant_id", b.tenantId).eq("role", "admin");
  if ((admins ?? []).length === 1 && admins![0].user_id === b.userId) {
    return NextResponse.json({ error: "last_admin" }, { status: 409 });
  }
  const { error } = await db.from("memberships").delete().eq("tenant_id", b.tenantId).eq("user_id", b.userId);
  if (error) return NextResponse.json({ error: "delete_failed" }, { status: 502 });
  return NextResponse.json({ ok: true });
}
