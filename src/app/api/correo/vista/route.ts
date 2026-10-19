import { NextResponse } from "next/server";
import { correoDeFila, correoDePedido, type DatosPedido, type Evento } from "@/lib/email/mensajes";
import type { Marca } from "@/lib/email/plantilla";

// Solo desarrollo: /api/correo/vista?e=creado|comprobante|pagado|listo|enviado|rechazado|vencido|fila
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") return new NextResponse("Not found", { status: 404 });

  const e = (new URL(req.url).searchParams.get("e") ?? "creado") as Evento;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const marca: Marca = {
    nombre: "Serena",
    logo: base ? `${base}/storage/v1/object/public/products/12ba24bd-7e92-46c5-9d3a-4a21b9402a6e/brand/wordmark-white.png` : null,
    primario: "#c10b21",
    acento: "#fa95b3",
    sitio: null,
  };
  const d: DatosPedido = {
    numero: 12,
    total: 47980,
    referencia: "SER-0012-AB",
    entrega: "courier",
    seguimiento: "CP123456789",
    motivo: "Rechazado: el monto no coincide",
    retiro: { direccion: "Av. Providencia 1234, Providencia", horario: "Lunes a viernes de 10:00 a 18:00", notas: "Trae tu cédula." },
    direccionEnvio: "Av. Providencia 1234, Providencia, Región Metropolitana",
    minutosParaPagar: 15,
    piezas: [
      { titulo: "Blazer oversize beige", numero: 1, precio: 18990 },
      { titulo: "Vestido satinado verde botella", numero: 2, precio: 24990 },
    ],
    clienta: "Clienta Demo",
    urlPedido: "http://localhost:3000/serena/pedido/demo",
    urlPanel: "http://localhost:3000/serena/admin",
    urlTienda: "http://localhost:3000/serena",
  };
  const bank = { holder: "Serena Moda y Accesorios", rut: "26.011.410-7", bank: "Banco Estado", account_type: "Cuenta RUT", account: "26011410" };

  const c =
    e === "fila"
      ? correoDeFila(marca, { clienta: "Clienta Demo", pieza: { titulo: "Blazer oversize beige", numero: 1, precio: 18990 }, minutos: 6, urlPieza: d.urlTienda + "/p/1" })
      : correoDePedido(marca, e, d, bank);
  return new NextResponse(c.html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
