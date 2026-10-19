import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { expireHolds, requireCustomer } from "@/lib/session";
import OrderActions from "@/components/OrderActions";
import StatusBadge from "@/components/StatusBadge";
import OrderStatusInfo from "@/components/OrderStatusInfo";
import PushToggle from "@/components/PushToggle";
import { DELIVERY_LABEL, formatCLP, orderSteps, pieceLabel } from "@/lib/format";
import { card } from "@/components/ui";
import type { Bank, Order } from "@/lib/types";

export const metadata: Metadata = { title: "Tu pedido", robots: { index: false } };

export default async function OrderPage({ params }: PageProps<"/[tenant]/pedido/[id]">) {
  const { tenant: slug, id } = await params;
  const t = await getTenant(slug);
  const v = await requireCustomer(slug, t.id, `/${slug}/pedido/${id}`);
  await expireHolds(t.id);

  const { data } = await v.supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", id)
    .eq("tenant_id", t.id)
    .maybeSingle();
  if (!data) notFound();
  const o = data as Order;

  const { data: bankRow } = await v.supabase.from("tenant_bank").select("data").eq("tenant_id", t.id).maybeSingle();
  const bank = (bankRow?.data ?? {}) as Bank;

  const open = o.status === "pending_payment";
  const steps = orderSteps(o.delivery_method);
  const stepIndex = steps.findIndex(([s]) => s === o.status);

  return (
    <div className="space-y-4 px-4 pt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted">Pedido #{o.number}</p>
          <h1 className="font-display text-3xl">{open ? "Paga tu pedido" : "Tu pedido"}</h1>
        </div>
        <StatusBadge status={o.status} delivery={o.delivery_method} />
      </div>

      {stepIndex >= 0 && (
        <ol className="flex items-center gap-1" aria-label="Avance del pedido">
          {steps.map(([s, label], i) => (
            <li key={s} className="flex flex-1 flex-col items-center gap-1">
              <span className={`h-1.5 w-full rounded-full ${i <= stepIndex ? "bg-brand" : "bg-line"}`} />
              <span className={`text-[10px] font-bold ${i <= stepIndex ? "text-ink" : "text-muted"}`}>{label}</span>
            </li>
          ))}
        </ol>
      )}

      <OrderStatusInfo order={o} pickup={t.settings.pickup_info ?? {}} />

      {o.status !== "cancelled" && o.status !== "expired" && o.status !== "delivered" ? <PushToggle slug={slug} /> : null}

      {open && (
        <section className={`${card} space-y-2`}>
          <h2 className="text-sm font-bold">Transfiere {formatCLP(o.total)} a:</h2>
          <dl className="space-y-1 text-sm">
            {([
              ["Titular", bank.holder],
              ["RUT", bank.rut],
              ["Banco", bank.bank],
              ["Tipo de cuenta", bank.account_type],
              ["N° de cuenta", bank.account],
              ["Correo", bank.email],
            ] as [string, string | undefined][]).filter(([, val]) => val).map(([k, val]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right font-semibold">{val}</dd>
              </div>
            ))}
          </dl>
          <p className="rounded-xl bg-blush px-3 py-2 text-sm">
            En el comentario de la transferencia escribe tu referencia:{" "}
            <strong className="select-all tracking-wide">{o.payment_ref}</strong>
          </p>
        </section>
      )}

      <section className={card}>
        <ul className="space-y-3">
          {(o.order_items ?? []).map((it) => (
            <li key={it.id} className="flex items-center gap-3">
              <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-blush">
                {it.photo ? <Image src={it.photo} alt="" fill sizes="56px" className="object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{it.title}</p>
                <p className="text-xs text-muted">{pieceLabel(it.product_number)}</p>
              </div>
              <span className="text-sm font-bold">{formatCLP(it.price)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between"><span>{DELIVERY_LABEL[o.delivery_method]}</span><span>{o.shipping_cost ? formatCLP(o.shipping_cost) : "Gratis"}</span></div>
          <div className="flex justify-between text-lg font-bold"><span>Total</span><span className="text-brand">{formatCLP(o.total)}</span></div>
        </div>
      </section>

      <OrderActions
        orderId={o.id}
        tenantId={t.id}
        slug={slug}
        status={o.status}
        expiresAt={o.expires_at}
        hasProof={!!o.proof_path}
      />

      <Link href={`/${slug}/mis-piezas`} className="block text-center text-sm font-semibold text-muted underline">
        Ver todos mis pedidos
      </Link>
    </div>
  );
}
