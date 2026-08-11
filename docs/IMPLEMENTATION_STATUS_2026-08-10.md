# Estado de implementación — 2026-08-10

Goal activo: `019fecab-2250-7e80-808b-dcc46d0d3348`

## Resultado de esta iteración

- Plan maestro y matriz de rutas creados.
- Tres frentes delegados y revisados: pagos, autorización/privacidad/uploads y SEO técnico.
- Se crearon módulos aislados y pruebas focalizadas.
- Se ejecutó `node --test server/tests/*.test.js`: **47/47 pruebas aprobadas**.
- No se aplicaron migraciones ni se modificó la base de datos.
- No se activaron los nuevos módulos en rutas/controladores productivos.

## Incrementos preparados

### Pagos

- `server/services/paykuPaymentIntegrity.js`
- `server/scripts/migrations/add_payku_payment_integrity.sql`
- `server/tests/paykuPaymentIntegrity.test.js`

El helper vincula callback, reserva y verificación Payku por `payment_key`, orden, monto, CLP, transaction ID bancario y verification key. La migración añade unicidad e idempotencia de eventos. Falta integrar el helper en `handlePaykuWebhook` y desplegar la migración antes del código.

### Autorización, privacidad y uploads

- `server/middleware/authorization.js`
- `server/middleware/fileUploadSecurity.js`
- `server/middleware/uploadRateLimits.js`
- `server/middleware/uploadErrorHandler.js`
- `server/utils/publicDtos.js`
- `server/tests/securityAuthorizationPrivacy.test.js`

Falta conectar los middlewares/DTOs en rutas y controladores. Hasta entonces no corrigen el comportamiento productivo.

### SEO técnico

- `server/services/seoService.js`
- `server/middleware/seoFrontend.js`
- `server/tests/seoTechnical.test.js`

`seoFrontend.js` **no debe integrarse todavía**. Requiere antes:

1. validar que `:id` sea UUID al inicio del handler `/provider/:id`, de modo que `/provider/dashboard` y `/provider/register` pasen al catch-all privado sin consultar DB;
2. omitir canonical cuando `forceNoindex` sea verdadero, especialmente en respuestas 404;
3. añadir pruebas negativas para ambas rutas de proveedor y para ausencia de canonical en 404.

Luego debe reemplazar —no coexistir con— el bloque frontend de producción actual en `server/index.js`.

## Bloqueo de integración

El wrapper sandbox de `apply_patch` no pudo leer archivos heredados bajo OneDrive y devolvió `windows sandbox failed: apply deny-read ACLs`. Los archivos nuevos sí pudieron crearse. Se rechazó correctamente un intento alternativo de reconstruir íntegramente `bookingController.js` porque era demasiado amplio para un controlador crítico. El original permaneció intacto y las copias temporales fueron eliminadas.

No se debe sortear este control con `Set-Content`, scripts de reescritura u otros escritores. La integración debe hacerse en una ventana donde `apply_patch` pueda editar los archivos existentes o con aprobación explícita del usuario para una alternativa acotada y revisable.

## No-go vigente

Los gates G1–G5 siguen abiertos porque los componentes aún no están conectados. En particular, el webhook actual conserva el riesgo crítico de sustitución/replay y el frontend productivo conserva app shell/soft 404/robots-sitemap incorrectos.

## Próximo orden de trabajo

1. Aplicar e integrar el patch acotado de pagos; revisar migración; ejecutar pruebas unitarias, integración DB y Payku sandbox.
2. Delegar secuencialmente reservas concurrentes después de cerrar el controlador de pagos.
3. Integrar autorización/DTOs/uploads por grupos pequeños y ejecutar matriz actor × acción.
4. Corregir los dos defects pre-integración de SEO y reemplazar el bloque frontend productivo.
5. Ejecutar build, suite completa, pruebas HTTP sin JS y smoke de staging.
