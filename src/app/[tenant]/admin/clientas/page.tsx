import { getTenant } from "@/lib/tenant";
import { requireStaff } from "@/lib/session";
import CustomerRow from "@/components/CustomerRow";
import type { Customer } from "@/lib/types";

export default async function AdminCustomers({ params }: PageProps<"/[tenant]/admin/clientas">) {
  const { tenant: slug } = await params;
  const t = await getTenant(slug);
  const v = await requireStaff(slug, t.id, ["admin", "caja"]);

  const { data } = await v.supabase
    .from("customers")
    .select("*")
    .eq("tenant_id", t.id)
    .order("strikes", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  const list = (data ?? []) as Customer[];

  return (
    <div className="space-y-2 px-4 pt-3">
      <h2 className="text-sm font-bold uppercase tracking-widest text-muted">Clientas ({list.length})</h2>
      <ul className="space-y-2">
        {list.map((c) => (
          <li key={c.user_id}><CustomerRow c={c} maxStrikes={t.settings.max_strikes} /></li>
        ))}
      </ul>
    </div>
  );
}
