import Link from "next/link";
import Image from "next/image";
import { formatCLP, pieceLabel } from "@/lib/format";
import type { Product } from "@/lib/types";

export default function ProductCard({ slug, p }: { slug: string; p: Product }) {
  const sold = p.status === "sold";
  const held = p.status === "reserved";

  return (
    <Link href={`/${slug}/p/${p.number}`} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-blush">
        {p.photos[0] ? (
          <Image
            src={p.photos[0]}
            alt={p.title}
            fill
            sizes="(max-width: 448px) 50vw, 224px"
            className={`object-cover transition-transform duration-300 group-active:scale-[0.98] ${sold ? "grayscale" : ""}`}
          />
        ) : null}
        <span className="absolute left-2 top-2 rounded-full bg-paper/90 px-2 py-0.5 text-[11px] font-bold text-ink">
          #{p.number}
        </span>
        {(sold || held) && (
          <span
            className={`absolute inset-x-2 bottom-2 rounded-full px-3 py-1 text-center text-xs font-bold ${
              sold ? "bg-ink text-paper" : "bg-accent text-ink"
            }`}
          >
            {sold ? "Vendida" : "Reservada"}
          </span>
        )}
      </div>
      <div className="mt-2 px-0.5">
        <p className="truncate text-sm font-semibold" title={pieceLabel(p.number)}>{p.title}</p>
        <p className="text-sm text-muted">
          <span className="font-bold text-brand">{formatCLP(p.price)}</span>
          {p.size ? <span> · Talla {p.size}</span> : null}
        </p>
      </div>
    </Link>
  );
}
