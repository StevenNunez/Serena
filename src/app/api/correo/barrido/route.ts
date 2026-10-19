import { NextResponse } from "next/server";
import { barrerPendientes } from "@/lib/email/enviar";
import { limpiarAlmacenamiento } from "@/lib/limpieza";

// Cron: avisa a quien le tocó una pieza de la fila de espera y a quien dejó vencer un pedido,
// y borra fotos de piezas vendidas y comprobantes viejos.
// Protegido con CRON_SECRET (Vercel lo manda como "Authorization: Bearer ...").
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const correos = await barrerPendientes();
  const limpieza = await limpiarAlmacenamiento();
  return NextResponse.json({ correos, limpieza });
}
