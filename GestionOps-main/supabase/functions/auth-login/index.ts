// auth-login: valida usuario/contraseña contra public.personal (bcrypt en Postgres vía login_check)
// y abre una sesión de Supabase Auth. Supabase firma el token; no se usa ningún JWT secret.
//
// Por cada persona existe un usuario de Auth con email sintético <personal.id>@users.gestionops.app.
// En cada login se fija app_metadata {app_role, personal_id}, que RLS lee vía app_role()/app_pid().
//
// Variables que Supabase inyecta solas: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from "npm:@supabase/supabase-js@2";

const EMAIL_DOMAIN = "users.gestionops.app";

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

  let body: { usuario?: string; password?: string; rol?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const usuario = String(body.usuario ?? "").trim();
  const password = String(body.password ?? "");
  const rol = body.rol === "admin" ? "admin" : "inspector";
  if (!usuario || !password) return json({ error: "Usuario y contraseña requeridos" }, 400);

  const url = Deno.env.get("SUPABASE_URL")!;
  const opts = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, opts);

  // 1) Credenciales (bcrypt + estado Activo + rol Admin si aplica + bloqueo por intentos)
  const { data, error } = await admin.rpc("login_check", { p_usuario: usuario, p_password: password, p_rol: rol });
  if (error) return json({ error: error.message }, error.code === "28000" ? 429 : 500);
  const user = Array.isArray(data) ? data[0] : data;
  if (!user) return json({ error: "Credenciales incorrectas o usuario inactivo" }, 401);

  // 2) Usuario de Auth (se crea la primera vez) con el rol de ESTE inicio de sesión
  const email = `${user.id}@${EMAIL_DOMAIN}`;
  const sessionPassword = crypto.randomUUID() + crypto.randomUUID(); // de un solo uso; el real es el de personal
  const app_metadata = { app_role: rol, personal_id: user.id };

  const { data: row } = await admin.from("personal").select("auth_user_id").eq("id", user.id).single();
  let authId: string | null = row?.auth_user_id ?? null;

  if (authId) {
    const { error: e } = await admin.auth.admin.updateUserById(authId, { password: sessionPassword, app_metadata });
    if (e) authId = null; // el usuario de Auth pudo borrarse a mano: se recrea
  }
  if (!authId) {
    const { data: created, error: e } = await admin.auth.admin.createUser({
      email, password: sessionPassword, email_confirm: true, app_metadata,
    });
    if (e || !created.user) return json({ error: "No se pudo crear la sesión" }, 500);
    authId = created.user.id;
    await admin.from("personal").update({ auth_user_id: authId }).eq("id", user.id);
  }

  // 3) Sesión real firmada por Supabase (access_token + refresh_token)
  const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, opts);
  const { data: s, error: se } = await anon.auth.signInWithPassword({ email, password: sessionPassword });
  if (se || !s.session) return json({ error: "No se pudo iniciar sesión" }, 500);

  return json({
    access_token: s.session.access_token,
    refresh_token: s.session.refresh_token,
    expires_in: s.session.expires_in,
    user: {
      id: user.id,
      id_externo: user.id_externo,
      nombre: user.nombre,
      usuario: user.usuario,
      rol: user.rol,
      es_super: user.es_super,
    },
  });
});
