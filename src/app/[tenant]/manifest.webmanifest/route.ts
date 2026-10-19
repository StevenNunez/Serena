import { getTenant } from "@/lib/tenant";

export async function GET(_req: Request, ctx: RouteContext<"/[tenant]/manifest.webmanifest">) {
  const { tenant: slug } = await ctx.params;
  const t = await getTenant(slug);
  return Response.json(
    {
      name: t.name,
      short_name: t.name,
      description: t.theme.tagline ?? t.name,
      id: `/${t.slug}`,
      lang: "es-CL",
      categories: ["shopping", "lifestyle"],
      start_url: `/${t.slug}?source=pwa`,
      // Scope en la raíz para que también se pueda instalar desde la página de entrada
      scope: "/",
      display: "standalone",
      orientation: "portrait",
      background_color: t.theme.accent ?? "#fa95b3",
      theme_color: t.theme.accent ?? "#fa95b3",
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
      shortcuts: [
        { name: "En vivo", url: `/${t.slug}/live`, icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
        { name: "Mis piezas", url: `/${t.slug}/mis-piezas`, icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
