import { getTenant, getCategories } from "@/lib/tenant";
import { requireStaff } from "@/lib/session";
import CategoryManager from "@/components/CategoryManager";
import PieceForm from "@/components/PieceForm";
import PieceRow from "@/components/PieceRow";
import type { Product } from "@/lib/types";

export default async function AdminPieces({ params }: PageProps<"/[tenant]/admin/piezas">) {
  const { tenant: slug } = await params;
  const t = await getTenant(slug);
  const v = await requireStaff(slug, t.id, ["admin", "live"]);
  const categories = await getCategories(t.id);

  const { data } = await v.supabase
    .from("products")
    .select("*")
    .eq("tenant_id", t.id)
    .order("number", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-5 px-4 pt-3">
      <PieceForm tenantId={t.id} categories={categories} />
      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted">Piezas ({(data ?? []).length})</h2>
        <ul className="space-y-2">
          {((data ?? []) as Product[]).map((p) => (
            <li key={p.id}><PieceRow p={p} categories={categories} /></li>
          ))}
        </ul>
      </section>
      <CategoryManager tenantId={t.id} categories={categories} />
    </div>
  );
}
