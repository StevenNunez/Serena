"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { card, field, ghostBtn, smallBtn } from "@/components/ui";
import type { Role } from "@/lib/types";

export type Member = { user_id: string; email: string | null; full_name: string | null; role: Role };

const ROLE_LABEL: Record<Role, string> = { admin: "Administradora", live: "En vivo", caja: "Caja" };

export default function TeamManager({ tenantId, members, meId }: { tenantId: string; members: Member[]; meId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("caja");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function call(method: "POST" | "DELETE", body: object, fail: string) {
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/equipo", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!r.ok) {
      const e = (await r.json().catch(() => ({}))) as { error?: string };
      return setMsg(e.error === "last_admin" ? "Tiene que quedar al menos una administradora." : fail);
    }
    router.refresh();
    return true;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (await call("POST", { tenantId, email, name, role }, "No pudimos agregar a esa persona.")) {
      setEmail("");
      setName("");
    }
  }

  return (
    <section className={`${card} space-y-3`}>
      <h2 className="font-display text-2xl">Equipo</h2>
      <p className="text-sm text-muted">Entran con su correo y un código, igual que las clientas.</p>
      <ul className="space-y-2">
        {members.map((m) => (
          <li key={m.user_id} className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{m.full_name || m.email}</p>
              <p className="truncate text-xs text-muted">{m.email} · {ROLE_LABEL[m.role]}</p>
            </div>
            {m.user_id !== meId && (
              <button disabled={busy} className={ghostBtn} onClick={() => call("DELETE", { tenantId, userId: m.user_id }, "No pudimos quitarla.")}>
                Quitar
              </button>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="space-y-2 border-t border-line pt-3">
        <label htmlFor="tm-email" className="block text-sm font-semibold">Correo</label>
        <input id="tm-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
        <label htmlFor="tm-name" className="block text-sm font-semibold">Nombre</label>
        <input id="tm-name" value={name} onChange={(e) => setName(e.target.value)} className={field} />
        <label htmlFor="tm-role" className="block text-sm font-semibold">Rol</label>
        <select id="tm-role" value={role} onChange={(e) => setRole(e.target.value as Role)} className={field}>
          <option value="caja">Caja: pagos y despachos</option>
          <option value="live">En vivo: piezas y transmisión</option>
          <option value="admin">Administradora: todo</option>
        </select>
        <button className={smallBtn} disabled={busy}>Agregar al equipo</button>
      </form>
      <p role="alert" className="min-h-4 text-xs font-semibold text-brand">{msg}</p>
    </section>
  );
}
