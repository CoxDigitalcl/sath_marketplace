# Servicios a tu Hogar

Marketplace de servicios y productos para el hogar. El proyecto contiene una aplicación React/Vite y una API Express conectada a PostgreSQL.

## Requisitos

- Node.js y npm.
- PostgreSQL.
- Git LFS, necesario para descargar los videos del sitio.

## Instalación local

```bash
git lfs install
git clone https://github.com/CoxDigitalcl/sath_marketplace.git
cd sath_marketplace
npm ci
```

Copia `server/.env.example` como `server/.env` y configura los valores localmente. Los archivos `.env` están excluidos de Git y nunca deben subirse al repositorio.

Para iniciar el frontend durante el desarrollo:

```bash
npm run dev
```

Para iniciar la API:

```bash
node server/index.js
```

## Validación

```bash
npm test
npm run build
```

## Despliegue desde GitHub

El servidor debe tener Git, Git LFS, Node.js, npm y acceso a PostgreSQL. En la primera instalación:

```bash
git lfs install
git clone https://github.com/CoxDigitalcl/sath_marketplace.git
cd sath_marketplace
npm ci
npm test
npm run build
```

Para actualizar una instalación existente:

```bash
git pull --ff-only origin main
git lfs pull
npm ci
npm test
npm run build
```

Con `NODE_ENV=production`, la API sirve el frontend generado desde `dist`. El proceso de Node debe administrarse con el mecanismo disponible en el servidor, por ejemplo systemd, PM2 o el panel del proveedor.

Antes de habilitar el nuevo procesamiento de pagos se debe aplicar una vez la migración [`server/scripts/migrations/add_payku_payment_integrity.sql`](server/scripts/migrations/add_payku_payment_integrity.sql). El primer despliegue debe mantener `ENABLE_PAYMENT_OUTBOX_WORKER=false` hasta completar la validación controlada de Payku.

Antes de desplegar la moderación diferencial de Servicios se debe aplicar la migración expansiva e idempotente [`server/scripts/migrations/add_service_revisions.sql`](server/scripts/migrations/add_service_revisions.sql):

```bash
npm run db:migrate-service-revisions
```

El esquema debe publicarse antes que el código. La migración conserva las filas de `services`, crea una línea base versionada y prepara una revisión completa para los Servicios legados que ya estaban pendientes. Productos no forma parte de este flujo.

## Seguridad de configuración

- Configura secretos exclusivamente mediante `server/.env` o el gestor de secretos del servidor.
- No subas tokens de Payku, contraseñas PostgreSQL, credenciales SMTP ni claves de facturación.
- Mantén el sitio cerrado y los pagos reales deshabilitados durante la validación previa a la apertura.

El plan técnico y sus avances están documentados en [`docs/IMPLEMENTATION_PLAN_SEO_AEO_SECURITY.md`](docs/IMPLEMENTATION_PLAN_SEO_AEO_SECURITY.md) y [`docs/IMPLEMENTATION_STATUS_2026-08-11_ITERATION_3.md`](docs/IMPLEMENTATION_STATUS_2026-08-11_ITERATION_3.md).
