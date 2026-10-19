// Siembra una tienda con piezas y una clienta demo con datos creíbles. Idempotente.
// Uso:  node --env-file=.env.local scripts/seed.mjs [slug] [--vacia]
//   slug     tienda a sembrar (por defecto "demo": la tienda de pruebas, que no sale en Google).
//   --vacia  crea la tienda sin piezas (para una tienda real que la dueña va a llenar).
// Requiere en .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   DEMO_EMAIL (clienta demo) y, opcional, OWNER_EMAIL (dueña, rol admin).
import { createClient } from "@supabase/supabase-js";

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, DEMO_EMAIL, OWNER_EMAIL } = process.env;
if (!url || !key || !DEMO_EMAIL) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o DEMO_EMAIL en .env.local");
  process.exit(1);
}
const slug = process.argv[2]?.startsWith("--") ? "demo" : (process.argv[2] ?? "demo");
const vacia = process.argv.includes("--vacia");
const esDemo = slug === "demo";
const db = createClient(url, key, { auth: { persistSession: false } });

async function must(label, q) {
  const { data, error } = await q;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function ensureUser(email, name) {
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
  const found = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (found) return found.id;
  const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: name } });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  return data.user.id;
}

// 1) Tienda
const tenant = await must(
  "tenant",
  db.from("tenants").upsert(
    {
      slug,
      name: esDemo ? "Serena Demo" : "Serena",
      theme: { primary: "#c10b21", accent: "#fa95b3", logo: "/brand/serena-wordmark.png", tagline: "Moda & Accesorios" },
    },
    { onConflict: "slug" },
  ).select("id").single(),
);
const tid = tenant.id;
if (esDemo) {
  // Marca la tienda como demostración: sin buscadores ni sitemap
  const { settings } = await must("settings", db.from("tenants").select("settings").eq("id", tid).single());
  await must("demo-flag", db.from("tenants").update({ settings: { ...settings, demo: true } }).eq("id", tid));
}

// Medios de pago de la demo: transferencia activa; pasarelas se activan al cargar credenciales
await must("bank", db.from("tenant_bank").upsert({
  tenant_id: tid,
  data: { holder: "Serena Moda y Accesorios", rut: "26.011.410-7", bank: "Banco Estado", account_type: "Cuenta RUT", account: "26011410", email: "pagos@serena.cl" },
}));

// 2) Categorías
const cats = [
  ["Blazers", "blazers"], ["Vestidos", "vestidos"], ["Chaquetas", "chaquetas"],
  ["Camisas", "camisas"], ["Blusas", "blusas"], ["Disfraces", "disfraces"],
];
await must("categories", db.from("categories").upsert(
  cats.map(([name, slug], i) => ({ tenant_id: tid, name, slug, sort: i })),
  { onConflict: "tenant_id,slug" },
));
const catRows = await must("catRows", db.from("categories").select("id, slug").eq("tenant_id", tid));
const cat = Object.fromEntries(catRows.map((c) => [c.slug, c.id]));

// 3) Piezas únicas (número fijo para poder re-sembrar sin duplicar)
const pieces = [
  [1, "Blazer oversize beige", "blazers", "M", "Beige", "Como nuevo", 18990, "Corte oversize, forro completo. Hombreras suaves."],
  [2, "Vestido satinado verde botella", "vestidos", "S", "Verde", "Nuevo con etiqueta", 24990, "Largo midi con abertura lateral. Cae precioso."],
  [3, "Chaqueta de cuero sintético negra", "chaquetas", "M", "Negro", "Muy buen estado", 21990, "Estilo motera, cierres plateados."],
  [4, "Camisa blanca de lino", "camisas", "L", "Blanco", "Como nuevo", 12990, "Lino fresco, ideal para verano."],
  [5, "Blusa floral con volantes", "blusas", "S", "Rosa", "Nuevo con etiqueta", 11990, "Mangas globo, cuello en V."],
  [6, "Disfraz de bruja con sombrero", "disfraces", "Única", "Negro", "Nuevo", 15990, "Incluye vestido, capa y sombrero."],
  [7, "Blazer cuadros gris", "blazers", "L", "Gris", "Muy buen estado", 16990, "Estilo oficina, doble botón."],
  [8, "Vestido rojo cruzado", "vestidos", "M", "Rojo", "Como nuevo", 22990, "Cruzado en la cintura, tela fluida."],
];
if (!vacia) await must("products", db.from("products").upsert(
  pieces.map(([number, title, c, size, color, condition, price, description]) => ({
    tenant_id: tid, number, title, category_id: cat[c], size, color, condition, price, description, status: "available",
  })),
  { onConflict: "tenant_id,number", ignoreDuplicates: true },
));
if (!vacia) await must("counter", db.from("tenants").update({ next_product_number: pieces.length + 1 }).eq("id", tid).lt("next_product_number", pieces.length + 1));

// 4) Dueña (admin) y clienta demo
if (OWNER_EMAIL) {
  const owner = await ensureUser(OWNER_EMAIL, "Dueña Serena");
  await must("owner", db.from("memberships").upsert({ tenant_id: tid, user_id: owner, role: "admin", full_name: "Dueña" }));
  console.log(`Admin: ${OWNER_EMAIL}`);
}
const demo = await ensureUser(DEMO_EMAIL, "Clienta Demo");
await must("demo", db.from("customers").upsert({
  tenant_id: tid, user_id: demo, full_name: "Clienta Demo", phone: "+56 9 0000 0000", email: DEMO_EMAIL,
  address: { street: "Av. Providencia 1234", commune: "Providencia", region: "Región Metropolitana" },
}));

console.log(`Listo: tienda "${slug}" (${tid}), ${vacia ? 0 : pieces.length} piezas, demo ${DEMO_EMAIL}`);
