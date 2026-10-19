import "server-only";
import nodemailer from "nodemailer";

// Se reutilizan los nombres de variables que ya existen en el hosting de Teo Labs
// (EMAIL_HOST, EMAIL_PORT, ZOHO_SMTP_USER/PASS o EMAIL_USER/PASS). Los SMTP_* tienen prioridad.
const env = (...nombres: string[]) => nombres.map((n) => process.env[n]?.trim()).find((v) => !!v) ?? "";

function config() {
  const usuario = env("SMTP_USUARIO", "ZOHO_SMTP_USER", "EMAIL_USER");
  return {
    host: env("SMTP_HOST", "EMAIL_HOST"),
    puerto: Number(env("SMTP_PORT", "EMAIL_PORT") || 465),
    usuario,
    clave: env("SMTP_CLAVE", "ZOHO_SMTP_PASS", "EMAIL_PASS"),
    remitente: env("SMTP_REMITENTE") || usuario,
  };
}

export const smtpConfigurado = () => {
  const c = config();
  return !!(c.host && c.usuario && c.clave);
};

const direccionDe = (r: string) => /<([^>]+)>/.exec(r)?.[1] ?? r.trim();

export type Correo = {
  /** Nombre que ve quien recibe: "Serena". La dirección es la de la casilla que autentica. */
  nombre: string;
  para: string;
  asunto: string;
  texto: string;
  html: string;
  responderA?: string;
};

export async function enviarCorreo(c: Correo) {
  const k = config();
  const transporte = nodemailer.createTransport({
    host: k.host,
    port: k.puerto,
    secure: k.puerto === 465,
    auth: { user: k.usuario, pass: k.clave },
  });
  await transporte.sendMail({
    from: { name: c.nombre, address: direccionDe(k.remitente) },
    replyTo: c.responderA || env("EMAIL_REPLY_TO") || undefined,
    to: c.para,
    subject: c.asunto,
    text: c.texto,
    html: c.html,
  });
}
