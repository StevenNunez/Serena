"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { card, field, ghostBtn, smallBtn } from "@/components/ui";
import type { Category } from "@/lib/types";

const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function CategoryManager({ tenantId, categories }: { tenantId: string; categories: Category[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const slug = slugify(name);
    if (!slug) return setMsg("Escribe un nombre.");
    setBusy(true);
    setMsg(null);
    const { error } = await createClient()
      .from("categories")
      .insert({ tenant_id: tenantId, name: name.trim(), slug, sort: categories.length });
    setBusy(false);
    if (error) return setMsg(error.code === "23505" ? "Ya existe una categoría con ese nombre." : "No se pudo crear.");
    setName("");
    router.refresh();
  }

  async function remove(c: Category) {
    setBusy(true);
    setMsg(null);
    const { error } = await createClient().from("categories").delete().eq("id", c.id);
    setBusy(false);
    if (error) return setMsg("No se pudo borrar.");
    router.refresh();
  }

  return (
    <section className={`${card} space-y-3`}>
      <h2 className="font-display text-2xl">Categorías</h2>
      <p className="text-sm text-muted">Al borrar una, sus piezas quedan sin categoría.</p>
      <ul className="space-y-2">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">{c.name}</span>
            <button onClick={() => remove(c)} disabled={busy} className={ghostBtn}>Borrar</button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="flex gap-2">
        <label htmlFor="cat-new" className="sr-only">Nueva categoría</label>
        <input id="cat-new" value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="Accesorios" />
        <button className={smallBtn} disabled={busy}>Agregar</button>
      </form>
      <p role="alert" className="min-h-4 text-xs font-semibold text-brand">{msg}</p>
    </section>
  );
}
