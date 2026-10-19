import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Body = { slug?: string; subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } } };

// Guarda (o traspasa a la persona que tiene la sesión abierta) el dispositivo que aceptó los avisos.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  const sub = body?.subscription;
  if (!body?.slug || !sub?.endpoint || !sub.keys?.p256dh || !sub.keys.auth || !sub.endpoint.startsWith("https://")) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { data: auth } = await (await createClient()).auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "auth_required" }, { status: 401 });

  const db = createAdminClient();
  const { data: t } = await db.from("tenants").select("id").eq("slug", body.slug).maybeSingle();
  if (!t) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { error } = await db.from("push_subscriptions").upsert(
    { tenant_id: t.id, user_id: auth.user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    { onConflict: "endpoint" },
  );
  if (error) return NextResponse.json({ error: "save_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const body = (await req.json().catch(() => null)) as { endpoint?: string } | null;
  if (!body?.endpoint) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { data: auth } = await (await createClient()).auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "auth_required" }, { status: 401 });
  await createAdminClient().from("push_subscriptions").delete().eq("endpoint", body.endpoint).eq("user_id", auth.user.id);
  return NextResponse.json({ ok: true });
}
