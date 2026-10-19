// Reduce una foto del celular antes de subirla, para no cargar el almacenamiento:
// baja el lado mayor y, si aún pesa más de `maxBytes`, va bajando la calidad (y después el tamaño).
export async function resizeImage(file: File, maxSide: number, maxBytes = 250 * 1024): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  let side = maxSide;
  let best: Blob | null = null;

  for (let intento = 0; intento < 3; intento++) {
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; // los PNG con transparencia no se ven negros al pasar a JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.82, 0.72, 0.62, 0.52]) {
      best = await new Promise<Blob>((ok, fail) =>
        canvas.toBlob((b) => (b ? ok(b) : fail(new Error("resize"))), "image/jpeg", quality),
      );
      if (best.size <= maxBytes) {
        bitmap.close();
        return best;
      }
    }
    side = Math.round(side * 0.8);
  }
  bitmap.close();
  return best!;
}
