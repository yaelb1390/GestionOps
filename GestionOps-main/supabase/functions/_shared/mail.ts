// Envío de correo para las Edge Functions. Funciona con CUALQUIER proveedor según los secretos que se configuren:
//
//   Opción A · Resend (API):    RESEND_API_KEY=re_...            [MAIL_FROM="Gestores OPS <onboarding@resend.dev>"]
//   Opción B · SMTP (Gmail, Brevo, etc.): SMTP_HOST, SMTP_USER, SMTP_PASS [SMTP_PORT=465] [MAIL_FROM]
//
// Si hay RESEND_API_KEY se usa Resend; si no, SMTP. Sin ninguno, mailConfigured() devuelve null.
// Nota: Supabase bloquea los puertos 25 y 587 en las Edge Functions; usa el 465 (SSL).
import nodemailer from "npm:nodemailer@6.9.16";

export interface Mail { to: string; subject: string; text: string; html: string }

export function mailConfigured(): "resend" | "smtp" | null {
  if (Deno.env.get("RESEND_API_KEY")) return "resend";
  if (Deno.env.get("SMTP_HOST")) return "smtp";
  return null;
}

// "yaelb1390@gmail.com" -> "y*******@gmail.com"
export function maskEmail(email: string): string {
  const [u, d] = email.split("@");
  if (!d) return "***";
  return u.slice(0, 1) + "*".repeat(Math.max(2, Math.min(u.length - 1, 8))) + "@" + d;
}

export async function sendMail(m: Mail): Promise<void> {
  const via = mailConfigured();
  if (via === "resend") {
    const res = await fetch(Deno.env.get("RESEND_API_URL") ?? "https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("MAIL_FROM") ?? "Gestores OPS <onboarding@resend.dev>",
        to: [m.to], subject: m.subject, text: m.text, html: m.html,
      }),
    });
    if (!res.ok) {
      const detalle = await res.text().catch(() => "");
      console.error("Resend error", res.status, detalle.slice(0, 300));
      // 403 sin dominio verificado: Resend solo entrega al correo con el que se creó la cuenta
      throw new Error(res.status === 403 || res.status === 422
        ? "El proveedor de correo rechazó el destinatario (¿Resend sin dominio verificado? solo envía al correo de tu cuenta)"
        : "El proveedor de correo no pudo enviar el mensaje");
    }
    return;
  }
  if (via === "smtp") {
    const port = Number(Deno.env.get("SMTP_PORT") ?? "465");
    const user = Deno.env.get("SMTP_USER") ?? "";
    const transport = nodemailer.createTransport({
      host: Deno.env.get("SMTP_HOST"),
      port,
      secure: (Deno.env.get("SMTP_SECURE") ?? String(port === 465)) === "true",
      ignoreTLS: Deno.env.get("SMTP_SECURE") === "false" && Deno.env.get("SMTP_INSECURE") === "true", // solo pruebas locales
      auth: user ? { user, pass: Deno.env.get("SMTP_PASS") ?? "" } : undefined,
      connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
    });
    try {
      await transport.sendMail({ from: Deno.env.get("MAIL_FROM") ?? user, to: m.to, subject: m.subject, text: m.text, html: m.html });
    } catch (e) {
      console.error("SMTP error", (e as Error).message);
      throw new Error("El servidor de correo no pudo enviar el mensaje (revisa usuario y contraseña de aplicación)");
    }
    return;
  }
  throw new Error("El envío de correo no está configurado");
}

// ── Plantillas ───────────────────────────────────────────────────────────────
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

function layout(titulo: string, cuerpoHtml: string): string {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#0f172a;padding:24px;font-family:Segoe UI,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="440" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border-radius:18px;overflow:hidden">
<tr><td style="height:5px;background:#da291c"></td></tr>
<tr><td style="padding:28px 32px 8px;font-size:13px;font-weight:700;letter-spacing:1.2px;color:#da291c">GESTORES OPS</td></tr>
<tr><td style="padding:0 32px 28px">
<h1 style="margin:0 0 12px;font-size:20px;color:#0f172a">${esc(titulo)}</h1>${cuerpoHtml}
</td></tr></table>
<p style="color:#94a3b8;font-size:12px;margin:16px 0 0">Mensaje automático de Gestión OPS de Campo.</p>
</td></tr></table></body></html>`;
}

export function correoCodigo(nombre: string, codigo: string, minutos: number): Mail & { to?: string } {
  const texto = `Hola ${nombre},\n\nTu código para restablecer la contraseña de Gestores OPS es:\n\n    ${codigo}\n\n` +
    `Vale ${minutos} minutos y solo se puede usar una vez.\nSi tú no lo pediste, ignora este mensaje: tu contraseña no cambia.\n`;
  const html = layout("Restablecer contraseña",
    `<p style="margin:0 0 18px;color:#475569;font-size:14px;line-height:1.55">Hola ${esc(nombre)}, usa este código para crear una contraseña nueva:</p>
<div style="margin:0 0 18px;padding:18px;border-radius:14px;background:#f1f5f9;text-align:center;font:700 34px/1 ui-monospace,Consolas,monospace;letter-spacing:10px;color:#0f172a">${esc(codigo)}</div>
<p style="margin:0 0 6px;color:#475569;font-size:13px">Vale <b>${minutos} minutos</b> y solo se puede usar una vez.</p>
<p style="margin:0;color:#94a3b8;font-size:12px">Si tú no lo pediste, ignora este mensaje: tu contraseña no cambia.</p>`);
  return { to: "", subject: `${codigo} es tu código de Gestores OPS`, text: texto, html };
}

export function correoPrueba(nombre: string): Mail & { to?: string } {
  const texto = `Hola ${nombre},\n\nEste es un correo de prueba: el envío de códigos de recuperación funciona correctamente.\n` +
    `Si algún día olvidas tu contraseña, el código llegará a esta dirección.\n`;
  const html = layout("El correo funciona",
    `<p style="margin:0;color:#475569;font-size:14px;line-height:1.55">Hola ${esc(nombre)}, este es un correo de prueba: el envío de códigos de recuperación funciona. Si algún día olvidas tu contraseña, el código llegará a esta dirección.</p>`);
  return { to: "", subject: "Correo de prueba · Gestores OPS", text: texto, html };
}
