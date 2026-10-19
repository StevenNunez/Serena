"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { card, ghostBtn, smallBtn } from "@/components/ui";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

const sinSuscripcion = () => () => {};

// «unsupported»: el navegador no sabe de avisos; «ios-install»: en iPhone solo funcionan con la app instalada
function soporte(): string {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent) ? "ios-install" : "unsupported";
  }
  return Notification.permission; // default | granted | denied
}

function aBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export default function PushToggle({ slug, texto = "Entérate al tiro cuando cambie tu pedido." }: { slug: string; texto?: string }) {
  const estado = useSyncExternalStore(sinSuscripcion, soporte, () => "ssr");
  const [activo, setActivo] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (estado !== "granted") return;
    void navigator.serviceWorker
      .getRegistration()
      .then((r) => r?.pushManager.getSubscription())
      .then((s) => setActivo(!!s))
      .catch(() => setActivo(false));
  }, [estado]);

  if (!PUBLIC_KEY || estado === "ssr" || estado === "unsupported") return null;

  if (estado === "ios-install") {
    return (
      <div className={`${card} text-sm`}>
        <p className="font-bold">Activa los avisos</p>
        <p className="text-muted">En iPhone primero instala la app: en Safari toca <b>Compartir</b> → <b>Agregar a inicio</b>, ábrela desde ahí y activa los avisos.</p>
      </div>
    );
  }
  if (estado === "denied") {
    return (
      <div className={`${card} text-sm`}>
        <p className="font-bold">Los avisos están bloqueados</p>
        <p className="text-muted">Actívalos en los ajustes del navegador o de la app para este sitio.</p>
      </div>
    );
  }

  async function activar() {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      if ((await Notification.requestPermission()) !== "granted") return;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(PUBLIC_KEY!) });
      const r = await fetch("/api/push/suscribir", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, subscription: sub.toJSON() }),
      });
      if (!r.ok) throw new Error("save");
      setActivo(true);
    } catch {
      setError("No pudimos activar los avisos. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function desactivar() {
    setBusy(true);
    try {
      const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/suscribir", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setActivo(false);
    } finally {
      setBusy(false);
    }
  }

  if (estado === "granted" && activo) {
    return (
      <div className={`${card} flex items-center justify-between gap-3 text-sm`}>
        <p><span className="font-bold text-ok">Avisos activados.</span> <span className="text-muted">Te llegan a este celular.</span></p>
        <button type="button" disabled={busy} onClick={desactivar} className={ghostBtn}>Desactivar</button>
      </div>
    );
  }

  return (
    <div className={`${card} flex items-center justify-between gap-3`}>
      <div className="text-sm">
        <p className="font-bold">Activa los avisos</p>
        <p className="text-muted">{texto}</p>
        {error ? <p role="alert" className="mt-1 font-semibold text-brand">{error}</p> : null}
      </div>
      <button type="button" disabled={busy} onClick={activar} className={smallBtn}>Activar</button>
    </div>
  );
}
