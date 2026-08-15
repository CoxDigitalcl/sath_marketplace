# Etapa 5C: presupuesto y disciplina de rendimiento

## Objetivo

Mantener las páginas públicas rastreables, rápidas y estables mientras crecen el catálogo y los medios. El gate local evita que una actualización vuelva a introducir un paquete inicial monolítico o videos desproporcionados.

## Presupuestos ejecutables

El comando `npm run performance:budget` evalúa el contenido generado en `dist/` y falla cuando se supera cualquiera de estos límites:

| Recurso | Límite |
| --- | ---: |
| JavaScript inicial, gzip | 180 KiB |
| CSS inicial, gzip | 20 KiB |
| Cada chunk de ruta, gzip | 150 KiB |
| Cada video obligatorio | 6 MiB |
| Videos obligatorios combinados | 10 MiB |

El gate completo es:

```bash
npm run verify:stage5c
```

Este comando genera el build, comprueba el presupuesto y ejecuta la suite serial para respetar los límites de procesos del hosting compartido.

## Objetivos de experiencia reales

Los presupuestos de archivos son controles preventivos; no sustituyen mediciones de usuarios. Después de publicar, se deben revisar por separado las páginas de inicio, categoría, servicio y proveedor, buscando el percentil 75 de Core Web Vitals:

- LCP menor o igual a 2,5 segundos.
- INP menor o igual a 200 milisegundos.
- CLS menor o igual a 0,1.

La evidencia de campo debe obtenerse con PageSpeed Insights/CrUX y Search Console cuando exista tráfico suficiente. Una medición de laboratorio aislada no se presenta como resultado de campo.

## Reglas de implementación

- Las rutas públicas se cargan por demanda con `React.lazy`.
- La navegación descubrible usa enlaces con `href` real, incluso cuando React Router intercepte la transición.
- Las imágenes declaran ancho, alto y decodificación; las que no son críticas usan carga diferida.
- Los videos del inicio no se reproducen automáticamente, usan `preload="none"`, poster y descripción textual.
- Los videos optimizados permanecen bajo control de versiones para que el deploy de cPanel sea reproducible.
- Servicios y proveedores usan un único slug canónico; las variantes antiguas o incorrectas responden con redirección permanente 308.
- Cualquier aumento de presupuesto requiere una decisión explícita y evidencia de que no se puede resolver con división de código, compresión o eliminación de dependencias.

## Verificación de despliegue

Después del pull/build/reinicio en cPanel:

1. Confirmar respuesta 200 en una URL canónica de servicio y proveedor.
2. Confirmar respuesta 308 desde la URL histórica basada sólo en UUID.
3. Confirmar que `sitemap.xml` contiene únicamente las rutas con slug canónico.
4. Confirmar que los dos videos cargan bajo demanda y conservan poster, controles y subtítulos integrados.
5. Ejecutar una medición móvil de laboratorio y registrar cualquier brecha antes de aumentar presupuestos.
