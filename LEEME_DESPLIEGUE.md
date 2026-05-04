# Guía de Despliegue en Servidor Web (Producción)

Esta guía te explica paso a paso cómo preparar tu aplicación web (Frontend en React) y subirla a cualquier servidor web tradicional (cPanel, Hostinger, GoDaddy, etc.) o a servicios modernos en la nube (Vercel, Netlify).

---

## 1. Entendiendo la Arquitectura Actual
*   **Backend / Base de Datos:** Tu backend ya está subido y corriendo en la nube a través de **Google Apps Script** y **Google Sheets**. No necesitas configurar bases de datos (MySQL) ni PHP en tu servidor.
*   **Frontend:** Está hecho en **React + Vite**. Para que un servidor web lo entienda, primero debemos "compilarlo" o "empaquetarlo" en archivos estáticos puros (HTML, CSS, y JavaScript).

---

## 2. Preparar los archivos (Compilación / Build)

Antes de subir nada, necesitas compilar tu código en tu computadora local:

1. Abre una terminal (o la consola de tu editor de código).
2. Navega a la carpeta del frontend:
   ```bash
   cd "C:\Users\YAEL\Desktop\Aplicacion claro\frontend"
   ```
3. Ejecuta el comando de compilación:
   ```bash
   npm run build
   ```
4. Espera a que termine. Vite creará una nueva carpeta llamada **`dist`** dentro de la carpeta `frontend` (`frontend/dist`).
   *Esta carpeta `dist` contiene los archivos finales y optimizados que irán a tu servidor web.*

---

## 3. Subir a un Servidor Tradicional (cPanel, Hostinger, HostGator)

Si has comprado un dominio y un hosting (hosting compartido):

1. **Inicia sesión** en el panel de control de tu hosting (cPanel o hPanel).
2. Abre el **Administrador de Archivos** (File Manager).
3. Navega a la carpeta principal de tu sitio web, que usualmente se llama **`public_html`**.
4. **Borra** los archivos por defecto que puedan estar ahí (como `default.html`).
5. **Sube el contenido** de tu carpeta **`dist`**. *(Ojo: Sube los archivos que están DENTRO de `dist`, no la carpeta `dist` en sí).*

### ⚠️ Configuración MUY IMPORTANTE (El archivo .htaccess)
Como estás usando React Router (`/admin`, `/login`, `/inspector`), si recargas la página en una ruta que no sea el inicio, el servidor dará un error 404. Para arreglar esto:

1. En tu `public_html`, crea un nuevo archivo llamado **`.htaccess`**.
2. Ábrelo y pega el siguiente código:
   ```apache
   <IfModule mod_rewrite.c>
     RewriteEngine On
     RewriteBase /
     RewriteRule ^index\.html$ - [L]
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d
     RewriteRule . /index.html [L]
   </IfModule>
   ```
3. Guarda los cambios. ¡Listo! Tu aplicación está en línea.

---

## Opción Alternativa: Subir a Vercel o Netlify (Gratis y más fácil)

Si aún no tienes servidor de pago, plataformas como **Vercel** o **Netlify** son ideales (y gratuitas) para aplicaciones hechas con Vite y React:

### Usando Vercel (Recomendado):
1. Sube tu proyecto completo (`Aplicacion claro`) a tu cuenta de **GitHub**.
2. Entra a [vercel.com](https://vercel.com/) y entra con GitHub.
3. Haz clic en **"Add New Project"** e importa tu repositorio.
4. En **Framework Preset** selecciona `Vite`.
5. En **Root Directory** asegúrate de escribir o seleccionar `frontend` (ya que ahí está tu React).
6. Haz clic en **Deploy**. 
7. Vercel te dará una URL (ej. `tu-app.vercel.app`) donde todo funcionará perfectamente de inmediato.
