import "server-only";
import { createClient } from "@supabase/supabase-js";

// Clave de servicio: solo webhooks y scripts del servidor. Nunca en el navegador.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
