"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatClock, useSecondsLeft } from "@/components/Countdown";
import { avisar } from "@/lib/avisar";
import { formatCLP, pieceLabel } from "@/lib/format";
import { card, field, ghostBtn, primaryBtn } from "@/components/ui";
import type { Address, DeliveryMethod, Product, TenantSettings } from "@/lib/types";

type Props = {
  slug: string;
  tenantId: string;
  items: Product[];
  delivery: TenantSettings["delivery"];
  payments: TenantSettings["payments"];
  customer: { name: string; phone: string; address: Address };
};

const ERRORS: Record<string, string> = {
  empty_cart: "Tus reservas vencieron. Vuelve a elegir tus piezas.",
  payment_method_disabled: "Ese medio de pago no está disponible.",
  delivery_method_disabled: "Ese tipo de entrega no está disponible.",
  profile_required: "Completa tus datos para seguir.",
};

export default function CheckoutForm({ slug, tenantId, items, delivery, payments, customer }: Props) {
  const router = useRouter();
  const methods = (Object.keys(delivery) as DeliveryMethod[]).filter((k) => delivery[k].enabled);
  const [method, setMethod] = useState<DeliveryMethod>(methods[0] ?? "pickup");
  const [addr, setAddr] = useState<Address>(customer.address);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const earliest = items.length ? items.map((i) => i.reserved_until!).sort()[0] : null;
  const left = useSecondsLeft(earliest);

  const subtotal = items.reduce((s, i) => s + i.price, 0);
  const shipping = delivery[method]?.cost ?? 0;
  const needsAddress = method !== "pickup";
  const addressOk = !needsAddress || (!!addr.street?.trim() && !!addr.commune?.trim() && !!addr.region?.trim());

  if (items.length === 0) {
    return (
      <div className="px-6 pt-10 text-center">
        <h1 className="font-display text-3xl">No tienes piezas por pagar</h1>
        <p className="mt-2 text-muted">Cuando toques «¡Es mía!» en una pieza, la guardamos para ti aquí.</p>
        <Link href={`/${slug}`} className={`${primaryBtn} mt-6`}>Ver piezas</Link>
      </div>
    );
  }

  async function drop(id: string) {
    setBusy(true);
    await createClient().rpc("release_my_reservation", { p_product: id });
    setBusy(false);
    router.refresh();
  }

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!addressOk) return setError("Completa la dirección de entrega.");
    setBusy(true);
    setError(null);
    const supabase = createClient();
    if (needsAddress) {
      await supabase.rpc("upsert_customer", {
        p_tenant: tenantId, p_name: customer.name, p_phone: customer.phone, p_address: addr,
      });
    }
    const { data, error } = await supabase.rpc("create_order", {
      p_tenant: tenantId,
      p_method: "transfer",
      p_delivery: method,
      p_address: needsAddress ? addr : {},
    });
    if (error) {
      setBusy(false);
      return setError(ERRORS[error.message] ?? "No pudimos crear tu pedido. Intenta de nuevo.");
    }
    avisar(data as string, "creado");
    router.push(`/${slug}/pedido/${data as string}`);
  }

  const set = (k: keyof Address) => (e: React.ChangeEvent<HTMLInputElement>) => setAddr((a) => ({ ...a, [k]: e.target.value }));

  return (
    <form onSubmit={pay} className="space-y-5 px-4 pt-4">
      <div>
        <h1 className="font-display text-3xl">Tu pedido</h1>
        {left !== null && (
          <p className={`mt-1 text-sm font-bold ${left < 60 ? "text-brand" : "text-muted"}`} role="timer">
            Te guardamos las piezas {formatClock(left)} más
          </p>
        )}
      </div>

      <ul className="space-y-2">
        {items.map((p) => (
          <li key={p.id} className={`${card} flex items-center gap-3`}>
            <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-blush">
              {p.photos[0] ? <Image src={p.photos[0]} alt="" fill sizes="64px" className="object-cover" /> : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{p.title}</p>
              <p className="text-xs text-muted">{pieceLabel(p.number)}</p>
              <p className="text-sm font-bold text-brand">{formatCLP(p.price)}</p>
            </div>
            <button type="button" onClick={() => drop(p.id)} disabled={busy} className="text-sm font-semibold text-muted underline">
              Quitar
            </button>
          </li>
        ))}
      </ul>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-bold">¿Cómo la recibes?</legend>
        {methods.map((m) => (
          <label key={m} className={`${card} flex cursor-pointer items-center gap-3 ${method === m ? "border-brand ring-1 ring-brand" : ""}`}>
            <input type="radio" name="delivery" checked={method === m} onChange={() => setMethod(m)} className="accent-[var(--brand)]" />
            <span className="flex-1 text-sm font-semibold">{delivery[m].label}</span>
            <span className="text-sm font-bold">{delivery[m].cost ? formatCLP(delivery[m].cost) : "Gratis"}</span>
          </label>
        ))}
      </fieldset>

      {needsAddress && (
        <div className="space-y-3">
          <label className="block text-sm font-semibold" htmlFor="street">Calle y número</label>
          <input id="street" required value={addr.street ?? ""} onChange={set("street")} className={field} autoComplete="street-address" />
          <label className="block text-sm font-semibold" htmlFor="commune">Comuna</label>
          <input id="commune" required value={addr.commune ?? ""} onChange={set("commune")} className={field} />
          <label className="block text-sm font-semibold" htmlFor="region">Región</label>
          <input id="region" required value={addr.region ?? ""} onChange={set("region")} className={field} />
          <label className="block text-sm font-semibold" htmlFor="notes">Indicaciones (opcional)</label>
          <input id="notes" value={addr.notes ?? ""} onChange={set("notes")} className={field} />
        </div>
      )}

      <div className={`${card} space-y-1 text-sm`}>
        <div className="flex justify-between"><span>Piezas</span><span>{formatCLP(subtotal)}</span></div>
        <div className="flex justify-between"><span>Entrega</span><span>{shipping ? formatCLP(shipping) : "Gratis"}</span></div>
        <div className="flex justify-between border-t border-line pt-2 text-lg font-bold">
          <span>Total</span><span className="text-brand">{formatCLP(subtotal + shipping)}</span>
        </div>
      </div>

      <p className="text-sm text-muted">
        {payments.transfer ? "Pagas por transferencia: en el paso siguiente verás los datos y subes tu comprobante." : "Sin medios de pago disponibles."}
      </p>

      <button className={primaryBtn} disabled={busy || !payments.transfer}>{busy ? "Creando pedido…" : "Confirmar y pagar"}</button>
      <Link href={`/${slug}`} className={`${ghostBtn} w-full`}>Seguir mirando</Link>
      <p role="alert" className="min-h-5 text-center text-sm font-semibold text-brand">{error}</p>
    </form>
  );
}
