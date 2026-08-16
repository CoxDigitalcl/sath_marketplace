# Reconciliación del outbox de pagos — 2026-08-16

## Evidencia de producción

La observabilidad de Etapa 7B detectó dos efectos pendientes creados por una única reserva Payku sandbox del 12 de agosto de 2026:

- `payment.notifications.requested`;
- `payment.invoice.requested`.

La reserva está `in_escrow`, el webhook Payku fue exitoso, moneda y monto coinciden y ambos eventos no tenían intentos ni errores previos. El worker periódico permanecía desactivado.

## Prueba controlada

Se autenticaron SMTP y SimpleFactura sin emitir documentos. El drenaje se limitó a un solo evento de notificaciones:

- el correo al proveedor fue aceptado;
- los correos al cliente sandbox fueron rechazados con SMTP 550 porque la casilla no existe;
- la notificación interna del proveedor fue creada;
- el código heredado marcó el evento y `notifications_sent` como exitosos pese al rechazo.

El evento de boleta no fue ejecutado. Aunque la configuración local indica `sandbox`, las credenciales pertenecen a una cuenta propia y SimpleFactura define el ambiente activo a nivel de empresa en su portal. Debe confirmarse que la empresa está en **Certificación** antes de emitir el DTE de prueba.

## Remediación

La corrección añade checkpoints independientes por reserva para:

- correo de contacto al cliente;
- correo de contacto al proveedor;
- confirmación adicional a invitado;
- notificación interna al proveedor;
- notificación interna al cliente registrado.

Los rechazos SMTP ahora lanzan un error codificado, el outbox conserva el evento para reintento y cada entrega exitosa se registra inmediatamente para que el siguiente intento la omita. La creación de notificaciones internas también informa éxito o fallo al efecto.

## Orden de despliegue

1. Conservar `ENABLE_PAYMENT_OUTBOX_WORKER` apagado.
2. Respaldar el estado afectado de `bookings` y `payment_outbox`.
3. Aplicar `add_payment_notification_delivery_integrity.sql`.
4. Desplegar el código validado y reiniciar Passenger.
5. Reconciliar exclusivamente la reserva sandbox conocida y comprobar el reintento sin duplicar la entrega al proveedor.
6. Confirmar en SimpleFactura que la empresa está en **Certificación** antes de procesar el evento de boleta.
7. Activar el worker periódico sólo cuando el outbox quede limpio y los dos efectos hayan sido comprobados.

La migración es aditiva. Un rollback de código puede conservar las columnas nuevas; no requiere restauración de base de datos.
