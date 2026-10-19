import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const alt = "Tienda en línea";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Imagen que se ve al compartir el enlace en WhatsApp, Instagram o Facebook
export default async function Image({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: t } = await db.from("tenants").select("name, theme").eq("slug", tenant).maybeSingle();

  const name = t?.name ?? "Tienda";
  const tagline = t?.theme?.tagline ?? "Piezas únicas";
  const primary = t?.theme?.primary ?? "#c10b21";
  const accent = t?.theme?.accent ?? "#fa95b3";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#3b0a14", color: "#fff6f9" }}>
        <div style={{ height: 18, background: accent, display: "flex" }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 90px" }}>
          <div style={{ fontSize: 150, fontWeight: 700, letterSpacing: 6, textTransform: "uppercase", display: "flex" }}>{name}</div>
          <div style={{ fontSize: 48, marginTop: 10, color: accent, display: "flex" }}>{tagline}</div>
          <div style={{ fontSize: 34, marginTop: 40, display: "flex", color: "#e9c3cf" }}>
            Cada prenda es única. Toca «¡Es mía!» y es tuya.
          </div>
        </div>
        <div style={{ height: 18, background: primary, display: "flex" }} />
      </div>
    ),
    { ...size },
  );
}
