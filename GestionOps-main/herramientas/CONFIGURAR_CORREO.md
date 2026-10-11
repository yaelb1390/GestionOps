# Configurar el envío de correo (códigos de recuperación)

La app ya sabe enviar el código de 6 dígitos al correo de **Mi Perfil**. Solo falta decirle **con qué servicio**.
Elige UNA de estas opciones y pon sus claves como *secretos* de Supabase (no se pegan en el chat ni en el código).
Funciona con la que configures; si hay Resend y SMTP a la vez, se usa Resend.

| | Resend (API) | Gmail (SMTP) | Brevo (SMTP) |
|---|---|---|---|
| Costo | Gratis: 3.000/mes, 100/día | Gratis (cuenta personal ~500/día) | Gratis: 300/día |
| Qué necesitas | Cuenta en resend.com + API key | Tu Gmail con verificación en 2 pasos + "contraseña de aplicación" | Cuenta en brevo.com + clave SMTP + remitente verificado |
| Sin dominio propio | Solo entrega **al correo con el que creaste la cuenta** (basta si ese es tu correo de Mi Perfil) | Entrega a cualquier correo | Entrega a cualquier correo* |
| Dificultad | La más simple | Media (2 pasos + clave de app) | Media |

\* Brevo pide validar el remitente; confírmalo en su panel antes de depender de él.

> Supabase bloquea los puertos 25 y 587 en sus funciones: para SMTP usa siempre el **465**.

## Opción A · Resend (recomendada para empezar)
1. Crea una cuenta en https://resend.com **con el mismo correo que pusiste en Mi Perfil**.
2. En *API Keys* → *Create API Key* (permiso "Sending access"). Copia la clave `re_...`.
3. En la terminal, dentro de la carpeta del proyecto:
   ```powershell
   npx supabase secrets set RESEND_API_KEY=re_PEGA_AQUI_TU_CLAVE
   ```
4. Listo. Más adelante, si verificas un dominio en Resend, agrega también:
   `npx supabase secrets set MAIL_FROM="Gestores OPS <no-responder@tudominio.com>"`

## Opción B · Gmail
1. En tu cuenta de Google activa la **verificación en 2 pasos**.
2. Entra a https://myaccount.google.com/apppasswords y crea una "contraseña de aplicación" (16 letras).
3. Terminal:
   ```powershell
   npx supabase secrets set SMTP_HOST=smtp.gmail.com SMTP_PORT=465 SMTP_USER=tucorreo@gmail.com SMTP_PASS=abcdefghijklmnop MAIL_FROM="Gestores OPS <tucorreo@gmail.com>"
   ```
   (la contraseña de aplicación va **sin espacios**)

## Opción C · Brevo
1. Cuenta en https://brevo.com → *SMTP & API* → copia el servidor, tu login y genera una clave SMTP. Valida tu remitente.
2. Terminal:
   ```powershell
   npx supabase secrets set SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=465 SMTP_USER=TU_LOGIN SMTP_PASS=TU_CLAVE_SMTP MAIL_FROM="Gestores OPS <tu-remitente-validado@correo.com>"
   ```

## Comprobar que funciona
1. Entra como administrador → **Mi Perfil** → bloque *Código por correo* → **Enviar correo de prueba**.
2. Debe llegarte un mensaje "Correo de prueba · Gestores OPS" (revisa spam la primera vez).
3. Si falla, el aviso dice por qué (clave mala, destinatario no permitido, etc.).

## Cómo funciona la recuperación por correo
- En el login: *¿Olvidaste tu contraseña?* → escribes tu usuario → **Enviarme un código al correo** → escribes el código de 6 dígitos + tu contraseña nueva.
- El código vale **15 minutos** y es de **un solo uso**. Se puede pedir uno nuevo cada 60 s y hasta 5 por hora.
- Se envía al correo guardado en **Mi Perfil**. Si ese correo está vacío no se envía nada.
- Por seguridad la pantalla responde igual exista o no el usuario, y los códigos de respaldo de Mi Perfil siguen sirviendo.
- Si el servicio de correo cae, quedan los códigos de respaldo y el procedimiento de `RECUPERAR_ADMIN.md`.
