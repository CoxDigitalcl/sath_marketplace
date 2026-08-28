# ADR-002: Moderacion diferencial y revisiones versionadas de servicios

## Status
Accepted

## Date
2026-08-28

## Context
El flujo actual usa la fila de `services` como contenido editable, contenido publico y
estado de moderacion. Cada edicion del proveedor, aunque solo cambie el precio,
restablece `moderation_status = 'pending'`. El administrador recibe una accion de
aprobar o rechazar sin una evidencia estructurada de lo que cambio.

Ese modelo reduce la autonomia del proveedor, genera una cola de microcambios y puede
retirar de publicacion un servicio previamente aprobado. Tambien permite que una
decision administrativa se aplique sin identificar una version exacta.

Necesitamos distinguir cambios comerciales u operativos de cambios que introducen
riesgo de seguridad, legalidad, identidad, veracidad o confianza. Productos es un
modulo separado y queda fuera de esta decision.

## Decision
`services` continuara siendo la version publica canonica. Los cambios que requieran
revision no se escribiran en esa fila hasta ser aprobados; se almacenaran como una
revision inmutable en `service_revisions`.

Cada guardado del proveedor sera comparado en el servidor contra el estado efectivo
del servicio. Una politica de campos, tambien controlada por el servidor, separara:

- cambios de aplicacion inmediata;
- cambios que requieren revision focalizada;
- cambios que requieren revision completa.

Una misma operacion puede tener un resultado mixto. Los campos seguros se aplican en
la misma transaccion y los restantes forman una revision pendiente. La revision
guarda valores anteriores y propuestos, motivos de clasificacion y el alcance
requerido. Una nueva propuesta reemplaza de forma explicita cualquier revision
pendiente anterior del mismo servicio.

Las decisiones humanas se registraran en `service_revision_decisions` y siempre
referenciaran un `revision_id`. Aprobar aplicara exclusivamente los campos pendientes
de esa revision dentro de una transaccion. Solicitar correccion o rechazar no alterara
la version publica. Una revision reemplazada no podra aprobarse.

El estado de publicacion y el estado de cambios se mostraran por separado. Un servicio
activo puede conservar un cambio pendiente sin dejar de estar publicado.

## Politica inicial

La politica se implementara como una allowlist versionada y testeable:

- Precio, tarifas de flete, duracion, agenda y disponibilidad: aplicacion inmediata
  con validacion de dominio.
- Titulo, descripcion y caracteristicas: controles deterministas; los cambios limpios
  se aplican y las senales de politica se derivan a revision focalizada.
- Imagen, video y galeria: revision focalizada del recurso propuesto.
- Categoria, categorias asociadas o modalidad del servicio: revision completa.
- Servicio nuevo: revision completa.
- Estado activo/pausado: endpoint independiente; no se acepta como campo de contenido.
- Campos desconocidos o reservados: rechazados en el limite de la API.

Los umbrales textuales, vocabulario sensible, categorias especiales y retencion de
medios son configuracion de politica y requieren propietario operativo. Un
clasificador futuro, incluida IA, solo podra producir senales; no tendra autoridad
directa para publicar, rechazar o sancionar.

## Contratos

El endpoint de actualizacion existente se mantiene durante la migracion y agrega un
resultado explicito: `applied`, `review_required` o `mixed`, con los campos aplicados
y el resumen de la revision. Esto evita romper clientes actuales.

La administracion usara recursos versionados:

- `GET /api/admin/service-revisions`
- `GET /api/admin/service-revisions/:revisionId`
- `POST /api/admin/service-revisions/:revisionId/decisions`

La lista sera paginada. Los errores de validacion, autorizacion y concurrencia tendran
codigos estables; una revision reemplazada respondera con conflicto y no se aplicara.

## Integridad de precio y reservas

Un cambio de precio no requiere moderacion. Las reservas ya creadas conservan el monto
persistido. La cotizacion expondra una version de precio y la creacion de la reserva
debera detectar una cotizacion obsoleta antes de aceptar un monto distinto al que el
cliente vio.

Todos los caminos de reserva deben verificar en el servidor que el servicio publico
este activo, aprobado y pertenezca a un proveedor habilitado.

## Alternatives Considered

### Volver todo el servicio a pendiente en cada edicion

Descartada porque retira autonomia, no escala operacionalmente y mezcla publicacion
con moderacion.

### Guardar borrador y publicado como dos filas completas de servicios

Descartada por ahora porque obligaria a reescribir todas las consultas publicas y
crearia dos identidades observables para el mismo servicio.

### Sobrescribir `services` y conservar solo un historial

Descartada porque un cambio riesgoso quedaria visible antes de la decision o exigiria
despublicar todo el servicio.

### Moderacion automatica mediante IA

Descartada como autoridad. Puede incorporarse mas adelante como una senal no confiable
y validada, con escalamiento humano para decisiones sensibles.

## Consequences

- Las consultas publicas existentes pueden seguir leyendo `services`.
- El formulario del proveedor debe recibir el estado efectivo, incluida su propuesta
  pendiente, sin confundirlo con lo que esta publicado.
- Las escrituras requieren transacciones, bloqueo o compare-and-set y una restriccion
  que impida dos revisiones vigentes para el mismo servicio.
- Los medios rechazados necesitan una politica de retencion y limpieza.
- La cache publica solo se invalida cuando cambia contenido publico.
- La cola administrativa debe mostrar la diferencia antes de habilitar una decision.
- La migracion sera expansiva e idempotente, seguida por una fase posterior de retiro
  del endpoint de moderacion legado.

## Rollout

1. Crear un respaldo verificable de PostgreSQL.
2. Ejecutar `npm run db:migrate-service-revisions`. La migracion es expansiva,
   transaccional e idempotente y debe terminar antes de desplegar el codigo.
3. Desplegar motor, API y UI juntos. El endpoint ciego legado responde `410` desde
   esta version y ninguna interfaz nueva depende de el.
4. Verificar que la cola administrativa abre el detalle, que una edicion segura se
   publica inmediatamente y que una edicion riesgosa conserva la version publica.
5. Verificar una reserva con la version de precio vigente y otra con una version
   obsoleta; la segunda debe responder `PRICE_CHANGED` sin crear un pago.

La migracion no elimina ni renombra columnas. Ante un rollback de aplicacion se puede
volver al artefacto anterior y dejar las tablas nuevas intactas; no se deben borrar
revisiones ni decisiones. Si la migracion falla, su transaccion revierte por completo
y el despliegue de codigo debe detenerse.

## Operacion y observabilidad

Durante las primeras 24 horas se deben observar errores con los codigos
`SERVICE_REVISION_CONFLICT`, `PRICE_CHANGED`, `SERVICE_UNAVAILABLE` y errores 5xx de
los tres endpoints administrativos de revisiones. Tambien se debe comparar el numero
de revisiones pendientes con las decisiones registradas y revisar que nunca exista
mas de una revision vigente por Servicio.

La cache publica actual vive en cada proceso y tiene un TTL maximo de diez minutos.
En el despliegue actual de una sola instancia se invalida al publicar contenido. Si
se escala la API a varias replicas, la invalidacion distribuida debe resolverse antes
de considerar consistencia visual inmediata entre replicas; la integridad de precio
y reserva no depende de esa cache y siempre se revalida en PostgreSQL.
