# Localizacion de servicios: diseno aprobado

## Estado
Aprobado para planificacion e implementacion.

## Fecha
2026-06-11

## Decision de producto
Se implementara la alternativa A: cobertura geografica por proveedor.

La alternativa C, cobertura por servicio, queda documentada como evolucion futura cuando existan condiciones operativas que justifiquen mayor granularidad. La decision completa vive en `docs/decisions/ADR-001-localizacion-cobertura-servicios.md`.

## Objetivo UX
El cliente debe entender desde la busqueda que puede filtrar por ubicacion geografica, y debe recibir una confirmacion clara antes de pagar:

- "Este servicio esta disponible en tu comuna".
- "Este servicio no cubre la comuna seleccionada".
- "Selecciona tu comuna para confirmar cobertura antes de pagar".

El proveedor debe configurar su cobertura con una experiencia directa:

- Selecciona region.
- El sistema muestra comunas de esa region.
- Selecciona multiples comunas.
- Guarda cambios.

## Alcance funcional

### Usuario cliente

Puntos afectados:

- Home y buscadores publicos.
- Pagina de resultados.
- Pagina de categoria.
- Detalle de servicio.
- Checkout.

Comportamiento:

- El buscador debe hacer visible la ubicacion, idealmente con region y comuna.
- Los filtros deben permitir region y comuna.
- Si se elige una comuna, los resultados deben mostrar servicios disponibles para esa comuna.
- Las tarjetas o el detalle deben mostrar un indicio simple de cobertura.
- En checkout, antes de pagar, el cliente debe confirmar la comuna del servicio.
- Si la comuna esta cubierta, mostrar confirmacion positiva.
- Si no esta cubierta, bloquear el pago o pedir cambiar comuna/servicio.

### Usuario proveedor

Punto afectado:

- Panel proveedor, vista Perfil de Tienda y KYC.

Comportamiento:

- Agregar bloque "Cobertura del servicio".
- Selector de region chilena.
- Selector multiple de comunas dependiente de la region.
- Si el proveedor cambia region, limpiar comunas incompatibles.
- Mostrar resumen de comunas seleccionadas.
- Guardar cobertura junto al perfil.

### Backend/API

Puntos afectados:

- `provider_profiles`.
- `POST /api/provider/profile`.
- `GET /api/provider/profile`.
- `GET /api/services`.
- `GET /api/services/:id`.
- Posiblemente `GET /api/services/featured` para mostrar datos de cobertura en carruseles.

Contrato esperado:

```json
{
  "coverage_region_code": "RM",
  "coverage_region_name": "Region Metropolitana de Santiago",
  "coverage_communes": ["Santiago", "Providencia", "Las Condes"],
  "coverage_area": "Region Metropolitana de Santiago: Santiago, Providencia, Las Condes"
}
```

Parametros de busqueda esperados:

```text
GET /api/services?region=RM&commune=Providencia
GET /api/services?category=hogar&region=RM&commune=Providencia
GET /api/services?q=limpieza&region=RM&commune=Providencia
```

Regla de compatibilidad:

- `coverage_area` sigue existiendo para UI antigua y perfiles.
- La nueva logica debe preferir `coverage_region_code` y `coverage_communes`.
- Si un proveedor aun no tiene cobertura estructurada, se puede mostrar `coverage_area`, pero no debe prometer disponibilidad precisa.

## Modelo de datos

Campos nuevos propuestos en `provider_profiles`:

- `coverage_region_code VARCHAR(10)`.
- `coverage_region_name VARCHAR(120)`.
- `coverage_communes JSONB DEFAULT '[]'::jsonb`.

Campo existente:

- `coverage_area VARCHAR(255)` se mantiene como resumen legible.

Razon:

- JSONB permite guardar una lista simple de comunas sin crear tablas nuevas en el primer release.
- El codigo de region mantiene filtros estables aunque cambie el texto visible.
- El nombre de region permite respuestas y UIs legibles sin recalcular siempre desde frontend.

## Datos territoriales de Chile

Crear un modulo compartido frontend para regiones y comunas chilenas.

El backend debe validar en frontera que:

- La region existe.
- Las comunas enviadas pertenecen a esa region.
- La lista de comunas no tenga duplicados.

Para el primer release, la fuente puede ser una constante local versionada en el repo. Mas adelante se puede extraer a tabla si se requiere administracion dinamica.

## Estados UX importantes

### Proveedor sin cobertura configurada

Panel proveedor:

- Mostrar llamado de accion.
- Indicar que sus servicios pueden aparecer con cobertura no confirmada.

Busqueda:

- No prometer "cubre tu comuna".
- Usar texto neutral: "Cobertura por confirmar".

Checkout:

- Mostrar advertencia y bloquear pago si no hay cobertura estructurada, salvo que el negocio decida permitir reserva bajo confirmacion manual.

### Proveedor con cobertura configurada

Busqueda:

- Si coincide comuna, mostrar "Cubre tu comuna".
- Si no coincide, no mostrar el servicio cuando el filtro por comuna esta activo.

Checkout:

- Si coincide, mostrar confirmacion.
- Si no coincide, bloquear pago.

### Servicio online o remoto

Decision inicial:

- Mantener el filtro geografico para servicios presenciales.
- Para servicios online, permitir que aparezcan aunque no haya comuna si `type` es `online`.
- En checkout, la cobertura geografica no debe bloquear servicios online.

Esta regla debe revisarse al implementar para no ocultar servicios remotos utiles.

## Configuraciones

### Configuracion A: cobertura por proveedor

Es la configuracion inicial aprobada.

Datos:

- Perfil proveedor define una region y multiples comunas.
- Todos los servicios presenciales del proveedor heredan esa cobertura.

Ventajas:

- Simple para el proveedor.
- Clara para cliente.
- Menor cambio en formularios existentes.

Limitacion:

- No distingue servicios del mismo proveedor con coberturas distintas.

### Configuracion B: filtro informativo

No se implementa en este alcance.

Datos:

- Ubicacion solo como texto o filtro local en frontend.

Motivo:

- No entrega suficiente certeza al checkout.

### Configuracion C: cobertura por servicio

No se implementa ahora. Se documenta como evolucion.

Datos futuros:

- Cada servicio puede heredar la cobertura del proveedor.
- Cada servicio puede sobrescribir region y comunas.

Gatillos para implementar C:

- Proveedores con servicios que cubren zonas distintas.
- Rechazos de reservas por diferencia territorial entre servicios.
- Necesidad de precio, disponibilidad o rutas por comuna a nivel de servicio.
- Categorias como fletes o cuadrillas requieren cobertura propia.

## Plan de validacion esperado

Pruebas unitarias o de servicio:

- Normalizar cobertura valida.
- Rechazar comuna que no pertenece a la region.
- Filtrar servicios por `region` y `commune`.
- No bloquear servicios `online` por comuna.

Pruebas de UI:

- ProviderProfile permite seleccionar region y comunas multiples.
- SearchResultsPage muestra filtros de region/comuna.
- CategoryDetailPage permite filtrar por comuna.
- Checkout confirma o bloquea disponibilidad territorial antes del pago.

## Fuera de alcance inicial

- Cobertura por multiples regiones en un mismo proveedor.
- Poligonos, mapas o geocoding por direccion exacta.
- Pricing por comuna.
- Disponibilidad por comuna.
- Cobertura por servicio, salvo documentacion y ruta futura.

## Notas de implementacion

- La implementacion debe ser incremental y compatible con datos existentes.
- Evitar romper tarjetas que leen `location`.
- Evitar que el filtro geografico quede escondido. Debe ser visible en buscadores y filtros.
- La copia debe usar lenguaje directo: "Region", "Comuna", "Cubre tu comuna", "Confirma la comuna del servicio".
