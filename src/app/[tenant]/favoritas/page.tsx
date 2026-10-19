import type { Metadata } from "next";
import Link from "next/link";
import { getTenant } from "@/lib/tenant";
import { requireCustomer } from "@/lib/session";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/lib/types";

export const metadata: Metadata = { title: "Favoritas", robots: { index: false } };

export default async function FavoritesPage({ params }: PageProps<"/[tenant]/favoritas">) {
  const { tenant: slug } = await params;
  const t = await getTenant(slug);
  const v = await requireCustomer(slug, t.id, `/${slug}/favoritas`);

  const { data } = await v.supabase
    .from("favorites")
    .select("created_at, product:products(*)")
    .eq("tenant_id", t.id)
    .eq("user_id", v.user.id)
    .order("created_at", { ascending: false });

  const products = ((data ?? []) as unknown as { product: Product | null }[])
    .map((r) => r.product)
    .filter((p): p is Product => !!p);

  return (
    <div className="px-4 pt-4">
      <h1 className="font-display text-3xl">Favoritas</h1>
      {products.length === 0 ? (
        <div className="mt-4 rounded-2xl bg-blush px-6 py-12 text-center">
          <p className="font-display text-2xl">Aún no guardas nada</p>
          <p className="mt-1 text-sm text-muted">Toca el corazón en una pieza para encontrarla después.</p>
          <Link href={`/${slug}`} className="mt-4 inline-block text-sm font-bold text-brand underline">Ver piezas</Link>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5">
          {products.map((p) => <ProductCard key={p.id} slug={slug} p={p} />)}
        </div>
      )}
    </div>
  );
}
