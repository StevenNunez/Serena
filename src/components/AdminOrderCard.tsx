"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import StatusBadge from "@/components/StatusBadge";
import { card, field, ghostBtn, smallBtn } from "@/components/ui";
import { avisar } from "@/lib/avisar";
import { DELIVERY_LABEL, formatCLP, formatDate, pieceLabel } from "@/lib/format";
import type { Customer, Order } from "@/lib/types";

type Props = { order: Order; customer: Pick<Customer, "full_name" | "phone" | "email"> | null };

export default function AdminOrderCard({ order: o, customer }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [tracking, setTracking] = useState(o.tracking ?? "");

  async function run(
    fn: () => PromiseLike<{ error: { message: string } | null; data?: unknown }>,
    evento?: "pagado" | "listo" | "enviado" | "rechazado",
  ) {
    setBusy(true);
    setMsg(null);
    const { error, data } = await fn();
    setBusy(false);
    if (error) return setMsg(`No se pudo: ${error.message}`);
    if (evento && data !== "needs_review") avisar(o.id, evento);
    if (data === "needs_review") setMsg("El pago llegó con el pedido vencido: revisa si las piezas siguen disponibles.");
    router.refresh();
  }

  const supabase = createClient();
  const rpc = supabase.rpc.bind(supabase);

  async function viewProof() {
    if (!o.proof_path) return;
    const { data } = await supabase.storage.from("proofs").createSignedUrl(o.proof_path, 120);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    else setMsg("No pudimos abrir el comprobante.");
  }

  const pickup = o.delivery_method === "pickup";
  const phone = customer?.phone?.replace(/\D/g, "");

  return (
    <article className={`${card} space-y-3`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold">Pedido #{o.number} · {formatCLP(o.total)}</p>
          <p className="text-xs text-muted">{formatDate(o.created_at)} · ref {o.payment_ref}</p>
        </div>
        <StatusBadge status={o.status} delivery={o.delivery_method} />
      </div>

      <div className="text-sm">
        <p className="font-semibold">{customer?.full_name ?? "Clienta"}</p>
        {phone ? (
          <a className="text-brand underline" href={`https://wa.me/${phone}`} target="_blank" rel="noopener noreferrer">
            {customer?.phone}
          </a>
        ) : null}
      </div>

      <ul className="space-y-0.5 text-sm">
        {(o.order_items ?? []).map((it) => (
          <li key={it.id} className="flex justify-between gap-2">
            <span className="truncate">{it.title} <span className="text-muted">({pieceLabel(it.product_number)})</span></span>
            <span>{formatCLP(it.price)}</span>
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted">
        {DELIVERY_LABEL[o.delivery_method]}
        {o.delivery_method !== "pickup" && o.shipping_address.street
          ? ` · ${o.shipping_address.street}, ${o.shipping_address.commune}, ${o.shipping_address.region}${o.shipping_address.notes ? ` (${o.shipping_address.notes})` : ""}`
          : ""}
      </p>
      {o.notes ? <p className="rounded-xl bg-blush px-3 py-2 text-xs">{o.notes}</p> : null}

      <div className="flex flex-wrap gap-2">
        {o.proof_path && <button onClick={viewProof} className={ghostBtn}>Ver comprobante</button>}

        {(o.status === "payment_review" || o.status === "pending_payment") && (
          <>
            <button disabled={busy} className={smallBtn} onClick={() => run(() => rpc("confirm_payment", { p_order: o.id }), "pagado")}>
              Confirmar pago
            </button>
            <button disabled={busy} className={ghostBtn} onClick={() => setRejecting((r) => !r)}>Rechazar</button>
          </>
        )}

        {pickup && o.status === "paid" && (
          <button disabled={busy} className={smallBtn} onClick={() => run(() => rpc("set_order_status", { p_order: o.id, p_status: "preparing" }), "listo")}>
            Listo para retirar
          </button>
        )}
        {pickup && (o.status === "paid" || o.status === "preparing") && (
          <button
            disabled={busy}
            className={o.status === "preparing" ? smallBtn : ghostBtn}
            onClick={() => run(() => rpc("set_order_status", { p_order: o.id, p_status: "delivered" }))}
          >
            Marcar retirado
          </button>
        )}
        {!pickup && o.status === "paid" && (
          <button disabled={busy} className={smallBtn} onClick={() => run(() => rpc("set_order_status", { p_order: o.id, p_status: "preparing" }))}>
            Agendar envío
          </button>
        )}
        {!pickup && o.status === "shipped" && (
          <button disabled={busy} className={smallBtn} onClick={() => run(() => rpc("set_order_status", { p_order: o.id, p_status: "delivered" }))}>
            Marcar recibido
          </button>
        )}
      </div>

      {rejecting && (
        <div className="space-y-2">
          <label htmlFor={`why-${o.id}`} className="text-xs font-semibold">Motivo (se guarda en el pedido)</label>
          <input id={`why-${o.id}`} value={reason} onChange={(e) => setReason(e.target.value)} className={field} />
          <button
            disabled={busy}
            className={smallBtn}
            onClick={() => run(() => rpc("reject_order", { p_order: o.id, p_reason: reason.trim() || null }), "rechazado")}
          >
            Confirmar rechazo
          </button>
        </div>
      )}

      {!pickup && (o.status === "paid" || o.status === "preparing") && (
        <div className="space-y-2">
          <label htmlFor={`trk-${o.id}`} className="text-xs font-semibold">Número de seguimiento (opcional)</label>
          <div className="flex gap-2">
            <input id={`trk-${o.id}`} value={tracking} onChange={(e) => setTracking(e.target.value)} className={field} />
            <button
              disabled={busy}
              className={smallBtn}
              onClick={() => run(() => rpc("set_order_status", { p_order: o.id, p_status: "shipped", p_tracking: tracking.trim() || null }), "enviado")}
            >
              Enviado
            </button>
          </div>
        </div>
      )}

      <p role="status" className="min-h-4 text-xs font-semibold text-brand">{msg}</p>
    </article>
  );
}
