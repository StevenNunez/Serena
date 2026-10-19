// Correos con la cara de la tienda. Tablas y estilos en línea (Gmail/Outlook ignoran <style>, flex y SVG),
// texto de vista previa oculto y versión de texto plano.

export type Marca = {
  nombre: string;
  /** PNG público, con fondo transparente y en blanco: va sobre la cabecera oscura. */
  logo: string | null;
  primario: string;
  acento: string;
  sitio: string | null;
  legal?: { nombre?: string; rut?: string; direccion?: string };
};

const TINTA = "#3b0a14";
const SUAVE = "#8a5a66";

export const escapar = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;

/** "Teo Labs" con cada letra en un tramo del degradado azul → morado → verde (los correos no pintan texto con degradado). */
export function firmaTeoLabs() {
  const paradas = [
    [0x25, 0x63, 0xeb],
    [0xa8, 0x55, 0xf7],
    [0x22, 0xc5, 0x5e],
  ];
  const letras = [..."Teo Labs"];
  const color = (t: number) => {
    const tramo = t < 0.5 ? 0 : 1;
    const u = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
    return (
      "#" +
      [0, 1, 2]
        .map((i) => Math.round(paradas[tramo][i] + (paradas[tramo + 1][i] - paradas[tramo][i]) * u))
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("")
    );
  };
  const coloreadas = letras
    .map((c, i) => (c === " " ? " " : `<span style="color:${color(i / (letras.length - 1))}">${c}</span>`))
    .join("");
  return `Desarrollado por <a href="https://www.teolabs.app" target="_blank" rel="noopener noreferrer" style="text-decoration:none;font-weight:bold">${coloreadas}</a> &reg;`;
}

type Fila = [etiqueta: string, valor: string];

export type Contenido = {
  asunto: string;
  /** Texto de vista previa (lo que se ve junto al asunto en la bandeja) */
  previa: string;
  /** Sobretítulo en mayúsculas: "Pedido #12" */
  etiqueta: string;
  titulo: string;
  /** Párrafos del mensaje */
  parrafos: string[];
  /** Tarjeta de resumen (número, montos, fechas) */
  resumen?: Fila[];
  /** Datos destacados, p. ej. los de transferencia */
  bloque?: { titulo: string; filas: Fila[]; nota?: string };
  boton: { texto: string; url: string };
};

export function armarCorreo(m: Marca, c: Contenido) {
  const filas = (fs: Fila[]) =>
    fs
      .map(
        ([k, v]) => `<tr>
          <td style="padding:6px 0;font-size:13px;color:${SUAVE}">${escapar(k)}</td>
          <td align="right" style="padding:6px 0;font-size:14px;font-weight:bold;color:${TINTA}">${escapar(v)}</td></tr>`,
      )
      .join("");

  const texto = [
    c.titulo,
    "",
    ...c.parrafos,
    "",
    ...(c.resumen ?? []).map(([k, v]) => `${k}: ${v}`),
    ...(c.bloque ? ["", c.bloque.titulo, ...c.bloque.filas.map(([k, v]) => `${k}: ${v}`), ...(c.bloque.nota ? [c.bloque.nota] : [])] : []),
    "",
    `${c.boton.texto}: ${c.boton.url}`,
    "",
    "—",
    m.legal?.nombre ? `${m.legal.nombre}${m.legal.rut ? ` · RUT ${m.legal.rut}` : ""}` : m.nombre,
    ...(m.legal?.direccion ? [m.legal.direccion] : []),
    ...(m.sitio ? [m.sitio.replace(/^https?:\/\//, "")] : []),
    `Enviado desde ${m.nombre} · Desarrollado por Teo Labs ®`,
  ].join("\n");

  const nombreCabecera = m.logo
    ? `<td width="150" valign="middle"><img src="${escapar(m.logo)}" width="140" alt="${escapar(m.nombre)}" style="display:block;border:0;height:auto"></td>
       <td valign="middle" style="padding-left:12px;font-size:15px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;color:#ffffff">${escapar(m.nombre)}</td>`
    : `<td valign="middle" style="font-size:20px;font-weight:bold;letter-spacing:4px;text-transform:uppercase;color:#ffffff">${escapar(m.nombre)}</td>`;

  const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapar(c.asunto)}</title></head>
<body style="margin:0;padding:0;background:#fdeef3">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapar(c.previa)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdeef3">
  <tr><td align="center" style="padding:28px 12px">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;font-family:Arial,Helvetica,sans-serif;color:${TINTA}">

      <tr><td style="background:${TINTA};border-radius:16px 16px 0 0;padding:20px 28px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          ${nombreCabecera}
          <td align="right" valign="middle" style="font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:#d9aebb">Tienda en línea</td>
        </tr></table>
      </td></tr>
      <tr><td style="background:${m.acento};height:4px;line-height:4px;font-size:0">&nbsp;</td></tr>

      <tr><td style="background:#ffffff;padding:28px">
        <div style="font-size:11px;font-weight:bold;letter-spacing:1.6px;text-transform:uppercase;color:${m.primario}">${escapar(c.etiqueta)}</div>
        <div style="margin-top:6px;font-size:26px;line-height:1.2;font-weight:bold;color:${TINTA}">${escapar(c.titulo)}</div>

        ${
          c.resumen?.length
            ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;background:#fff6f9;border-radius:12px"><tr><td style="padding:10px 16px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filas(c.resumen)}</table></td></tr></table>`
            : ""
        }

        <div style="margin-top:22px;font-size:15px;line-height:1.6;color:${TINTA}">
          ${c.parrafos.map((p) => `<p style="margin:0 0 14px">${escapar(p).replace(/\n/g, "<br>")}</p>`).join("")}
        </div>

        ${
          c.bloque
            ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px;border:1px solid #f4c9d6;border-radius:12px"><tr><td style="padding:14px 16px">
          <div style="font-size:11px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;color:${SUAVE}">${escapar(c.bloque.titulo)}</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px">${filas(c.bloque.filas)}</table>
          ${c.bloque.nota ? `<div style="margin-top:8px;padding:10px 12px;background:#fdeef3;border-radius:8px;font-size:13px;color:${TINTA}">${c.bloque.nota}</div>` : ""}
        </td></tr></table>`
            : ""
        }

        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px"><tr>
          <td style="background:${m.primario};border-radius:999px">
            <a href="${escapar(c.boton.url)}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none">${escapar(c.boton.texto)} &rarr;</a>
          </td>
        </tr></table>
      </td></tr>

      <tr><td style="background:#ffffff;border-radius:0 0 16px 16px;padding:0 28px 22px">
        <div style="font-size:11px;color:${SUAVE}">Si el botón no funciona, copia este enlace: <span style="word-break:break-all">${escapar(c.boton.url)}</span></div>
      </td></tr>

      <tr><td align="center" style="padding:22px 12px 0;font-size:12px;line-height:1.7;color:${SUAVE}">
        <strong style="color:${TINTA}">${escapar(m.legal?.nombre || m.nombre)}</strong>${m.legal?.rut ? ` · RUT ${escapar(m.legal.rut)}` : ""}<br>
        ${m.legal?.direccion ? `${escapar(m.legal.direccion)}<br>` : ""}
        ${m.sitio ? `<a href="${escapar(m.sitio)}" target="_blank" style="color:${m.primario};font-weight:bold;text-decoration:none">${escapar(m.sitio.replace(/^https?:\/\//, ""))}</a>` : ""}
      </td></tr>
      <tr><td align="center" style="padding:16px 12px 8px;font-size:11px;color:#a68994">
        Enviado desde ${escapar(m.nombre)}<br>${firmaTeoLabs()}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  return { asunto: c.asunto, texto, html };
}
