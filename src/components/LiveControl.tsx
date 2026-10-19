"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { card, field, ghostBtn, primaryBtn, smallBtn } from "@/components/ui";
import { formatCLP, pieceLabel } from "@/lib/format";
import { PLATAFORMAS, enlaceValido, nombreDe, type Plataforma } from "@/lib/live";
import type { LiveSession, Product } from "@/lib/types";

// Elegir en qué red se transmite y, si ya se tiene, pegar el enlace del en vivo
function DondeSeVe({
  platform, url, onPlatform, onUrl, id,
}: { platform: Plataforma; url: string; onPlatform: (p: Plataforma) => void; onUrl: (v: string) => void; id: string }) {
  const actual = PLATAFORMAS.find((x) => x.id === platform)!;
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">¿Dónde vas a transmitir?</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Red de la transmisión">
        {PLATAFORMAS.map((x) => (
          <button
            key={x.id}
            type="button"
            role="radio"
            aria-checked={platform === x.id}
            onClick={() => onPlatform(x.id)}
            className={`rounded-full border px-4 py-2 text-sm font-bold ${platform === x.id ? "border-brand bg-brand text-paper" : "border-line bg-white text-ink"}`}
          >
            {x.nombre}
          </button>
        ))}
      </div>
      <label htmlFor={id} className="block text-sm font-semibold">Enlace de tu en vivo (opcional)</label>
      <input id={id} value={url} onChange={(e) => onUrl(e.target.value)} className={field} inputMode="url" placeholder={actual.ejemplo} />
      <p className="text-xs text-muted">
        {platform === "youtube" || platform === "facebook"
          ? "Con este enlace el video se ve dentro de Serena, sobre la pieza."
          : `${actual.nombre} no permite mostrar el video dentro de otra página: las clientas verán un botón para abrirlo.`}{" "}
        Si no lo pegas, usamos el perfil de la tienda. Puedes agregarlo cuando ya estés transmitiendo.
      </p>
    </div>
  );
}

type P = Pick<Product, "id" | "number" | "title" | "price" | "status">;

export default function LiveControl({
  tenantId, userId, session, products,
}: { tenantId: string; userId: string; session: LiveSession | null; products: P[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState<Plataforma>(session?.platform ?? "instagram");
  const [url, setUrl] = useState(session?.stream_url ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true);
    setMsg(null);
    const { error } = await fn();
    setBusy(false);
    if (error) return setMsg("No se pudo completar. Intenta de nuevo.");
    router.refresh();
  }

  const supabase = createClient();

  if (!session) {
    return (
      <form
        className={`${card} space-y-3`}
        onSubmit={(e) => {
          e.preventDefault();
          if (url.trim() && !enlaceValido(platform, url)) {
            setMsg(`Ese enlace no parece de ${nombreDe(platform)}. Revísalo o déjalo vacío.`);
            return;
          }
          void run(async () => {
            const r = await supabase
              .from("live_sessions")
              .insert({ tenant_id: tenantId, title: title.trim(), created_by: userId, platform, stream_url: enlaceValido(platform, url) })
              .select("id")
              .single();
            // Avisa a las clientas que activaron las notificaciones (no frena el inicio del vivo)
            if (r.data?.id) {
              void fetch("/api/push/live", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ sessionId: r.data.id }),
                keepalive: true,
              }).catch(() => {});
            }
            return { error: r.error };
          });
        }}
      >
        <h2 className="font-display text-2xl">Empezar un en vivo</h2>
        <p className="text-sm text-muted">Las clientas verán el aviso en el inicio y podrán reservar la pieza que muestres.</p>
        <label htmlFor="lv-title" className="block text-sm font-semibold">Título</label>
        <input id="lv-title" required value={title} onChange={(e) => setTitle(e.target.value)} className={field} placeholder="Fardo de octubre" />
        <DondeSeVe id="lv-url" platform={platform} url={url} onPlatform={setPlatform} onUrl={setUrl} />
        <button className={primaryBtn} disabled={busy}>Empezar en vivo</button>
        <p role="alert" className="min-h-5 text-center text-sm font-semibold text-brand">{msg}</p>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`${card} flex items-center justify-between gap-3`}>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand">En vivo ahora</p>
          <p className="font-display text-2xl">{session.title}</p>
        </div>
        <button
          disabled={busy}
          className={ghostBtn}
          onClick={() =>
            run(() => supabase.from("live_sessions").update({ status: "ended", ended_at: new Date().toISOString(), current_product_id: null }).eq("id", session.id))
          }
        >
          Terminar
        </button>
      </div>

      <form
        className={`${card} space-y-3`}
        onSubmit={(e) => {
          e.preventDefault();
          if (url.trim() && !enlaceValido(platform, url)) {
            setMsg(`Ese enlace no parece de ${nombreDe(platform)}. Revísalo o déjalo vacío.`);
            return;
          }
          void run(() => supabase.from("live_sessions").update({ platform, stream_url: enlaceValido(platform, url) }).eq("id", session.id));
        }}
      >
        <DondeSeVe id="lv-url-edit" platform={platform} url={url} onPlatform={setPlatform} onUrl={setUrl} />
        <button className={smallBtn} disabled={busy}>Guardar</button>
      </form>

      <h2 className="text-sm font-bold uppercase tracking-widest text-muted">Mostrar pieza</h2>
      <ul className="space-y-2">
        {products.map((p) => {
          const current = p.id === session.current_product_id;
          return (
            <li key={p.id} className={`${card} flex items-center gap-3 ${current ? "border-brand ring-1 ring-brand" : ""}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.title}</p>
                <p className="text-xs text-muted">{pieceLabel(p.number)} · {formatCLP(p.price)}{p.status === "reserved" ? " · reservada" : ""}</p>
              </div>
              {current ? (
                <span className="text-xs font-bold text-brand">En pantalla</span>
              ) : (
                <button
                  disabled={busy}
                  className={smallBtn}
                  onClick={() => run(() => supabase.from("live_sessions").update({ current_product_id: p.id }).eq("id", session.id))}
                >
                  Mostrar
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p role="alert" className="min-h-5 text-center text-sm font-semibold text-brand">{msg}</p>
    </div>
  );
}
