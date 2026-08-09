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
