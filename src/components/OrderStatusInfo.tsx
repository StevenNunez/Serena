import { DELIVERY_LABEL } from "@/lib/format";
import { card } from "@/components/ui";
import type { Order, TenantSettings } from "@/lib/types";

type Pickup = NonNullable<TenantSettings["pickup_info"]>;

// Qué tiene que saber o hacer la clienta según el estado de su pedido y cómo lo recibe
export default function OrderStatusInfo({ order: o, pickup }: { order: Order; pickup: Pickup }) {
  const retiro = o.delivery_method === "pickup";
  const a = o.shipping_address;
  const direccion = [a.street, a.commune, a.region].filter(Boolean).join(", ");

  if (["pending_payment", "payment_review", "cancelled", "expired"].includes(o.status)) return null;

  const filas = (fs: [string, string | undefined][]) =>
    fs.filter(([, v]) => v).map(([k, v]) => (
      <div key={k} className="flex justify-between gap-3 text-sm">
        <dt className="text-muted">{k}</dt>
        <dd className="text-right font-semibold">{v}</dd>
      </div>
    ));

  if (retiro) {
    const listo = o.status === "preparing";
    const retirado = o.status === "delivered";
    return (
      <section className={`${card} space-y-2`}>
        <h2 className="font-display text-2xl">
          {retirado ? "Retirado, ¡gracias!" : listo ? "¡Listo para retirar!" : "Estamos preparando tu pedido"}
        </h2>
        <p className="text-sm">
          {retirado
            ? "Ya retiraste tu pedido. ¡Que lo disfrutes!"
            : listo
              ? `Pasa a buscarlo y dinos tu nombre o el número de pedido #${o.number}.`
              : "Tu pago está confirmado. Te avisamos apenas esté listo para retirar."}
        </p>
        {!retirado && (
          <dl className="space-y-1 rounded-xl bg-blush px-3 py-2">
            {filas([
              ["Dónde", pickup.address],
              ["Horario", pickup.hours],
            ])}
            {!pickup.address && !pickup.hours && (
              <p className="text-sm">Te confirmamos el lugar y el horario de retiro por correo.</p>
            )}
            {pickup.notes ? <p className="pt-1 text-xs text-muted">{pickup.notes}</p> : null}
          </dl>
        )}
      </section>
    );
  }

  const titulo: Record<string, string> = {
    paid: "Estamos preparando tu envío",
    preparing: "Tu envío está agendado",
    shipped: "¡Tu pedido va en camino!",
    delivered: "Recibido, ¡gracias!",
  };
  const texto: Record<string, string> = {
    paid: "Tu pago está confirmado. Te avisamos cuando agendemos el envío.",
    preparing: "Ya tenemos tu pedido listo y agendado. Te avisamos apenas salga.",
    shipped: "Salió hacia tu dirección. Con el seguimiento puedes ver dónde va.",
    delivered: "Marcamos tu pedido como recibido. Si algo no está bien, escríbenos.",
  };

  return (
    <section className={`${card} space-y-2`}>
      <h2 className="font-display text-2xl">{titulo[o.status]}</h2>
      <p className="text-sm">{texto[o.status]}</p>
      <dl className="space-y-1 rounded-xl bg-blush px-3 py-2">
        {filas([
          ["Entrega", DELIVERY_LABEL[o.delivery_method]],
          ["Dirección", direccion],
          ["Indicaciones", a.notes],
          ["Seguimiento", o.tracking ?? undefined],
        ])}
      </dl>
    </section>
  );
}
