# Runbook 7C — release y rollback en cPanel

## Alcance y reglas

La aplicación Node.js y el repositorio administrado por cPanel comparten la ruta:

```text
/home/servicioshogar/repositories/backend
```

Por esa razón, **Update from Remote** o `git pull --ff-only origin main` actualiza directamente la aplicación. No se usa **Deploy HEAD Commit** y no se requiere `.cpanel.yml`.

Reglas obligatorias:

- desplegar únicamente un `main` protegido y con CI verde;
- no desplegar con cambios locales o archivos versionados modificados en cPanel;
- aplicar migraciones requeridas antes del código que depende de ellas;
- no ejecutar en producción `test-auth.js`, `test-upload.js` ni `test-marketplace.js`;
- no usar `git reset --hard`, force-push ni checkout permanente de un SHA antiguo;
- mantener `ENABLE_PAYMENT_OUTBOX_WORKER` apagado mientras SimpleFactura siga diferido.

## Registro previo

Crear una copia de [STAGE7C_RELEASE_RECORD_TEMPLATE.md](./STAGE7C_RELEASE_RECORD_TEMPLATE.md) y completar como mínimo:

- PR y CI;
- SHA actualmente desplegado;
- SHA objetivo;
- rollback objetivo;
- migraciones y orden;
- ubicación/permisos del backup;
- flags sensibles;
- operador y hora de inicio.

## 1. Preparación local y GitHub

1. Confirmar que el cambio está en una rama `codex/*` basada en `origin/main`.
2. Ejecutar:

   ```powershell
   npm.cmd run check:ci
   git diff --check
   git status -sb
   ```

3. Publicar mediante PR y exigir `Quality gate` y `Clean schema`.
4. Integrar con historial lineal.
5. Esperar el CI de `main` y registrar su SHA exacto.

El build se produce y verifica antes del merge. No se recompila el frontend manualmente en cPanel.

## 2. Preflight en cPanel

Desde Terminal:

```bash
cd /home/servicioshogar/repositories/backend
git status --porcelain
git rev-parse HEAD
git fetch origin main
git rev-parse origin/main
```

Continuar sólo si `git status --porcelain` no devuelve líneas y el SHA de `origin/main` coincide con el objetivo registrado.

Comprobar flags sin imprimir secretos:

```bash
grep -E '^(NODE_ENV|PAYKU_MODE|ENABLE_PAYMENT_OUTBOX_WORKER)=' server/.env
```

Mientras SimpleFactura esté diferido, el worker debe estar ausente o distinto de `true`.

## 3. Backup y migraciones

Para un release sin cambios de datos, registrar `no aplica`.

Cuando exista una migración:

1. confirmar que fue validada por `validate:migrations` y `Clean schema`;
2. identificar si es expand compatible con el código anterior;
3. respaldar las tablas/filas afectadas o usar el backup de base de datos de cPanel;
4. guardar respaldos fuera del web root, bajo `/home/servicioshogar/backups`, con permisos `0600`;
5. ejecutar la migración con transacción y `ON_ERROR_STOP` o runner equivalente;
6. verificar columnas, índices y filas esperadas antes de desplegar código.

No eliminar columnas ni constraints de integridad durante el mismo release que deja de usarlos.

## 4. Actualización y reinicio

Usar una sola de estas vías:

- botón **Update from Remote** en Git Version Control; o
- Terminal:

  ```bash
  cd /home/servicioshogar/repositories/backend
  git pull --ff-only origin main
  git rev-parse HEAD
  touch tmp/restart.txt
  ```

Después de **Update from Remote**, reiniciar igualmente Passenger desde Setup Node.js App o con `touch tmp/restart.txt`.

El SHA posterior debe coincidir exactamente con el objetivo registrado.

## 5. Smoke posterior de solo lectura

Desde una máquina con Node.js:

```powershell
$env:STAGE7C_BASE_URL='https://serviciosatuhogar.cl'
npm.cmd run smoke:stage7c
```

O desde cPanel, usando el binario de la aplicación:

```bash
cd /home/servicioshogar/repositories/backend
STAGE7C_BASE_URL=https://serviciosatuhogar.cl /home/servicioshogar/nodevenv/repositories/backend/20/bin/node server/scripts/run_stage7c_release_smoke.js
```

El resultado debe aprobar:

- health y conexión DB;
- portada SSR y crawler;
- robots y sitemap;
- noindex de login;
- 404 real sin canonical;
- CSP, HSTS, `nosniff` y referrer policy.

Completar además:

```bash
git status -sb
tail -n 20 logs/application.log
tail -n 20 logs/error.log
```

No copiar cuerpos, emails, tokens ni identificadores personales al registro del release.

## 6. Triggers de rollback

Rollback inmediato:

- health 503 o DB desconectada en dos comprobaciones consecutivas;
- nueva falla de autorización, privacidad o integridad;
- duplicación/sustitución de pagos o reservas;
- pérdida de CSP/HSTS/noindex/404 honesto;
- error 5xx mayor a 2 veces el baseline;
- p95 mayor a 50% sobre el baseline;
- smoke 7C fallido sin explicación conocida y acotada.

Mantener y observar:

- error entre 10% y 100% sobre baseline;
- p95 entre 20% y 50% sobre baseline;
- warning conocido y documentado sin impacto nuevo.

La señal `PAYMENT_OUTBOX_LAG` producida exclusivamente por la boleta SimpleFactura diferida es una excepción conocida. Cualquier segundo evento pendiente, error del outbox o intento de boleta cambia la decisión a **hold**.

## 7. Rollback compatible con GitHub/cPanel

Mitigaciones inmediatas, si aplican:

- mantener `ENABLE_PAYMENT_OUTBOX_WORKER=false`;
- usar `OBSERVABILITY_MONITOR_ENABLED=false` sólo si el monitor causa la degradación;
- usar `LOG_FILE_ENABLED=false` sólo ante presión de disco atribuible al transporte.

Rollback de código:

1. desde un checkout local limpio, crear una rama desde `origin/main`;
2. revertir el commit defectuoso con `git revert`, sin reescribir historial;
3. ejecutar `npm run check:ci`;
4. publicar PR, esperar ambos checks e integrar;
5. actualizar cPanel por fast-forward, reiniciar Passenger y ejecutar el smoke 7C;
6. registrar tiempo de recuperación y SHA final.

Ejemplo para un único commit:

```bash
git fetch origin main
git switch -c codex/rollback-YYYYMMDD origin/main
git revert --no-edit SHA_DEFECTUOSO
npm run check:ci
git push -u origin codex/rollback-YYYYMMDD
```

Las migraciones expand se conservan. Restaurar datos o revertir una migración requiere un plan específico y evidencia del backup; nunca debe improvisarse durante el incidente.

El ensayo local de este flujo y sus límites están registrados en [STAGE7C_ROLLBACK_REHEARSAL_2026-08-16.md](./STAGE7C_ROLLBACK_REHEARSAL_2026-08-16.md). El commit efímero del ensayo no fue publicado y no debe reutilizarse.

## 8. Apertura controlada

En hosting compartido el rollout no usa porcentajes técnicos de balanceador. Se controla por acceso y adquisición:

1. uso interno y pruebas funcionales;
2. observar 24 horas;
3. observar 72 horas antes de activar marketing o difusión amplia;
4. revisión a 7 días;
5. avanzar sólo sin Critical/High abiertos y con métricas dentro de umbrales.

Antes de habilitar pagos públicos deben resolverse SimpleFactura, el worker del outbox y al menos un canal externo de alertas.
