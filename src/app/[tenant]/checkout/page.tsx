import type { Metadata } from "next";
import { getTenant } from "@/lib/tenant";
import { expireHolds, requireCustomer } from "@/lib/session";
import CheckoutForm from "@/components/CheckoutForm";
import type { Product } from "@/lib/types";

export const metadata: Metadata = { title: "Pagar", robots: { index: false } };

export default async function CheckoutPage({ params }: PageProps<"/[tenant]/checkout">) {
  const { tenant: slug } = await params;
  const t = await getTenant(slug);
  const v = await requireCustomer(slug, t.id, `/${slug}/checkout`);
  await expireHolds(t.id);

  const { data } = await v.supabase
    .from("products")
    .select("*")
    .eq("tenant_id", t.id)
    .eq("status", "reserved")
    .eq("reserved_by", v.user.id)
    .is("order_id", null)
    .gt("reserved_until", new Date().toISOString())
    .order("reserved_until");

  return (
    <CheckoutForm
      slug={slug}
      tenantId={t.id}
      items={(data ?? []) as Product[]}
      delivery={t.settings.delivery}
      payments={t.settings.payments}
      customer={{ name: v.customer.full_name, phone: v.customer.phone ?? "", address: v.customer.address ?? {} }}
    />
  );
}
