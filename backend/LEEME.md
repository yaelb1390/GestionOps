# Backend Laravel - Sistema de Averías Fibra Óptica

Debido a que PHP y Composer no estaban instalados en el entorno al momento de la creación, se ha generado el código fuente principal del backend. Para integrarlo a un proyecto Laravel real, sigue estos pasos:

1. **Instalar PHP y Composer** en tu sistema (o usar Docker/Sail).
2. Crea un nuevo proyecto Laravel en la raíz:
   ```bash
   composer create-project laravel/laravel app-fibra
   ```
3. Instala los paquetes requeridos:
   ```bash
   cd app-fibra
   composer require maatwebsite/excel
   ```
4. **Copia el contenido** de esta carpeta `backend` sobre el proyecto Laravel recién creado (reemplazando/añadiendo `app/`, `database/` y `routes/`).
5. Configura tu `.env` con las credenciales de MySQL.
6. Ejecuta las migraciones:
   ```bash
   php artisan migrate
   ```
7. Sirve la API:
   ```bash
   php artisan serve
   ```
