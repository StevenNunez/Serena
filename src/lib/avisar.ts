// Pide al servidor el correo de un evento del pedido. No bloquea la pantalla ni muestra errores:
// el correo es un aviso, la acción ya ocurrió.
export function avisar(orderId: string, evento: "creado" | "comprobante" | "pagado" | "listo" | "enviado" | "rechazado") {
  void fetch("/api/correo", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ orderId, evento }),
    keepalive: true,
  }).catch(() => {});
}
