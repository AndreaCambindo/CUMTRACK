# CUMTRACK — VERSIÓN CONECTADA

Esta versión usa tu Google Sheet mediante Google Apps Script.

## 1. Apps Script

Usa el `Code.gs` incluido en esta carpeta. Reemplaza el código actual de Apps Script con este archivo, guarda y vuelve a desplegar la aplicación web como una nueva versión.

Importante: el `Code.gs` debe aceptar el parámetro `callback` para que la aplicación local pueda comunicarse sin problemas de CORS.

## 2. Prueba local

Abre `index.html`.

Si el navegador bloquea funciones al abrirlo directamente, ejecuta:

`python -m http.server 8000`

y abre:

`http://localhost:8000`

## 3. Google Sheets

La aplicación leerá:

- Cotizaciones
- Comerciales
- Intermediarios

Las cotizaciones nuevas se escriben en Google Sheets y los cambios de estado también.

## 4. WhatsApp

No utiliza API de WhatsApp. Abre `wa.me` con el número del comercial y el mensaje preparado.

## 5. Descargar Excel

Desde Cotizaciones, Pagarés y Presupuesto puedes descargar un archivo `.xlsx` con la información filtrada que estás viendo en pantalla (el reporte de Presupuesto además incluye el detalle de las cotizaciones del mes en una segunda hoja).

## 6. Modo local (sin conexión a internet)

Si trabajas desde un computador que no permite conectarse a Google Sheets (por ejemplo, una red empresarial restringida), puedes cargar una copia exportada del Excel directamente en la app, sin necesidad de internet.

**Cómo generar el archivo:**

1. Abre tu Google Sheet (el mismo que usa CUMTRACK) desde cualquier computador con acceso.
2. Archivo → Descargar → Microsoft Excel (.xlsx).
3. Guarda ese archivo y llévalo al computador restringido (USB, correo, etc.).

**Cómo cargarlo en la app:**

1. Abre `index.html` normalmente (no necesita internet para esto, ya que la librería de Excel viene incluida en la carpeta `js/`).
2. En la barra lateral, haz clic en "📂 Cargar Excel local" y selecciona el archivo.
3. La app mostrará "MODO LOCAL (SIN CONEXIÓN)" y cargará el Dashboard, Cotizaciones, Pagarés y Presupuesto con los datos del archivo.

**Importante:** el modo local es solo de consulta/presentación. No permite guardar, editar ni agregar información (no hay a dónde escribir sin conexión a Sheets). Si intentas guardar algo, la app te avisará que estás en modo local. Sí puedes seguir usando los filtros y el botón de "Descargar Excel" de cada sección para generar reportes.

Para volver al modo conectado, simplemente recarga la página (F5) con conexión a internet.

