import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Pantallas personales, de pago y del equipo: no tienen nada que indexar
      disallow: ["/api/", "/*/admin", "/*/checkout", "/*/pedido/", "/*/mis-piezas", "/*/favoritas", "/*/login"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
