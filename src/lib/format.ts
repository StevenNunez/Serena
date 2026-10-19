const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

export const formatCLP = (n: number) => clp.format(n);

export const pieceLabel = (n: number) => `Pieza #${n}`;

export const ORDER_STATUS: Record<string, { label: string; tone: "wait" | "ok" | "bad" | "info" }> = {
  pending_payment: { label: "Por pagar", tone: "wait" },
  payment_review: { label: "Pago en revisión", tone: "info" },
  paid: { label: "Pagado", tone: "ok" },
  preparing: { label: "Preparando", tone: "ok" },
  shipped: { label: "Enviado", tone: "ok" },
  delivered: { label: "Entregado", tone: "ok" },
  cancelled: { label: "Cancelado", tone: "bad" },
  expired: { label: "Vencido", tone: "bad" },
};

// Los nombres de los estados dependen de cómo recibe el pedido: retiro en tienda o envío
const PICKUP_LABEL: Record<string, string> = { paid: "Pagado", preparing: "Listo para retirar", delivered: "Retirado" };
const SHIP_LABEL: Record<string, string> = { paid: "Pagado", preparing: "Envío agendado", shipped: "Enviado", delivered: "Recibido" };

export function orderStatus(status: string, delivery?: string) {
  const base = ORDER_STATUS[status] ?? { label: status, tone: "info" as const };
  const own = delivery === "pickup" ? PICKUP_LABEL[status] : delivery ? SHIP_LABEL[status] : undefined;
  return { ...base, label: own ?? base.label };
}

// Barra de avance del pedido
export function orderSteps(delivery: string): [status: string, label: string][] {
  const comun: [string, string][] = [["pending_payment", "Pago"], ["payment_review", "Revisión"], ["paid", "Pagado"]];
  return delivery === "pickup"
    ? [...comun, ["preparing", "Para retirar"], ["delivered", "Retirado"]]
    : [...comun, ["preparing", "Agendado"], ["shipped", "Enviado"], ["delivered", "Recibido"]];
}

export const DELIVERY_LABEL: Record<string, string> = {
  pickup: "Retiro en tienda",
  courier: "Envío por courier",
  delivery: "Despacho a domicilio",
};

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
