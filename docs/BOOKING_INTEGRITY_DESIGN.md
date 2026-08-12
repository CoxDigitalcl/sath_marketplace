# Etapa 2 — Integridad de reservas

## Invariantes

1. Un proveedor no puede mantener dos bloques activos que se solapen.
2. La reserva y sus bloques temporales nacen en una sola transacción.
3. El bloqueo temporal dura 30 minutos y las consultas ignoran bloqueos vencidos.
4. El primer pago confirmado conserva el bloque. Otro pago tardío o concurrente falla cerrado y no confirma una segunda reserva.
5. Una clave de idempotencia pertenece a un actor, una operación y un hash exacto de solicitud.
6. Los cambios de estado usan una máquina explícita y compare-and-swap.
7. Los datos públicos de una reserva requieren una capacidad firmada, de propósito único y con vencimiento.
8. Los GET públicos de verificación son de solo lectura.

## Modelo de exclusión

El PostgreSQL 13 del hosting no dispone de la extensión `btree_gist`. La exclusión se implementa en la base de datos con un trigger que toma `pg_advisory_xact_lock` por proveedor y luego comprueba rangos semiabiertos `[inicio, fin)`. Así, dos transacciones concurrentes para el mismo proveedor se serializan y la base de datos elige un único ganador.

Los servicios de agenda generan un bloque por hora seleccionada. Los servicios sin hora fija —por ejemplo, fletes con `a_convenir`— no crean un bloque exclusivo porque aún no tienen un intervalo real.

## Pago tardío

La API pública documentada de Payku no expone un parámetro contractual de expiración para la transacción. Por ello, el hold local vence, pero la confirmación de pago vuelve a adquirir el lock del proveedor: confirma si el intervalo sigue libre; si otro pago ya confirmó ese intervalo, responde `BOOKING_SLOT_CONFLICT` y deja el caso disponible para resolución operativa/reembolso.

## Capacidades públicas

El retorno de Payku incluye una capacidad HMAC en el fragmento `#cap=...`. El fragmento no se envía en la petición HTTP inicial. El frontend lo lee, lo elimina de la barra del navegador y lo entrega mediante `X-Booking-Capability`. La firma vincula versión, propósito, reserva y expiración. `BOOKING_CAPABILITY_SECRETS` permite conservar secretos anteriores durante una rotación.
