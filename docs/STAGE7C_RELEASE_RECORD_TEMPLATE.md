# Registro de release 7C — plantilla

## Identificación

- Release:
- Fecha/hora inicio:
- Fecha/hora cierre:
- Operador:
- PR:
- CI de `main`:
- SHA anterior:
- SHA objetivo:
- SHA desplegado:
- Rollback objetivo:

## Alcance

- Cambios incluidos:
- Migraciones:
- Orden migración/código:
- Compatibilidad con código anterior:
- Flags relevantes:
- SimpleFactura diferido: sí/no
- Worker del outbox habilitado: sí/no

## Backup

- Requerido: sí/no
- Tipo y alcance:
- Ruta privada:
- Permisos comprobados:
- Restauración comprobada o procedimiento:

## Preflight

- [ ] cPanel limpio
- [ ] `origin/main` coincide con SHA objetivo
- [ ] checks obligatorios verdes
- [ ] variables no secretas verificadas
- [ ] migraciones/backup preparados
- [ ] rollback objetivo disponible

## Ejecución

- Vía: Update from Remote / `git pull --ff-only`
- Hora actualización:
- Hora reinicio Passenger:
- Resultado del pull:
- SHA posterior:

## Verificación

- [ ] smoke 7C aprobado
- [ ] health 200 y DB conectada
- [ ] repositorio limpio
- [ ] logs persistiendo
- [ ] sin nuevo Critical/High
- [ ] outbox dentro del estado esperado

Resumen del smoke, sin PII:

```json
{}
```

## Métricas y decisión

| Ventana | Error/5xx | p95 | DB | outbox | hallazgos | decisión |
|---|---:|---:|---|---|---|---|
| inmediata | | | | | | avanzar / hold / rollback |
| 24 h | | | | | | avanzar / hold / rollback |
| 72 h | | | | | | avanzar / hold / rollback |
| 7 días | | | | | | cerrar / remediar |

## Rollback, si se ejecutó

- Trigger:
- Hora decisión:
- PR/revert:
- SHA restaurado:
- Tiempo de recuperación:
- Smoke post-rollback:
- Estado de datos/migraciones:
- Seguimiento:

## Dependencias diferidas

- SimpleFactura/cliente:
- Canal externo:
- Search Console/Bing/analítica:
- Legal/editorial:
