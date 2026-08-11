# Estado de implementación — iteración 3

Fecha: 2026-08-11  
Etapa activa: 1 — integridad crítica de pagos y webhooks

## Resultado local

La Etapa 1 quedó integrada en código y falla cerrada, pero el gate G1 aún requiere evidencia de PostgreSQL y Payku sandbox en staging.

- El router conserva las operaciones heredadas de reservas mediante `bookingController.legacy.js` y sustituye únicamente `handlePaykuWebhook` y `verifyPayment`.
- El webhook busca la reserva por el `payment_key` inmutable guardado, verifica con Payku antes de abrir la transacción y vuelve a validar los mismos hechos bajo `FOR UPDATE`.
- La transición usa compare-and-set desde `pending_payment` y nunca reemplaza `bookings.transaction_id` con datos del callback.
- El evento verificado, la transición y dos efectos outbox se escriben en la misma transacción.
- Replay exacto devuelve éxito sin repetir transición ni crear nuevos efectos.
- Conflictos de orden, monto, moneda, payment key, transaction ID, verification key o estado final se rechazan sin mutar la reserva.
- Fallos transitorios de Payku o PostgreSQL devuelven estado de reintento en vez de confirmar el pago.
- `/api/bookings/verify/:id` quedó de solo lectura; ya no consulta Payku, cambia estado, factura ni envía notificaciones.
- Los logs de verificación Payku ya no serializan el payload completo.
- El worker periódico queda desactivado por defecto y solo inicia con `ENABLE_PAYMENT_OUTBOX_WORKER=true`.

## Migración preparada

`server/scripts/migrations/add_payku_payment_integrity.sql` ahora contiene:

- auditoría bloqueante de `bookings.transaction_id` duplicados;
- índice único parcial para payment keys no nulas;
- unicidad por payment key y por gateway transaction ID en `payment_webhook_events`;
- `payment_outbox` con deduplicación, lease, intentos, backoff y estado de procesamiento;
- índice parcial para eventos pendientes.

La migración no fue ejecutada en esta iteración.

## SEO técnico corregido

- `/provider/dashboard` y `/provider/register` pasan al shell privado con `noindex` sin consultar el loader público de proveedores.
- Respuestas 404 con `forceNoindex` no emiten canonical.

## Evidencia automática

- `npm test`: 63/63 pruebas aprobadas.
- Batería focalizada de pagos/outbox/efectos/wiring: 22/22 aprobadas.
- Regresiones SEO: 2/2 aprobadas.
- `npm run build`: aprobado; 2.335 módulos transformados.
- `node --check` de entrypoint y módulos modificados: aprobado.
- Importación real de `bookingController.js`: exports requeridos disponibles.

Advertencias no bloqueantes del build:

- `caniuse-lite` tiene ocho meses de antigüedad.
- El bundle principal minificado supera 500 kB; corresponde tratarlo en la etapa de rendimiento/SSR, no dentro del cambio de integridad de pagos.

## Orden de despliegue obligatorio

1. Respaldar la base de staging y auditar duplicados históricos de `transaction_id`.
2. Aplicar `add_payku_payment_integrity.sql` en staging.
3. Desplegar el código con `ENABLE_PAYMENT_OUTBOX_WORKER` ausente o `false`.
4. Ejecutar callbacks sandbox válidos, sustituidos, repetidos y simultáneos; comprobar una transición, un evento y dos filas outbox.
5. Verificar notificaciones y facturación sandbox con eventos controlados.
6. Habilitar `ENABLE_PAYMENT_OUTBOX_WORKER=true` solo después del smoke de efectos.

## Riesgos residuales y no-go

- El contrato exacto, firma y reintentos de Payku no pudieron confirmarse desde documentación pública completa; se requiere evidencia sandbox/proveedor.
- No se ejecutaron migraciones, callbacks, SMTP ni SimpleFactura en esta iteración.
- Una caída después de que un proveedor externo acepta un email/DTE y antes de marcar el outbox puede repetir el efecto si ese proveedor no soporta idempotency keys. Debe verificarse la capacidad de idempotencia de cada proveedor.
- `/verify/:id` y `/public/:id` siguen requiriendo sesión o capability token en Etapa 2 para cerrar BOLA/IDOR de datos de reserva.
- G1 permanece condicionado hasta completar migración y pruebas concurrentes reales en PostgreSQL + Payku sandbox.

## Siguiente etapa

Después de aprobar G1 en staging, continuar con Etapa 2: cupos transaccionales, holds expirables, `Idempotency-Key` para reserva/checkout, máquina de estados y capability tokens.
