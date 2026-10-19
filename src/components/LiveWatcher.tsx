"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Sin UI: refresca la pantalla cuando el equipo cambia la pieza en vivo o termina la transmisión
export default function LiveWatcher({ tenantId }: { tenantId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`live-${tenantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_sessions", filter: `tenant_id=eq.${tenantId}` }, () =>
        router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [tenantId, router]);

  return null;
}
