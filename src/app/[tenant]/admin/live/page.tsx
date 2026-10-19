import { getTenant } from "@/lib/tenant";
import { requireStaff } from "@/lib/session";
import LiveControl from "@/components/LiveControl";
import type { LiveSession, Product } from "@/lib/types";

export default async function AdminLive({ params }: PageProps<"/[tenant]/admin/live">) {
  const { tenant: slug } = await params;
  const t = await getTenant(slug);
  const v = await requireStaff(slug, t.id, ["admin", "live"]);

  const [{ data: session }, { data: products }] = await Promise.all([
    v.supabase
      .from("live_sessions")
      .select("id, title, status, current_product_id, platform, stream_url")
      .eq("tenant_id", t.id)
      .eq("status", "live")
      .maybeSingle(),
    v.supabase
      .from("products")
      .select("id, number, title, price, status")
      .eq("tenant_id", t.id)
      .in("status", ["available", "reserved"])
      .order("number"),
  ]);

  return (
    <div className="px-4 pt-3">
      <LiveControl
        tenantId={t.id}
        userId={v.user.id}
        session={(session as LiveSession | null) ?? null}
        products={(products ?? []) as Pick<Product, "id" | "number" | "title" | "price" | "status">[]}
      />
    </div>
  );
}
