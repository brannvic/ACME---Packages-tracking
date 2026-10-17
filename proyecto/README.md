# ACME - Rastreo y entrega de paquetes

Aquí se presenta la primera versión del sistema descrito en [el PRD](docs/PRD.md). Se trata de una aplicación NodeJS + NestJS que contiene Usuarios, Movimientos, Reintentos y Consulta; todos trabajan sobre PostgreSQL.  
Equipo: **ACME** - Integrantes: **@onofrela, @Ur182, @grecia-i y @brannvic**.

## Levantar con Docker

Para levantar el monolito, se necesita Docker Desktop encendido con contenedores Linux y Docker Compose. La imagen compila TypeScript; no se necesita instalar Node para levantar la aplicación.

```sh
docker compose up --build -d --wait
docker compose ps
docker compose exec app npm run seed:prod
docker compose exec app npm run demo
```

La API escucha en `http://localhost:8080`. Para comprobar, se puede mandar una petición `GET /health`. Debe devolver  `{"estado":"UP","baseDatos":"UP"}` cuando PostgreSQL responde. El primer arranque descarga imágenes y dependencias. Si algo falla, se puede revisar con el comando `docker compose logs app db` para ver en qué falló.

Compose usa valores locales de desarrollo. Para este caso, se puede copiar `.env.example` a `.env` y cambiar puerto, contraseña de base, secreto JWT y contraseña de demostración antes del primer arranque. `seed` crea las cuentas que falten y conserva las existentes; no cambia sus contraseñas al ejecutarse otra vez.

| Rol | Correo | Contraseña inicial por defecto |
|---|---|---|
| Administrador | `administrador@acme.test` | `AcmeDemo2026!` |
| Cliente | `cliente@acme.test` | `AcmeDemo2026!` |
| Almacenista | `almacenista@acme.test` | `AcmeDemo2026!` |
| Repartidor | `repartidor@acme.test` | `AcmeDemo2026!` |

Para detener conservando los datos:

```sh
docker compose down
```

El volumen `acme_datos` conserva el PostgreSQL. No se recomienda utilizar `down -v` si quieres preservar los paquetes.

## Recorrido y endpoints

`npm run demo` inicia sesión con los cuatro roles, crea una guía nueva, corrige la dirección, registra almacén, centro y salida a ruta, entrega con receptor y consulta el resultado. Verifica reenvíos sin duplicados, rechazo de una dirección fuera de ventana y revocación al cerrar sesión. Sale con código distinto de cero si algo falla. Se puede repetir: genera una guía distinta cada vez.

Todos los endpoints de negocio empiezan con `/api/v1`. Envía JSON y, para las rutas protegidas, `Authorization: Bearer <token>`.

| Método y ruta | Operación y acceso |
|---|---|
| `POST /auth/login` | `{correo, contrasena}` → `{token, venceEn, usuario}` |
| `POST /auth/logout` | Revoca la sesión del token actual |
| `POST /paquetes` | Administrador: `{numeroGuia, clienteId, destinatario, direccion}` |
| `POST /movimientos/escanear` | Almacenista o repartidor: `{id, numeroGuia, tipo, ubicacion?, motivo?, receptor?}` |
| `GET /tracking/:numero_guia` | Público: guía, estado y línea de tiempo sin datos personales |
| `GET /tracking/:numero_guia/detalle` | Cliente titular: datos completos e historial |
| `PATCH /movimientos/:numero_guia/direccion` | Cliente titular: `{id, direccion}` |
| `GET /reintentos` | Repartidor o administrador: programación pendiente |
| `PATCH /paquetes/:numero_guia/caso` | Administrador: `{clienteRespondio, notasContacto, decisionProveedor?}` |

La creación del envío representa una orden ya confirmada por el proveedor. Se obtiene el `clienteId` de la respuesta de login del cliente. La guía debe contener entre 6 y 40 caracteres: letras mayúsculas, números y guiones. `id` es un UUID generado por quien llama y conservado al reintentar.

Ejemplo de login:

```sh
curl -i http://localhost:8080/api/v1/auth/login -H "Content-Type: application/json" --data '{"correo":"cliente@acme.test","contrasena":"AcmeDemo2026!"}'
```

Para Windows PowerShell se debe usar `curl.exe`, o ejecutar la demostración con Docker para evitar diferencias de comillas entre shells.

### Flujo permitido

```text
creado → en_almacen → en_centro_distribucion → en_ruta → entregado
                                                ↓
                                          intento_fallido
                                                ↓
                                   siguiente día, distinta franja
                                                ↓
                                             en_ruta
                                                ↓
                              tercer intento fallido → en_sucursal
```

El almacenista registra `ingreso_almacen` e `ingreso_centro_distribucion`, con `ubicacion` obligatoria. Puede registrar varias paradas dentro de la misma categoría. El repartidor registra `salida_ruta`, `intento_fallido` con `motivo`, y `entregado` con `receptor`.

La primera salida puede registrarse a cualquier hora: se clasifica como mañana antes de las 14:00 y tarde a partir de las 14:00. Los **reintentos** sí deben salir en su franja: mañana `[09:00, 13:00)` o tarde `[14:00, 18:00)`, hora de Ciudad de México. Se admite uno por día. Si no se realiza el día programado, sigue pendiente y puede salir otro día posterior en la misma franja. No se consumen intentos por el simple paso del tiempo. Tras tres intentos fallidos en días distintos, el sistema registra automáticamente el paso a sucursal.

La programación se crea junto con el fallo y se consume junto con la siguiente salida. No hay un proceso que simule visitas. La dirección queda bloqueada desde la primera salida a ruta, incluso después de un intento fallido. Se eligió esta lectura estricta del PRD: por ello no existen reintentos previos a una corrección aceptada.

En sucursal se registra el contacto. Si el cliente no respondió, el administrador puede registrar `decisionProveedor: "regresar"` o `"no_regresar"` y cerrar el caso, en la misma petición o en una posterior. Ambas requieren notas y falta de respuesta. El estado permanece `en_sucursal`: el sistema no ejecuta devoluciones. Si el cliente respondió, queda registrado el contacto y el caso continúa abierto.

### Respuestas y consistencia

- Alta de envío o nuevo movimiento/corrección: `201`; reenvío idéntico de UUID: `200`. La respuesta de movimiento es `{movimiento, duplicado}`. Reutilizar el UUID con otros datos devuelve `409`.
- `400`: datos inválidos; `401`: token ausente, inválido, vencido o revocado; `403`: rol o titular incorrecto; `404`: guía inexistente; `409`: transición incompatible o conflicto concurrente; `503`: operación de base no disponible.
- El paquete se bloquea mientras se modifica. Historial, estado, intento y programación se confirman juntos o se revierten juntos. Las consultas leen una versión consistente y ordenan el historial por secuencia de inserción.
- La hora proviene del servidor. Los tokens duran 12 horas; cada petición protegida comprueba su sesión en PostgreSQL. Si la base falla, no se puede autorizar ni confirmar operaciones. No se promete funcionamiento offline en esta etapa.

## Cómo leer el código

Para comprender cómo hicimos el monolito, se recomienda empezar por `src/main.ts`, de ahí se sigue a un controlador y luego al servicio correspondiente:

- **Usuarios:** login, hashes de contraseña con scrypt, token firmado y sesiones revocables.
- **Movimientos:** creación, transiciones, dirección y cierre de caso. `registrarMovimiento` muestra el recorrido completo de escritura.
- **Reintentos:** registra intentos y programa la siguiente visita dentro de la transacción recibida de Movimientos.
- **Consulta:** dos proyecciones explícitas: pública y privada del titular.

TypeORM accede directamente a las entidades. No hay repositorios genéricos, buses de eventos ni llamadas HTTP entre módulos. El esquema está en una migración; `synchronize` está desactivado. Docker aplica las migraciones antes de iniciar el servidor.

## Arquitectura para la defensa

| Pregunta | Respuesta en `01-monolito` |
|---|---|
| ¿Dónde está la entrada/gateway? | El servidor HTTP de NestJS recibe todas las rutas en el puerto 8080. No hay gateway separado. |
| ¿Dónde está el directorio? | DNS interno de Compose: la aplicación resuelve `db` por nombre. |
| ¿Cómo se balancea? | Hay una instancia de aplicación; todavía no hay balanceador. |
| ¿Dónde están los datos? | Una base PostgreSQL con volumen persistente y transacciones locales. |
| ¿Cómo se comunican los módulos? | Llamadas de funciones dentro del mismo proceso. |
| ¿Qué pasa si algo falla? | Un error revierte la transacción; los UUID hacen seguro reenviar una operación cuya respuesta se perdió. Si cae app o db, el monolito deja de atender hasta recuperarse. |
