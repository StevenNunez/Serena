"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = { slug: string; tenantId: string; productId: string; userId: string | null; initial: boolean };

export default function FavoriteButton({ slug, tenantId, productId, userId, initial }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!userId) return router.push(`/${slug}/login?next=${encodeURIComponent(pathname)}`);
    setBusy(true);
    const supabase = createClient();
    const next = !on;
    setOn(next);
    const { error } = next
      ? await supabase.from("favorites").upsert({ tenant_id: tenantId, user_id: userId, product_id: productId })
      : await supabase.from("favorites").delete().eq("user_id", userId).eq("product_id", productId);
    if (error) setOn(!next);
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={on}
      aria-label={on ? "Quitar de favoritas" : "Guardar en favoritas"}
      className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-white active:scale-90"
    >
      <svg viewBox="0 0 24 24" className="size-6" fill={on ? "var(--brand)" : "none"} stroke="var(--brand)" strokeWidth="2" strokeLinejoin="round">
        <path d="M12 21s-7-4.6-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.4-9.5 9-9.5 9z" />
      </svg>
    </button>
  );
}
