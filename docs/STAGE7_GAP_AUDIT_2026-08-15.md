# Auditoría de brechas — Etapa 7

**Fecha:** 2026-08-15
**Alcance:** CI, observabilidad, medición, despliegue gradual y rollback del marketplace Servicios a tu Hogar.
**Estado de remediación:** 7A, 7B y el hotfix de entregas parciales están integrados y desplegados. La reconciliación de notificaciones terminó sin duplicados; 7C-A y el ensayo 7C-B están completados. SimpleFactura queda diferido por dependencia del cliente; todavía se requiere configurar un canal externo y preparar 7C-C antes de aprobar G6.

## Resumen ejecutivo

La base funcional es sólida: 143 pruebas pasan, el build y el presupuesto de rendimiento pasan, los audits de dependencias no reportan vulnerabilidades y existen controles de autorización, pagos, reservas, SEO HTTP, health check y correlation IDs. Sin embargo, esos controles solo se ejecutan manualmente. GitHub no tiene workflows ni protección de `main`, por lo que una regresión puede llegar al checkout de producción sin ninguna compuerta automática.

La segunda brecha principal es operativa. Las métricas actuales viven en memoria y los logs se escriben a consola; no hay persistencia, percentiles por ruta, monitoreo de saturación ni alertas agregadas para pagos, reservas, autenticación o crawlers. El evento de conversión existe en frontend, pero el repositorio no demuestra un destino analítico activo.

## Evidencia validada

- `npm run test:serial`: **143/143 pruebas aprobadas**.
- `npm run build`: aprobado con Vite 6.4.3.
- `npm run performance:budget`: aprobado; JS inicial 151.8 KiB gzip, CSS 13.1 KiB y mayor chunk 133 KiB.
- `npm audit --omit=dev --audit-level=high` y `npm audit --audit-level=high`: **0 vulnerabilidades**.
- Búsqueda básica de claves privadas y tokens comunes en archivos versionados: sin coincidencias.
- GitHub Actions: **0 workflows y 0 ejecuciones** para el repositorio.
- Protección de `main`: inexistente; GitHub respondió 404 al consultar branch protection.
- El commit remoto inspeccionado no tenía estados/checks asociados.
- `npx tsc --noEmit`: falla antes de revisar la aplicación porque `allowJs` incluye el archivo local ignorado `test.js`, cuyo contenido no es código fuente válido.

## Hallazgos

### Alta — No existe una compuerta automática antes de producción

No hay `.github/workflows`, checks obligatorios ni protección de `main`. El flujo actual permite actualizar el checkout de cPanel desde un commit que no fue validado por GitHub.

**Impacto:** build roto, regresiones de seguridad/SEO o pruebas fallidas pueden desplegarse por error.
**Remediación:** implementar 7A y, una vez verde, exigir los checks en `main`.

### Alta — Observabilidad no persistente e incompleta

`systemMetricService` conserva solo 100 latencias y 5 errores en memoria, y `logger` usa consola. No existen percentiles por ruta/status, métricas de pool DB, disco de uploads, cache, outbox ni paneles/umbrales operativos.

**Impacto:** un incidente puede desaparecer al reiniciar la aplicación y no ser detectado antes de afectar pagos, reservas o acceso.
**Remediación:** implementar telemetría estructurada y persistente con alertas accionables en 7B.

### Alta — El typecheck no es ejecutable de forma confiable

`tsconfig.json` habilita `allowJs` sin `include`/`exclude`. Por ello, un archivo local ignorado en la raíz (`test.js`) entra al análisis y produce errores de sintaxis.

**Impacto:** no se puede convertir el typecheck en check obligatorio de CI.
**Remediación:** acotar explícitamente el proyecto TypeScript a código fuente/configuración real y añadir un script `typecheck` reproducible.

### Media — Las alertas de lentitud no salen del proceso

`performanceLogger` envía solicitudes mayores a 2 segundos con severidad `WARNING`, pero `alertService` retorna inmediatamente para `INFO` y `WARNING`. En la práctica solo queda el log local.

**Impacto:** degradaciones importantes pueden pasar inadvertidas.
**Remediación:** definir umbrales y canales por severidad, con deduplicación para evitar ruido.

### Media — Medición de conversión y descubribilidad sin cierre operativo

El frontend emite `sath:conversion` y usa `gtag` solo si otro componente lo ha cargado. No hay evidencia en el repositorio de GA/GTM activo, Search Console, Bing Webmaster Tools, envío de sitemap ni telemetría de crawlers/referrals AI.

**Impacto:** no se puede medir indexación, CTR, reservas iniciadas ni calidad de lead después de abrir el sitio.
**Remediación:** conectar un destino analítico con consentimiento y confirmar las propiedades externas con el dueño. La ausencia en el repositorio no demuestra que las cuentas externas no existan.

### Media — Despliegue y rollback dependen de pasos manuales no documentados

El despliegue se realiza mediante `Update from Remote` y reinicio de Node.js en cPanel. No hay runbook versionado, smoke automatizado posterior, registro de versión anterior ni criterios de rollback.

**Impacto:** una recuperación depende de memoria operativa y puede demorarse durante un incidente.
**Remediación:** implementar 7C con comandos/verificaciones exactos para cPanel y una apertura interna gradual. Dado el hosting compartido, el rollout se controla por acceso y ventanas de observación, no por balanceo porcentual.

### Media — Faltan pruebas de seguridad dinámicas automatizadas

Existen pruebas de seguridad e integración en Node, pero no se encontró automatización DAST/E2E para auth, BOLA, rate limits, headers, uploads ni navegación pública sin JS.

**Impacto:** ciertas regresiones solo se detectarían manualmente.
**Remediación:** añadir smoke HTTP seguro en CI y un DAST focalizado antes de la apertura pública.

## Controles ya existentes

- Pruebas seriales de autorización, pagos, outbox, reservas, privacidad, SEO y AEO.
- Build reproducible y presupuesto de bundle.
- Health check con validación de base de datos.
- CSP/headers de seguridad, correlation IDs y respuestas de error controladas.
- Idempotencia de pagos y restricciones de integridad de reservas.
- Migraciones versionadas y variables sensibles excluidas del repositorio.

## Remediación recomendada en tres bloques

### 7A — CI y protección del repositorio

**Estado al 2026-08-15:** 7A activada en GitHub. La implementación `b7eb443` pasó `Quality gate` y `Clean schema`; `CI_DB_PASSWORD` está configurado y `main` exige PR y ambos checks, aplica también a administradores, requiere historial lineal y bloquea force-push/deletion. El PR #1 permanece en borrador hasta el merge controlado.

1. Acotar `tsconfig` y añadir scripts `typecheck` y `check:ci`.
2. Crear GitHub Actions para instalación reproducible, typecheck, build, presupuesto, 143 pruebas seriales y dependency audit.
3. Añadir secret scan y validaciones de migraciones/esquema limpio en jobs separados.
4. Ejecutar smoke SEO HTTP contra una aplicación efímera o entorno controlado.
5. Proteger `main` después de obtener la primera ejecución verde, exigiendo checks y evitando push directo accidental.

### 7B — Observabilidad y medición

**Estado al 2026-08-16:** implementación integrada mediante el PR #2 y desplegada en `acf6141`: logs JSON rotables, redacción, métricas/percentiles, panel administrativo, monitor de DB/disco/cache/outbox y alertas agregadas. La persistencia fue verificada en cPanel. La reconciliación posterior y el hotfix de entregas parciales se documentan en [STAGE7B_OUTBOX_RECONCILIATION_2026-08-16.md](./STAGE7B_OUTBOX_RECONCILIATION_2026-08-16.md). Pendiente del dueño: configurar el canal externo y confirmar Certificación en SimpleFactura.

1. Persistir logs JSON con correlation ID, ruta normalizada, status, duración y familia de user-agent.
2. Medir p50/p95/p99, tasa 5xx/4xx/429, pool DB, disco/uploads, cache y atraso/error del outbox.
3. Crear alertas agregadas para pago inválido/replay, conflicto de reserva, auth/reset, acciones admin y salud DB.
4. Corregir el circuito de alertas de rendimiento.
5. Conectar eventos de conversión sin PII y confirmar Search Console/Bing/sitemap con el dueño.

### 7C — Lanzamiento y rollback cPanel

1. Versionar un runbook con commit objetivo, backup, migraciones, actualización remota, reinicio y smoke.
2. Registrar siempre commit desplegado y commit anterior recuperable.
3. Definir triggers objetivos de rollback para errores, latencia, pagos, reservas y salud DB.
4. Realizar apertura interna, observar 24 h y 72 h, y abrir públicamente solo con los umbrales estables.
5. Hacer revisión post-lanzamiento a 7 días.

## Decisión de gate

**G6: no aprobado todavía.** 7A, 7B, el hotfix, 7C-A y el ensayo 7C-B están cerrados. Permanecen preparar la apertura controlada 7C-C, configurar al menos un canal externo y resolver la excepción de SimpleFactura antes de habilitar pagos públicos.

## Dependencias del dueño

- Confirmar/crear Search Console y Bing Webmaster Tools y verificar el dominio.
- Aprobar la herramienta de analítica y su configuración de consentimiento.
- Completar la revisión legal/editorial y las transcripciones reales pendientes de Etapa 6.
