import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Category, Tenant } from "@/lib/types";

export const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT ?? "serena";

export const getTenant = cache(async (slug: string): Promise<Tenant> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenants")
    .select("id, slug, name, theme, settings")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) notFound();
  return data as Tenant;
});

export const getCategories = cache(async (tenantId: string): Promise<Category[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name, slug, sort")
    .eq("tenant_id", tenantId)
    .order("sort");
  return (data ?? []) as Category[];
});
