# Recuperar la contraseña del administrador

Hay dos caminos. Usa el primero siempre que puedas.

## 1) Con un código de recuperación (lo normal)

1. En la pantalla de inicio de sesión pulsa **¿Olvidaste tu contraseña?**
2. Escribe tu usuario de administrador, **uno de tus códigos** (`XXXX-XXXX-XXXX`) y una contraseña nueva (mínimo 8 caracteres).
3. Listo: inicia sesión con la nueva. Ese código ya no sirve.

Detalles:
- Son **8 códigos de un solo uso**. Se generan en **Mi Perfil → Códigos de recuperación** y se muestran **una sola vez**.
- **Genéralos ahora**, antes de necesitarlos, y guárdalos fuera del sistema (impresos o en un gestor de contraseñas).
- Generar un lote nuevo **anula el anterior**. Si te quedan pocos, genera otro.
- Tras 5 intentos fallidos el formulario se bloquea 15 minutos.
- Al restablecer, se cierran las sesiones abiertas de esa cuenta.
- Funciona para cualquier usuario con rol **Admin**. Los gestores no usan este camino: el admin les cambia la contraseña en *Personal → editar*.

## 2) Sin códigos (emergencia, requiere acceso al proyecto de Supabase)

Solo para quien administra el proyecto de Supabase. En una terminal, dentro de la carpeta del proyecto:

```powershell
npx supabase login
npx supabase link --project-ref nvjwqztyrhvqrchgsmqv
npx supabase db query --linked "update public.personal set password_hash = extensions.crypt('PON-AQUI-LA-NUEVA-CLAVE', extensions.gen_salt('bf', 10)) where es_super; delete from public.login_attempts where not ok;"
```

- Cambia `PON-AQUI-LA-NUEVA-CLAVE` por la contraseña nueva (usa solo letras, números y guiones; evita comillas simples).
- Esto restablece la del **super administrador**. Para otro admin, reemplaza `where es_super` por `where lower(usuario) = 'su_usuario'`.
- La segunda instrucción levanta cualquier bloqueo por intentos fallidos.
- Después entra al sistema y **genera códigos de recuperación nuevos** en Mi Perfil.

> Quien tiene acceso al panel de Supabase tiene acceso total a los datos; protege esa cuenta con una contraseña fuerte y verificación en dos pasos.
