# Aprobación de servicios y selección de categorías — 2026-11-03

## Alcance y riesgo

Se revisaron los dos videos enviados por el cliente. Se modifica únicamente la
tipificación de dos parámetros SQL de `serviceRevisionService.js` y la sección de
categorías de `ServiceForm.tsx`. No se cambia el esquema ni las reglas de moderación.
El riesgo concreto es publicar contenido sin una decisión íntegra o perder una
selección del proveedor al guardar. Se conserva la autorización de administrador,
la lista obligatoria, el bloqueo de filas, la revisión esperada y la auditoría.

## Causa reproducida

La escritura del estado reutilizaba `$1` tanto para una columna `VARCHAR(24)` como
para una comparación en `CASE`. PostgreSQL devuelve `42P08`, «inconsistent types
deduced for parameter $1», detalle «text versus character varying», y revierte la
transacción completa. Se reprodujo primero con una consulta mínima y después con
el servicio real contra PostgreSQL 17 local. También fallaban rechazo y solicitud
de correcciones. El registro de cambios automáticos contenía el mismo patrón con
`$5`, corregido en el mismo alcance mediante un cast explícito `::varchar`.

La inferencia de parámetros está descrita en la
[documentación de PostgreSQL 17](https://www.postgresql.org/docs/17/sql-prepare.html).
Las pruebas anteriores usaban consultas simuladas y no ejecutaban el analizador SQL.

## Formulario

- Campos nativos con borde visible, etiqueta persistente y foco de teclado.
- Secuencia explícita: elegir categoría, elegir especialidad y agregar categoría.
- La especialidad se habilita al elegir categoría y se reinicia si esta cambia.
- El botón completo queda debajo de los campos y se habilita al completar la selección.
- Se indican selecciones pendientes y repetidas junto a los controles.
- Lista y contador de categorías agregadas; acciones de quitar con nombre accesible.
- Al guardar sin categorías o con una selección nueva sin agregar, aparece un error
  junto al campo y se lleva el foco al control correspondiente. Puede descartarse
  una selección nueva sin perder las categorías ya agregadas.
- En móvil se apilan los campos y las especialidades largas se ajustan al ancho.

## Validación local

- 26 pruebas focalizadas existentes de servicio, esquema, validación y moderación: pasan (~0,9 s).
- Regresión real PostgreSQL: aprobación completa, precio automático, edición de un
  servicio pausado, corrección, rechazo, checklist incompleto, concurrencia y fallo
  de auditoría con rollback y reintento: 8 escenarios, pasan (~1 s).
- La regresión PostgreSQL falló antes del cambio con `42P08`; pasó tras los casts.
- TypeScript, lint y build de producción: pasan. Build en carpeta temporal para
  conservar los cambios de `dist` que ya existían en el workspace (16,3 s).
  Vite informa Browserslist antiguo y un chunk mayor de 500 kB; no son fallos de build.
- Chrome local con el componente real: guardado, error y foco, agregar con Enter,
  duplicados, segunda selección pendiente, descarte, cambio de categoría y eliminación.
- Capturas inspeccionadas en escritorio y anchos móviles de 375 y 320 px, sin
  desbordamiento horizontal y con acciones principales de al menos 44 px.
- Detector Impeccable: una advertencia sobre gris/fondo rojo en el botón de quitar.
  Se revisó el estado: el rojo solo aparece al hover, que también cambia el texto
  a rojo oscuro (`hover:text-red-800`); el estado base es gris sobre fondo neutro.

Para ejecutar la regresión real, proporcionar `SERVICE_REVISION_TEST_DATABASE_URL`
apuntando a una base desechable y ejecutar
`node --test server/tests/serviceRevisionPostgres.test.js`. La prueba crea y elimina
su propio esquema aleatorio. Sin esa variable se omite expresamente; no utiliza
los ajustes `DB_*` de la aplicación.

## Entrega proporcional y límites

Se aplica el acuerdo del usuario del 2026-10-25: comprobaciones locales pertinentes,
sin nuevo workflow, artifacts hospedados ni requisito de cuota de Actions. La
reproducción local aporta la garantía necesaria; no hace falta calificación remota.
No se modificaron workflows, protecciones, acceso ni producción. El estado local
previo incluía cambios ajenos en notificaciones y en `dist`; se conservaron.
Las notas históricas de despliegue no autorizan por sí mismas publicar esta corrección.

### Entrega autorizada por el usuario

El usuario autorizó expresamente el despliegue después de revisar la corrección.
Se preparó una entrega aislada desde `origin/main` `a12ede25ae832445802b62b5544ba718f51b7d37`,
que coincide con el checkout limpio de cPanel. Se conservaron las mejoras posteriores
de moderación y la comprobación de existencia de archivos multimedia.

- Rama de preparación: `release/fix-approval-categories-20261103`. Se utiliza el prefijo
  `release/` para evitar el trigger `push: codex/**` y su ejecución duplicada con el PR.
- Protecciones consultadas en GitHub: `Quality gate` y `Clean schema`, strict y
  administradores incluidos; PR obligatorio sin aprobaciones adicionales requeridas.
  Esta dependencia real justifica una calificación hospedada del PR y la ejecución
  existente de `main` posterior, sin modificar permisos, workflows ni protecciones.
- No se añaden artifacts ni almacenamiento hospedado; únicamente el bundle estático
  versionado que cPanel ya sirve. No hay migración ni cambio de flags. La revisión
  posterior del audit requirió actualizar dependencias, como se detalla abajo.
- Reversión preparada: revertir el commit de la entrega, integrar y actualizar cPanel
  por fast-forward; no se requiere restauración de datos ni `reset --hard`.
- Validación de la entrega reconciliada: lint, TypeScript, secretos, migraciones y
  presupuesto de rendimiento pasan; build de producción 10,87 s.
- Suite integral: 221/221 pruebas pasan, sin omisiones, incluyendo PostgreSQL real
  (8,10 s). Un ensayo anterior bajo sandbox tuvo 15 fallos por red local/renombrado;
  las pruebas afectadas pasaron fuera del sandbox y la pasada integral confirmó el resultado.
- El formulario coincide byte por byte con el componente ya inspeccionado en Chrome.
- Smoke público previo: 7/7 comprobaciones pasan, incluido health con DB y cabeceras.
- Estado previo: `NODE_ENV=production`, `PAYKU_MODE=sandbox`; worker del outbox
  no habilitado por una variable explícita. No se modifica configuración operativa.

### Dependencias necesarias para superar la protección vigente

La auditoría actual del lockfile anterior encontró 1 alerta crítica y 9 altas
(los checks históricos de `main` eran del 2026-08-28). Se detuvo la integración
antes de ejecutar CI hospedada y se preparó la corrección local.

- Actualizaciones compatibles del lockfile, incluido `proxy-addr` 2.0.8, sin
  `npm audit fix --force`, overrides de seguridad ni supresión de advisories.
- Las dos alertas altas restantes exigían Nodemailer 10.3.1 y Zod 4.6.7.
  Se comprobaron sus fuentes oficiales: [Nodemailer 10](https://github.com/nodemailer/nodemailer/releases/tag/v10.0.0),
  [migración Zod 4](https://zod.dev/v4/changelog),
  [aviso Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) y
  [aviso proxy-addr](https://github.com/advisories/GHSA-jqcg-44mw-7w3h).
- Nodemailer 10 requiere Node >=20, compatible con el runtime de cPanel.
- Adaptación de Zod en dos archivos: `errorMap` pasa a `error`, `ZodError.errors`
  a `issues`, y `z.record` declara expresamente la clave de texto.
- Cinco pruebas adicionales cubren roles permitidos, respuestas 400 de autenticación,
  avance de login válido, restricciones de contraseñas/step-up, configuración de agenda
  y composición real de correo en memoria sin envío externo.
- Suite final: 226/226 pruebas pasan sin omisiones (10,69 s), incluidas las pruebas
  PostgreSQL y las de compatibilidad. Lint, TypeScript, secretos y presupuesto pasan;
  build regenerado con el lockfile final (10,13 s).
- Audit final: 0 críticas, 0 altas; quedan 9 moderadas en herramientas de desarrollo.
  `npm audit --audit-level=high` pasa. No se afirma que el árbol esté libre de alertas.
- El despliegue debe instalar el lockfile final con el Node de la aplicación antes
  de reiniciar Passenger. Una reversión también debe reinstalar el lockfile anterior.

La comprobación del formulario usa datos de prueba; no equivale a una validación
en la cuenta real del cliente. Queda pendiente la comprobación funcional después
del despliegue mediante el mecanismo autorizado del proyecto.
