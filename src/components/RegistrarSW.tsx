"use client";

import { useEffect } from "react";

// El service worker tiene que estar registrado desde la primera visita: así el navegador
// instala Serena como app (con sus avisos y links propios) y no como un simple atajo.
export default function RegistrarSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
