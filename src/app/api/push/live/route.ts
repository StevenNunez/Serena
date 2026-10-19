import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { avisarPush } from "@/lib/push";
import { PLATAFORMAS } from "@/lib/live";

const NOMBRES: Record<string, string> = Object.fromEntries(PLATAFORMAS.map((x) => [x.id, x.nombre]));

// Lo llama el panel al empezar un en vivo: avisa a todas las clientas que activaron los avisos.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { sessionId?: string } | null;
  if (!body?.sessionId) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "auth_required" }, { status: 401 });

  // Pasa por RLS: solo el equipo de esa tienda ve la sesión; y tiene que estar en vivo ahora
  const { data: s } = await supabase.from("live_sessions").select("id, tenant_id, title, status, started_at, platform").eq("id", body.sessionId).maybeSingle();
  if (!s || s.status !== "live" || Date.now() - new Date(s.started_at).getTime() > 10 * 60 * 1000) {
    return NextResponse.json({ error: "not_applicable" }, { status: 409 });
  }
  const { data: m } = await supabase
    .from("memberships").select("role").eq("tenant_id", s.tenant_id).eq("user_id", auth.user.id).in("role", ["admin", "live"]).maybeSingle();
  if (!m) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const db = createAdminClient();
  const url = `/${await slugDe(db, s.tenant_id)}/live`;
  // Un solo aviso por en vivo
  const { data: ya } = await db.from("notifications").select("id").eq("tenant_id", s.tenant_id).eq("url", url).gt("created_at", s.started_at).limit(1);
  if (ya?.length) return NextResponse.json({ result: "duplicado" });

  const { data: subs } = await db.from("push_subscriptions").select("user_id").eq("tenant_id", s.tenant_id);
  const destinos = (subs ?? []).map((x) => x.user_id as string).filter((id) => id !== auth.user.id);
  const r = await avisarPush(s.tenant_id, destinos, {
    titulo: "¡Estamos en vivo!",
    texto: s.platform ? `${s.title} · por ${NOMBRES[s.platform] ?? s.platform}` : s.title,
    url,
  });
  return NextResponse.json({ result: r });
}

async function slugDe(db: ReturnType<typeof createAdminClient>, tenantId: string) {
  const { data } = await db.from("tenants").select("slug").eq("id", tenantId).single();
  return data?.slug as string;
}
