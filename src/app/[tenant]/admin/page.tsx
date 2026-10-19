import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { expireHolds, requireStaff } from "@/lib/session";
import AdminOrderCard from "@/components/AdminOrderCard";
import PushToggle from "@/components/PushToggle";
import type { Customer, Order, OrderStatus } from "@/lib/types";

const GROUPS: Record<string, { label: string; statuses: OrderStatus[] }> = {
  revisar: { label: "Por revisar", statuses: ["payment_review"] },
  pagar: { label: "Por pagar", statuses: ["pending_payment"] },
  despacho: { label: "Despacho", statuses: ["paid", "preparing", "shipped"] },
  cerrados: { label: "Cerrados", statuses: ["delivered", "cancelled", "expired"] },
};

export default async function AdminOrders({ params, searchParams }: PageProps<"/[tenant]/admin">) {
  const { tenant: slug } = await params;
  const sp = await searchParams;
  const t = await getTenant(slug);
  const v = await requireStaff(slug, t.id, ["admin", "live", "caja"]);
  if (v.role === "live") redirect(`/${slug}/admin/piezas`);
  await expireHolds(t.id);

  const key = typeof sp.e === "string" && GROUPS[sp.e] ? sp.e : "revisar";

  const [{ data: orders }, { data: customers }, { data: counts }] = await Promise.all([
    v.supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("tenant_id", t.id)
      .in("status", GROUPS[key].statuses)
      .order("created_at", { ascending: false })
      .limit(50),
    v.supabase.from("customers").select("user_id, full_name, phone, email").eq("tenant_id", t.id),
    v.supabase.from("orders").select("status").eq("tenant_id", t.id),
  ]);

  const byUser = new Map(((customers ?? []) as Customer[]).map((c) => [c.user_id, c]));
  const n = (g: string) => (counts ?? []).filter((o) => GROUPS[g].statuses.includes(o.status as OrderStatus)).length;

  return (
    <div className="px-4 pt-3">
      <div className="mb-3">
        <PushToggle slug={slug} texto="Entérate al tiro cuando una clienta suba un comprobante." />
      </div>
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {Object.entries(GROUPS).map(([k, g]) => (
          <Link
            key={k}
            href={`/${slug}/admin?e=${k}`}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-bold ${k === key ? "bg-brand text-paper" : "bg-white text-ink ring-1 ring-line"}`}
          >
            {g.label} · {n(k)}
          </Link>
        ))}
      </div>

      {(orders ?? []).length === 0 ? (
        <p className="rounded-2xl bg-blush px-6 py-10 text-center text-sm text-muted">No hay pedidos en esta lista.</p>
      ) : (
        <ul className="space-y-3">
          {(orders as Order[]).map((o) => (
            <li key={o.id}>
              <AdminOrderCard order={o} customer={byUser.get(o.customer_id) ?? null} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
