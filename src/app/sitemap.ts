import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { SITE_URL } from "@/lib/site-url";

export const revalidate = 3600;

// Solo lo público: la vitrina de cada tienda y sus piezas publicadas (RLS ya oculta borradores y ocultas)
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const [{ data: tenants }, { data: products }] = await Promise.all([
    db.from("tenants").select("id, slug"),
    db.from("products").select("tenant_id, number, created_at").in("status", ["available", "reserved"]),
  ]);

  const slugOf = new Map((tenants ?? []).map((t) => [t.id, t.slug]));
  return [
    { url: SITE_URL, changeFrequency: "daily" as const, priority: 1 },
    ...(tenants ?? []).flatMap((t) => [
      { url: `${SITE_URL}/${t.slug}`, changeFrequency: "daily" as const, priority: 0.9 },
      { url: `${SITE_URL}/${t.slug}/live`, changeFrequency: "weekly" as const, priority: 0.5 },
    ]),
    ...(products ?? []).flatMap((p) => {
      const slug = slugOf.get(p.tenant_id);
      return slug
        ? [{ url: `${SITE_URL}/${slug}/p/${p.number}`, lastModified: p.created_at, changeFrequency: "daily" as const, priority: 0.7 }]
        : [];
    }),
  ];
}
