import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTenant } from "@/lib/tenant";
import { formatCLP, pieceLabel } from "@/lib/format";
import ReserveButton from "@/components/ReserveButton";
import FavoriteButton from "@/components/FavoriteButton";
import type { Product } from "@/lib/types";

async function loadProduct(slug: string, number: string) {
  const n = Number(number);
  if (!Number.isInteger(n)) notFound();
  const t = await getTenant(slug);
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("tenant_id", t.id)
    .eq("number", n)
    .maybeSingle();
  if (!data) notFound();
  return { t, supabase, p: data as Product };
}

export async function generateMetadata({ params }: PageProps<"/[tenant]/p/[number]">): Promise<Metadata> {
  const { tenant, number } = await params;
  const { t, p } = await loadProduct(tenant, number);
  const title = `${p.title} · ${pieceLabel(p.number)}`;
  const description =
    p.description ?? `${p.title}${p.size ? `, talla ${p.size}` : ""}. Pieza única en ${t.name}: ${formatCLP(p.price)}.`;
  return {
    title,
    description,
    alternates: { canonical: `/${tenant}/p/${p.number}` },
    robots: { index: p.status !== "sold", follow: true },
    openGraph: { type: "website", title, description, url: `/${tenant}/p/${p.number}`, images: p.photos[0] ? [{ url: p.photos[0] }] : undefined },
    twitter: { card: "summary_large_image" },
  };
}

export default async function ProductPage({ params }: PageProps<"/[tenant]/p/[number]">) {
  const { tenant: slug, number } = await params;
  const { t, supabase, p } = await loadProduct(slug, number);

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  const [customer, waiting, fav] = user
    ? await Promise.all([
        supabase.from("customers").select("user_id").eq("tenant_id", t.id).eq("user_id", user.id).maybeSingle(),
        supabase.from("waitlist").select("id").eq("product_id", p.id).eq("user_id", user.id).maybeSingle(),
        supabase.from("favorites").select("product_id").eq("user_id", user.id).eq("product_id", p.id).maybeSingle(),
      ])
    : [null, null, null];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    description: p.description ?? undefined,
    sku: `${t.slug}-${p.number}`,
    image: p.photos.length ? p.photos : undefined,
    color: p.color ?? undefined,
    size: p.size ?? undefined,
    brand: { "@type": "Brand", name: t.name },
    itemCondition: /nuevo/i.test(p.condition ?? "") && !/como nuevo/i.test(p.condition ?? "")
      ? "https://schema.org/NewCondition"
      : "https://schema.org/UsedCondition",
    offers: {
      "@type": "Offer",
      priceCurrency: "CLP",
      price: p.price,
      availability: p.status === "available" ? "https://schema.org/InStock" : p.status === "reserved" ? "https://schema.org/LimitedAvailability" : "https://schema.org/SoldOut",
    },
  };

  const facts = [
    ["Talla", p.size],
    ["Color", p.color],
    ["Estado", p.condition],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]" aria-label="Fotos de la prenda">
        {(p.photos.length ? p.photos : [""]).map((src, i) => (
          <div key={i} className="relative aspect-[3/4] w-full shrink-0 snap-center bg-blush">
            {src ? (
              <Image src={src} alt={`${p.title}, foto ${i + 1}`} fill sizes="448px" priority={i === 0} className="object-cover" />
            ) : null}
          </div>
        ))}
      </div>

      <div className="px-4 pt-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted">{pieceLabel(p.number)} · única</p>
        <div className="mt-1 flex items-start justify-between gap-3">
          <h1 className="font-display text-3xl leading-tight">{p.title}</h1>
          <FavoriteButton slug={slug} tenantId={t.id} productId={p.id} userId={user?.id ?? null} initial={!!fav?.data} />
        </div>
        <p className="mt-1 text-2xl font-bold text-brand">{formatCLP(p.price)}</p>

        {p.status === "sold" && (
          <p className="mt-3 rounded-2xl bg-blush px-4 py-3 text-sm font-semibold">
            ¡Esta pieza es tuya! Solo tú ves esta ficha, y la retiramos de la tienda un día después de tu compra. Tu pedido guarda el detalle.
          </p>
        )}

        {facts.length > 0 && (
          <dl className="mt-4 grid grid-cols-3 gap-2">
            {facts.map(([k, v]) => (
              <div key={k} className="rounded-xl bg-blush px-3 py-2">
                <dt className="text-[11px] font-semibold uppercase text-muted">{k}</dt>
                <dd className="text-sm font-bold">{v}</dd>
              </div>
            ))}
          </dl>
        )}

        {p.description ? <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed">{p.description}</p> : null}
      </div>

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+3.5rem)] z-20 mt-6 border-t border-line bg-paper/95 px-4 pb-2 pt-3 backdrop-blur">
        <ReserveButton
          slug={slug}
          productId={p.id}
          initial={{ status: p.status, reserved_by: p.reserved_by, reserved_until: p.reserved_until, order_id: p.order_id }}
          userId={user?.id ?? null}
          hasProfile={!!customer?.data}
          inWaitlist={!!waiting?.data}
          reservationMinutes={t.settings.reservation_minutes}
        />
      </div>
    </article>
  );
}
