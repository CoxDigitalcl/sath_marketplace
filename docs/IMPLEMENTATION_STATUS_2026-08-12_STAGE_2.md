# Estado de implementación — Etapa 2

Fecha: 2026-08-12  
Gate: G2 — Integridad de reservas  
Resultado: **APROBADO**

## Alcance desplegado

- Bloqueos temporales de agenda con vencimiento configurable.
- Exclusión de rangos por proveedor aplicada dentro de PostgreSQL.
- Creación de reserva y ocupación de bloques en una única transacción.
- Idempotencia vinculada a actor, clave y hash canónico de solicitud.
- Confirmación Payku serializada por proveedor: el primer pago confirmado gana.
- Máquina de estados explícita con compare-and-swap y autorización por rol.
- Lecturas públicas protegidas por capacidad HMAC de propósito único y expiración.
- Verificación pública de pagos estrictamente de solo lectura y limitada por IP.
- Fecha/hora canónica en `America/Santiago`.
- Compatibilidad preservada para fletes verificados con horario `a_convenir`.

## Evidencia

- Suite completa en producción migrada: **87/87 pruebas aprobadas**.
- Build Vite de producción: **correcto**.
- Prueba aislada de 50 reservas paralelas para un mismo bloque:
  - ganadoras: **1**
  - conflictos controlados: **49**
- Repetición con la misma clave y payload: misma respuesta y misma reserva.
- Misma clave con payload distinto: rechazada.
- Carrera de dos pagos para el mismo intervalo:
  - confirmaciones: **1**
  - segundo pago: rechazo cerrado por conflicto.
- Backfill con datos de producción:
  - bloques confirmados: **15**
  - intentos históricos `pending_payment` liberados: **6**
  - pares confirmados solapados: **0**
- Verificación HTTPS posterior al reinicio:
  - `/api/health`: **200**
  - lectura sin capacidad: **401**
  - capacidad válida: **200**
  - capacidad alterada: **401**
  - GET de verificación: sin cambio de estado ni `updated_at`
  - disponibilidad: **200**
  - home: **200**
  - ambos videos persistentes: **200** y hashes conservados.

## Respaldo y recuperación

- Base de datos: `/home/servicioshogar/sath-db-before-stage2-20260812-1455.dump`
- Entorno: `/home/servicioshogar/repositories/backend/server/.env.before-stage2-20260812-1455`
- Videos preservados: `/home/servicioshogar/stage2-video-preserve-20260812-1455/`
- Commit anterior a Etapa 2: `82f79dc2068a66c48d31d0f69d0b1d9d0093c51f`
- Commit funcional desplegado: `79114353f7f0a5d593ffbe577e095c9756d515a1`

La migración es aditiva. Un rollback de código puede conservar las tablas nuevas; la restauración de base de datos solo es necesaria si se requiere volver exactamente al estado previo.

## Riesgos residuales controlados

La documentación pública de Payku no ofrece un parámetro contractual de expiración para la transacción. El hold local vence, pero un pago tardío vuelve a competir bajo el lock del proveedor. Si otro pago ya confirmó el bloque, el pago tardío falla cerrado y requiere resolución operativa o reembolso.

El worker de outbox continúa deshabilitado. No se activó para evitar ejecutar automáticamente los efectos pendientes de la prueba sandbox de Etapa 1. Su depuración y activación controlada siguen siendo una tarea operativa separada.

El build mantiene una advertencia de bundle principal grande; no afecta el gate G2 y corresponde a optimización de rendimiento posterior.
