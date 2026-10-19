"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resizeImage } from "@/lib/image";
import { pathsFromUrls } from "@/lib/storage";
import { card, field, primaryBtn } from "@/components/ui";
import type { Category, Product } from "@/lib/types";

type Props = {
  tenantId: string;
  categories: Category[];
  /** Si viene, el formulario edita esa pieza en vez de crear una nueva */
  product?: Product;
  onDone?: () => void;
};

export default function PieceForm({ tenantId, categories, product, onDone }: Props) {
  const router = useRouter();
  const editing = !!product;
  const [open, setOpen] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [kept, setKept] = useState<string[]>(product?.photos ?? []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    try {
      const files = (fd.getAll("photos") as File[]).filter((f) => f.size > 0);
      const urls: string[] = [...kept];
      for (const f of files) {
        const path = `${tenantId}/${crypto.randomUUID()}.jpg`;
        const up = await supabase.storage.from("products").upload(path, await resizeImage(f, 1200, 220 * 1024), { contentType: "image/jpeg" });
        if (up.error) throw up.error;
        urls.push(supabase.storage.from("products").getPublicUrl(path).data.publicUrl);
      }
      const str = (k: string) => String(fd.get(k) ?? "").trim() || null;
      const values = {
        title: str("title"),
        description: str("description"),
        category_id: str("category"),
        size: str("size"),
        color: str("color"),
        condition: str("condition"),
        price: Number(fd.get("price")),
        photos: urls,
      };
      const { error } = editing
        ? await supabase.from("products").update(values).eq("id", product.id)
        : await supabase.from("products").insert({ ...values, tenant_id: tenantId, status: "available" });
      if (error) throw error;
      // Las fotos que se quitaron al editar no se quedan ocupando espacio
      const quitadas = pathsFromUrls((product?.photos ?? []).filter((u) => !kept.includes(u)));
      if (quitadas.length) await supabase.storage.from("products").remove(quitadas);
      form.reset();
      setOpen(editing);
      onDone?.();
      router.refresh();
    } catch {
      setMsg("No pudimos guardar la pieza. Revisa los datos y las fotos.");
    }
    setBusy(false);
  }

  if (!open) {
    return <button onClick={() => setOpen(true)} className={primaryBtn}>+ Nueva pieza</button>;
  }

  const id = (k: string) => `pf-${product?.id ?? "new"}-${k}`;

  return (
    <form onSubmit={submit} className={`${card} space-y-3`}>
      <h2 className="font-display text-2xl">{editing ? `Editar pieza #${product.number}` : "Nueva pieza"}</h2>
      <label className="block text-sm font-semibold" htmlFor={id("title")}>Nombre</label>
      <input id={id("title")} name="title" required defaultValue={product?.title} className={field} placeholder="Blazer oversize beige" />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-semibold" htmlFor={id("price")}>Precio (CLP)</label>
          <input id={id("price")} name="price" type="number" inputMode="numeric" min={0} step={10} required defaultValue={product?.price} className={field} />
        </div>
        <div>
          <label className="block text-sm font-semibold" htmlFor={id("size")}>Talla</label>
          <input id={id("size")} name="size" defaultValue={product?.size ?? ""} className={field} placeholder="M" />
        </div>
        <div>
          <label className="block text-sm font-semibold" htmlFor={id("color")}>Color</label>
          <input id={id("color")} name="color" defaultValue={product?.color ?? ""} className={field} />
        </div>
        <div>
          <label className="block text-sm font-semibold" htmlFor={id("cond")}>Estado</label>
          <input id={id("cond")} name="condition" defaultValue={product?.condition ?? ""} className={field} placeholder="Como nuevo" />
        </div>
      </div>
      <label className="block text-sm font-semibold" htmlFor={id("cat")}>Categoría</label>
      <select id={id("cat")} name="category" className={field} defaultValue={product?.category_id ?? ""}>
        <option value="">Sin categoría</option>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <label className="block text-sm font-semibold" htmlFor={id("desc")}>Descripción</label>
      <textarea id={id("desc")} name="description" rows={3} defaultValue={product?.description ?? ""} className={`${field} h-auto py-3`} />

      {kept.length > 0 && (
        <div>
          <p className="text-sm font-semibold">Fotos actuales</p>
          <ul className="mt-1 flex gap-2 overflow-x-auto">
            {kept.map((src, i) => (
              <li key={src} className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-blush">
                <Image src={src} alt={`Foto ${i + 1}`} fill sizes="80px" className="object-cover" />
                <button
                  type="button"
                  onClick={() => setKept((k) => k.filter((x) => x !== src))}
                  aria-label={`Quitar foto ${i + 1}`}
                  className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-ink/80 text-xs font-bold text-paper"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <label className="block text-sm font-semibold" htmlFor={id("photos")}>{editing ? "Agregar fotos" : "Fotos"}</label>
      <input id={id("photos")} name="photos" type="file" accept="image/*" multiple className="block w-full text-sm" />
      <button className={primaryBtn} disabled={busy}>{busy ? "Guardando…" : editing ? "Guardar cambios" : "Publicar pieza"}</button>
      <button type="button" onClick={() => (editing ? onDone?.() : setOpen(false))} className="w-full text-sm font-semibold text-muted underline">Cancelar</button>
      <p role="alert" className="min-h-5 text-center text-sm font-semibold text-brand">{msg}</p>
    </form>
  );
}
