# PRD · Sistema de rastreo y entrega de paquetes

Equipo: ACME · Integrantes: @onofrela, @Ur182, @grecia-i, @brannvic · Fecha: 2026-10-10

## 1. Problema y usuarios

Quien compra en línea no sabe con claridad dónde está su paquete, no tiene alternativas si no está en casa y, cuando una entrega falla, el paquete puede quedarse en el limbo: el repartidor pasa una vez, no encuentra a nadie y no regresa. La única salida hoy es un servicio al cliente lento.

**Usuarios.** El sistema lo opera la paquetería:

- **Repartidor:** registra cada parada y el resultado de la entrega, incluso sin conexión.
- **Almacenista:** registra movimientos en almacenes y centros de distribución.
- **Administrador:** escala los casos que agotan sus reintentos y registra la decisión del proveedor.
- **Cliente titular de la compra:** consulta el estado de su paquete y corrige la dirección de destino.
- **Proveedor:** confirma la orden, con lo que se crea el envío.

## 2. Por qué es un sistema distribuido

1. **Aislar fallas.** Los movimientos se reparten en 4 shards por hash del número de guía. Si un shard cae, solo se afecta ~25% de los paquetes y el resto sigue operando.
2. **Escrituras masivas.** Una paquetería genera muchísimos escaneos por segundo, y una base relacional en un solo nodo escala mal con escrituras concurrentes. Repartir por guía distribuye esas inserciones.
3. **Picos de carga.** En Buen Fin, Navidad y Día de las Madres, la consulta del estado recibe lecturas masivas, así que se replica y se apoya en caché.
4. **Disponibilidad en la última milla.** El repartidor tiene que poder registrar una entrega aunque falle la red o algún servicio.

El objeto central del negocio es **el paquete**, no la geografía. La red física es jerárquica (almacén → centro de distribución → estación de última milla), pero los datos no se parten por zona.

## 3. Objetivos y lo que no vamos a hacer

**El corazón (3 funcionalidades):**

1. **Registrar movimientos:** desde que el proveedor confirma la orden, pasando por almacén, centro de distribución y última milla, hasta la entrega (aun sin conexión, indicando quién recibió). Un intento fallido y una corrección de dirección también son movimientos.
2. **Reintentos de entregas fallidas:** a distintas horas durante 3 días. Después el paquete pasa a sucursal y un administrador contacta al cliente; si el cliente no responde, el proveedor decide si se le regresa el paquete.
3. **Consultar el estado:** una vista ligera por número de guía sin sesión y una vista detallada con sesión, que incluye la corrección de dirección.

Usuarios (login y roles) entra como servicio de soporte, necesario para la corrección de dirección y para identificar quién registra cada movimiento.

**Lo que NO vamos a hacer:**

- Que el cliente elija su horario de entrega.
- Personas autorizadas a recibir.
- Facturación.
- Cálculo automático de rutas: las rutas entre nodos están predefinidas.
- Notificaciones automáticas: el cliente se entera por su línea de tiempo y el contacto lo hace una persona.
- Devoluciones como servicio propio: solo se registra la decisión del proveedor.
- Rastreo GPS, coordenadas en el escaneo, escaneo con cámara, reconocimiento de imágenes y fotos de fachada (en producción las fotos irían a un almacenamiento como S3).
- Despliegue en varias máquinas: las zonas se simulan con contenedores en una sola máquina.

## 4. El requisito que perseguimos y lo que dejamos atrás

**Perseguimos disponibilidad** en Movimientos y Consulta. El cliente siempre ve un estado claro y el repartidor siempre puede registrar.

**Sacrificamos el tiempo real.** El estado puede llegar atrasado, pero nunca debe ser ambiguo:

- **"Entregado" es terminal** y exige indicar quién recibió.
- **Un intento fallido nunca es terminal:** genera un reintento, o el paso a sucursal.
- **Los conflictos se resuelven por tipo de evento y hora.** Si el cliente cambió algo antes de la entrega, gana el cliente; si fue después, gana la entrega.
- **La hora no sale del reloj del celular.** Se calcula con la última hora conocida del servidor más un cronómetro monótono; si no cuadra con el reloj del dispositivo, el evento se marca como sospechoso.

**Excepción: en Usuarios perseguimos consistencia.** Es un tema de seguridad: no se puede entrar con una contraseña vieja. Las escrituras se confirman por quórum. Si no hay mayoría, nadie puede registrarse ni iniciar sesión, pero los tokens ya emitidos siguen sirviendo. Preferimos negar el servicio a abrir una brecha de seguridad.

## 5. Historias de usuario

### Funcionalidad 1 · Registrar movimientos

*Como repartidor quiero escanear un paquete en cada parada y registrar el resultado (en reparto, entregado o intento fallido con su motivo) desde mi web app, incluso sin conexión, para que el estado del paquete quede en la línea de tiempo, nunca se pierda un movimiento y el cliente siempre vea algo claro.*

1. **Token:** dado un escaneo sin token, con un token vencido o con uno revocado, el sistema lo rechaza (401). Dado un "entregado" cuando no se puede verificar la revocación contra Usuarios, el movimiento queda como "pendiente de confirmación" y no como terminal.
2. **Idempotencia:** dado un escaneo con un UUID que ya existe, el sistema responde 200 y no crea un registro nuevo.
3. **Offline y lote:** dado que la PWA está sin conexión, el escaneo se guarda localmente. Al recuperar la señal se envían todos en un solo lote y todos aparecen en la línea de tiempo.
4. **Respuesta perdida:** dado un lote cuya respuesta no llega en 30 s, la app reintenta a los 2, 4 y 8 s (con jitter). Después de 3 fallos espera a que cambie la red, y al final no hay duplicados.
5. **Hora confiable:** dado un celular con el reloj alterado, la hora del escaneo se calcula con la última hora del servidor más el cronómetro, y si no cuadra el evento se marca como sospechoso.
6. **Quién recibió:** dado un "entregado" sin indicar quién recibió, el sistema responde 400.

### Funcionalidad 2 · Reintentos de entregas fallidas

*Como repartidor quiero que el sistema programe automáticamente un nuevo intento cuando registro una entrega fallida, en una franja horaria distinta y con la dirección vigente, para que el paquete no se quede en el limbo y no tenga que repetir la misma visita a la misma hora.*

(El administrador escala y cierra el caso. El cliente es beneficiario, no usuario de esta funcionalidad.)

1. **Reintento automático:** dado un movimiento de "intento fallido" con motivo, Reintentos programa un nuevo intento en una franja horaria distinta a la del intento anterior.
2. **Dirección vigente:** dado un paquete cuya dirección corrigió el cliente antes de "salió a ruta", el intento programado para la dirección vieja se cancela y el siguiente usa la nueva.
3. **Nunca terminal:** dado un intento fallido, el paquete nunca pasa a un estado final.
4. **Sin duplicados:** dado el mismo evento de intento fallido entregado dos veces por la cola, solo existe un reintento programado.
5. **Escalamiento:** dados 3 días con intentos fallidos, el paquete pasa a "en sucursal" y queda pendiente de contacto por parte de un administrador.
6. **Cierre:** dado un paquete en sucursal sin respuesta del cliente, el administrador registra la decisión del proveedor (regresarlo o no) y el caso se cierra.

### Funcionalidad 3 · Consultar el estado

*Como cliente que compró en línea quiero consultar el estado de mi paquete con solo el número de guía y, si ya inicié sesión, ver el detalle completo y corregir la dirección de destino antes de que salga a ruta, para saber dónde está sin incertidumbre y evitar que una entrega falle por datos incorrectos.*

1. **Vista ligera:** dado un número de guía válido, sin sesión, se devuelve la línea de tiempo sin nombre ni dirección. Dada una guía inexistente, se responde 404.
2. **Respaldo:** dado el circuit breaker abierto, una guía que está en Redis devuelve el último estado conocido con un aviso de que puede estar desactualizado, y una que no está devuelve 503.
3. **Vista detallada:** dado un usuario con sesión que no es el titular de la guía, se rechaza (403). Dado el titular, ve el detalle completo.
4. **Corrección con ventana:** dado un paquete que ya "salió a ruta", la corrección se rechaza. Dado uno que todavía no sale, se acepta y se registra como movimiento.
5. **Propagación:** dada una corrección aceptada, Reintentos cancela el intento a la dirección vieja, la PWA del repartidor recibe la nueva dirección al sincronizar y la vista del cliente muestra el cambio.
6. **Sin duplicados:** dada la misma corrección enviada dos veces con el mismo identificador, solo existe un movimiento y un evento.

## 6. Del monolito a los servicios

**Monolito (`01-monolito`), con una sola base:**

| Módulo | Responsabilidad | Tablas |
|---|---|---|
| Usuarios | Login y roles (cliente, repartidor, almacenista, administrador) | `usuarios` |
| Movimientos | Cada parada del paquete (qué, dónde, cuándo, quién), incluidos los intentos fallidos con motivo y la corrección de dirección | `paquetes`, `historial_movimientos` |
| Reintentos | Programa intentos a distintas horas durante 3 días, luego sucursal y contacto, y registra la decisión del proveedor | `intentos_entrega`, `programacion_reintentos` |
| Consulta | Vista ligera por guía (sin sesión) y vista detallada (con sesión) | solo lectura |

**Servicios resultantes y dueño de cada dato:**

| Servicio | Dueño de | Cómo se comunica |
|---|---|---|
| Usuarios | `usuarios` y roles | Emite tokens firmados de jornada completa; los demás servicios los verifican localmente. Atiende la verificación síncrona de revocación |
| Movimientos | `paquetes` (incluida la dirección de destino vigente), `historial_movimientos`, `outbox` | Escribe el movimiento y el evento en la misma transacción; un proceso publica el outbox en RabbitMQ |
| Reintentos | `intentos_entrega`, `programacion_reintentos` | Consume eventos de forma idempotente; sin ruta pública |
| Consulta | Su propia copia de lectura (MongoDB) y el caché de paquetes calientes (Redis) | Consume eventos de forma idempotente; al procesarlos actualiza MongoDB y Redis |

**Plan de ramas:** `01-monolito` → `02-usuarios` → `03-movimientos` → `04-consulta` → `05-reintentos`

- **Usuarios** va primero: es la puerta de entrada y centraliza la autorización.
- **Movimientos** sigue: es la fuente de verdad y el productor de eventos. Desde esta rama ya se necesitan el outbox y RabbitMQ, aunque los consumidores sigan dentro del monolito.
- **Consulta** después: es un consumidor puro y la primera ventana del cliente.
- **Reintentos** al final: es la regla de negocio más compleja y depende de los anteriores.

## 7. Dónde vive cada pieza

| Pieza | Dónde vive | Por qué | Qué pasa si falla |
|---|---|---|---|
| API gateway | 3 copias detrás de un Nginx (el único con puerto publicado). Rutas: `/api/v1/auth/*` (login, logout), `/api/v1/movimientos/*` (escanear, sincronizar, `/:numero_guia/direccion`), `GET /api/v1/tracking/:numero_guia`, `GET /api/v1/tracking/:numero_guia/detalle` | Una sola puerta; Reintentos no se expone | Nginx reparte entre las copias vivas. Si cae todo, el repartidor sigue trabajando offline y sincroniza después. En producción habría varios balanceadores detrás de un DNS externo (p. ej. Cloudflare); en el proyecto, el Nginx único es una limitación declarada |
| Directorio / DNS | DNS interno de Docker Compose, con nombres de servicio fijos | Sencillo; las zonas se simulan en una sola máquina | Si cae el daemon de Docker, cae todo (limitación declarada; en producción serían máquinas separadas con otro mecanismo de descubrimiento) |
| Balanceo | Nginx → copias del gateway; gateway → copias de Consulta (resueltas con el DNS de Docker) | Consulta recibe las lecturas masivas; el gateway es el cuello de botella de entrada | Si una copia de Consulta falla, el gateway reintenta en otra copia viva |
| Datos (tipo de base, réplicas, particiones) | **Movimientos:** PostgreSQL, 4 shards por hash del número de guía. **Usuarios:** PostgreSQL replicado completo por región, con escrituras por quórum. **Consulta:** MongoDB + Redis en una red compartida con el gateway (lectura). **Reintentos:** MongoDB | Movimientos: transacciones para el outbox, llaves foráneas y escrituras repartidas; la guía es inmutable y el paquete nunca cambia de shard. Usuarios: datos estructurados y consistencia por seguridad. Consulta: documentos listos para leer rápido. Reintentos: datos de forma variable | Shard caído: ~25% de los paquetes afectados, el repartidor guarda offline y reintenta. Sin quórum en Usuarios: no hay login ni registro, pero los tokens vigentes siguen sirviendo |
| Operaciones entre servicios | Eventos con outbox y RabbitMQ; saga con compensación | Ningún servicio depende de otro en línea; Movimientos no conoce a sus consumidores | El cambio de dirección solo se acepta antes de "salió a ruta". Si se cuela una entrega a la dirección vieja (repartidor sin señal), ese "entregado" se rechaza, el paquete pasa a "entrega errónea" y se gestiona su recuperación |
| Manejo de fallas | **App:** UUID por escaneo, timeout de 30 s, 3 reintentos (2/4/8 s con jitter), luego espera a que cambie la red. **Gateway:** circuit breaker hacia Consulta (se abre con ≥50% de fallas en las últimas 100 peticiones, contando 500, 502 y timeouts de más de 2 s; 1 min abierto; prueba con 5% del tráfico) con respaldo en Redis. **Servicios:** consumidores idempotentes; un servicio que se recupera procesa la cola antes de abrir su API | No duplicar, no saturar, no dejar al cliente sin información | Duplicado → `200 OK` sin guardar. Circuito abierto → último estado desde Redis con aviso, o 503 si la guía no está en caché. RabbitMQ caído → nada se pierde, solo se atrasa (el outbox acumula, Consulta muestra el último estado, Reintentos se pausa) |

**Seguridad de sesión:**

- **Tokens:** firmados, de jornada completa; cada servicio los verifica localmente.
- **PIN en la PWA:** se pide un PIN local de 4 dígitos cada cierto tiempo. Si no coincide, la app se bloquea aunque el token siga vigente.
- **Revocación por eventos:** el logout y el cambio de contraseña publican un evento de sesión terminada, y cada servicio mantiene su lista de tokens revocados.
- **Revocación síncrona:** como la revocación por eventos depende de RabbitMQ, las operaciones sensibles ("entregado" y cambio de dirección) además consultan a Usuarios. Si no se puede verificar, el movimiento queda pendiente de confirmación.

## 8. Stack y cómo se levanta

| Pieza | Tecnología | Por qué |
|---|---|---|
| Servicios | Node.js + TypeScript + NestJS (TypeORM) | Familiaridad del equipo; módulos aislados con un mismo estándar; conectores nativos para brokers y bases |
| Cola de eventos | RabbitMQ | Persistencia en disco y confirmaciones de entrega; reencola si un consumidor cae a mitad del procesamiento |
| Bases | PostgreSQL (Movimientos, Usuarios), MongoDB (Consulta, Reintentos), Redis (caché de Consulta) | Ver sección 7 |
| Entrada | Nginx | Único puerto publicado; reparte entre las copias del gateway |
| App del repartidor | PWA offline-first: React + Vite + Tailwind + TypeScript | Simula el uso real sin construir una app nativa |
| Vista del cliente | SPA web de consulta y corrección (mismo stack) | Mínima |
| Almacenista | CLI en Node.js + TypeScript | Mínimo |
| Despliegue | Docker Compose en una sola máquina | Recursos limitados; las zonas se simulan con contenedores |

## 9. Decisiones de arquitectura

| Decisión | Alternativas descartadas | Por qué |
|---|---|---|
| Disponibilidad en Movimientos y Consulta | Consistencia fuerte en todo | El cliente siempre debe ver algo y el repartidor siempre debe poder registrar |
| Consistencia por quórum en Usuarios | Réplica principal única; aceptar el retraso de las réplicas | Seguridad: no entrar con una contraseña vieja; se acepta negar el login sin mayoría |
| Usuarios replicado completo, no partido | Sharding por región; una tabla aparte de "correo → región" | El cliente no tiene región fija y la tabla aparte sería un punto único de falla |
| Sharding de Movimientos por hash del número de guía | Por zona de origen o de destino | La guía es inmutable, reparte parejo y el paquete nunca cambia de shard |
| Comunicación por eventos con una cola | Consultar a Movimientos por red en cada petición | Si cae Movimientos, Consulta y Reintentos siguen funcionando; menos acoplamiento |
| Patrón outbox | Guardar y publicar en dos pasos separados | Evita perder el evento o publicar uno sin guardar si el servicio cae a la mitad |
| Idempotencia con UUID generado en el celular | Identificador generado en el servidor | Un reenvío por pérdida de respuesta trae el mismo UUID y no se duplica |
| Tokens firmados verificados localmente | Preguntar a Usuarios en cada petición | El repartidor sigue trabajando aunque Usuarios caiga |
| Token de jornada completa + PIN local | Token de expiración corta | El repartidor no se bloquea offline; el PIN mitiga el robo del celular |
| Hora calculada con la última hora del servidor más un cronómetro monótono | Usar el reloj del dispositivo | El reloj del celular se puede alterar |
| Reintentos en franjas horarias distintas | El cliente elige su horario | Se recortó el alcance; se sacrifica eficiencia del repartidor a cambio de la satisfacción del cliente |
| Un intento fallido y una corrección de dirección son movimientos | Un servicio de notificaciones | El cliente lo ve en su línea de tiempo, sin otro servicio |
| Corrección de dirección en Movimientos y solo antes de "salió a ruta" | En Usuarios; en cualquier momento | Es la dirección de este paquete y debe quedar registrada; después de salir a ruta rompe la operación |
| Circuit breaker en el gateway hacia Consulta, con respaldo en Redis | Sin breaker; Redis detrás de Consulta | Evita que el gateway agote sus conexiones; Redis compartido sobrevive a la caída de Consulta |
| DNS de Docker Compose | Directorio con registro de servicios | Basta para una sola máquina |
| Node.js + TypeScript + NestJS | Java, Go, PHP, Python | Verbosidad; aprender desde cero; un proceso por petición, sin procesos persistentes; sin estructura común |
| RabbitMQ | Redis Streams, Kafka | Confirmaciones débiles; demasiado complejo para el tamaño del proyecto |
| Frontend mínimo: PWA, SPA y CLI | App nativa, GPS, cámara | No aporta a demostrar el sistema distribuido |

## 10. Preguntas abiertas y desacuerdos

No se registraron desacuerdos: el equipo confirmó cada etapa de forma unánime.

Quedaron sin definir:

- **Ruteo al shard:** ¿quién calcula el hash de la guía para elegir el shard de Movimientos: el propio servicio o el gateway? ¿Cada shard tiene réplica, o el ~25% afectado espera a que el shard se recupere?
- **Regiones de Usuarios:** ¿cuántas réplicas regionales hay en el `docker-compose` (el quórum necesita un número impar, p. ej. 3) y cómo se implementa el quórum sobre PostgreSQL?
- **Franjas de reintento:** ¿cuáles son las franjas horarias concretas y cuántos intentos caben por día dentro de los 3 días?
- **Intervalo del PIN:** ¿cada cuánto pide el PIN la PWA?
- **Cronómetro en el navegador:** ¿cómo sobrevive el cronómetro monótono de la PWA si el navegador se cierra o el celular se reinicia estando offline?
- **Herramienta del administrador:** ¿desde dónde registra el contacto y la decisión del proveedor (¿la misma CLI del almacenista?)?
- **Recuperación de una entrega errónea:** ¿qué movimientos se registran en ese proceso y quién los registra?
- **Eventos sospechosos:** ¿qué pasa con un evento marcado como sospechoso por discrepancia de hora? ¿Lo revisa alguien o solo queda marcado?
