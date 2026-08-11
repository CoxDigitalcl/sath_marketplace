# ADR-001: Localizacion y cobertura geografica de servicios

## Status
Accepted

## Date
2026-06-11

## Context
Serviciosatuhogar necesita que clientes y proveedores trabajen con ubicacion geografica de manera explicita.

El cliente debe poder filtrar servicios por region y comuna en los buscadores, entender durante la comparacion si un proveedor cubre su localidad, y recibir una confirmacion final antes de pagar.

El proveedor debe configurar la cobertura territorial de sus servicios. El requerimiento inicial es Chile: primero se selecciona una region y luego una o mas comunas dentro de esa region.

El codigo actual ya tiene `provider_profiles.coverage_area`, pero es un texto plano usado como `location` en listados y detalle. Eso permite mostrar una ubicacion simple, pero no permite filtrar ni validar cobertura con precision.

## Decision
Implementaremos la alternativa A: cobertura por proveedor.

Cada proveedor configurara:

- `coverage_region_code`: codigo estable de region chilena.
- `coverage_region_name`: nombre legible de la region.
- `coverage_communes`: arreglo de comunas atendidas dentro de la region.
- `coverage_area`: texto legible derivado, mantenido por compatibilidad con tarjetas y perfiles existentes.

La busqueda y las paginas de categoria expondran filtros visibles de region y comuna. El checkout pedira o confirmara la comuna del cliente antes del pago y mostrara si el servicio esta disponible para esa localidad.

La configuracion de cobertura vivira inicialmente en el perfil del proveedor, no en cada servicio. Esto evita duplicar trabajo para proveedores y calza con el modelo actual, donde el perfil ya provee la ubicacion de los servicios.

## Configuraciones documentadas

### Configuracion A: cobertura por proveedor, decision aceptada

Uso esperado:

- Proveedores que atienden el mismo territorio para todos o casi todos sus servicios.
- Marketplace en fase inicial, donde la claridad y baja friccion de configuracion importan mas que la granularidad por servicio.
- Servicios locales comunes: mantencion, limpieza, clases presenciales, salud a domicilio, belleza, eventos y similares.

Comportamiento:

- El proveedor elige una region.
- Al elegir region, se muestran solo las comunas de esa region.
- El proveedor selecciona multiples comunas.
- El sistema guarda la seleccion estructurada y genera un resumen legible.
- Los resultados se filtran por region y comuna.
- El checkout valida la comuna elegida contra la cobertura del proveedor.

### Configuracion B: filtro solo en resultados, descartada para este alcance

Uso posible:

- Prototipos rapidos sin validacion de checkout.
- Experiencias donde la ubicacion es solo informativa.

Motivo de descarte:

- No cumple bien el requerimiento UX. El cliente podria descubrir tarde que el servicio no aplica a su comuna.
- No genera suficiente confianza antes del pago.
- Mantiene el riesgo de contrataciones fuera de cobertura.

### Configuracion C: cobertura por servicio, evolucion futura condicionada

Uso esperado:

- Proveedores que ofrecen servicios con territorios realmente distintos.
- Servicios que dependen de rutas, vehiculos, tiempos de traslado o capacidad operativa especifica.
- Proveedores con sucursales, equipos o cuadrillas que atienden zonas diferentes.
- Categorias donde la cobertura de un servicio no se puede inferir desde la cobertura general del proveedor.

Condiciones para migrar o extender hacia C:

- Al menos una porcion relevante de proveedores declara que distintos servicios cubren distintas comunas.
- Soporte o operaciones detecta reservas rechazadas por diferencia de cobertura entre servicios del mismo proveedor.
- Aparecen categorias con logica territorial propia, por ejemplo fletes, urgencias, cuadrillas, rutas o servicios premium por comuna.
- Se necesita pricing o disponibilidad distinta por comuna a nivel de servicio.
- La cobertura por proveedor empieza a ocultar servicios validos o mostrar servicios no disponibles.

Comportamiento futuro:

- Cada servicio podria heredar la cobertura del proveedor por defecto.
- El proveedor podria activar "Cobertura especifica para este servicio".
- Al activarla, el servicio tendria su propia region y comunas.
- La busqueda priorizaria la cobertura del servicio cuando exista, y usaria la del proveedor como fallback.
- El checkout validaria contra la cobertura efectiva del servicio.

## Alternatives Considered

### Alternativa A: cobertura por proveedor

Pros:

- Menor friccion para proveedores.
- Encaja con el modelo actual de `provider_profiles`.
- Hace posible filtrar y validar cobertura sin rehacer el formulario de servicios.
- Mantiene una sola fuente de verdad inicial.

Cons:

- Menos precisa para proveedores con servicios de coberturas distintas.
- Puede requerir una extension futura si la operacion crece en complejidad territorial.

### Alternativa B: filtro solo en resultados

Pros:

- Implementacion mas pequena.
- Cambia poco el backend.

Cons:

- UX debil para el requerimiento principal.
- No confirma disponibilidad antes del pago.
- Mantiene datos de cobertura ambiguos.

### Alternativa C: cobertura por servicio

Pros:

- Maxima precision por servicio.
- Permite pricing, disponibilidad y reglas territoriales por oferta.
- Escala mejor para operaciones complejas.

Cons:

- Mayor carga de configuracion.
- Mayor superficie de UI en `ServiceForm`.
- Requiere reglas de herencia y fallback para no duplicar datos.
- Mas dificil de implementar y testear como primer paso.

## Consequences

- El primer release debe agregar datos estructurados de cobertura al perfil proveedor.
- `coverage_area` no se elimina. Se mantiene como compatibilidad y resumen legible.
- Las respuestas publicas de servicios deben incluir region y comunas de cobertura.
- La busqueda debe aceptar parametros de region y comuna sin romper `category` ni `q`.
- Checkout debe bloquear o advertir antes del pago si la comuna elegida no esta cubierta.
- La opcion C queda documentada como evolucion, no como deuda olvidada.

## Migration Path Toward C

Si se cumplen las condiciones para C, no se reemplaza A de golpe. Se extiende:

1. Agregar campos de cobertura opcional en `services`.
2. Mantener cobertura de proveedor como default.
3. Calcular una "cobertura efectiva" por servicio:
   - cobertura del servicio si existe;
   - cobertura del proveedor si el servicio no define una propia.
4. Actualizar filtros y checkout para usar cobertura efectiva.
5. Agregar una UI opt-in en el formulario de servicio: "Usar cobertura distinta para este servicio".

Esta ruta evita romper proveedores existentes y permite migrar servicio por servicio.
