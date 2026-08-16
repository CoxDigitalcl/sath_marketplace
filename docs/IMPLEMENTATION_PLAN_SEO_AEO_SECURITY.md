# Plan de implementación SEO/AEO y seguridad

Estado: activo  
Fecha de inicio: 2026-08-10  
Goal de Codex: `019fecab-2250-7e80-808b-dcc46d0d3348`

## 1. Objetivo y criterio de éxito

Llevar el marketplace **Servicios a tu Hogar** a un estado verificable de preparación para producción, de modo que:

- los pagos no puedan reasignarse, repetirse ni confirmar reservas distintas;
- dos usuarios no puedan adjudicarse el mismo cupo por una carrera;
- toda operación privada esté autorizada por rol, propietario y estado del recurso;
- los datos personales e internos no aparezcan en respuestas públicas;
- uploads, búsquedas, caché y endpoints sensibles tengan límites de abuso;
- las páginas públicas importantes entreguen contenido útil en el HTML inicial, sin depender exclusivamente de JavaScript;
- buscadores y motores de respuesta reciban URLs canónicas, estados HTTP correctos, metadatos y datos estructurados fieles al contenido visible;
- exista evidencia automática de seguridad, indexabilidad, rendimiento y capacidad de rollback antes de abrir tráfico significativo.

No se considerará terminado por “compilar”. Cada etapa debe cumplir su gate y conservar evidencia de pruebas.

## 2. Principios de ejecución

1. **Integridad antes que adquisición:** no se amplifica tráfico hasta cerrar pagos, reservas, autorización y exposición de datos.
2. **Controles en servidor y base de datos:** la UI nunca es la barrera de seguridad ni la única garantía de consistencia.
3. **Fail closed en dinero y permisos:** una respuesta incompleta del proveedor de pagos, un rol ambiguo o un estado inesperado debe detener la operación.
4. **Una fuente de verdad para rutas públicas:** sitemap, canonical, SSR, metadatos y reglas `noindex` deben derivar de la misma clasificación.
5. **Contenido humano primero:** JSON-LD y recursos para agentes solo describen información visible, verificable y pública.
6. **Cambios pequeños y reversibles:** migraciones expand/contract, flags cuando aporten seguridad y rollout progresivo.
7. **Observabilidad sin filtrar secretos:** IDs de correlación y auditoría estructurada; nunca tokens, RUT, contraseñas ni URLs sensibles completas.

## 3. Gates globales de lanzamiento

| Gate | Condición de aprobación | Condición de no-go |
|---|---|---|
| G1 — Dinero | Webhook vinculado a orden/transacción, idempotencia DB y pruebas de replay/sustitución | Una transacción válida puede confirmar otra reserva o procesarse dos veces |
| G2 — Inventario de tiempo | Reserva/cupo protegido por restricción DB y transacción | Dos solicitudes concurrentes obtienen el mismo cupo |
| G3 — Acceso y privacidad | Matriz de autorización y DTO públicos probados | Cliente publica como proveedor; RUT/comisiones/email interno quedan públicos |
| G4 — Abuso y operación | Rate limits, paginación, límites de caché/upload, errores y logs endurecidos | Consulta o upload autenticado puede agotar memoria, disco o DB sin límites |
| G5 — Descubribilidad | HTML público útil sin JS, robots/sitemap reales, canonical y 404 correctos | App shell vacío, soft 404 o rutas privadas indexables |
| G6 — Calidad | CI verde, pruebas negativas, smoke staging, rollback ensayado | Migraciones no reversibles o ausencia de evidencia sobre flujos críticos |

La apertura de campañas o tráfico pagado requiere G1–G4 y G6. La campaña SEO pública requiere además G5.

## 4. Etapas

### Etapa 0 — Baseline, gobierno técnico y red de seguridad

**Propósito:** fijar el punto de partida y evitar que la remediación introduzca regresiones invisibles.

**Trabajo**

- Crear un registro único de hallazgos con severidad, propietario, estado, evidencia y prueba de cierre.
- Clasificar rutas como `public-indexable`, `public-noindex`, `authenticated` o `admin/internal`.
- Inventariar estados válidos de reserva/pago y las transiciones permitidas por actor.
- Documentar contrato real de Payku: identificador de orden, identificador de transacción, monto, moneda, firma/evento y comportamiento de reintentos.
- Separar configuración de desarrollo/staging/producción y comprobar que secretos obligatorios no tengan fallback inseguro.
- Ampliar `npm test` para descubrir todas las pruebas del servidor y establecer carpetas por dominio.
- Crear fixtures/fábricas sin PII real para usuario, proveedor, servicio, reserva y transacción.
- Preparar staging con DB desechable, credenciales sandbox y copia de seguridad antes de migraciones.

**Entregables**

- Este plan, matriz de rutas, matriz de autorización y diagrama de estados.
- Comandos reproducibles de build, tests y smoke.
- Backlog trazable Critical/High/Medium.

**Gate de salida**

- Build actual reproducible.
- Suite base ejecutable con un solo comando.
- Staging identificado y sin datos productivos en fixtures.
- Cada hallazgo crítico tiene prueba de regresión especificada.

**Esfuerzo orientativo:** 1–2 jornadas de ingeniería.

---

### Etapa 1 — Integridad crítica de pagos y webhooks

**Propósito:** impedir sustitución de transacción, replay, doble procesamiento y confirmaciones parciales.

**Trabajo**

- Verificar con Payku la transacción recibida y comparar, como mínimo:
  - ID de la transacción verificada con el ID del callback;
  - orden verificada con `booking.id` o referencia inmutable equivalente;
  - monto exacto calculado por servidor;
  - moneda esperada;
  - estado final permitido.
- Guardar el `transaction_id` esperado al crear la intención; no permitir que el callback lo reemplace libremente.
- Registrar cada evento de pago en una tabla de eventos con clave única del proveedor y payload mínimo sanitizado/hash.
- Añadir índice único parcial para transacciones no nulas y una clave de idempotencia por evento/operación.
- Procesar webhook dentro de una transacción DB con bloqueo de la reserva y transición compare-and-set.
- Responder 2xx a duplicados ya procesados sin repetir notificaciones, facturación ni cambios de estado.
- Rechazar eventos ambiguos, incompletos, de otra moneda/orden/monto o con estado no final.
- Si Payku ofrece firma, timestamp o secreto de callback, validarlos antes de consultar la transacción; la consulta directa al proveedor sigue siendo necesaria.
- Enviar notificaciones y efectos secundarios después del commit o mediante outbox idempotente.

**Pruebas obligatorias**

- transacción pagada A no confirma reserva B del mismo precio;
- replay idéntico no duplica efectos;
- callbacks simultáneos solo producen una transición;
- orden, moneda, monto, ID o estado incorrectos fallan cerrados;
- caída entre validación y commit no deja estado parcial;
- índice único impide asociar una transacción a dos reservas.

**Migración y rollback**

- Expandir primero: tabla/columnas/índices compatibles con filas existentes.
- Auditar duplicados históricos antes de activar unicidad.
- Desplegar código tolerante al esquema expandido, activar constraint y recién después retirar rutas legacy.
- Rollback de código conserva el esquema nuevo; no eliminar eventos capturados.

**Gate de salida:** G1 aprobado en tests y staging con Payku sandbox.

**Esfuerzo orientativo:** 2–4 jornadas.

---

### Etapa 2 — Reservas concurrentes, disponibilidad y capacidades públicas

**Propósito:** convertir la disponibilidad en una garantía transaccional, no en una consulta informativa.

**Trabajo**

- Modelar un cupo normalizado por proveedor/servicio/fecha/hora o rango temporal.
- Proteger exclusión mediante índice único o constraint de exclusión de PostgreSQL, según soporte real de duraciones.
- Crear reserva y ocupar cupo en la misma transacción; la DB decide el ganador.
- Introducir `hold` temporal para checkout con expiración y liberación idempotente.
- Añadir `Idempotency-Key` a creación de reserva/checkout, ligado a actor, operación y hash del request.
- Reemplazar actualizaciones `SELECT` + `UPDATE` abiertas por compare-and-set sobre estado anterior permitido.
- Formalizar máquina de estados por actor: cliente, proveedor, admin y webhook.
- Proteger `/verify/:id` y `/public/:id` con sesión o capability token firmado, de propósito único, expirable y rotatable.
- Evitar efectos secundarios en GET públicos; la verificación activa debe ser rate-limited, auditada y separada.

**Pruebas obligatorias**

- 20–100 solicitudes paralelas por el mismo cupo producen una reserva/hold ganador;
- reintento con igual idempotency key devuelve el mismo resultado;
- misma key con payload diferente se rechaza;
- transiciones inválidas y carreras cancelar/confirmar fallan;
- token público expirado, de otra reserva o alterado no revela contactos.

**Gate de salida:** G2 aprobado y prueba de carga breve sin doble reserva.

**Esfuerzo orientativo:** 3–6 jornadas.

---

### Etapa 3 — Autorización, privacidad, uploads y consumo de recursos

**Propósito:** reducir superficie pública y asegurar que cada rol solo opere sobre objetos permitidos.

**Trabajo de autorización y datos**

- Crear middlewares/policies reutilizables: `requireRole`, `requireOwnershipOrAdmin`, `requireVerifiedProvider` y validadores de transición.
- Exigir rol proveedor para perfil, KYC, creación/edición/publicación de servicios y carga de media.
- Exigir verificación/moderación antes de que proveedor o servicio aparezcan en catálogo, sitemap o perfil público.
- Definir DTOs públicos por allowlist; retirar RUT, comisiones, email interno, flags operativos y campos no contractuales.
- Probar todas las variantes read/write/delete/export con matriz actor × recurso × acción.

**Trabajo de uploads**

- Aceptar solo nombres de campo conocidos; sustituir `upload.any()` donde no sea necesario.
- Validar extensión, MIME y firma/magic bytes; renombrar en servidor con identificador aleatorio.
- Establecer límites por archivo, request, usuario y periodo; rate limit separado para video/documentos.
- Mantener cuarentena privada y, si la operación lo justifica, escaneo antimalware antes de publicar.
- Limpiar archivos huérfanos en fallos y rechazar contenido ejecutable/polyglot no admitido.
- Servir KYC y documentos privados únicamente vía autorización de objeto; `nosniff` y descarga segura.

**Trabajo de búsquedas, caché y abuso**

- Paginar obligatoriamente el catálogo con tope 20–50 y límites de longitud de búsqueda.
- Permitir solo query params/sorts/filtros conocidos; rechazar desconocidos.
- Normalizar la cache key con parámetros efectivamente usados; fijar `maxKeys`, TTL y estrategia de eviction.
- Aplicar rate limits diferenciados a búsqueda, detalle, upload, reservas, recuperación y endpoints costosos.
- Añadir índices DB medidos para búsquedas; evitar escanear JSON/texto completo sin estrategia.

**Pruebas obligatorias**

- cliente no crea/publica servicio ni sube media de proveedor;
- proveedor no modifica objetos ajenos;
- respuestas públicas nunca incluyen campos sensibles;
- proveedor no verificado no aparece en catálogo/sitemap;
- MIME falsificado, campo desconocido y exceso de cuota se rechazan y no dejan archivo;
- nonces/params desconocidos no crean caché ilimitada;
- paginación no acepta límites abusivos.

**Gate de salida:** G3 y G4 aprobados para estas superficies.

**Esfuerzo orientativo:** 4–7 jornadas.

---

### Etapa 4 — Sesiones, supply chain, errores y operación segura

**Propósito:** limitar el impacto de XSS/robo de sesión y hacer operable la plataforma bajo ataque o fallo.

**Trabajo**

- Migrar progresivamente de JWT persistente en `localStorage` a:
  - access token corto en memoria y refresh token rotado `HttpOnly; Secure; SameSite`; o
  - sesión de servidor equivalente.
- Si se usan cookies, añadir protección CSRF para toda mutación.
- Incorporar `token_version` o sesiones revocables; invalidar sesiones al reset/cambio de contraseña, bloqueo o cambio de rol.
- Hacer de un solo uso los tokens de recuperación mediante `jti`/hash persistido y consumo atómico.
- Eliminar endpoints HTTP de migración/reparación; ejecutar migraciones por pipeline/CLI con maintenance gate.
- Auditar impersonación admin en DB, exigir step-up, duración corta, banner visible y revocación.
- Devolver errores genéricos en producción con correlation ID; eliminar `debugStep`, mensajes DB y stack.
- Redactar tokens y PII de URLs/logs; eventos de pago/admin/auth deben tener audit trail estructurado.
- Actualizar dependencias vulnerables y lockfile; justificar temporalmente cualquier advisory no alcanzable.
- Añadir alertas para picos de login/reset/upload/búsqueda, webhooks inválidos, reservas en conflicto y acciones admin.
- Verificar en infraestructura TLS, proxy trust, CORS final, WAF/CDN, backup/restauración, ACL de storage y retención de logs.

**Pruebas obligatorias**

- logout/reset/cambio de rol revocan sesiones;
- refresh reuse detectado y familia revocada;
- CSRF falla sin token/origin correcto;
- error inducido no filtra SQL, ruta interna ni PII;
- endpoint de migración no es alcanzable en producción;
- `npm audit --omit=dev` sin vulnerabilidades High/Critical alcanzables o con excepción documentada y fecha de vencimiento;
- restore de backup ensayado en staging.

**Gate de salida:** G4 completo y revisión operativa aprobada.

**Esfuerzo orientativo:** 4–8 jornadas, más coordinación de infraestructura.

---

### Etapa 5 — Fundamentos SEO técnicos y renderizado público

**Propósito:** conseguir indexabilidad fiable sin obligar al crawler a ejecutar la SPA.

#### 5A. Higiene HTTP inmediata

- Entregar `robots.txt` de texto y sitemap XML reales, con host/canonical de producción configurado.
- Incluir solo home, categorías curadas, servicios activos/verificados, proveedores verificados y políticas públicas.
- Excluir admin, dashboards, auth, reset, checkout, success, tokens, APIs, style guide y rutas parametrizadas privadas.
- Separar caché: assets con hash `immutable`; HTML y metadatos con `no-cache`/revalidación corta.
- Devolver 404/410 reales para recursos inexistentes y 301/308 para rutas antiguas.
- Añadir `X-Robots-Tag: noindex, nofollow` a rutas privadas/transaccionales como defensa complementaria; autenticación sigue siendo obligatoria.
- Definir política independiente para `OAI-SearchBot`, `GPTBot` y otros crawlers solo después de decisión de negocio.

#### 5B. Arquitectura híbrida SSR/CSR

- Añadir entrada de servidor React y `hydrateRoot` en cliente.
- Renderizar en servidor home, categorías, servicio, proveedor y políticas con datos públicos ya filtrados.
- Mantener admin/dashboards como cliente privado, fuera del bundle público inicial cuando sea posible.
- Centralizar manifiesto de rutas con clasificación, loader, canonical, title, description, estado e inclusión en sitemap.
- Renderizar en HTML inicial título, H1, descripción, precio/alcance verificable, proveedor y enlaces contextuales.
- No usar dynamic rendering específico para bots ni entregar contenido diferente al usuario.
- Aplicar timeout/cache controlado a loaders SSR y fallback 5xx; no convertir errores de DB en páginas vacías 200.

#### 5C. Crawlabilidad y rendimiento

- Sustituir navegación interna con `button/div onClick` por `<a href>` o `Link` que genere ancla real.
- Implementar lazy loading por ruta para que home no descargue dashboards/admin.
- Establecer presupuesto inicial: bundle público, LCP, CLS, INP y peso de media; medir móvil real/staging.
- Definir dimensiones, lazy loading y formatos de imágenes; captions/transcripts para videos relevantes.
- Crear slugs estables y redirects desde URLs anteriores sin duplicar canonical.

**Pruebas obligatorias**

- request sin JavaScript a cada plantilla pública contiene contenido principal y enlaces;
- sitemap no contiene patrones privados ni recursos no verificados;
- canonical, status, title y description son únicos/coherentes;
- URL inexistente devuelve 404 y no Home 200;
- rutas privadas devuelven auth/noindex y nunca se incluyen en discovery;
- smoke con Googlebot y user-agent normal entrega contenido equivalente;
- build y presupuesto de bundle/CWV sin regresión acordada.

**Gate de salida:** G5 aprobado en staging y luego en producción mediante verificación HTTP.

**Esfuerzo orientativo:** 7–14 jornadas; la parte SSR es el bloque arquitectónico principal.

---

### Etapa 6 — Capa semántica, AEO, confianza y conversión

**Propósito:** hacer que las páginas sean comprensibles, citables y útiles después de una respuesta generada por IA.

**Estado técnico al 2026-08-16:** remediación y hotfix desplegados; smoke HTTP final aprobado en producción. Permanecen únicamente las dependencias editoriales/legales del dueño y transcripciones reales cuando correspondan.

- **6A — Integridad y confianza:** métricas simuladas eliminadas; ratings solo con reseñas reales; claims, garantías y tiempos no verificables retirados.
- **6B — Capa semántica:** grafo JSON-LD seguro con IDs estables, categorías vacías en `noindex` y sitemap limitado a oferta pública activa.
- **6C — Contenido y conversión:** descripciones renderizadas sin Markdown crudo, plantilla editorial ampliada, alcance de verificación visible, CTA trazable sin PII y soporte de transcripción.
- **Hotfix de cierre:** los resúmenes SSR usan texto plano y los proveedores sin oferta pública quedan en `noindex` y fuera del sitemap.
- **Pendiente para aprobar el gate:** revisión final del dueño/asesoría legal, completar contenido faltante de los servicios y aportar transcripciones reales cuando existan videos relevantes.

**Trabajo**

- Definir grafo JSON-LD con IDs estables: `Organization`, `WebSite`, `BreadcrumbList`, `Service` y `Offer` solo con datos reales.
- Usar `AggregateRating` únicamente con reseñas reales, visibles y gobernadas; eliminar rating 5.0 simulado.
- Reemplazar claims no probados como “#1” o “garantía” por evidencia o enlazar la política contractual correspondiente.
- Crear plantilla editorial por servicio:
  - respuesta breve a la necesidad;
  - qué incluye/no incluye;
  - base del precio y factores que lo cambian;
  - cobertura y disponibilidad;
  - evidencia/verificación del proveedor;
  - cancelación, garantía y siguiente acción.
- Cubrir query fan-out: alternativas, comparación, requisitos, objeciones, comunas/regiones y preguntas posteriores.
- Añadir breadcrumbs, updated date, autoria/revisión cuando aplique, alt/caption/transcript y pruebas/casos reales.
- Mantener `llms.txt`, catálogo JSON, OpenAPI o MCP fuera de alcance hasta que exista una necesidad real y un modelo de seguridad; si se incorporan, comenzar read-only y sin rutas privadas.

**Pruebas obligatorias**

- JSON-LD valida y coincide con texto visible;
- ninguna página publica claims/rating no verificables;
- todas las páginas de dinero responden preguntas clave y presentan CTA trazable;
- revisiones editoriales y legales aprobadas para garantía, cancelación, privacidad y comisiones visibles.

**Gate de salida:** validación semántica, revisión de contenido y muestra de páginas aprobadas.

**Esfuerzo orientativo:** 5–10 jornadas técnicas, más producción/revisión de contenido.

---

### Etapa 7 — CI, observabilidad, medición y lanzamiento escalonado

**Propósito:** impedir regresiones y abrir tráfico con capacidad de detectar y revertir fallos.

**Estado de remediación al 2026-08-16:** auditoría completada en [STAGE7_GAP_AUDIT_2026-08-15.md](./STAGE7_GAP_AUDIT_2026-08-15.md). 7A fue integrada mediante el PR #1 y desplegada en `2d204cd`; `main` conserva CI y protección obligatoria. 7B está implementada en `codex/stage7b-observability` con pruebas específicas verdes y documentación en [STAGE7B_OBSERVABILITY.md](./STAGE7B_OBSERVABILITY.md); falta publicar/desplegar, comprobar persistencia en cPanel y configurar un canal externo. G6 aún no está aprobado porque también resta 7C.

**Automatización CI**

- Build y typecheck.
- Tests unitarios/integración por dominio.
- Tests de autorización por matriz y de pagos/reservas concurrentes.
- Verificación automática de robots, sitemap, canonical, noindex, 404 y HTML sin JS.
- Dependency audit, secret scan, lint de migraciones y prueba de esquema limpio.
- DAST focalizado en staging para auth, BOLA, rate limits, headers y uploads.

**Observabilidad**

- Métricas de latencia/error por ruta, saturación DB/cache, disco de uploads y colas/outbox.
- Dashboards y alertas de pago inválido/replay, conflictos de cupo, 401/403, 429, reset/login y acciones admin.
- Logs de crawlers por familia/ruta/status, aclarando que user-agent no prueba identidad.
- Search Console y Bing Webmaster Tools; sitemap enviado y URLs representativas inspeccionadas.
- Medir impresiones, indexación, CTR, conversiones, inicios de reserva, calidad de lead y referencias AI.

**Rollout**

1. Migraciones expand en staging y restauración de backup.
2. Smoke end-to-end con Payku sandbox, reserva concurrente, uploads y rutas públicas.
3. Producción interna/allowlist.
4. 5%–10% de tráfico con alertas y comparación de errores/latencia/conversión.
5. 25%, 50% y 100% solo si los thresholds se mantienen.
6. Revisión a 24 h, 72 h y 7 días; no aumentar marketing antes del corte de 72 h.

**Rollback**

- Código anterior preparado y compatible con migraciones expand.
- Flags para SSR/caché y flujos sensibles solo cuando no permiten bypass de seguridad.
- Nunca desactivar unicidad/idempotencia para “resolver” incidentes; detener checkout si la integridad está en duda.
- Runbook con responsable, trigger, comando, validación posterior y comunicación.

**Gate de salida:** G6, rollout 100% estable y auditoría post-lanzamiento sin Critical/High abiertos.

**Esfuerzo orientativo:** 4–8 jornadas iniciales y operación continua.

## 5. Secuencia, dependencias y paralelización

```text
Etapa 0
  ├─ Etapa 1 Pagos ───────┐
  ├─ Etapa 3 Auth/PII ────┼─ Etapa 4 Sesiones/Operación ─┐
  └─ Etapa 5A SEO HTTP ───┘                              ├─ Etapa 7 Lanzamiento
       Etapa 1 ── Etapa 2 Reservas ──────────────────────┤
       Etapa 3 ── Etapa 5B SSR ── Etapa 5C ── Etapa 6 ──┘
```

- Pagos y autorización pueden avanzar en paralelo porque modifican superficies distintas.
- Reservas sigue a pagos porque ambos cambian `bookingController` y el modelo de estados.
- SSR público depende de DTOs públicos seguros; no se debe prerenderizar una fuga de datos.
- AEO depende de URLs/canonicals/renderizado estables y de reglas de confianza aprobadas.
- CI evoluciona en cada etapa, aunque la consolidación operativa cierre en Etapa 7.

## 6. Asignación inicial de agentes

| Frente | Alcance inicial | Restricción para evitar conflictos | Estado inicial |
|---|---|---|---|
| `payment_integrity` | Webhook Payku, idempotencia, esquema/migración y pruebas | No tocar servicios/proveedores/SEO | En ejecución |
| `authorization_privacy` | Roles, DTO públicos, verificación de proveedor, uploads y pruebas | No tocar booking/pagos/SEO server | En ejecución |
| `seo_foundation` | robots, sitemap, cache HTML, noindex/404/metadatos seguros y pruebas | No tocar pagos ni controladores de catálogo | En ejecución |
| Agente principal | Arquitectura, plan, integración, revisión adversarial, pruebas globales y siguientes etapas | Único responsable de aceptar/integrar resultados | En ejecución |

La Etapa 2 se delegará secuencialmente después de integrar Etapa 1 para evitar ediciones concurrentes en reservas. La arquitectura SSR tendrá una revisión específica antes de cambios amplios.

## 7. Definición de terminado por cambio

Un cambio solo se acepta si incluye:

- amenaza o fallo que resuelve;
- prueba positiva y negativa que falla antes y pasa después;
- migración compatible y rollback cuando toca datos;
- autorización y privacidad revisadas para rutas/DTO nuevos;
- logs sin secretos/PII y métrica operativa cuando el flujo es crítico;
- build y suite completa verdes;
- documentación de riesgos residuales;
- evidencia HTTP/renderizada cuando afecta SEO.

## 8. Riesgos que requieren evidencia externa

- contrato, firma y campos exactos de Payku en producción;
- constraints realmente desplegados en PostgreSQL, no solo presentes en `schema.sql`;
- CDN/WAF/rate limits, proxy trust, TLS y cache rules del hosting;
- ACL y capacidad del storage de uploads/KYC;
- backups, RPO/RTO y prueba de restauración;
- alertas, on-call y retención/tamper resistance de logs;
- propiedad/configuración de Search Console, Bing Webmaster y analítica;
- prueba de penetración autenticada antes de tráfico alto.

Estos puntos no se marcarán como cerrados basándose únicamente en revisión estática.
