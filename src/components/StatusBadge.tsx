import { orderStatus } from "@/lib/format";

const TONE = {
  wait: "bg-accent text-ink",
  info: "bg-blush text-brand",
  ok: "bg-ok/15 text-ok",
  bad: "bg-ink/10 text-muted",
} as const;

export default function StatusBadge({ status, delivery }: { status: string; delivery?: string }) {
  const s = orderStatus(status, delivery);
  return <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${TONE[s.tone]}`}>{s.label}</span>;
}
