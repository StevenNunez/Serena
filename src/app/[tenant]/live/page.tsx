import type { Metadata } from "next";
import Image from "next/image";
import { getTenant } from "@/lib/tenant";
import { getViewer } from "@/lib/session";
import LiveWatcher from "@/components/LiveWatcher";
import ReserveButton from "@/components/ReserveButton";
import { formatCLP, pieceLabel } from "@/lib/format";
import { nombreDe, transmision } from "@/lib/live";
import type { LiveSession, Product } from "@/lib/types";

export const metadata: Metadata = { title: "En vivo" };

export default async function LivePage({ params }: PageProps<"/[tenant]/live">) {
  const { tenant: slug } = await params;
  const t = await getTenant(slug);
  const v = await getViewer(t.id);

  const { data: session } = await v.supabase
    .from("live_sessions")
    .select("id, title, status, current_product_id, platform, stream_url")
    .eq("tenant_id", t.id)
    .eq("status", "live")
    .maybeSingle();
  const live = session as LiveSession | null;

  const video = live ? transmision(live.platform, live.stream_url, t.settings.social) : null;

  let p: Product | null = null;
  let waiting = false;
  if (live?.current_product_id) {
    const { data } = await v.supabase.from("products").select("*").eq("id", live.current_product_id).maybeSingle();
    p = (data as Product | null) ?? null;
    if (p && v.user) {
      const w = await v.supabase.from("waitlist").select("id").eq("product_id", p.id).eq("user_id", v.user.id).maybeSingle();
      waiting = !!w.data;
    }
  }

  return (
    <div className="px-4 pt-4">
      <LiveWatcher tenantId={t.id} />

      {!live ? (
        <div className="rounded-2xl bg-blush px-6 py-12 text-center">
          <p className="font-display text-2xl">No estamos en vivo ahora</p>
          <p className="mt-1 text-sm text-muted">Cuando empecemos, esta pantalla se activa sola.</p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-2">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-brand" />
            </span>
            <h1 className="font-display text-2xl">{live.title}</h1>
          </div>

          {video?.tipo === "incrustado" ? (
            <div className="mb-4 overflow-hidden rounded-2xl bg-ink">
              <iframe
                src={video.src}
                title={`Transmisión en vivo de ${t.name}`}
                className="aspect-video w-full"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          ) : null}
          {video ? (
            <a
              href={video.abrir}
              target="_blank"
              rel="noopener noreferrer"
              className={`mb-4 flex items-center justify-center gap-2 rounded-full px-5 text-sm font-bold ${
                video.tipo === "enlace" ? "h-12 bg-brand text-paper" : "h-10 border border-line bg-white text-ink"
              }`}
            >
              {video.tipo === "enlace" ? "Ver el en vivo" : "Abrir el video"}
              {video.plataforma ? ` en ${nombreDe(video.plataforma)}` : ""} ↗
            </a>
          ) : null}
          {video?.tipo === "enlace" ? (
            <p className="-mt-2 mb-4 text-center text-xs text-muted">Míralo allá y vuelve aquí para reservar tu pieza con «¡Es mía!».</p>
          ) : null}

          {!p ? (
            <div className="rounded-2xl bg-blush px-6 py-12 text-center">
              <p className="font-display text-2xl">Ya viene la próxima pieza</p>
              <p className="mt-1 text-sm text-muted">Quédate aquí: aparece apenas la muestren.</p>
            </div>
          ) : (
            <article key={p.id}>
              <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-blush">
                {p.photos[0] ? <Image src={p.photos[0]} alt={p.title} fill sizes="448px" priority className="object-cover" /> : null}
              </div>
              <p className="mt-3 text-xs font-bold uppercase tracking-widest text-muted">{pieceLabel(p.number)} · única</p>
              <h2 className="font-display text-3xl leading-tight">{p.title}</h2>
              <p className="text-2xl font-bold text-brand">{formatCLP(p.price)}</p>
              <p className="mt-1 text-sm text-muted">{[p.size && `Talla ${p.size}`, p.color, p.condition].filter(Boolean).join(" · ")}</p>
              <div className="mt-4">
                <ReserveButton
                  key={p.id}
                  slug={slug}
                  productId={p.id}
                  initial={{ status: p.status, reserved_by: p.reserved_by, reserved_until: p.reserved_until, order_id: p.order_id }}
                  userId={v.user?.id ?? null}
                  hasProfile={!!v.customer}
                  inWaitlist={waiting}
                  reservationMinutes={t.settings.reservation_minutes}
                />
              </div>
            </article>
          )}
        </>
      )}
    </div>
  );
}
