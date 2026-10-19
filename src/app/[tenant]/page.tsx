import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCategories, getTenant } from "@/lib/tenant";
import ProductCard from "@/components/ProductCard";
import { InstallBanner } from "@/components/InstallApp";
import type { Product } from "@/lib/types";

export default async function StoreHome({ params, searchParams }: PageProps<"/[tenant]">) {
  const { tenant: slug } = await params;
  const sp = await searchParams;
  const cat = typeof sp.cat === "string" ? sp.cat : undefined;
  const size = typeof sp.talla === "string" ? sp.talla : undefined;
  const q = typeof sp.q === "string" ? sp.q.trim() : undefined;

  const t = await getTenant(slug);
  const categories = await getCategories(t.id);
  const supabase = await createClient();

  let query = supabase
    .from("products")
    .select("*")
    .eq("tenant_id", t.id)
    .in("status", ["available", "reserved"])
    .order("created_at", { ascending: false })
    .limit(60);

  const activeCat = categories.find((c) => c.slug === cat);
  if (activeCat) query = query.eq("category_id", activeCat.id);
  if (size) query = query.eq("size", size);
  if (q) query = query.ilike("title", `%${q.replace(/[%_]/g, "")}%`);

  const [{ data }, { data: live }] = await Promise.all([
    query,
    supabase.from("live_sessions").select("id, title").eq("tenant_id", t.id).eq("status", "live").maybeSingle(),
  ]);

  // Disponibles primero; las vendidas no se muestran
  const rank = { available: 0, reserved: 1, sold: 2, draft: 3, hidden: 3 } as const;
  const products = ((data ?? []) as Product[]).sort((a, b) => rank[a.status] - rank[b.status]);

  return (
    <div className="px-4 pt-3">
      <InstallBanner />

      {live ? (
        <Link
          href={`/${slug}/live`}
          className="mb-3 flex items-center gap-3 rounded-2xl bg-brand px-4 py-3 text-paper"
        >
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-paper opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-paper" />
          </span>
          <span className="flex-1 text-sm font-bold">¡Estamos en vivo! {live.title}</span>
          <span aria-hidden="true">→</span>
        </Link>
      ) : null}

      <form action={`/${slug}`} className="mb-3">
        <label htmlFor="q" className="sr-only">Buscar prendas</label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Buscar blazers, vestidos, disfraces…"
          className="h-11 w-full rounded-full border border-line bg-white px-4 text-sm outline-none focus:border-brand"
        />
      </form>

      <nav aria-label="Categorías" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <Chip href={`/${slug}`} active={!activeCat}>Todo</Chip>
        {categories.map((c) => (
          <Chip key={c.id} href={`/${slug}?cat=${c.slug}`} active={activeCat?.id === c.id}>
            {c.name}
          </Chip>
        ))}
      </nav>

      {products.length === 0 ? (
        <div className="rounded-2xl bg-blush px-6 py-12 text-center">
          <p className="font-display text-2xl">Aún no hay piezas aquí</p>
          <p className="mt-1 text-sm text-muted">Vuelve pronto: cada fardo trae piezas nuevas y únicas.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-5">
          {products.map((p) => (
            <li key={p.id}>
              <ProductCard slug={slug} p={p} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${
        active ? "border-brand bg-brand text-paper" : "border-line bg-white text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
