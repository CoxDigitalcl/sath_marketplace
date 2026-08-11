# Estado de implementación — iteración 2

Goal: `019fecab-2250-7e80-808b-dcc46d0d3348`  
Etapa activa: 1 — integridad de pagos, reservas e idempotencia

## Progreso verificable

- Se añadió `docs/PAYMENT_INTEGRITY_DESIGN.md` con el contrato revisado, arquitectura transaccional y outbox.
- La revisión adversarial degradada refutó que el helper inicial bastara por sí solo.
- Se identificaron como obligatorios antes de integrar:
  - unificar o retirar la mutación alternativa de `/api/bookings/verify/:id`;
  - no mantener locks DB durante la llamada a Payku;
  - insertar un outbox atómico para facturación/notificaciones;
  - retirar el log del payload completo de verificación;
  - desplegar migraciones antes del código y reconciliar duplicados históricos.
- Se creó `server/tests/seoPrivateRouteRegression.test.js` para cubrir dos defectos encontrados en self-review del incremento SEO.

## Evidencia RED

`node --test server/tests/seoPrivateRouteRegression.test.js` produce 2 fallos esperados:

1. `/provider/dashboard` entra al loader público `/provider/:id`, consulta DB y devuelve 404 en lugar del shell privado 200 con `noindex`.
2. Una respuesta 404 todavía contiene canonical.

Estas pruebas no se incorporarán a la suite verde hasta aplicar los microfixes correspondientes; permanecen como contrato de regresión explícito.

## Revisión de duda

- Se solicitó revisión a un agente de contexto fresco con ARTIFACT + CONTRACT aislados.
- El agente no devolvió resultado y fue interrumpido; no se atribuye aprobación a ese intento.
- Se aplicó el fallback degradado del agente principal y los hallazgos se clasificaron como accionables en `PAYMENT_INTEGRITY_DESIGN.md`.
- Cross-model omitido: continuación autónoma, sin autorización para invocar CLI externa.

## Bloqueo operativo

`apply_patch` volvió a fallar al leer un archivo existente, incluso para un parche pequeño:

`windows sandbox failed: helper_unknown_error: apply deny-read ACLs`

Los archivos nuevos sí se pueden crear. No se utilizarán escritores alternativos para sortear este control. Es la segunda iteración consecutiva con el mismo bloqueo; el goal permanece activo porque aún se puede producir evidencia y diseño útil. Si se repite en una tercera iteración y no existe una vía segura de edición, corresponderá auditar el estado de bloqueo conforme a las reglas del goal.

## Próximo cambio requerido

1. Recuperar una ventana normal de `apply_patch` sobre archivos existentes.
2. Corregir primero los dos tests RED de SEO mediante microparches.
3. Implementar el procesador Payku dedicado y outbox.
4. Cambiar de forma mínima `bookingRoute.js` para que webhook y reconciliación usen el procesador común.
5. Ejecutar tests de concurrencia con PostgreSQL y Payku sandbox antes de aprobar G1.
