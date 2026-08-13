# Etapa 4B: sesiones, recuperacion y acciones administrativas

## Alcance implementado

- Los tokens de acceso son tipados, versionados y expiran por defecto en 2 horas.
- El navegador conserva credenciales en `sessionStorage`, no en almacenamiento persistente.
- Cerrar sesion, cambiar/restablecer contrasena, bloquear una cuenta o cambiar su rol invalida sesiones previas mediante `token_version`.
- La recuperacion usa tokens opacos almacenados solo como SHA-256, con expiracion y consumo atomico de un solo uso.
- Las acciones administrativas criticas exigen una credencial de reautenticacion (`X-Admin-Step-Up`) valida por 5 minutos.
- La suplantacion administrativa expira a los 15 minutos, queda auditada y muestra un aviso persistente en la interfaz.
- Los errores internos usan identificadores de correlacion y respuestas genericas en produccion; los logs evitan URL completas, cuerpos y datos personales conocidos.

## Migracion

Ejecutar una sola vez antes de reiniciar la aplicacion:

```bash
npm run security:migrate-sessions
```

La migracion es idempotente y crea/actualiza:

- columnas de control de sesion y recuperacion en `users`;
- `password_reset_sessions`;
- `admin_security_events`;
- trigger de revocacion al cambiar contrasena, rol, bloqueo o exigencia de cambio.

## Variables

`JWT_SECRET` debe ser un secreto largo y exclusivo de produccion. `JWT_ACCESS_EXPIRES_IN` es opcional y usa `2h` por defecto.

## Impacto de despliegue

Los tokens emitidos antes de 4B no tienen tipo ni version y dejaran de ser validos. Los usuarios con una sesion abierta deberan iniciar sesion nuevamente.

## Validacion posterior

1. Comprobar `/api/health` y `/api/health/db`.
2. Confirmar inicio y cierre de sesion.
3. Solicitar recuperacion, usar el enlace una vez y confirmar que el segundo intento sea rechazado.
4. Confirmar que bloquear, forzar cambio, anonimizar y suplantar exijan reautenticacion administrativa.
5. Verificar que la suplantacion muestre el aviso y permita regresar a la cuenta administradora.
6. Revisar que los nuevos eventos aparezcan en `admin_security_events` sin tokens ni contrasenas.

## Riesgo residual aceptado

4B mantiene Bearer tokens de acceso para compatibilidad. Una evolucion posterior puede migrar a cookies `HttpOnly`, `Secure` y `SameSite` con refresh tokens rotativos, lo que requerira proteccion CSRF y un despliegue coordinado de cliente y API.
