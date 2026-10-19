"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Badging = Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };

// Mantiene al día el número rojo del ícono: cuenta los avisos sin leer, marca como leído lo que
// apunta a la pantalla que se está mirando y deja el dispositivo registrado a nombre de quien tiene la sesión.
export default function BadgeSync({ slug }: { slug: string }) {
  const pathname = usePathname();

  useEffect(() => {
    let vivo = true;
    const supabase = createClient();
    const nav = navigator as Badging;

    async function sync() {
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null).eq("url", pathname);
      const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
      if (!vivo) return;
      try {
        if ((count ?? 0) > 0) await nav.setAppBadge?.(count ?? 0);
        else await nav.clearAppBadge?.();
      } catch {
        /* el sistema no muestra número: no pasa nada */
      }
    }
    void sync();

    const alVolver = () => {
      if (document.visibilityState === "visible") void sync();
    };
    const alLlegarAviso = (e: MessageEvent) => {
      if (e.data?.type === "push") void sync();
    };
    document.addEventListener("visibilitychange", alVolver);
    navigator.serviceWorker?.addEventListener("message", alLlegarAviso);
    return () => {
      vivo = false;
      document.removeEventListener("visibilitychange", alVolver);
      navigator.serviceWorker?.removeEventListener("message", alLlegarAviso);
    };
  }, [pathname]);

  // Si ya aceptó los avisos en este dispositivo, queda a nombre de quien entró (útil si se comparte el celular)
  useEffect(() => {
    if (!("Notification" in window) || Notification.permission !== "granted" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker
      .getRegistration()
      .then((r) => r?.pushManager.getSubscription())
      .then((sub) => {
        if (!sub) return;
        return fetch("/api/push/suscribir", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slug, subscription: sub.toJSON() }),
        });
      })
      .catch(() => {});
  }, [slug]);

  return null;
}
