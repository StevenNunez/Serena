"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatClock, useSecondsLeft } from "@/components/Countdown";
import { ghostBtn, primaryBtn } from "@/components/ui";
import { avisar } from "@/lib/avisar";
import { resizeImage } from "@/lib/image";
import type { OrderStatus } from "@/lib/types";

type Props = {
  orderId: string;
  tenantId: string;
  slug: string;
  status: OrderStatus;
  expiresAt: string | null;
  hasProof: boolean;
};

export default function OrderActions({ orderId, tenantId, slug, status, expiresAt, hasProof }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const left = useSecondsLeft(status === "pending_payment" ? expiresAt : null);

  // El estado cambia solo cuando caja confirma o el pedido vence
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`order-${orderId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` }, () =>
        router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [orderId, router]);

  useEffect(() => {
    if (left === 0) router.refresh();
  }, [left, router]);

  async function upload(file: File) {
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    try {
      const isPdf = file.type === "application/pdf";
      const body = isPdf ? file : await resizeImage(file, 1400, 350 * 1024);
      const ext = isPdf ? "pdf" : "jpg";
      const path = `${tenantId}/${orderId}/${Date.now()}.${ext}`;
      const up = await supabase.storage.from("proofs").upload(path, body, {
        contentType: isPdf ? "application/pdf" : "image/jpeg",
      });
      if (up.error) throw up.error;
      const { error } = await supabase.rpc("attach_proof", { p_order: orderId, p_path: path });
      if (error) throw error;
      avisar(orderId, "comprobante");
      router.refresh();
    } catch {
      setMsg("No pudimos subir el comprobante. Revisa que sea una foto o PDF e intenta de nuevo.");
    }
    setBusy(false);
  }

  async function cancel() {
    setBusy(true);
    const { error } = await createClient().rpc("cancel_my_order", { p_order: orderId });
    setBusy(false);
    if (error) return setMsg("No pudimos cancelar el pedido.");
    router.push(`/${slug}/mis-piezas`);
    router.refresh();
  }

  if (status === "pending_payment") {
    return (
      <div className="space-y-3">
        {left !== null && (
          <p className={`text-center text-sm font-bold ${left < 120 ? "text-brand" : "text-muted"}`} role="timer">
            Tienes {formatClock(left)} para pagar
          </p>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="sr-only"
          aria-label="Comprobante de transferencia"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = "";
          }}
        />
        <button onClick={() => fileRef.current?.click()} disabled={busy} className={primaryBtn}>
          {busy ? "Subiendo…" : "Ya transferí · subir comprobante"}
        </button>
        <button onClick={cancel} disabled={busy} className={`${ghostBtn} w-full`}>Cancelar pedido</button>
        <p role="alert" className="min-h-5 text-center text-sm font-semibold text-brand">{msg}</p>
      </div>
    );
  }

  if (status === "payment_review") {
    return (
      <p className="rounded-2xl bg-blush px-4 py-3 text-center text-sm font-semibold">
        {hasProof ? "Recibimos tu comprobante. Estamos confirmando tu pago; te avisamos aquí apenas esté listo." : "Estamos revisando tu pedido."}
      </p>
    );
  }

  if (status === "expired" || status === "cancelled") {
    return (
      <p className="rounded-2xl bg-blush px-4 py-3 text-center text-sm font-semibold">
        {status === "expired" ? "El plazo para pagar venció y las piezas volvieron a la venta." : "Este pedido fue cancelado."}
      </p>
    );
  }

  return null;
}
