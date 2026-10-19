"use client";

import { useState, useSyncExternalStore } from "react";

// Instalación como app (PWA). Chrome/Edge en Android dejan instalar con un toque;
// iPhone solo permite hacerlo desde Safari con «Compartir → Agregar a inicio».
type Prompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: Prompt | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as Prompt;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    emit();
  });
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => void listeners.delete(cb);
};

const DISMISS_KEY = "install-dismissed";

function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

type Kind = "ssr" | "installed" | "prompt" | "ios" | "inapp" | "other";

// Un solo texto estable para que useSyncExternalStore no re-renderice de más
function snapshot(): string {
  const nav = navigator as Navigator & { standalone?: boolean };
  const standalone = window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
  let kind: Kind;
  if (standalone || installed) kind = "installed";
  else if (deferred) kind = "prompt";
  else if (/Instagram|FBAN|FBAV|FB_IAB|Line\/|TikTok|Snapchat/i.test(nav.userAgent)) kind = "inapp";
  else if (/iPhone|iPad|iPod/i.test(nav.userAgent) || (nav.userAgent.includes("Mac") && nav.maxTouchPoints > 1)) kind = "ios";
  else kind = "other";
  return `${kind}:${readDismissed() ? "1" : "0"}`;
}

function useInstall() {
  const snap = useSyncExternalStore(subscribe, snapshot, () => "ssr:0");
  const [kind, dismissed] = snap.split(":") as [Kind, string];

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    emit();
  }
  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    emit();
  }
  return { kind, dismissed: dismissed === "1", install, dismiss };
}

function Steps({ kind }: { kind: Kind }) {
  if (kind === "inapp") {
    return (
      <p className="rounded-2xl bg-paper/70 px-4 py-3 text-sm">
        Estás dentro de otra app (Instagram, Facebook…). Toca los <b>tres puntos ⋯</b> y elige <b>«Abrir en el navegador»</b>; ahí aparece la opción de instalar.
      </p>
    );
  }
  if (kind === "ios") {
    return (
      <ol className="space-y-1.5 rounded-2xl bg-paper/70 px-4 py-3 text-sm">
        <li>1. Abre esta página en <b>Safari</b>.</li>
        <li>2. Toca el botón <b>Compartir</b> (el cuadrado con la flecha hacia arriba).</li>
        <li>3. Elige <b>«Agregar a inicio»</b> y listo: tendrás Serena como una app más.</li>
      </ol>
    );
  }
  return (
    <ol className="space-y-1.5 rounded-2xl bg-paper/70 px-4 py-3 text-sm">
      <li>1. Abre el menú del navegador (<b>⋮</b>).</li>
      <li>2. Elige <b>«Instalar app»</b> o <b>«Agregar a la pantalla de inicio»</b>.</li>
    </ol>
  );
}

const outline = "flex h-12 w-full items-center justify-center rounded-full border-2 border-cta px-6 text-base font-bold text-cta active:scale-[0.99]";

/** Botón grande de la página de entrada */
export function InstallHero() {
  const { kind, install } = useInstall();
  const [open, setOpen] = useState(false);

  if (kind === "ssr" || kind === "installed") return null;
  if (kind === "prompt") {
    return (
      <button type="button" onClick={install} className={outline}>
        Instalar la app
      </button>
    );
  }
  return (
    <div className="space-y-3">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={outline}>
        Instalar la app
      </button>
      {open ? <Steps kind={kind} /> : null}
    </div>
  );
}

/** Aviso chico dentro de la tienda, para quien entró por el navegador */
export function InstallBanner() {
  const { kind, dismissed, install, dismiss } = useInstall();
  const [open, setOpen] = useState(false);

  if (dismissed || (kind !== "prompt" && kind !== "ios")) return null;

  return (
    <div className="mb-3 rounded-2xl bg-accent px-4 py-3">
      <div className="flex items-center gap-3">
        <p className="flex-1 text-sm font-semibold">Instala Serena en tu celular y entra con un toque.</p>
        {kind === "prompt" ? (
          <button type="button" onClick={install} className="rounded-full bg-brand px-4 py-2 text-xs font-bold text-paper">
            Instalar
          </button>
        ) : (
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="rounded-full bg-brand px-4 py-2 text-xs font-bold text-paper">
            Cómo
          </button>
        )}
        <button type="button" onClick={dismiss} aria-label="Cerrar aviso" className="-mr-1 px-1 text-lg leading-none text-ink/70">
          ×
        </button>
      </div>
      {open ? (
        <div className="mt-2">
          <Steps kind="ios" />
        </div>
      ) : null}
    </div>
  );
}
