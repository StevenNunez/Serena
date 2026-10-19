import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TENANT, getTenant } from "@/lib/tenant";
import { SITE_URL } from "@/lib/site-url";
import { InstallHero } from "@/components/InstallApp";
import InteractiveLogo from "@/components/InteractiveLogo";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/lib/types";

// Página de entrada: quien llega por el enlace (Instagram, WhatsApp, Google) ve de qué se trata,
// puede instalar la app o pasar directo a la tienda.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTenant(DEFAULT_TENANT);
  const title = `${t.name} · ${t.theme.tagline ?? "Piezas únicas"}`;
  const description = `${t.name}: ropa y accesorios de piezas únicas, cada prenda existe una sola vez. Reserva con «¡Es mía!» y paga por transferencia. Instala la app en tu celular.`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: "/" },
    robots: { index: true, follow: true },
    openGraph: { type: "website", locale: "es_CL", siteName: t.name, title, description, url: "/", images: [`/${t.slug}/opengraph-image`] },
    twitter: { card: "summary_large_image", title, description, images: [`/${t.slug}/opengraph-image`] },
    applicationName: t.name,
    manifest: `/${t.slug}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: t.name, statusBarStyle: "default" },
    icons: { apple: "/icons/apple-touch-icon.png" },
  };
}

const PASOS = [
  ["1", "Elige tu pieza", "Cada prenda es única: si la ves, existe una sola."],
  ["2", "Toca «¡Es mía!»", "La guardamos para ti unos minutos mientras pagas."],
  ["3", "Paga y listo", "Transfieres, subes el comprobante y la retiras o te la enviamos."],
] as const;

export default async function Landing() {
  const t = await getTenant(DEFAULT_TENANT);
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("tenant_id", t.id)
    .eq("status", "available")
    .order("created_at", { ascending: false })
    .limit(4);
  const nuevas = (data ?? []) as Product[];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "OnlineStore",
        "@id": `${SITE_URL}/#tienda`,
        name: t.name,
        url: SITE_URL,
        description: `${t.name}: ropa y accesorios de piezas únicas.`,
        logo: `${SITE_URL}/icons/icon-512.png`,
        areaServed: "CL",
        currenciesAccepted: "CLP",
        paymentAccepted: "Transferencia bancaria",
      },
      { "@type": "WebSite", url: SITE_URL, name: t.name, inLanguage: "es-CL" },
    ],
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-paper shadow-[0_0_0_1px_var(--line)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <header className="relative overflow-hidden rounded-b-[2.75rem] bg-gradient-to-b from-accent via-[#fbb4c8] to-blush px-6 pb-12 pt-[calc(env(safe-area-inset-top)+1.75rem)] text-center">
        <Image
          src={t.theme.logo ?? "/brand/serena-wordmark.png"}
          alt={t.name}
          width={576}
          height={136}
          priority
          className="mx-auto h-20 w-auto"
        />
        <h1 className="mt-5">
          <span className="font-script block text-2xl leading-none text-brand">Piezas únicas</span>
          <span className="font-display mt-1 block text-lg leading-tight text-ink">que solo existen una vez</span>
        </h1>
        <p className="mx-auto mt-2 max-w-72 text-sm leading-snug text-ink/80">
          Ropa y accesorios elegidos uno a uno. Si te gusta una, toca <strong>«¡Es mía!»</strong> y es tuya.
        </p>
        <Link
          href={`/${t.slug}`}
          className="mx-auto mt-6 flex h-12 w-fit items-center justify-center rounded-full bg-cta px-9 text-base font-bold text-white shadow-[0_6px_16px_-6px_var(--cta)] active:scale-[0.98]"
        >
          Entrar a la tienda
        </Link>
      </header>

      <main className="flex-1 px-6 pb-10 pt-7">
        <div className="space-y-3">
          <InstallHero />
          <p className="pt-1 text-center text-xs text-muted">
            ¿Administras la tienda?{" "}
            <Link href={`/${t.slug}/login?como=tienda`} className="font-bold underline">Entra al panel</Link>
          </p>
        </div>

        {nuevas.length > 0 ? (
          <section aria-labelledby="nuevas" className="mt-8">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 id="nuevas" className="font-display text-2xl">Recién llegadas</h2>
              <Link href={`/${t.slug}`} className="text-sm font-bold text-cta">Ver todo →</Link>
            </div>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-5">
              {nuevas.map((p) => (
                <li key={p.id}>
                  <ProductCard slug={t.slug} p={p} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="como" className="mt-10">
          <h2 id="como" className="font-display text-2xl">Así de fácil</h2>
          <ol className="mt-3 space-y-3">
            {PASOS.map(([n, titulo, texto]) => (
              <li key={n} className="flex gap-3 rounded-2xl bg-blush px-4 py-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-cta text-sm font-bold text-white">{n}</span>
                <div>
                  <p className="font-bold">{titulo}</p>
                  <p className="text-sm text-muted">{texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <p className="mt-8 rounded-2xl border border-line px-4 py-3 text-center text-sm text-muted">
          También vendemos en vivo: entra a «En vivo» y reserva las piezas en tiempo real.
        </p>
      </main>

      <footer className="flex items-center justify-center gap-1.5 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] text-[14px] text-muted">
        Desarrollado por
        <a href="https://www.teolabs.app" target="_blank" rel="noopener noreferrer" className="transition-opacity hover:opacity-80">
          <InteractiveLogo variant="footer-small" className="text-[14px]" />
        </a>
        ®
      </footer>
    </div>
  );
}
