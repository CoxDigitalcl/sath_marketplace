# Matriz inicial de rutas públicas y privadas

Fecha de baseline: 2026-08-10  
Estado: la clasificación objetivo debe convertirse en una fuente de verdad ejecutable durante la Etapa 5.

## Rutas de interfaz

| Patrón | Clase objetivo | Indexación | Sitemap | Requisito principal |
|---|---|---:|---:|---|
| `/` | pública indexable | sí | sí | SSR, canonical propio y contenido útil sin JS |
| `/categories` | pública indexable | sí | sí | SSR y enlaces `<a href>` a categorías válidas |
| `/categories/:id` | pública indexable condicional | sí, si existe/está publicada | sí | canonical estable; filtros no generan duplicados indexables |
| `/service/:id` | pública indexable condicional | sí, si activo y proveedor verificado | sí | DTO público, SSR, 404/410 si no publicable |
| `/provider/:id` | pública indexable condicional | sí, si verificado/moderado | sí | DTO público sin PII/campos internos y 404/410 si no publicable |
| `/legal/:slug` | pública indexable condicional | sí, para políticas vigentes | sí | SSR, versión/fecha y slug allowlisted |
| `/search` | pública noindex | no | no | `noindex,follow`; canonical controlado; filtros y paginación limitados |
| `/auth` | pública noindex | no | no | no revelar sesión ni errores internos |
| `/login` | pública noindex | no | no | rate limit y sin tokens en URL |
| `/provider/register` | pública noindex | no | no | alta controlada; no equivale a proveedor publicable |
| `/client/register` | pública noindex | no | no | rate limit/antiabuso |
| `/forgot-password` | pública noindex | no | no | respuesta no enumerativa |
| `/reset-password` | tokenizada noindex | no | no | no cache; token de un uso; Referrer-Policy restrictiva |
| `/checkout` | transaccional noindex | no | no | no cache; estado recuperable del servidor |
| `/checkout/success` | transaccional/tokenizada noindex | no | no | no cache; capability o sesión; no PII en query/logs |
| `/style-guide` | interna/noindex | no | no | retirar de producción o proteger explícitamente |
| `/admin` | autenticada admin | no | no | autorización server-side y no cache |
| `/provider/dashboard` | autenticada proveedor | no | no | autorización server-side y no cache |
| `/client/dashboard` | autenticada cliente | no | no | autorización server-side y no cache |
| cualquier otra | inexistente | no | no | 404 real; nunca renderizar Home con 200 |

## Rutas de infraestructura y API

| Patrón | Exposición | Descubrimiento público | Política |
|---|---|---|---|
| `/robots.txt` | pública | sí | `text/plain`, cache corta, enlaza sitemap |
| `/sitemap.xml` | pública | sí | XML, solo canonicals públicos válidos |
| `/api/public/*` | pública según endpoint | no por defecto | allowlist de campos, paginación y rate limit |
| `/api/services/*` | mixta | no | cada ruta declara auth/rol/propiedad; GET público usa DTO seguro |
| `/api/providers/*` | pública según endpoint | no | solo perfiles verificados y DTO público |
| `/api/bookings/*` | privada/tokenizada salvo webhook | nunca | sesión/capability, idempotencia, rate limits; webhook no se publica en sitemap/docs públicas |
| `/api/auth/*` | pública sensible | nunca | rate limits, no cache y errores no enumerativos |
| `/api/provider/*` | privada proveedor | nunca | auth + rol + propiedad/verificación |
| `/api/admin/*` | privada admin | nunca | auth + rol + step-up/auditoría en acciones críticas |
| otras `/api/*` | privada o pública explícita | nunca por defecto | deny by default; inventario endpoint por endpoint |
| `/uploads/*` | mixta | no por defecto | solo media pública aprobada es cacheable; KYC/documentos requieren autorización |

## Reglas de canonical y filtros

- El host canónico sale de configuración de producción validada, no del header `Host` sin confianza.
- Los parámetros de búsqueda, región, comuna, orden y tracking no crean canonicals nuevos por defecto.
- Solo landings geográficas curadas, con contenido y oferta suficiente, pueden ser indexables.
- IDs inexistentes, recursos despublicados y proveedores no verificados no devuelven app shell 200.
- La ausencia del sitemap o una regla de robots no sustituye autenticación ni `noindex`.

## Invariantes que deben automatizarse

1. El sitemap no contiene `/api`, `/admin`, `dashboard`, auth, reset, checkout, success, tokens ni style guide.
2. Un servicio/proveedor no verificado no aparece en sitemap ni HTML público indexable.
3. Rutas privadas entregan `noindex` y controles de cache, incluso antes de hidratar React.
4. Cada URL pública indexable tiene un solo canonical absoluto y estado 200.
5. Cada URL desconocida devuelve 404; una URL retirada permanentemente puede devolver 410.
6. Crawler y navegador reciben el mismo contenido principal para una URL pública.
