"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Step = "email" | "code" | "perfil";

type Props = {
  slug: string;
  tenantId: string;
  tenantName: string;
  next: string;
  initialStep: Step;
  initialName?: string;
  initialPhone?: string;
};

const field =
  "h-12 w-full rounded-xl border border-line bg-white px-4 text-base outline-none focus:border-brand";
const primary =
  "h-14 w-full rounded-full bg-brand text-lg font-bold text-paper active:scale-[0.98] disabled:opacity-60";

export default function LoginForm({
  slug, tenantId, tenantName, next, initialStep, initialName = "", initialPhone = "",
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState<Step>(initialStep);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Solo rutas internas de esta tienda
  const dest = next.startsWith(`/${slug}`) ? next : `/${slug}`;

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) return setError("No pudimos enviar el código. Revisa tu correo e intenta de nuevo.");
    setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    if (error || !data.user) {
      setBusy(false);
      return setError("Código incorrecto o vencido.");
    }
    const { data: customer } = await supabase
      .from("customers").select("user_id").eq("tenant_id", tenantId).eq("user_id", data.user.id).maybeSingle();
    setBusy(false);
    if (customer) {
      router.replace(dest);
      router.refresh();
    } else {
      setStep("perfil");
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("upsert_customer", {
      p_tenant: tenantId, p_name: name, p_phone: phone,
    });
    setBusy(false);
    if (error) return setError("No pudimos guardar tus datos. Intenta de nuevo.");
    router.replace(dest);
    router.refresh();
  }

  return (
    <div className="px-6 pt-8">
      {step === "email" && (
        <form onSubmit={sendCode} className="space-y-4">
          <h1 className="font-display text-3xl">Entra a {tenantName}</h1>
          <p className="text-muted">Te enviamos un código a tu correo. Sin contraseñas.</p>
          <label className="block text-sm font-semibold" htmlFor="email">Correo</label>
          <input id="email" type="email" required autoComplete="email" inputMode="email" value={email}
            onChange={(e) => setEmail(e.target.value)} className={field} placeholder="tu@correo.cl" />
          <button className={primary} disabled={busy}>{busy ? "Enviando…" : "Enviarme el código"}</button>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={verify} className="space-y-4">
          <h1 className="font-display text-3xl">Revisa tu correo</h1>
          <p className="text-muted">Escribe el código que enviamos a <strong>{email}</strong>.</p>
          <label className="block text-sm font-semibold" htmlFor="code">Código</label>
          <input id="code" required autoComplete="one-time-code" inputMode="numeric" value={code}
            onChange={(e) => setCode(e.target.value)} className={`${field} text-center text-2xl tracking-[0.4em]`} />
          <button className={primary} disabled={busy}>{busy ? "Verificando…" : "Entrar"}</button>
          <button type="button" onClick={() => setStep("email")} className="w-full text-sm font-semibold text-muted underline">
            Usar otro correo
          </button>
        </form>
      )}

      {step === "perfil" && (
        <form onSubmit={saveProfile} className="space-y-4">
          <h1 className="font-display text-3xl">¿Cómo te llamas?</h1>
          <p className="text-muted">Así sabremos quién se lleva cada pieza y cómo avisarte.</p>
          <label className="block text-sm font-semibold" htmlFor="name">Nombre y apellido</label>
          <input id="name" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={field} />
          <label className="block text-sm font-semibold" htmlFor="phone">WhatsApp</label>
          <input id="phone" required type="tel" autoComplete="tel" inputMode="tel" value={phone}
            onChange={(e) => setPhone(e.target.value)} className={field} placeholder="+56 9 1234 5678" />
          <button className={primary} disabled={busy}>{busy ? "Guardando…" : "Guardar y seguir"}</button>
        </form>
      )}

      <p role="alert" className="mt-4 min-h-5 text-center text-sm font-semibold text-brand">{error}</p>
    </div>
  );
}
