// Dirección pública de la tienda: una sola fuente para metadatos, robots y sitemap.
// En producción se define NEXT_PUBLIC_SITE_URL (ej. https://serena.cl).
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
