# Preparar un Excel antes de importarlo

`preparar_excel.py` toma el Excel tal como lo exporta el sistema y deja uno limpio, solo con las columnas del
módulo (Tickets, Órdenes, Averías repetidas o Códigos razón), listo para subir en **Importar Excel**.

El panel aplica las mismas reglas al subir cualquier archivo, así que **este paso es opcional**: úsalo cuando
quieras revisar o ordenar el archivo antes (queda una hoja *Resumen* y otra *Descartadas* con lo que sobró).

## Uso

```
pip install openpyxl
python preparar_excel.py ordenes.xlsx
python preparar_excel.py ordenes.xlsx --modulo ordenes -o ordenes_listo.xlsx
python preparar_excel.py *.xlsx
```

| Opción | Qué hace |
|---|---|
| `--modulo` | `auto` (por defecto), `tickets`, `ordenes`, `calidad` o `razones` |
| `-o ARCHIVO` | nombre de salida (por defecto `<nombre>_listo.xlsx`) |
| `--hoja NOMBRE` | hoja a leer (por defecto la primera con datos) |
| `--con-extras` | conserva las demás columnas del archivo al final |

## Qué corrige
- Encuentra los encabezados aunque haya títulos encima.
- **Trabajo** manda: si otra columna significa lo mismo (p. ej. *Work Name*), no lo pisa; se guarda aparte.
- En Órdenes, *Orden externa* es la clave y *Trabajo* es la descripción.
- Fechas en texto (`13/10/2026 12:00 p. m.`, `2026-10-13 09:30`, `15-oct-2026`) o números de Excel pasan a fechas reales.
- Identificadores como texto, sin `.0` ni notación científica.
- Quita filas vacías, sin identificador o repetidas.
- No incluye estado, inspector ni código aplicado (el panel nunca los pisa).
