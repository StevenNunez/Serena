import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notificarPedido, origenActual } from "@/lib/email/enviar";
import type { Evento } from "@/lib/email/mensajes";

// Lo llama la pantalla justo después de una acción sobre un pedido.
// No acepta nada que la base no confirme: el pedido tiene que estar en el estado que corresponde
// y quien llama tiene que ser la clienta dueña (avisos suyos) o el equipo de caja/admin.
const REGLAS: Record<Exclude<Evento, "fila" | "vencido">, { quien: "clienta" | "equipo"; estados: string[] }> = {
  creado: { quien: "clienta", estados: ["pending_payment"] },
  comprobante: { quien: "clienta", estados: ["payment_review"] },
  pagado: { quien: "equipo", estados: ["paid", "preparing", "shipped", "delivered"] },
  listo: { quien: "equipo", estados: ["preparing"] },
  enviado: { quien: "equipo", estados: ["shipped"] },
  rechazado: { quien: "equipo", estados: ["cancelled"] },
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { orderId?: string; evento?: string } | null;
  const regla = body?.evento ? REGLAS[body.evento as keyof typeof REGLAS] : undefined;
  if (!body?.orderId || !regla) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "auth_required" }, { status: 401 });

  // La lectura pasa por RLS: solo ve el pedido su dueña o el equipo
  const { data: o } = await supabase.from("orders").select("id, tenant_id, customer_id, status, delivery_method").eq("id", body.orderId).maybeSingle();
  if (!o || !regla.estados.includes(o.status)) return NextResponse.json({ error: "not_applicable" }, { status: 409 });

  if (body.evento === "listo" && o.delivery_method !== "pickup") {
    return NextResponse.json({ error: "not_applicable" }, { status: 409 });
  }

  if (regla.quien === "clienta") {
    if (o.customer_id !== auth.user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  } else {
    const { data: m } = await supabase
      .from("memberships").select("role").eq("tenant_id", o.tenant_id).eq("user_id", auth.user.id).in("role", ["admin", "caja"]).maybeSingle();
    if (!m) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const r = await notificarPedido(body.evento as keyof typeof REGLAS, o.id, await origenActual());
    return NextResponse.json({ result: r });
  } catch (e) {
    console.error("[correo]", e);
    return NextResponse.json({ error: "send_failed" }, { status: 502 });
  }
}
