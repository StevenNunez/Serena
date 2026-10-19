"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "", label: "Inicio", icon: "M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { href: "/live", label: "En vivo", icon: "M4 6h12a2 2 0 0 1 2 2v1.5l4-2.5v10l-4-2.5V16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" },
  { href: "/favoritas", label: "Favoritas", icon: "M12 21s-7-4.6-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.4-9.5 9-9.5 9z" },
  { href: "/mis-piezas", label: "Mis piezas", icon: "M6 7h12l1 13H5zM9 7a3 3 0 0 1 6 0" },
];

export default function BottomNav({ slug }: { slug: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="grid grid-cols-4">
        {items.map((it) => {
          const href = `/${slug}${it.href}`;
          const active = it.href === "" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={it.label}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
                  active ? "text-brand" : "text-muted"
                }`}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
                  <path d={it.icon} />
                </svg>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
