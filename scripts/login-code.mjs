// Genera un código de acceso (OTP) sin enviar correo, para entrar como admin o demo.
// Uso:  node --env-file=.env.local scripts/login-code.mjs [correo ...]
import { createClient } from "@supabase/supabase-js";

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, OWNER_EMAIL, DEMO_EMAIL } = process.env;
const emails = process.argv.length > 2 ? process.argv.slice(2) : [OWNER_EMAIL, DEMO_EMAIL].filter(Boolean);
const db = createClient(url, key, { auth: { persistSession: false } });

for (const email of emails) {
  const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
  console.log(error ? `${email}: ${error.message}` : `${email}  →  código ${data.properties.email_otp}`);
}
