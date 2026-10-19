// Siembra fotos de ejemplo (ilustraciones) en las piezas de la demo. Idempotente.
// Uso:  node --env-file=.env.local scripts/seed-photos.mjs
// También sube la marca en blanco que usan los correos (carpeta brand/ del mismo bucket).
// Usa `sharp` (ya instalado como dependencia de Next) para dibujar cada prenda y la sube al bucket "products".
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

// Siluetas simples en un lienzo de 900x1200
const SHAPES = {
  blazer: (c, d) => `
    <path d="M300 250 L450 330 L600 250 L760 330 L790 700 L690 700 L690 1000 L210 1000 L210 700 L110 700 L140 330 Z" fill="${c}"/>
    <path d="M300 250 L450 520 L600 250 L450 330 Z" fill="${d}"/>
    <path d="M450 520 L450 1000" stroke="${d}" stroke-width="6"/>
    <circle cx="500" cy="660" r="14" fill="${d}"/><circle cx="500" cy="780" r="14" fill="${d}"/>`,
  dress: (c, d) => `
    <path d="M360 240 L450 330 L540 240 L610 300 L570 520 L760 1010 Q450 1060 140 1010 L330 520 L290 300 Z" fill="${c}"/>
    <path d="M330 520 L570 520 L560 560 L340 560 Z" fill="${d}"/>
    <path d="M450 330 L450 520" stroke="${d}" stroke-width="5"/>`,
  jacket: (c, d) => `
    <path d="M310 260 L450 320 L590 260 L790 340 L820 760 L710 760 L710 980 L190 980 L190 760 L80 760 L110 340 Z" fill="${c}"/>
    <path d="M450 320 L450 980" stroke="${d}" stroke-width="10"/>
    <path d="M300 640 L420 640 M480 640 L600 640" stroke="${d}" stroke-width="8"/>
    <path d="M310 260 L420 420 L450 320 Z M590 260 L480 420 L450 320 Z" fill="${d}"/>`,
  shirt: (c, d) => `
    <path d="M320 250 L450 310 L580 250 L780 340 L810 640 L700 640 L700 990 L200 990 L200 640 L90 640 L120 340 Z" fill="${c}"/>
    <path d="M320 250 L450 420 L580 250 L450 310 Z" fill="${d}"/>
    <path d="M450 420 L450 990" stroke="${d}" stroke-width="5"/>
    <circle cx="450" cy="520" r="9" fill="${d}"/><circle cx="450" cy="640" r="9" fill="${d}"/><circle cx="450" cy="760" r="9" fill="${d}"/>`,
  blouse: (c, d) => `
    <path d="M330 260 L450 360 L570 260 Q720 300 800 470 Q770 560 690 560 L690 960 L210 960 L210 560 Q130 560 100 470 Q180 300 330 260 Z" fill="${c}"/>
    <path d="M330 260 L450 420 L570 260 L450 360 Z" fill="${d}"/>
    <path d="M200 900 Q450 960 700 900" stroke="${d}" stroke-width="8" fill="none"/>`,
  costume: (c, d) => `
    <path d="M450 80 L560 330 L340 330 Z" fill="${d}"/><ellipse cx="450" cy="335" rx="190" ry="34" fill="${d}"/>
    <path d="M370 380 L450 440 L530 380 L600 440 L560 620 L770 1010 Q450 1070 130 1010 L340 620 L300 440 Z" fill="${c}"/>
    <path d="M370 380 Q450 560 530 380" stroke="${d}" stroke-width="10" fill="none"/>`,
};

// [número, fondo claro, fondo oscuro, color prenda, color detalle, forma]
const LOOKS = {
  1: ["#fbf3e8", "#ead8bd", "#d9bf94", "#b99a68", "blazer"],
  2: ["#e7f3ec", "#bcd9c8", "#0f5a3d", "#093d29", "dress"],
  3: ["#f1e4ea", "#d9b9c6", "#26212a", "#0e0c10", "jacket"],
  4: ["#f8f6f1", "#e4ddcf", "#fbfaf7", "#d6cfbf", "shirt"],
  5: ["#fdeaf1", "#f6c3d6", "#f48fb3", "#d96a93", "blouse"],
  6: ["#efe6f5", "#cbb4de", "#2a1b3a", "#6a3d8f", "costume"],
  7: ["#eef0f2", "#cfd4da", "#8b929b", "#5e656e", "blazer"],
  8: ["#fde7e9", "#f3b6bd", "#c10b21", "#8e0818", "dress"],
};

function svg(n, title) {
  const [bg1, bg2, fill, detail, shape] = LOOKS[n];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient>
      <filter id="sh" x="-20%" y="-10%" width="140%" height="130%"><feDropShadow dx="0" dy="22" stdDeviation="22" flood-color="#3b0a14" flood-opacity="0.22"/></filter>
    </defs>
    <rect width="900" height="1200" fill="url(#bg)"/>
    <path d="M450 120 Q450 90 480 90 Q510 90 510 118 Q510 142 478 150 L450 190 L120 330 Q95 345 125 352 L450 340 L775 352 Q805 345 780 330 L450 190" fill="none" stroke="#3b0a14" stroke-opacity="0.35" stroke-width="7" stroke-linecap="round" transform="translate(-30 20)"/>
    <g filter="url(#sh)">${SHAPES[shape](fill, detail)}</g>
    <text x="450" y="1120" text-anchor="middle" font-family="Georgia, serif" font-size="38" fill="#3b0a14" fill-opacity="0.55">${title}</text>
    <text x="450" y="1165" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" letter-spacing="6" fill="#3b0a14" fill-opacity="0.4">FOTO DE EJEMPLO</text>
  </svg>`;
}

const { data: tenant, error: te } = await db.from("tenants").select("id").eq("slug", "serena").single();
if (te) throw new Error(`tenant: ${te.message}`);
// Marca para correos: el wordmark en blanco (se ve sobre la cabecera oscura)
{
  const src = sharp(await readFile("public/brand/serena-wordmark.png")).ensureAlpha();
  const { width, height } = await src.metadata();
  const alpha = await src.clone().extractChannel(3).raw().toBuffer();
  const white = await sharp({ create: { width, height, channels: 3, background: "#ffffff" } })
    .joinChannel(alpha, { raw: { width, height, channels: 1 } })
    .png().toBuffer();
  const up = await db.storage.from("products").upload(`${tenant.id}/brand/wordmark-white.png`, white, { contentType: "image/png", upsert: true });
  if (up.error) throw new Error(`marca: ${up.error.message}`);
  console.log("marca para correos → ok");
}

const { data: products, error: pe } = await db.from("products").select("id, number, title").eq("tenant_id", tenant.id);
if (pe) throw new Error(`products: ${pe.message}`);

for (const p of products) {
  if (!LOOKS[p.number]) continue;
  const esc = p.title.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const png = await sharp(Buffer.from(svg(p.number, esc))).png({ compressionLevel: 9 }).toBuffer();
  const path = `${tenant.id}/demo-${p.number}.png`;
  const up = await db.storage.from("products").upload(path, png, { contentType: "image/png", upsert: true });
  if (up.error) throw new Error(`upload #${p.number}: ${up.error.message}`);
  const { publicUrl } = db.storage.from("products").getPublicUrl(path).data;
  const { error } = await db.from("products").update({ photos: [publicUrl] }).eq("id", p.id);
  if (error) throw new Error(`update #${p.number}: ${error.message}`);
  console.log(`#${p.number} ${p.title} → ok (${Math.round(png.length / 1024)} KB)`);
}
