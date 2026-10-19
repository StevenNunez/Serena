// Dónde se transmite el en vivo. La compra siempre ocurre en Serena; el video puede venir de cualquier red.
export const PLATAFORMAS = [
  { id: "instagram", nombre: "Instagram", ejemplo: "https://www.instagram.com/tu_tienda/live" },
  { id: "tiktok", nombre: "TikTok", ejemplo: "https://www.tiktok.com/@tu_tienda/live" },
  { id: "youtube", nombre: "YouTube", ejemplo: "https://www.youtube.com/watch?v=…" },
  { id: "facebook", nombre: "Facebook", ejemplo: "https://www.facebook.com/tu_tienda/videos/…" },
] as const;

export type Plataforma = (typeof PLATAFORMAS)[number]["id"];

export const nombreDe = (p: string | null | undefined) => PLATAFORMAS.find((x) => x.id === p)?.nombre ?? null;

const HOSTS: Record<Plataforma, RegExp> = {
  instagram: /(^|\.)instagram\.com$/,
  tiktok: /(^|\.)tiktok\.com$/,
  youtube: /(^|\.)(youtube\.com|youtu\.be)$/,
  facebook: /(^|\.)(facebook\.com|fb\.watch|fb\.com|fb\.me)$/,
};

/** Solo https y, si se eligió plataforma, un dominio de esa plataforma. Devuelve la dirección limpia o null. */
export function enlaceValido(plataforma: string | null | undefined, valor: string | null | undefined): string | null {
  const v = (valor ?? "").trim();
  if (!v) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (u.protocol !== "https:") return null;
    const re = HOSTS[plataforma as Plataforma];
    if (re && !re.test(u.hostname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Perfil de la tienda en una red: acepta @usuario o una dirección completa */
export function perfilUrl(plataforma: Plataforma, valor: string | null | undefined): string | null {
  const v = (valor ?? "").trim();
  if (!v) return null;
  if (/^(https?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,}\/)/i.test(v)) return enlaceValido(plataforma, v);
  const h = v.replace(/^@/, "").replace(/[^\w.\-]/g, "");
  if (!h) return null;
  return {
    instagram: `https://www.instagram.com/${h}/`,
    tiktok: `https://www.tiktok.com/@${h}`,
    youtube: `https://www.youtube.com/@${h}`,
    facebook: `https://www.facebook.com/${h}`,
  }[plataforma];
}

function idDeYoutube(u: URL): string | null {
  const ok = (s: string | null | undefined) => (s && /^[\w-]{11}$/.test(s) ? s : null);
  if (u.hostname.endsWith("youtu.be")) return ok(u.pathname.slice(1));
  const m = u.pathname.match(/^\/(?:live|embed|shorts)\/([\w-]{11})/);
  return ok(u.searchParams.get("v")) ?? ok(m?.[1]);
}

export type Transmision =
  | { tipo: "incrustado"; src: string; abrir: string; plataforma: Plataforma | null }
  | { tipo: "enlace"; abrir: string; plataforma: Plataforma | null };

/**
 * Cómo mostrar el en vivo dentro de Serena. YouTube y Facebook se pueden ver dentro de la pantalla;
 * Instagram y TikTok no permiten incrustar transmisiones, así que llevan un botón que abre la app.
 * Sin enlace del en vivo se usa el perfil de la tienda en esa red.
 */
export function transmision(
  plataforma: string | null | undefined,
  url: string | null | undefined,
  social?: Partial<Record<Plataforma, string>>,
): Transmision | null {
  const p = PLATAFORMAS.find((x) => x.id === plataforma)?.id ?? null;
  const limpio = enlaceValido(p, url);
  if (!limpio) {
    const perfil = p ? perfilUrl(p, social?.[p]) : null;
    return perfil ? { tipo: "enlace", abrir: perfil, plataforma: p } : null;
  }
  const u = new URL(limpio);
  if (p === "youtube") {
    const id = idDeYoutube(u);
    if (id) return { tipo: "incrustado", src: `https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1&rel=0`, abrir: limpio, plataforma: p };
  }
  if (p === "facebook" && /\/(videos|watch|reel)\b|fb\.watch/.test(u.href)) {
    return {
      tipo: "incrustado",
      src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(limpio)}&show_text=false&autoplay=true`,
      abrir: limpio,
      plataforma: p,
    };
  }
  return { tipo: "enlace", abrir: limpio, plataforma: p };
}
