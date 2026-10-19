"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { card, ghostBtn } from "@/components/ui";
import type { Customer } from "@/lib/types";

export default function CustomerRow({ c, maxStrikes }: { c: Customer; maxStrikes: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const stuck = c.blocked || c.strikes >= maxStrikes;

  async function patch(values: Partial<Pick<Customer, "strikes" | "blocked">>) {
    setBusy(true);
    await createClient().from("customers").update(values).eq("tenant_id", c.tenant_id).eq("user_id", c.user_id);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className={`${card} space-y-2`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{c.full_name}</p>
          <p className="truncate text-xs text-muted">{[c.phone, c.email].filter(Boolean).join(" · ")}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${stuck ? "bg-brand text-paper" : "bg-blush text-ink"}`}>
          {c.blocked ? "Bloqueada" : `${c.strikes}/${maxStrikes} faltas`}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {c.strikes > 0 && <button disabled={busy} className={ghostBtn} onClick={() => patch({ strikes: 0 })}>Perdonar faltas</button>}
        <button disabled={busy} className={ghostBtn} onClick={() => patch({ blocked: !c.blocked })}>
          {c.blocked ? "Desbloquear" : "Bloquear"}
        </button>
      </div>
    </div>
  );
}
