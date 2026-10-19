"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatClock, useSecondsLeft } from "@/components/Countdown";
import type { Product, ReserveResult } from "@/lib/types";

type Live = Pick<Product, "status" | "reserved_by" | "reserved_until" | "order_id">;

type Props = {
  slug: string;
  productId: string;
  initial: Live;
  userId: string | null;
  hasProfile: boolean;
  inWaitlist: boolean;
  reservationMinutes: number;
};

const ERRORS: Record<string, string> = {
  not_found: "Esta pieza ya no está disponible.",
  profile_required: "Completa tus datos para reservar.",
};

export default function ReserveButton({
  slug, productId, initial, userId, hasProfile, inWaitlist, reservationMinutes,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [p, setP] = useState<Live>(initial);
  const [waiting, setWaiting] = useState(inWaitlist);
  const [position, setPosition] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const mine = !!userId && p.reserved_by === userId;
  const secondsLeft = useSecondsLeft(mine && !p.order_id ? p.reserved_until : null);

  // Estado en vivo: si otra persona reserva, compra o se libera, la pantalla cambia al instante
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`product-${productId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "products", filter: `id=eq.${productId}` },
        (payload) => {
          const n = payload.new as Live;
          setP({ status: n.status, reserved_by: n.reserved_by, reserved_until: n.reserved_until, order_id: n.order_id });
          if (n.status !== "reserved") setWaiting(false);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [productId]);

  const reserve = useCallback(async () => {
    const next = encodeURIComponent(pathname);
    if (!userId) return router.push(`/${slug}/login?next=${next}`);
    if (!hasProfile) return router.push(`/${slug}/login?step=perfil&next=${next}`);

    setBusy(true);
    setMsg(null);
    const { data, error } = await createClient().rpc("reserve_product", { p_product: productId });
    setBusy(false);

    if (error) {
      setMsg(ERRORS[error.message] ?? "No pudimos reservar. Intenta de nuevo.");
      return;
    }
    const r = data as ReserveResult;
    if (r.result === "reserved" || r.result === "mine") {
      setP((s) => ({ ...s, status: "reserved", reserved_by: userId, reserved_until: r.until, order_id: null }));
    } else if (r.result === "waitlisted") {
      setWaiting(true);
      setPosition(r.position);
    } else if (r.result === "sold") {
      setP((s) => ({ ...s, status: "sold" }));
    } else if (r.result === "blocked") {
      setMsg("Tu cuenta tiene reservas sin pagar. Escríbenos para ayudarte.");
    }
  }, [userId, hasProfile, productId, router, slug, pathname]);

  const release = async () => {
    setBusy(true);
    await createClient().rpc("release_my_reservation", { p_product: productId });
    setBusy(false);
    setWaiting(false);
    setPosition(null);
    router.refresh();
  };

  let body: React.ReactNode;

  if (p.status === "sold") {
    body = <Disabled>Vendida</Disabled>;
  } else if (mine && p.status === "reserved" && p.order_id) {
    body = <LinkButton href={`/${slug}/mis-piezas`}>Ir a pagar mi pedido</LinkButton>;
  } else if (mine && p.status === "reserved") {
    body = (
      <>
        <LinkButton href={`/${slug}/checkout`}>
          Es tuya · pagar ahora{secondsLeft !== null ? ` (${formatClock(secondsLeft)})` : ""}
        </LinkButton>
        <button onClick={release} disabled={busy} className="mt-2 w-full text-center text-sm font-semibold text-muted underline">
          Ya no la quiero
        </button>
      </>
    );
  } else if (p.status === "reserved") {
    body = waiting ? (
      <>
        <Disabled>Estás en la fila{position ? ` · lugar ${position}` : ""}</Disabled>
        <button onClick={release} disabled={busy} className="mt-2 w-full text-center text-sm font-semibold text-muted underline">
          Salir de la fila
        </button>
      </>
    ) : (
      <>
        <Disabled>Reservada por otra clienta</Disabled>
        <button onClick={reserve} disabled={busy} className="mt-2 w-full text-center text-sm font-bold text-brand underline">
          Avísame si se libera (unirme a la fila)
        </button>
      </>
    );
  } else {
    body = (
      <>
        <button
          onClick={reserve}
          disabled={busy}
          className="h-14 w-full rounded-full bg-brand text-lg font-bold text-paper transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? "Reservando…" : "¡Es mía!"}
        </button>
        <p className="mt-2 text-center text-xs text-muted">
          La guardamos para ti {reservationMinutes} minutos mientras pagas.
        </p>
      </>
    );
  }

  return (
    <div>
      {body}
      <p role="status" aria-live="polite" className="mt-2 min-h-5 text-center text-sm font-semibold text-brand">
        {msg}
      </p>
    </div>
  );
}

function Disabled({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-14 w-full items-center justify-center rounded-full bg-blush px-4 text-center font-bold text-muted">
      {children}
    </div>
  );
}

function LinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex h-14 w-full items-center justify-center rounded-full bg-brand text-lg font-bold text-paper active:scale-[0.98]">
      {children}
    </Link>
  );
}
