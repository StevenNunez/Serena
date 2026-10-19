import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getTenant } from "@/lib/tenant";
import LoginForm from "@/components/LoginForm";

export const metadata: Metadata = { title: "Entrar", robots: { index: false } };

export default async function LoginPage({ params, searchParams }: PageProps<"/[tenant]/login">) {
  const { tenant: slug } = await params;
  const sp = await searchParams;
  const t = await getTenant(slug);

  const { data } = await (await createClient()).auth.getUser();
  const wantsProfile = sp.step === "perfil" && !!data.user;

  return (
    <LoginForm
      slug={slug}
      tenantId={t.id}
      tenantName={t.name}
      next={typeof sp.next === "string" ? sp.next : `/${slug}`}
      initialStep={wantsProfile ? "perfil" : "email"}
      como={sp.como === "tienda" ? "tienda" : "clienta"}
    />
  );
}
