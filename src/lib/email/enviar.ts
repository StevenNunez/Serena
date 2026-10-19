import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarCorreo, smtpConfigurado } from "@/lib/email/smtp";
import { correoDeFila, correoDePedido, type DatosPedido, type Evento } from "@/lib/email/mensajes";
import type { Marca } from "@/lib/email/plantilla";
import { avisarPush, idsDeCaja, type Aviso } from "@/lib/push";
import type { Bank, Order, Tenant } from "@/lib/types";

// Los correos de la cuenta demo no salen a su dirección: van a la casilla de la persona dueña del proyecto.
const redirigir = (para: string) => {
  const demo = process.env.DEMO_EMAIL?.toLowerCase();
  const dueno = process.env.OWNER_EMAIL;
  return demo && dueno && para.toLowerCase() === demo ? { para: dueno, prefijo: "[demo] " } : { para, prefijo: "" };
};

/** Dominio desde el que se pidió la acción. Sin petición, el de NEXT_PUBLIC_SITE_URL. */
export async function origenActual() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) return `${host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https"}://${host}`;
  } catch {
    /* fuera de una petición */
  }
  return "http://localhost:3000";
}

function marcaDe(t: Pick<Tenant, "id" | "name" | "theme" | "settings">, origen: string): Marca {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const settings = t.settings as Tenant["settings"] & { legal?: Marca["legal"] };
  return {
    nombre: t.name,
    logo: base ? `${base}/storage/v1/object/public/products/${t.id}/brand/wordmark-white.png` : null,
    primario: t.theme.primary ?? "#c10b21",
    acento: t.theme.accent ?? "#fa95b3",
    sitio: process.env.NEXT_PUBLIC_SITE_URL ?? (origen.includes("localhost") ? null : origen),
    legal: settings.legal,
  };
}

async function emailDe(db: ReturnType<typeof createAdminClient>, userId: string) {
  const { data } = await db.auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}

async function entregar(nombre: string, para: string, c: { asunto: string; texto: string; html: string }) {
  const r = redirigir(para);
  await enviarCorreo({ nombre, para: r.para, asunto: `${r.prefijo}${c.asunto}`, texto: c.texto, html: c.html });
}

function avisoDePedido(evento: Exclude<Evento, "fila">, d: DatosPedido, urlPedido: string, urlPanel: string): Aviso | null {
  const n = `Pedido #${d.numero}`;
  switch (evento) {
    case "comprobante":
      return { titulo: "Pago por revisar", texto: `${n} · ${d.clienta || "una clienta"} subió su comprobante`, url: urlPanel };
    case "pagado":
      return { titulo: "¡Pago confirmado!", texto: `${n}: ya estamos preparando tus piezas.`, url: urlPedido };
    case "listo":
      return { titulo: "¡Listo para retirar!", texto: d.retiro.horario ? `${n} · ${d.retiro.horario}` : `${n} te espera en tienda.`, url: urlPedido };
    case "enviado":
      return { titulo: "Tu pedido va en camino", texto: d.seguimiento ? `${n} · seguimiento ${d.seguimiento}` : `${n} ya salió.`, url: urlPedido };
    case "rechazado":
      return { titulo: "No pudimos confirmar tu pago", texto: `${n}: las piezas volvieron a la venta.`, url: urlPedido };
    case "vencido":
      return { titulo: "Tu pedido venció", texto: `${n}: no recibimos el pago a tiempo.`, url: urlPedido };
    default:
      return null; // «creado»: la clienta acaba de hacerlo, no hace falta avisarle
  }
}

/**
 * Avisa por un evento de un pedido. Cada (pedido, evento) sale una sola vez:
 * se reserva en email_log antes de enviar y se libera si el SMTP falla.
 */
export async function notificarPedido(evento: Exclude<Evento, "fila">, orderId: string, origen: string) {
  const db = createAdminClient();

  const { data: o } = await db.from("orders").select("*, order_items(*)").eq("id", orderId).maybeSingle();
  if (!o) return "no_existe" as const;
  const order = o as Order;

  const { data: t } = await db.from("tenants").select("id, slug, name, theme, settings").eq("id", order.tenant_id).single();
  const tenant = t as Tenant;

  const claim = await db.from("email_log").insert({ tenant_id: tenant.id, order_id: order.id, kind: evento });
  if (claim.error) {
    if (claim.error.code === "23505") return "duplicado" as const;
    throw new Error(`email_log: ${claim.error.message}`); // p. ej. falta aplicar la migración 0004
  }

  try {
    const [{ data: bankRow }, { data: cust }] = await Promise.all([
      db.from("tenant_bank").select("data").eq("tenant_id", tenant.id).maybeSingle(),
      db.from("customers").select("full_name, email").eq("tenant_id", tenant.id).eq("user_id", order.customer_id).maybeSingle(),
    ]);
    const datos: DatosPedido = {
      numero: order.number,
      total: order.total,
      referencia: order.payment_ref,
      entrega: order.delivery_method,
      seguimiento: order.tracking,
      motivo: order.notes?.split("\n").find((l) => l.startsWith("Rechazado")) ?? null,
      retiro: { direccion: tenant.settings.pickup_info?.address, horario: tenant.settings.pickup_info?.hours, notas: tenant.settings.pickup_info?.notes },
      direccionEnvio: [order.shipping_address.street, order.shipping_address.commune, order.shipping_address.region].filter(Boolean).join(", "),
      minutosParaPagar: tenant.settings.payment_minutes,
      piezas: (order.order_items ?? []).map((i) => ({ titulo: i.title, numero: i.product_number, precio: i.price })),
      clienta: cust?.full_name ?? "",
      urlPedido: `${origen}/${tenant.slug}/pedido/${order.id}`,
      urlPanel: `${origen}/${tenant.slug}/admin`,
      urlTienda: `${origen}/${tenant.slug}`,
    };
    const correo = correoDePedido(marcaDe(tenant, origen), evento, datos, (bankRow?.data ?? {}) as Bank);

    if (smtpConfigurado()) {
      if (evento === "comprobante") {
        const { data: equipo } = await db.from("memberships").select("user_id").eq("tenant_id", tenant.id).in("role", ["admin", "caja"]);
        const destinos = (await Promise.all((equipo ?? []).map((m) => emailDe(db, m.user_id)))).filter((x): x is string => !!x);
        for (const para of new Set(destinos)) await entregar(tenant.name, para, correo);
      } else {
        const para = cust?.email ?? (await emailDe(db, order.customer_id));
        if (!para) throw new Error("sin correo de la clienta");
        await entregar(tenant.name, para, correo);
      }
    }

    // Aviso en el celular: va después del correo y nunca lo hace fallar
    const aviso = avisoDePedido(evento, datos, `/${tenant.slug}/pedido/${order.id}`, `/${tenant.slug}/admin`);
    if (aviso) {
      const quienes = evento === "comprobante" ? await idsDeCaja(tenant.id) : [order.customer_id];
      await avisarPush(tenant.id, quienes, aviso);
    }
    return smtpConfigurado() ? ("enviado" as const) : ("sin_smtp" as const);
  } catch (e) {
    await db.from("email_log").delete().eq("order_id", order.id).eq("kind", evento);
    throw e;
  }
}

/**
 * Lo que pasa en la base sin que nadie lo dispare desde la pantalla:
 * piezas que se le asignaron a la primera de la fila y pedidos que vencieron.
 * Se llama por cron y de forma oportunista al mirar la tienda.
 */
export async function barrerPendientes(origen?: string) {
  const db = createAdminClient();
  const base = origen ?? (await origenActual());
  let fila = 0;
  let vencidos = 0;

  // 1) Fila de espera: se toma la marca de forma atómica para que dos barridos no manden el mismo correo
  const { data: tomadas } = await db
    .from("products")
    .update({ notify_promoted: false })
    .eq("notify_promoted", true)
    .select("id, number, title, price, tenant_id, status, reserved_by, order_id");

  for (const p of tomadas ?? []) {
    if (p.status !== "reserved" || !p.reserved_by || p.order_id) continue;
    try {
      const { data: t } = await db.from("tenants").select("id, slug, name, theme, settings").eq("id", p.tenant_id).single();
      const tenant = t as Tenant;
      const { data: cust } = await db.from("customers").select("full_name, email").eq("tenant_id", tenant.id).eq("user_id", p.reserved_by).maybeSingle();
      const para = cust?.email ?? (await emailDe(db, p.reserved_by));
      await avisarPush(tenant.id, [p.reserved_by], {
        titulo: `¡Te tocó la pieza #${p.number}!`,
        texto: `La guardamos para ti ${tenant.settings.reservation_minutes} minutos: entra y págala.`,
        url: `/${tenant.slug}/p/${p.number}`,
      });
      if (!para || !smtpConfigurado()) continue;
      const c = correoDeFila(marcaDe(tenant, base), {
        clienta: cust?.full_name ?? "",
        pieza: { titulo: p.title, numero: p.number, precio: p.price },
        minutos: tenant.settings.reservation_minutes,
        urlPieza: `${base}/${tenant.slug}/p/${p.number}`,
      });
      await entregar(tenant.name, para, c);
      fila++;
    } catch (e) {
      console.error("[correo] fila de espera:", e);
    }
  }

  // 2) Pedidos vencidos de los últimos días sin aviso
  const desde = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
  const { data: vencidosDb } = await db.from("orders").select("id").eq("status", "expired").gt("created_at", desde).limit(20);
  for (const o of vencidosDb ?? []) {
    try {
      if ((await notificarPedido("vencido", o.id, base)) === "enviado") vencidos++;
    } catch (e) {
      console.error("[correo] vencido:", e);
    }
  }
  return { fila, vencidos };
}
