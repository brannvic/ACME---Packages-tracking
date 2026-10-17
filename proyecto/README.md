# ACME - Flujo de paquetes y seguimiento

Segunda etapa del monolito descrito en [el PRD](docs/PRD.md).

## Ejecución local

Requiere Node.js 24 y PostgreSQL. Copia `.env.example` a `.env`, ajusta la conexión y ejecuta:

```powershell
npm ci
npm run build
npm run migration:run
npm start
```

`GET http://localhost:8080/health` comprueba la base. La migración crea tablas, pero no cuentas; la carga de usuarios de demostración llega en la etapa 3.

## Funcionalidad incorporada

- Usuarios: login, logout, roles y sesiones revocables.
- Movimientos: alta de paquetes, escaneos, transiciones, corrección de dirección y cierre de casos en sucursal.
- Reintentos: franjas horarias de Ciudad de México, un intento por día y paso a sucursal tras el tercer fallo.
- Consulta: tracking público sin datos personales y detalle privado del cliente titular.

Todos los endpoints de negocio usan `/api/v1`. Las rutas protegidas requieren `Authorization: Bearer <token>`.

| Método y ruta | Acceso |
|---|---|
| `POST /auth/login` | Público |
| `POST /auth/logout` | Autenticado |
| `POST /paquetes` | Administrador |
| `POST /movimientos/escanear` | Almacenista o repartidor |
| `PATCH /movimientos/:numero_guia/direccion` | Cliente titular |
| `PATCH /paquetes/:numero_guia/caso` | Administrador |
| `GET /reintentos` | Repartidor o administrador |
| `GET /tracking/:numero_guia` | Público |
| `GET /tracking/:numero_guia/detalle` | Cliente titular |

Movimientos y Reintentos se incluyen juntos porque comparten la transacción: historial, estado, intento y programación se confirman o revierten juntos. Los UUID permiten reenviar operaciones sin duplicarlas. Consulta expone proyecciones del estado y del historial.

La migración y las entidades permanecen iguales a la etapa 1. Se registran los tres nuevos módulos en `src/app.module.ts`.
