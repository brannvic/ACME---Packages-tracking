# ACME - Base y autenticación

Primera etapa del monolito descrito en [el PRD](docs/PRD.md).

## Alcance

NestJS, TypeScript, PostgreSQL y TypeORM; salud, validación y manejo de errores de base de datos. Usuarios incorpora contraseñas con scrypt, login, JWT, roles y sesiones revocables.

Se incluyen desde esta etapa todas las entidades y la migración inicial para conservar un esquema único. Las carpetas Movimientos y Reintentos solo contienen sus entidades; sus endpoints se incorporan en la siguiente etapa.

## Ejecución local

Requiere Node.js 24 y un PostgreSQL accesible con la base y las credenciales de `.env`. Copia `.env.example` a `.env` y ajusta sus valores. En PowerShell:

```powershell
Copy-Item .env.example .env
npm ci
npm run build
npm run migration:run
npm start
```

El endpoint `GET http://localhost:8080/health` comprueba la base de datos.

Rutas disponibles bajo `/api/v1`: `POST /auth/login` y `POST /auth/logout`. El login recibe `{correo, contrasena}`; logout requiere `Authorization: Bearer <token>`.

La migración crea el esquema, pero no cuentas. Para probar login se necesita un usuario provisionado en PostgreSQL con un hash generado por `generarHashContrasena` de `src/usuarios/contrasenas.ts`. La carga automática de cuentas de demostración se añade en la etapa 3.
