import { armarCorreo, escapar, pesos, type Contenido, type Marca } from "@/lib/email/plantilla";
import { DELIVERY_LABEL } from "@/lib/format";
import type { Bank } from "@/lib/types";

export type Evento = "creado" | "comprobante" | "pagado" | "listo" | "enviado" | "rechazado" | "vencido" | "fila";

export type DatosPedido = {
  numero: number;
  total: number;
  referencia: string;
  entrega: keyof typeof DELIVERY_LABEL;
  seguimiento: string | null;
  motivo: string | null;
  retiro: { direccion?: string; horario?: string; notas?: string };
  direccionEnvio: string;
  minutosParaPagar: number;
  piezas: { titulo: string; numero: number; precio: number }[];
  clienta: string;
  /** Enlaces ya resueltos con el dominio de la tienda */
  urlPedido: string;
  urlPanel: string;
  urlTienda: string;
};

const primerNombre = (n: string) => n.trim().split(/\s+/)[0] || "hola";
const listaPiezas = (d: DatosPedido) => d.piezas.map((p) => `${p.titulo} (#${p.numero})`).join(", ");

export function correoDePedido(m: Marca, e: Exclude<Evento, "fila">, d: DatosPedido, bank: Bank) {
  const resumen: Contenido["resumen"] = [
    ["Pedido", `#${d.numero}`],
    ["Piezas", String(d.piezas.length)],
    ["Entrega", DELIVERY_LABEL[d.entrega]],
    ["Total", pesos(d.total)],
  ];
  const nombre = primerNombre(d.clienta);

  const C: Record<typeof e, Contenido> = {
    creado: {
      asunto: `Tu pedido #${d.numero} está reservado · ${m.nombre}`,
      previa: `Transfiere ${pesos(d.total)} dentro de ${d.minutosParaPagar} minutos para quedarte con tus piezas.`,
      etiqueta: `Pedido #${d.numero}`,
      titulo: `Tus piezas son tuyas, ${nombre}`,
      parrafos: [
        `Las guardamos por ${d.minutosParaPagar} minutos. Haz la transferencia y sube tu comprobante para confirmarlas: ${listaPiezas(d)}.`,
      ],
      resumen,
      bloque: {
        titulo: "Datos para transferir",
        filas: ([
          ["Titular", bank.holder],
          ["RUT", bank.rut],
          ["Banco", bank.bank],
          ["Tipo de cuenta", bank.account_type],
          ["N° de cuenta", bank.account],
        ] as [string, string | undefined][]).filter((f): f is [string, string] => !!f[1]),
        nota: `En el comentario de la transferencia escribe tu referencia: <strong>${d.referencia}</strong>`,
      },
      boton: { texto: "Subir comprobante", url: d.urlPedido },
    },
    comprobante: {
      asunto: `Pedido #${d.numero} con comprobante por revisar`,
      previa: `${d.clienta} subió su comprobante por ${pesos(d.total)}.`,
      etiqueta: `Pedido #${d.numero}`,
      titulo: "Hay un pago por revisar",
      parrafos: [`${d.clienta} subió el comprobante de su transferencia. Piezas: ${listaPiezas(d)}.`, `Referencia del pedido: ${d.referencia}`],
      resumen,
      boton: { texto: "Revisar en el panel", url: d.urlPanel },
    },
    pagado: {
      asunto: `Pago confirmado · pedido #${d.numero}`,
      previa: "Recibimos tu pago. Estamos preparando tus piezas.",
      etiqueta: `Pedido #${d.numero}`,
      titulo: `¡Pago confirmado, ${nombre}!`,
      parrafos: [
        `Recibimos tu transferencia y tus piezas ya son oficialmente tuyas: ${listaPiezas(d)}.`,
        d.entrega === "pickup" ? "Te avisaremos cuando estén listas para retirar en tienda." : "Las preparamos y te avisamos apenas salgan en camino.",
      ],
      resumen,
      boton: { texto: "Ver mi pedido", url: d.urlPedido },
    },
    listo: {
      asunto: `¡Tu pedido #${d.numero} está listo para retirar!`,
      previa: d.retiro.horario ? `Horario de retiro: ${d.retiro.horario}` : "Pasa a buscarlo cuando quieras.",
      etiqueta: `Pedido #${d.numero}`,
      titulo: `¡Listo para retirar, ${nombre}!`,
      parrafos: [
        `Tu pedido está listo: ${listaPiezas(d)}.`,
        `Cuando vengas, dinos tu nombre o el número de pedido #${d.numero}.`,
      ],
      resumen,
      bloque: {
        titulo: "Retiro en tienda",
        filas: ([
          ["Dónde", d.retiro.direccion],
          ["Horario", d.retiro.horario],
        ] as [string, string | undefined][]).filter((f): f is [string, string] => !!f[1]),
        nota: d.retiro.notas ? escapar(d.retiro.notas) : undefined,
      },
      boton: { texto: "Ver mi pedido", url: d.urlPedido },
    },
    enviado: {
      asunto: `Tu pedido #${d.numero} va en camino`,
      previa: d.seguimiento ? `Número de seguimiento: ${d.seguimiento}` : "Tu pedido ya salió.",
      etiqueta: `Pedido #${d.numero}`,
      titulo: "¡Tu pedido va en camino!",
      parrafos: [
        `Despachamos tus piezas: ${listaPiezas(d)}.`,
        ...(d.direccionEnvio ? [`Dirección de entrega: ${d.direccionEnvio}`] : []),
        ...(d.seguimiento ? [`Número de seguimiento: ${d.seguimiento}`] : []),
      ],
      resumen,
      boton: { texto: "Ver mi pedido", url: d.urlPedido },
    },
    rechazado: {
      asunto: `No pudimos confirmar tu pago · pedido #${d.numero}`,
      previa: "Tu pedido fue cancelado y las piezas volvieron a la venta.",
      etiqueta: `Pedido #${d.numero}`,
      titulo: "No pudimos confirmar tu pago",
      parrafos: [
        `Revisamos tu pedido y no pudimos validar la transferencia${d.motivo ? ` (${d.motivo.replace(/^Rechazado:\s*/i, "")})` : ""}. Las piezas volvieron a la venta.`,
        "Si crees que es un error, responde este correo y lo revisamos contigo.",
      ],
      resumen,
      boton: { texto: "Volver a la tienda", url: d.urlTienda },
    },
    vencido: {
      asunto: `Tu pedido #${d.numero} venció`,
      previa: "No recibimos el pago a tiempo y las piezas volvieron a la venta.",
      etiqueta: `Pedido #${d.numero}`,
      titulo: "Se acabó el tiempo para pagar",
      parrafos: [
        `No recibimos el pago de tu pedido dentro del plazo, así que las piezas volvieron a la venta: ${listaPiezas(d)}.`,
        "Si todavía las quieres, revisa si siguen disponibles.",
      ],
      resumen,
      boton: { texto: "Ver la tienda", url: d.urlTienda },
    },
  };

  return armarCorreo(m, C[e]);
}

export type DatosFila = {
  clienta: string;
  pieza: { titulo: string; numero: number; precio: number };
  minutos: number;
  urlPieza: string;
};

export function correoDeFila(m: Marca, d: DatosFila) {
  return armarCorreo(m, {
    asunto: `¡Te tocó la pieza #${d.pieza.numero}! · ${m.nombre}`,
    previa: `La guardamos para ti ${d.minutos} minutos.`,
    etiqueta: `Pieza #${d.pieza.numero}`,
    titulo: `¡Te tocó, ${primerNombre(d.clienta)}!`,
    parrafos: [
      `Estabas en la fila de «${d.pieza.titulo}» y se liberó. La guardamos para ti por ${d.minutos} minutos: entra y págala antes de que pase a la siguiente persona.`,
    ],
    resumen: [
      ["Pieza", `#${d.pieza.numero}`],
      ["Precio", pesos(d.pieza.precio)],
      ["Tiempo para pagar", `${d.minutos} min`],
    ],
    boton: { texto: "Ir a pagar", url: d.urlPieza },
  });
}
