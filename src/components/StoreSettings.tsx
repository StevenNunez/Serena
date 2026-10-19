"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { card, field, primaryBtn } from "@/components/ui";
import type { Bank, TenantSettings } from "@/lib/types";

export default function StoreSettings({ tenantId, settings, bank }: { tenantId: string; settings: TenantSettings; bank: Bank }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const s = (k: string) => String(fd.get(k) ?? "").trim();
    const n = (k: string) => Math.max(0, Math.round(Number(fd.get(k)) || 0));
    setBusy(true);
    setMsg(null);
    const supabase = createClient();

    const next: TenantSettings = {
      ...settings,
      reservation_minutes: Math.max(1, n("reservation_minutes")),
      payment_minutes: Math.max(1, n("payment_minutes")),
      max_strikes: Math.max(1, n("max_strikes")),
      sold_retention_hours: Math.max(1, n("sold_retention_hours") || 24),
      proof_retention_days: Math.max(1, n("proof_retention_days") || 30),
      pickup_info: { address: s("pickup_address"), hours: s("pickup_hours"), notes: s("pickup_notes") },
      social: { instagram: s("social_instagram"), tiktok: s("social_tiktok"), youtube: s("social_youtube"), facebook: s("social_facebook") },
      legal: { nombre: s("legal_nombre"), rut: s("legal_rut"), direccion: s("legal_direccion") },
      delivery: {
        pickup: { ...settings.delivery.pickup, cost: 0 },
        courier: { ...settings.delivery.courier, cost: n("courier") },
        delivery: { ...settings.delivery.delivery, cost: n("delivery") },
      },
    };
    const [a, b] = await Promise.all([
      supabase.from("tenants").update({ settings: next }).eq("id", tenantId),
      supabase.from("tenant_bank").upsert({
        tenant_id: tenantId,
        data: {
          holder: s("holder"), rut: s("rut"), bank: s("bank"),
          account_type: s("account_type"), account: s("account"), email: s("email"),
        },
      }),
    ]);
    setBusy(false);
    if (a.error || b.error) return setMsg("No pudimos guardar. Intenta de nuevo.");
    setMsg("Guardado.");
    router.refresh();
  }

  const input = (name: string, label: string, value: string | number | undefined, type = "text") => (
    <div>
      <label className="block text-sm font-semibold" htmlFor={`st-${name}`}>{label}</label>
      <input id={`st-${name}`} name={name} type={type} defaultValue={value ?? ""} className={field} />
    </div>
  );

  return (
    <form onSubmit={save} className="space-y-5">
      <section className={`${card} space-y-3`}>
        <h2 className="font-display text-2xl">Datos para transferir</h2>
        <p className="text-sm text-muted">Los ven las clientas al pagar.</p>
        {input("holder", "Titular", bank.holder)}
        {input("rut", "RUT", bank.rut)}
        {input("bank", "Banco", bank.bank)}
        {input("account_type", "Tipo de cuenta", bank.account_type)}
        {input("account", "N° de cuenta", bank.account)}
        {input("email", "Correo para comprobantes", bank.email, "email")}
      </section>

      <section className={`${card} space-y-3`}>
        <h2 className="font-display text-2xl">Tiempos y entrega</h2>
        {input("reservation_minutes", "Minutos que se guarda una reserva", settings.reservation_minutes, "number")}
        {input("payment_minutes", "Minutos para pagar un pedido", settings.payment_minutes, "number")}
        {input("max_strikes", "Faltas antes de bloquear", settings.max_strikes, "number")}
        {input("courier", "Costo envío por courier (CLP)", settings.delivery.courier.cost, "number")}
        {input("delivery", "Costo despacho a domicilio (CLP)", settings.delivery.delivery.cost, "number")}
      </section>

      <section className={`${card} space-y-3`}>
        <h2 className="font-display text-2xl">Retiro en tienda</h2>
        <p className="text-sm text-muted">Lo ven las clientas cuando su pedido está listo para retirar.</p>
        {input("pickup_address", "Dirección de retiro", settings.pickup_info?.address)}
        {input("pickup_hours", "Horario de retiro", settings.pickup_info?.hours)}
        {input("pickup_notes", "Indicaciones (opcional)", settings.pickup_info?.notes)}
      </section>

      <section className={`${card} space-y-3`}>
        <h2 className="font-display text-2xl">Redes de la tienda</h2>
        <p className="text-sm text-muted">Donde transmites tus en vivo. Si no pegas un enlace al empezar, las clientas llegan a tu perfil. Sirve el @usuario o la dirección completa.</p>
        {input("social_instagram", "Instagram", settings.social?.instagram)}
        {input("social_tiktok", "TikTok", settings.social?.tiktok)}
        {input("social_youtube", "YouTube", settings.social?.youtube)}
        {input("social_facebook", "Facebook", settings.social?.facebook)}
      </section>

      <section className={`${card} space-y-3`}>
        <h2 className="font-display text-2xl">Pie de los correos</h2>
        <p className="text-sm text-muted">Aparece al final de cada correo que reciben las clientas.</p>
        {input("legal_nombre", "Razón social o nombre", settings.legal?.nombre)}
        {input("legal_rut", "RUT", settings.legal?.rut)}
        {input("legal_direccion", "Dirección", settings.legal?.direccion)}
      </section>

      <section className={`${card} space-y-3`}>
        <h2 className="font-display text-2xl">Limpieza automática</h2>
        <p className="text-sm text-muted">Para no ocupar espacio: las piezas vendidas se retiran de la tienda con sus fotos, y los comprobantes viejos se borran.</p>
        {input("sold_retention_hours", "Horas que una pieza vendida sigue visible para quien la compró", settings.sold_retention_hours ?? 24, "number")}
        {input("proof_retention_days", "Días que se guarda el comprobante de un pedido cerrado", settings.proof_retention_days ?? 30, "number")}
      </section>

      <button className={primaryBtn} disabled={busy}>{busy ? "Guardando…" : "Guardar cambios"}</button>
      <p role="status" className="min-h-5 text-center text-sm font-semibold text-brand">{msg}</p>
    </form>
  );
}
