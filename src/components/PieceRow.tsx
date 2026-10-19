"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PieceForm from "@/components/PieceForm";
import { pathsFromUrls } from "@/lib/storage";
import { card, ghostBtn } from "@/components/ui";
import { formatCLP, pieceLabel } from "@/lib/format";
import type { Category, Product } from "@/lib/types";

const LABEL: Record<string, string> = {
  draft: "Borrador", available: "Disponible", reserved: "Reservada", sold: "Vendida", hidden: "Oculta",
};

export default function PieceRow({ p, categories }: { p: Product; categories: Category[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const free = p.status === "available" || p.status === "hidden" || p.status === "draft";

  async function toggle() {
    setBusy(true);
    await createClient().from("products").update({ status: p.status === "hidden" ? "available" : "hidden" }).eq("id", p.id);
    setBusy(false);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (!error && p.photos.length) await supabase.storage.from("products").remove(pathsFromUrls(p.photos));
    setBusy(false);
    if (error) return setMsg("No se pudo borrar. Si tiene historial, mejor ocúltala.");
    router.refresh();
  }

  if (editing) {
    return <PieceForm tenantId={p.tenant_id} categories={categories} product={p} onDone={() => setEditing(false)} />;
  }

  return (
    <div className={`${card} space-y-2`}>
      <div className="flex items-center gap-3">
        <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-blush">
          {p.photos[0] ? <Image src={p.photos[0]} alt="" fill sizes="56px" className="object-cover" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{p.title}</p>
          <p className="text-xs text-muted">{pieceLabel(p.number)} · {formatCLP(p.price)} · {LABEL[p.status]}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setEditing(true)} disabled={busy} className={ghostBtn}>Editar</button>
        {(p.status === "available" || p.status === "hidden") && (
          <button onClick={toggle} disabled={busy} className={ghostBtn}>{p.status === "hidden" ? "Mostrar" : "Ocultar"}</button>
        )}
        {free && !confirmDelete && (
          <button onClick={() => setConfirmDelete(true)} disabled={busy} className={ghostBtn}>Borrar</button>
        )}
        {free && confirmDelete && (
          <>
            <button onClick={remove} disabled={busy} className="inline-flex h-10 items-center rounded-full bg-brand px-4 text-sm font-bold text-paper">Sí, borrar</button>
            <button onClick={() => setConfirmDelete(false)} className="text-sm font-semibold text-muted underline">No</button>
          </>
        )}
      </div>
      <p role="alert" className="text-xs font-semibold text-brand">{msg}</p>
    </div>
  );
}
