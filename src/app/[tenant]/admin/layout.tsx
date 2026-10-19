import type { Metadata } from "next";
import Link from "next/link";
import { getTenant } from "@/lib/tenant";
import { requireStaff } from "@/lib/session";
import type { Role } from "@/lib/types";

export const metadata: Metadata = { title: "Panel", robots: { index: false } };

const TABS: { href: string; label: string; roles: Role[] }[] = [
  { href: "", label: "Pedidos", roles: ["admin", "caja"] },
  { href: "/piezas", label: "Piezas", roles: ["admin", "live"] },
  { href: "/live", label: "En vivo", roles: ["admin", "live"] },
  { href: "/clientas", label: "Clientas", roles: ["admin", "caja"] },
  { href: "/tienda", label: "Tienda", roles: ["admin"] },
];

export default async function AdminLayout({ children, params }: LayoutProps<"/[tenant]/admin">) {
  const { tenant: slug } = await params;
  const t = await getTenant(slug);
  const { role } = await requireStaff(slug, t.id, ["admin", "live", "caja"]);

  return (
    <div>
      <nav aria-label="Panel" className="sticky top-[calc(env(safe-area-inset-top)+3rem)] z-20 flex gap-2 overflow-x-auto border-b border-line bg-paper px-4 py-2 [scrollbar-width:none]">
        {TABS.filter((x) => x.roles.includes(role)).map((x) => (
          <Link
            key={x.label}
            href={`/${slug}/admin${x.href}`}
            className="shrink-0 rounded-full bg-blush px-4 py-1.5 text-sm font-bold text-ink"
          >
            {x.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
