# Diseño de integridad de pagos Payku

Estado: revisión adversarial completada en modo degradado; integración pendiente.  
Fecha: 2026-08-10

## Contrato de seguridad

Una reserva solo puede pasar de `pending_payment` a `in_escrow` si una consulta server-to-server a Payku, realizada usando el `payment_key` inmutable guardado al crear el checkout, confirma simultáneamente:

- `verification.id === booking.transaction_id`;
- `verification.order === booking.id`;
- monto entero exacto igual al congelado por servidor;
- moneda `CLP`;
- estado final `success`;
- ID bancario, verification key y transaction key coherentes con el callback cuando el flujo parte desde webhook.

El callback nunca selecciona una reserva solamente por `order` ni puede reemplazar `bookings.transaction_id`.

## Revisión adversarial

### Hallazgos válidos y accionables

1. **El endpoint público `GET /verify/:id` conserva una ruta de transición alternativa.** Actualmente valida menos campos, puede competir con el webhook y no registra el mismo evento idempotente. Debe usar el mismo procesador de dominio o convertirse en una consulta sin mutaciones protegida por sesión/capability.
2. **El diseño inicial mantenía `FOR UPDATE` mientras esperaba la red de Payku.** Un proveedor lento o solicitudes concurrentes pueden agotar conexiones/locks. La verificación remota debe ocurrir fuera de la transacción; luego se inicia una transacción corta, se bloquea por payment key, se repiten las invariantes inmutables y se ejecuta el compare-and-set.
3. **Facturación y notificaciones posteriores al commit pueden perderse.** Si el proceso cae después del commit, el replay ve `in_escrow` y omite los efectos. La misma transacción debe insertar un outbox único; un worker reintentable ejecuta los efectos y marca `processed_at`.
4. **`payku.js` registra la respuesta completa.** El payload puede contener verification keys, email, IP o metadatos de pago. El log debe limitarse a ID sanitizado, estado, correlation ID y resultado de validación.
5. **La migración y el código tienen orden obligatorio.** Primero se auditan duplicados, luego se aplican tablas/índices, después se despliega el procesador. Desplegar el código antes del esquema debe fallar el smoke y no llegar a producción.
6. **Un 2xx ante caída transitoria puede impedir reintentos del proveedor.** Debe verificarse el contrato de reintentos Payku. Mientras no exista evidencia, el sistema necesita reconciliación interna periódica/outbox y alerta; los rechazos criptográficos/lógicos sí deben ser terminales y auditados.

### Ruido o trade-offs

- Un índice único sobre `bookings.transaction_id` es aceptable mientras Payku sea el único gateway y el valor sea globalmente único. Si se agregan gateways, migrar a `(payment_provider, transaction_id)`.
- Exigir `transaction_key` solo cuando aparece en cualquiera de los dos lados es coherente con el contrato que permite `null`; una presencia unilateral se rechaza.

## Arquitectura objetivo

```text
Callback Payku
  -> validar forma y límites
  -> buscar payment_key guardado (sin lock largo)
  -> verificar server-to-server con Payku
  -> validar binding completo
  -> BEGIN
       SELECT booking BY transaction_id FOR UPDATE
       repetir binding/estado
       INSERT payment_webhook_event UNIQUE
       UPDATE booking WHERE status = pending_payment
       INSERT outbox(payment.confirmed, booking_id) UNIQUE
     COMMIT
  -> responder resultado idempotente

Worker outbox
  -> SELECT ... FOR UPDATE SKIP LOCKED
  -> facturación/notificaciones con idempotency key del evento
  -> registrar intento/resultado
  -> marcar processed_at o reprogramar con backoff
```

## Modelo de datos requerido

### `payment_webhook_events`

- unicidad `(provider, payment_key)`;
- unicidad `(provider, gateway_transaction_id)`;
- `booking_id`, monto, moneda, estado y fecha;
- no guardar secrets completos; opcionalmente hash del payload normalizado.

### `payment_outbox`

- `id`, `event_type`, `aggregate_id`, `deduplication_key` única;
- payload mínimo JSONB sin secretos;
- `attempt_count`, `available_at`, `locked_at`, `processed_at`, `last_error_code`;
- índice sobre eventos pendientes por `available_at`.

## Integración mínima en código heredado

Para reducir el riesgo de editar un controlador de más de 60 kB:

1. Crear un controlador dedicado `paykuWebhookController.js` que dependa de un servicio de dominio probado.
2. Cambiar en `bookingRoute.js` únicamente los imports/handlers de webhook y verificación.
3. Mantener los demás handlers en `bookingController.js` sin cambios durante esta etapa.
4. Retirar la implementación legacy después de pruebas de integración y no en el mismo despliegue de la migración.

## Pruebas de aceptación

- pago A no confirma reserva B, incluso con mismo monto;
- callback con `order`, payment key, transaction ID, verification key, monto o moneda distintos no muta DB;
- dos callbacks simultáneos producen un evento, una transición y un outbox;
- replay devuelve el resultado previo sin duplicar outbox;
- `/verify/:id` no ofrece una transición menos estricta;
- caída entre verificación remota y `BEGIN` no cambia estado;
- caída después de commit conserva outbox pendiente y el worker reintenta;
- worker concurrente no procesa dos veces el mismo evento;
- migración se niega a activar unicidad si existen duplicados históricos;
- logs no contienen verification keys, payload completo, email, IP ni datos bancarios.

## Estado del ciclo de duda

- CLAIM evaluado: el helper/migración inicial bastaban para binding e idempotencia end-to-end.
- Resultado: refutado; faltaban la ruta alternativa de verificación, el outbox y el límite del lock remoto.
- Revisión fresca: intentada con agente aislado, sin resultado por bloqueo operativo.
- Fallback: revisión adversarial degradada del agente principal.
- Segunda opinión entre modelos: omitida por tratarse de continuación autónoma; no se invocan CLIs externos sin autorización.
