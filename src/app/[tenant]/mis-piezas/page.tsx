import type { Metadata } from "next";
import Link from "next/link";
import { getTenant } from "@/lib/tenant";
import { expireHolds, requireCustomer } from "@/lib/session";
import StatusBadge from "@/components/StatusBadge";
import PushToggle from "@/components/PushToggle";
import { card, primaryBtn } from "@/components/ui";
import { formatCLP, formatDate, pieceLabel } from "@/lib/format";
import type { Order, Product } from "@/lib/types";

export const metadata: Metadata = { title: "Mis piezas", robots: { index: false } };

export default async function MyPiecesPage({ params }: PageProps<"/[tenant]/mis-piezas">) {
  const { tenant: slug } = await params;
  const t = await getTenant(slug);
  const v = await requireCustomer(slug, t.id, `/${slug}/mis-piezas`);
  await expireHolds(t.id);

  const [{ data: held }, { data: orders }] = await Promise.all([
    v.supabase
      .from("products")
      .select("*")
      .eq("tenant_id", t.id)
      .eq("status", "reserved")
      .eq("reserved_by", v.user.id)
      .is("order_id", null)
      .gt("reserved_until", new Date().toISOString()),
    v.supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("tenant_id", t.id)
      .eq("customer_id", v.user.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const reservations = (held ?? []) as Product[];
  const list = (orders ?? []) as Order[];

  return (
    <div className="space-y-6 px-4 pt-4">
      <h1 className="font-display text-3xl">Mis piezas</h1>

      <PushToggle slug={slug} />

      {v.customer.strikes > 0 && (
        <p className="rounded-2xl bg-blush px-4 py-3 text-sm">
          Tienes <strong>{v.customer.strikes}</strong> de {t.settings.max_strikes} avisos por reservas sin pagar. Al llegar al máximo no podrás reservar.
        </p>
      )}

      {reservations.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted">Guardadas para ti</h2>
          <ul className="space-y-2">
            {reservations.map((p) => (
              <li key={p.id} className={`${card} flex items-center justify-between gap-3`}>
                <Link href={`/${slug}/p/${p.number}`} className="min-w-0">
                  <p className="truncate text-sm font-semibold">{p.title}</p>
                  <p className="text-xs text-muted">{pieceLabel(p.number)}</p>
                </Link>
                <span className="font-bold text-brand">{formatCLP(p.price)}</span>
              </li>
            ))}
          </ul>
          <Link href={`/${slug}/checkout`} className={primaryBtn}>Pagar mis piezas</Link>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted">Pedidos</h2>
        {list.length === 0 ? (
          <div className="rounded-2xl bg-blush px-6 py-10 text-center">
            <p className="font-display text-2xl">Aún no tienes pedidos</p>
            <p className="mt-1 text-sm text-muted">Toca «¡Es mía!» en la pieza que te guste.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {list.map((o) => (
              <li key={o.id}>
                <Link href={`/${slug}/pedido/${o.id}`} className={`${card} block`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold">Pedido #{o.number}</p>
                    <StatusBadge status={o.status} delivery={o.delivery_method} />
                  </div>
                  <p className="mt-1 truncate text-sm text-muted">
                    {(o.order_items ?? []).map((i) => i.title).join(" · ") || "—"}
                  </p>
                  <div className="mt-1 flex justify-between text-sm">
                    <span className="text-muted">{formatDate(o.created_at)}</span>
                    <span className="font-bold text-brand">{formatCLP(o.total)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
