import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { getTenant } from "@/lib/tenant";
import BottomNav from "@/components/BottomNav";
import InteractiveLogo from "@/components/InteractiveLogo";
import BadgeSync from "@/components/BadgeSync";
import { getViewer } from "@/lib/session";

export async function generateMetadata({ params }: LayoutProps<"/[tenant]">): Promise<Metadata> {
  const { tenant: slug } = await params;
  const t = await getTenant(slug);
  return {
    title: { default: `${t.name} · ${t.theme.tagline ?? "Tienda"}`, template: `%s · ${t.name}` },
    description: `${t.name}: ${t.theme.tagline ?? "tienda en línea"}. Piezas únicas: cada prenda existe una sola vez. Reserva con «¡Es mía!» y paga por transferencia.`,
    keywords: ["ropa", "moda", "piezas únicas", "blazers", "vestidos", "chaquetas", "Chile", t.name],
    alternates: { canonical: `/${t.slug}` },
    robots: { index: true, follow: true },
    openGraph: { type: "website", locale: "es_CL", siteName: t.name, title: `${t.name} · ${t.theme.tagline ?? "Tienda"}`, url: `/${t.slug}` },
    twitter: { card: "summary_large_image" },
    applicationName: t.name,
    manifest: `/${t.slug}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: t.name, statusBarStyle: "default" },
    icons: { apple: "/icons/apple-touch-icon.png" },
  };
}

export default async function TenantLayout({ children, params }: LayoutProps<"/[tenant]">) {
  const { tenant: slug } = await params;
  const t = await getTenant(slug);
  const { role, user } = await getViewer(t.id);

  // El tema de la tienda pisa los tokens de marca por defecto
  const vars = {
    ...(t.theme.primary ? { "--brand": t.theme.primary } : {}),
    ...(t.theme.accent ? { "--accent": t.theme.accent } : {}),
  } as CSSProperties;

  return (
    <div style={vars} className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-paper shadow-[0_0_0_1px_var(--line)] md:my-0">
      <header className="sticky top-0 z-30 flex items-center justify-center bg-accent px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.6rem)]">
        <Link href={`/${t.slug}`} aria-label={`${t.name}, inicio`}>
          <Image
            src={t.theme.logo ?? "/brand/serena-wordmark.png"}
            alt={t.name}
            width={576}
            height={136}
            priority
            className="h-8 w-auto"
          />
        </Link>
        {role ? (
          <Link
            href={`/${t.slug}/admin`}
            className="absolute right-3 top-[calc(env(safe-area-inset-top)+0.7rem)] rounded-full bg-paper/80 px-3 py-1 text-xs font-bold text-ink"
          >
            Panel
          </Link>
        ) : null}
      </header>
      <main className="safe-bottom flex-1">
        {children}
        <footer className="mt-10 flex items-center justify-center gap-1.5 px-4 pb-4 text-[14px] text-muted">
          Desarrollado por
          <a href="https://www.teolabs.app" target="_blank" rel="noopener noreferrer" className="transition-opacity hover:opacity-80">
            <InteractiveLogo variant="footer-small" className="text-[14px]" />
          </a>
          ®
        </footer>
      </main>
      <BottomNav slug={t.slug} />
      {user ? <BadgeSync slug={t.slug} /> : null}
    </div>
  );
}
