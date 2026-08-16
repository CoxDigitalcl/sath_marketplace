# Ensayo de rollback 7C-B — GitHub y cPanel

**Fecha:** 2026-08-16
**Modalidad:** ensayo local aislado, sin push y sin cambios en producción
**Release evaluado:** `6fa5ba7358a52e617e9d52821d84705dc4a3b497`
**Rollback objetivo:** `acf614121cebec80903e16c0cecd1d1da98b7ac3`

## Objetivo

Comprobar que el release desplegado puede revertirse mediante un commit lineal de `git revert`, que el árbol resultante corresponde exactamente a la versión anterior y que esa versión continúa siendo construible con las migraciones expand conservadas en la base de datos.

No se hizo rollback de producción: devolver deliberadamente el sitio a una implementación con la brecha de entregas parciales no aporta seguridad. El tiempo medido corresponde a preparación y verificación local, no al RTO total de cPanel.

## Procedimiento ejecutado

1. Se creó un clon local temporal sin hardlinks.
2. Se posicionó el clon en `6fa5ba7`.
3. Se ejecutó `git revert --no-commit 6fa5ba7`.
4. Se comparó el árbol preparado con el árbol de `acf6141`.
5. Se ejecutaron la suite serial, el build de producción y el presupuesto de rendimiento sobre el árbol revertido.
6. En un segundo clon temporal se creó una rama `codex/rollback-rehearsal` y un commit real de `git revert --no-edit 6fa5ba7`.
7. Se verificaron el padre, el árbol y la limpieza de ese commit; no se publicó la rama.
8. Las dos copias temporales fueron eliminadas después de validar sus rutas absolutas dentro del workspace.

## Evidencia

| Comprobación | Resultado |
|---|---|
| Revert sin conflictos | aprobado |
| Árbol revertido | `0b2ff55b7e25dc517405f1c7658658973fcf1ffe` |
| Árbol de `acf6141` | `0b2ff55b7e25dc517405f1c7658658973fcf1ffe` |
| Equivalencia exacta de árboles | aprobada |
| Suite del rollback | 149/149 pruebas aprobadas |
| Build Vite | aprobado |
| Presupuesto 5C | aprobado |
| Commit de ensayo | `fc62f01` local y descartado |
| Padre del commit de ensayo | `6fa5ba7358a52e617e9d52821d84705dc4a3b497` |
| Worktree posterior al commit | limpio |
| Duración de revert + tests + build + presupuesto | 93 segundos |

El SHA corto del commit de ensayo es sólo evidencia efímera: la copia fue eliminada y el commit no existe en GitHub ni debe usarse como objetivo operativo.

## Compatibilidad de datos

La migración `add_payment_notification_delivery_integrity.sql`:

- agrega cinco columnas `TIMESTAMP WITH TIME ZONE` opcionales;
- completa checkpoints únicamente para reservas históricas ya marcadas como notificadas;
- no elimina columnas, índices, constraints ni filas;
- puede permanecer aplicada si el código vuelve temporalmente a `acf6141`.

Un rollback de código no debe intentar revertir esta migración. El código anterior ignora las columnas adicionales.

## Condiciones para un rollback real

- mantener `ENABLE_PAYMENT_OUTBOX_WORKER` apagado;
- no drenar manualmente eventos de notificación con el código anterior;
- crear el revert desde el `origin/main` vigente, no reutilizar el commit efímero de este ensayo;
- pasar `Quality gate` y `Clean schema` en el PR;
- actualizar cPanel por fast-forward, reiniciar Passenger y ejecutar `npm run smoke:stage7c`;
- medir y registrar el RTO real desde la decisión hasta el smoke aprobado.

La boleta SimpleFactura pendiente continúa sin intentos y no forma parte del ensayo.

## Decisión

**7C-B aprobado como ensayo controlado.** Se verificaron el mecanismo de revert, la equivalencia del árbol, la compatibilidad expand, las pruebas y el build. El RTO real de cPanel sólo se medirá ante una necesidad legítima de rollback o en una futura ventana de mantenimiento expresamente autorizada.

El siguiente bloque es 7C-C: apertura controlada sin pagos públicos, con observación a 24 horas, 72 horas y 7 días. G6 continúa no aprobado mientras falten el canal externo de alertas y la habilitación segura de SimpleFactura/worker.
