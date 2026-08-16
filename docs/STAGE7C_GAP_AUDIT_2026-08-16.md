# Auditoría de brechas 7C — lanzamiento y rollback en cPanel

**Fecha:** 2026-08-16
**Producción observada:** `6fa5ba7358a52e617e9d52821d84705dc4a3b497`
**Versión anterior recuperable:** `acf614121cebec80903e16c0cecd1d1da98b7ac3`

## Decisión operativa

La comprobación del ambiente de SimpleFactura queda diferida porque el acceso al portal pertenece al cliente. El evento `payment.invoice.requested` permanece sin procesar y con cero intentos; `ENABLE_PAYMENT_OUTBOX_WORKER` continúa apagado. Esta dependencia no impide preparar 7C, pero sí impide habilitar automáticamente los efectos de facturación y cerrar G6 para una apertura pública con pagos.

La reconciliación de notificaciones quedó completada: dos correos aceptados, checkpoints completos, replay omitido y proveedor sin duplicados. Los respaldos privados previos a la migración y a la reconciliación permanecen en cPanel con permisos `0600`.

## Evidencia revisada

- `main` exige PR, historial lineal y los checks `Quality gate` y `Clean schema`.
- CI ejecuta instalación reproducible, lint, tipos, secretos, migraciones, 157 pruebas, build, presupuesto y auditoría de dependencias.
- El checkout administrado por cPanel es también la raíz de la aplicación; el despliegue efectivo es `Update from Remote`/`git pull --ff-only`, seguido de `touch tmp/restart.txt`. No corresponde `Deploy HEAD Commit` ni existe `.cpanel.yml`.
- Producción mantiene el repositorio limpio, health con DB y logs JSON persistentes.
- Las migraciones recientes son aditivas y el rollback de código puede conservar sus columnas.
- Al iniciar la auditoría no existían un runbook 7C versionado ni un smoke HTTP de producción estrictamente de solo lectura; 7C-A remedia ambos puntos.
- Los scripts heredados `test-auth.js`, `test-upload.js` y `test-marketplace.js` crean usuarios, archivos, servicios o reservas. No son aptos para producción.

## Brechas

### 1. Media — Despliegue correcto, pero dependiente de memoria operativa

Faltan comandos exactos para registrar SHA anterior/objetivo, validar limpieza, aplicar migraciones en orden, reiniciar Passenger y comprobar el resultado. Esto ya causó confusión entre `Update from Remote` y `Deploy HEAD Commit`.

**Remediación mínima:** runbook específico para este checkout directo de cPanel y una plantilla de evidencia por despliegue.

### 2. Media — No hay smoke posterior seguro y reproducible

Las verificaciones actuales se ejecutan manualmente. Los scripts heredados producen datos y pueden disparar efectos externos.

**Remediación mínima:** smoke GET/HEAD sin autenticación ni escrituras para health, portada, robots, sitemap, 404 honesto, rutas privadas noindex y headers esenciales.

### 3. Media — Rollback no ensayado ni registrado

Existe un commit anterior conocido, pero no hay evidencia versionada de compatibilidad, comandos, tiempo de recuperación ni validación posterior. Un checkout local de un SHA antiguo rompería el flujo administrado de `main`.

**Remediación mínima:** rollback mediante revert PR sobre `main`, con mitigaciones inmediatas por flags, SHA esperado, compatibilidad de migraciones expand y ensayo controlado sin reescribir historial.

### 4. Media — Apertura gradual sin registro ni canal externo

El hosting compartido no permite balanceo porcentual real. El rollout debe controlarse por usuarios autorizados, ventanas de observación y marketing. Falta una plantilla de 24 h, 72 h y 7 días, y `DISCORD_WEBHOOK_URL`/`ADMIN_EMAIL` aún depende del dueño.

**Remediación mínima:** checklist de apertura interna y registro de métricas/decisión por ventana. La falta de canal externo permanece como dependencia del dueño.

### 5. Excepción operativa — Facturación SimpleFactura diferida

El único pendiente del outbox es la boleta sandbox. Mientras no se confirme **Certificación** en el portal:

- no procesar el evento;
- no activar el worker periódico;
- tratar `PAYMENT_OUTBOX_LAG` como señal esperada y documentada, no como evidencia de una falla nueva;
- revisar esta excepción antes de habilitar pagos públicos.

## Remediación 7C en tres bloques

### 7C-A — Release reproducible

1. Añadir smoke HTTP de solo lectura con pruebas automatizadas.
2. Versionar el runbook exacto de cPanel.
3. Registrar siempre SHA anterior, SHA objetivo, migraciones, backup, operador y resultado.

### 7C-B — Rollback comprobable

1. Definir triggers objetivos y mitigaciones inmediatas.
2. Ensayar revert PR y verificar que no requiere revertir migraciones expand.
3. Ejecutar smoke post-rollback y registrar tiempo de recuperación.

### 7C-C — Apertura controlada

1. Acceso interno y pruebas funcionales.
2. Observación a 24 h y 72 h antes de abrir marketing.
3. Revisión a 7 días y cierre de hallazgos Critical/High.
4. Antes de pagos públicos: resolver SimpleFactura, activar y comprobar el worker y configurar un canal externo.

## Gate

### Resultado de 7C-A

- Smoke HTTP de solo lectura implementado en `server/scripts/run_stage7c_release_smoke.js` y expuesto como `npm run smoke:stage7c`.
- Contrato cubierto por 4 pruebas nuevas; gate completo aprobado con 157/157 pruebas, build, presupuesto y cero vulnerabilidades altas.
- Smoke ejecutado contra `https://serviciosatuhogar.cl`: 7/7 comprobaciones aprobadas (health DB, portada SSR, paridad crawler, robots, sitemap, login noindex y 404 honesto).
- Runbook específico de cPanel y plantilla de registro de liberación versionados.

### Resultado de 7C-B

- Revert de `6fa5ba7` ensayado en clones locales aislados, sin push ni cambios en producción.
- El árbol revertido coincidió exactamente con `acf6141`; el commit de revert tuvo como padre el release actual y dejó el worktree limpio.
- Árbol de rollback aprobado con 149/149 pruebas, build y presupuesto de rendimiento.
- Migración de checkpoints confirmada como expand compatible; permanece aplicada durante un rollback de código.
- Evidencia y limitación de RTO registradas en [STAGE7C_ROLLBACK_REHEARSAL_2026-08-16.md](./STAGE7C_ROLLBACK_REHEARSAL_2026-08-16.md).

**7C-A y 7C-B completadas. G6 continúa no aprobado.** El siguiente paso recomendado es preparar 7C-C sin pagos públicos. La apertura queda condicionada a las dependencias del dueño y a la excepción de SimpleFactura.
