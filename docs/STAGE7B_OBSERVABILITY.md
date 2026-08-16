# Etapa 7B — Observabilidad y medición operativa

## Alcance implementado

La aplicación produce telemetría operativa sin registrar cuerpos, parámetros de consulta, credenciales ni user-agents completos:

- logs JSON en consola y archivos rotables en producción;
- correlation ID, método, ruta normalizada, status, duración y familia de user-agent por respuesta HTTP;
- ventana acotada de métricas con promedio, p50, p95 y p99 por ruta;
- tasas y conteos de respuestas 4xx, 5xx y 429;
- saturación del pool PostgreSQL, espacio libre de uploads, caché y atraso/error del outbox de pagos;
- panel protegido en `GET /api/admin/system-status`;
- alertas deduplicadas para degradación HTTP, auth, reservas, administración, Payku, DB, disco y outbox.

No requiere migración de base de datos.

## Persistencia y privacidad

En producción, Winston crea dentro de la raíz privada de la aplicación:

- `logs/application.log`: todos los eventos desde nivel `info`;
- `logs/error.log`: eventos de nivel `error`.

Ambos son JSON, rotan por tamaño y están excluidos de Git. Los valores predeterminados conservan hasta cinco archivos de 5 MiB por transporte. Si el directorio no puede crearse, la aplicación mantiene el transporte de consola y registra el código del fallo sin impedir el arranque.

Antes de escribir o despachar, el logger y el servicio de alertas eliminan campos sensibles como password, secret, token, authorization, cookie, email, RUT, teléfono, payload, body, IP y dirección. También redactan emails, IPs, bearer tokens y secretos presentes accidentalmente en texto.

## Umbrales iniciales

| Señal | Umbral | Severidad |
|---|---:|---|
| Solicitud HTTP lenta | más de 2.000 ms | warning |
| Rate limit | status 429 | warning, deduplicada por ruta |
| Auth denegada | 401/403 en `/api/auth` | warning, deduplicada |
| Conflicto de reserva | 409 en `/api/bookings` | warning |
| Error administrativo | 4xx/5xx en `/api/admin` | warning/high |
| Payku inválido/replay/retry | por outcome y código | warning/high |
| DB no disponible | health del monitor | critical |
| Espera en pool DB | más de 5 solicitudes | warning |
| Espacio libre de uploads | menos de 10% | high |
| Outbox con errores | uno o más pendientes con error | high |
| Atraso del outbox | más de 300 segundos | warning |

Las alertas iguales se agrupan durante cinco minutos. Cada proceso conserva como máximo 500 fingerprints activos.

## Variables de entorno

Los valores están documentados en `server/.env.example`:

```dotenv
LOG_FILE_ENABLED=true
LOG_DIR=logs
LOG_LEVEL=info
LOG_MAX_SIZE_BYTES=5242880
LOG_MAX_FILES=5
OBSERVABILITY_MONITOR_ENABLED=true
OBSERVABILITY_INTERVAL_MS=60000
OBS_DB_WAITING_THRESHOLD=5
OBS_DISK_FREE_PERCENT_THRESHOLD=10
OBS_OUTBOX_LAG_SECONDS_THRESHOLD=300
ALERT_DEDUP_WINDOW_MS=300000
DISCORD_WEBHOOK_URL=
ADMIN_EMAIL=
```

El monitor y los archivos quedan activos por defecto en producción. `DISCORD_WEBHOOK_URL` y `ADMIN_EMAIL` son opcionales para el arranque. Para cobertura externa completa debe configurarse el webhook: warning/high/critical lo usan cuando existe; el email se reserva para critical.

## Verificación

Local/CI:

```bash
npm run verify:stage7b
npm run lint
npm run typecheck
npm run test:serial
npm run build
```

Después de desplegar en cPanel:

```bash
cd /home/servicioshogar/repositories/backend
git status -sb
tail -n 20 logs/application.log
tail -n 20 logs/error.log
```

Comprobar además:

1. `GET /api/health` devuelve 200 y `db_connection: connected`.
2. Un administrador puede abrir el widget Estado operativo.
3. `logs/application.log` recibe eventos `http_request` con rutas normalizadas.
4. Los archivos no contienen emails, bearer tokens, IPs ni cuerpos de solicitudes.
5. El canal externo configurado recibe una alerta controlada o un evento real deduplicado.

## Rollback

El cambio no altera datos. Ante saturación o permisos inesperados:

1. establecer temporalmente `OBSERVABILITY_MONITOR_ENABLED=false` para detener el sondeo;
2. establecer `LOG_FILE_ENABLED=false` si el transporte de archivo causa presión de disco;
3. reiniciar Passenger mediante `touch tmp/restart.txt`;
4. si el problema persiste, volver al commit anterior y verificar `/api/health`.

Nunca deben publicarse los archivos de logs ni moverse dentro de `dist`, `public` o `uploads`.

## Dependencias externas pendientes

- El dueño debe proporcionar/aprobar `DISCORD_WEBHOOK_URL` y/o `ADMIN_EMAIL`.
- Search Console, Bing Webmaster Tools, envío de sitemap y analítica con consentimiento requieren acceso a cuentas externas.
- La ausencia de esas credenciales no impide el logging local ni el panel, pero sí impide cerrar la alerta fuera del proceso y la medición de adquisición.
