# Flujos de ACME en Postman

## Importar y ejecutar

1. Levanta el monolito y crea los usuarios de demostración:

   ```sh
   docker compose up --build -d --wait
   docker compose exec app npm run seed:prod
   ```

2. En Postman, pulsa **Import** e importa estos archivos:
   - `ACME-monolito.postman_collection.json`
   - `ACME-reintentos-manual.postman_collection.json`
   - `ACME-local.postman_environment.json`
3. Selecciona **ACME - Local** en el selector de entorno de la esquina superior derecha.
4. Abre **ACME - 01 Monolito - Recorrido completo**. Puedes enviar las peticiones con **Send**, de arriba hacia abajo, o usar **Run collection** con una iteración y todas sus carpetas seleccionadas.
5. Revisa las pruebas de cada respuesta. Los errores intencionales también comprueban el código esperado.

El entorno apunta a `http://localhost:8080`. Si cambiaste el puerto o la contraseña de las cuentas de demo, ajusta `baseUrl` y `contrasenaDemo`. `baseUrl` no debe incluir `/api/v1` ni terminar en `/`.

## Colección principal. 48 peticiones

| Carpeta | Qué demuestra |
|---|---|
| 1 - Arriba y respondiendo | Salud de app y PostgreSQL; login de los cuatro roles |
| 2 - Crear envío y corregir dirección | Creación por administrador, consulta pública y privada, corrección antes de ruta |
| 3 - Del almacén a la entrega | Almacén → centro → ruta → entregado; receptor obligatorio y ventana de dirección |
| 4 - Idempotencia y estado terminal | Reenvío del UUID sin duplicar; conflicto con otro receptor; entrega terminal |
| 5 - Entrega fallida y reintento automático | Otra guía, primer fallo, programación de siguiente visita y rechazo de una salida el mismo día |
| 6 - Privacidad y errores esperados | Proyección pública, permisos y errores 400, 401, 403, 404 y 409 |
| 7 - Cerrar sesiones y comprobar revocación | Logout de los cuatro roles y rechazo del token revocado |

Los scripts guardan tokens e identificadores en el entorno. Las peticiones protegidas ya tienen configurado el rol correspondiente en **Authorization**. No necesitas copiar tokens a mano.

Cada ejecución completa genera dos guías nuevas: `guiaEntrega` termina entregada y `guiaReintentos` queda con su primer intento fallido. También se guardan `fechaReintento` y `franjaReintento`. Si ejecutas con Runner, conserva los valores del entorno al finalizar o copia la guía de la respuesta antes de continuar manualmente.

Los UUID nuevos se generan automáticamente; los reenvíos usan `idCorreccion`, `idEntrega` e `idFallo` para conservar el identificador original. Para repetir toda la demostración, empieza en la carpeta 1. Para reenviar solo una entrega, usa la petición explícita de reenvío de la carpeta 4.

## Colección manual. 16 peticiones

**ACME - 02 Reintentos y sucursal - Manual** continúa `guiaReintentos` del entorno. No ejecutes toda esta colección de una vez: el servidor exige días distintos.

1. Ejecuta la carpeta **1 - Preparar seguimiento** para renovar los tokens y consultar la fecha/franja pendiente. Puedes pegar otra guía válida en `guiaReintentos` si ya tiene un primer fallo.
2. El segundo día, dentro de la franja programada, ejecuta la carpeta **2** en orden: salida, fallo y consulta de la siguiente programación.
3. El tercer día, renueva sesiones con la carpeta **1** y ejecuta la carpeta **3** dentro de la nueva franja. El tercer fallo registra automáticamente `en_sucursal`.
4. Solo entonces ejecuta la carpeta **4**: registrar contacto sin respuesta y decisión del proveedor. El caso se cierra; el paquete permanece en sucursal.

Las franjas son mañana `[09:00, 13:00)` y tarde `[14:00, 18:00)`, hora de Ciudad de México. Si una salida devuelve `409`, detente y consulta `/reintentos`; no registres el fallo de una salida rechazada. No vuelvas a ejecutar la colección principal entre días si quieres conservar la misma guía.

Los tokens duran 12 horas y la colección principal los revoca al terminar, por eso la colección manual comienza renovando las sesiones. Los archivos importables contienen los campos de token vacíos.

Para demostrar los tres días sin esperar en tiempo real, usa `npm run test:integration`: las pruebas controlan el reloj dentro de su propia aplicación de prueba. Postman no tiene un endpoint para cambiar la hora del monolito.
