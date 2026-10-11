// auth-recover: recuperación de la contraseña de un ADMINISTRADOR. Tres acciones:
//
//   { accion: "enviar",    usuario }                  -> envía un código de 6 dígitos al correo de Mi Perfil (sin sesión)
//   { accion: "restablecer"|(omitida), usuario, codigo, nueva }  -> cambia la contraseña con ese código o uno de respaldo (sin sesión)
//   { accion: "probar" }  (con sesión de admin)       -> envía un correo de prueba, para comprobar que el envío funciona
//
// La lógica y los límites viven en SQL (request_recovery_otp / recover_password): bcrypt, bloqueo tras 5 fallos,
// 60 s entre envíos, 15 min de vigencia, mismo mensaje exista o no el usuario. El código en claro solo viaja de la
// base a esta función y de aquí al correo: nunca se devuelve al navegador.
import { createClient } from "npm:@supabase/supabase-js@2";
import { correoCodigo, correoPrueba, mailConfigured, maskEmail, sendMail } from "../_shared/mail.ts";

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  let body: { accion?: string; usuario?: string; codigo?: string; nueva?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }
  const accion = body.accion ?? "restablecer";
  const usuario = String(body.usuario ?? "").trim();

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── Enviar código al correo ────────────────────────────────────────────────
  if (accion === "enviar") {
    if (!usuario || usuario.length > 120) return json({ error: "Escribe tu usuario" }, 400);
    if (!mailConfigured()) return json({ error: "El envío de correo aún no está configurado. Usa un código de respaldo o contacta a quien administra el sistema." }, 503);

    const { data, error } = await admin.rpc("request_recovery_otp", { p_usuario: usuario });
    if (error) return json({ error: "No se pudo procesar la solicitud" }, 500);
    if (data?.send) {
      try {
        await sendMail({ ...correoCodigo(data.nombre, data.code, data.minutos), to: data.email });
      } catch (e) {
        console.error("Fallo al enviar el código:", (e as Error).message);
        return json({ error: "No se pudo enviar el correo. Intenta más tarde o usa un código de respaldo." }, 502);
      }
    }
    // Misma respuesta si el usuario existe o no, si tiene correo o no, o si está en el límite de solicitudes
    return json({ ok: true });
  }

  // ── Correo de prueba (admin con sesión) ────────────────────────────────────
  if (accion === "probar") {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(token);
    const meta = u?.user?.app_metadata;
    if (!u?.user || meta?.app_role !== "admin" || !meta?.personal_id) return json({ error: "No autorizado" }, 401);
    if (!mailConfigured()) return json({ error: "El envío de correo aún no está configurado (faltan los secretos del proveedor)" }, 503);
    const { data } = await admin.rpc("recovery_target", { p_personal: meta.personal_id });
    if (!data?.email) return json({ error: "No tienes un correo de recuperación registrado en Mi Perfil" }, 400);
    try {
      await sendMail({ ...correoPrueba(data.nombre), to: data.email });
    } catch (e) {
      return json({ error: (e as Error).message }, 502);
    }
    return json({ ok: true, destino: maskEmail(data.email) });
  }

  // ── Restablecer con un código (de correo o de respaldo) ────────────────────
  const codigo = String(body.codigo ?? "").trim();
  const nueva = String(body.nueva ?? "");
  if (!usuario || !codigo || !nueva) return json({ error: "Completa usuario, código y nueva contraseña" }, 400);
  if (usuario.length > 120 || codigo.length > 40 || nueva.length > 200) return json({ error: "Datos inválidos" }, 400);

  const { data, error } = await admin.rpc("recover_password", { p_usuario: usuario, p_code: codigo, p_new: nueva });
  if (error) {
    if (error.code === "28000") return json({ error: error.message }, 429);           // bloqueado por intentos
    if (error.code === "22023") return json({ error: error.message }, 400);           // contraseña no válida
    return json({ error: "No se pudo restablecer la contraseña" }, 500);
  }
  if (!data?.ok) return json({ error: "Usuario o código incorrecto" }, 401);          // mismo mensaje exista o no el usuario
  return json({ ok: true, restantes: data.restantes });
});
