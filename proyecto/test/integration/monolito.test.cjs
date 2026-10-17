require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

test('recorrido HTTP con PostgreSQL real y transacciones', async t => {
  assert.match(process.env.DB_NAME ?? '', /^acme_test(?:_|$)/, 'Usa una base exclusiva cuyo nombre empiece por acme_test');
  process.env.JWT_SECRET = 'secreto-de-pruebas-acme-al-menos-32-caracteres';
  const { default: baseDatos } = require('../../dist/base-datos');
  const { Usuario, Rol } = require('../../dist/usuarios/usuario.entity');
  const { Paquete, Movimiento } = require('../../dist/movimientos/paquete.entity');
  const { IntentoEntrega, ProgramacionReintento } = require('../../dist/reintentos/reintento.entity');
  const { generarHashContrasena } = require('../../dist/usuarios/contrasenas');
  const { Reloj } = require('../../dist/reloj');
  const { JwtService } = require('@nestjs/jwt');
  const { crearAplicacion } = require('../../dist/crear-aplicacion');
  await baseDatos.initialize();
  t.after(async () => { if (baseDatos.isInitialized) await baseDatos.destroy(); });
  await baseDatos.runMigrations();
  await baseDatos.query('TRUNCATE programacion_reintentos, intentos_entrega, historial_movimientos, paquetes, sesiones, usuarios RESTART IDENTITY CASCADE');
  const usuarios = {};
  for (const rol of [...Object.values(Rol), 'otro_cliente']) {
    usuarios[rol] = await baseDatos.getRepository(Usuario).save({
      correo: `${rol}@acme.test`, nombre: `Prueba ${rol}`, rol: rol === 'otro_cliente' ? Rol.CLIENTE : rol,
      contrasenaHash: generarHashContrasena('AcmeDemo2026!'),
    });
  }
  const app = await crearAplicacion();
  await app.listen(0, '127.0.0.1');
  t.after(() => app.close());
  const url = await app.getUrl();
  let instante = '2026-10-16T16:00:00Z';
  app.get(Reloj).ahora = () => new Date(instante);
  const tokens = {};
  async function pedir(ruta, metodo = 'GET', cuerpo, token, esperado = 200) {
    const respuesta = await fetch(`${url}${ruta.startsWith('/health') ? '' : '/api/v1'}${ruta}`, {
      method: metodo, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    const datos = await respuesta.json();
    assert.equal(respuesta.status, esperado, JSON.stringify(datos));
    return datos;
  }
  async function crearPaquete(guia) {
    return pedir('/paquetes', 'POST', { numeroGuia: guia, clienteId: usuarios.cliente.id, destinatario: 'Titular privado', direccion: 'Dirección privada 123' }, tokens.administrador, 201);
  }
  async function escanear(guia, tipo, extra = {}, esperado = 201, id = randomUUID(), token) {
    return pedir('/movimientos/escanear', 'POST', { id, numeroGuia: guia, tipo, ...extra },
      token ?? tokens[['ingreso_almacen', 'ingreso_centro_distribucion'].includes(tipo) ? 'almacenista' : 'repartidor'], esperado);
  }
  async function llevarAlCentro(guia) {
    await escanear(guia, 'ingreso_almacen', { ubicacion: 'Almacén de prueba' });
    await escanear(guia, 'ingreso_centro_distribucion', { ubicacion: 'Centro de prueba' });
  }

  await t.test('salud, login, permisos y validación', async () => {
    assert.equal((await pedir('/health')).estado, 'UP');
    await pedir('/auth/login', 'POST', { correo: 'cliente@acme.test', contrasena: 'incorrecta' }, undefined, 401);
    for (const rol of Object.keys(usuarios)) {
      const sesion = await pedir('/auth/login', 'POST', { correo: `${rol}@acme.test`, contrasena: 'AcmeDemo2026!' });
      tokens[rol] = sesion.token;
      assert.equal(sesion.usuario.id, usuarios[rol].id);
      assert.equal('contrasenaHash' in sesion.usuario, false);
    }
    await pedir('/paquetes', 'POST', {}, undefined, 401);
    await pedir('/paquetes', 'POST', {}, tokens.cliente, 403);
    await pedir('/paquetes', 'POST', {}, tokens.administrador, 400);
    await pedir('/tracking/INEXISTENTE', 'GET', undefined, undefined, 404);
    const vencido = await app.get(JwtService).signAsync({ sub: usuarios.cliente.id, sid: randomUUID() }, { expiresIn: -1 });
    await pedir('/reintentos', 'GET', undefined, vencido, 401);
  });

  await t.test('privacidad, corrección idempotente y UUID incompatible', async () => {
    await crearPaquete('ACME-ENTREGA');
    await crearPaquete('ACME-OTRO');
    await pedir('/tracking/ACME-ENTREGA/detalle', 'GET', undefined, tokens.otro_cliente, 403);
    const id = randomUUID();
    const cambio = { id, direccion: 'Dirección nueva confidencial 456' };
    const ruta = '/movimientos/ACME-ENTREGA/direccion';
    await pedir(ruta, 'PATCH', cambio, tokens.otro_cliente, 403);
    const respuestas = await Promise.all([201, 200].map(() => fetch(`${url}/api/v1${ruta}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.cliente}` }, body: JSON.stringify(cambio),
    })));
    assert.deepEqual(respuestas.map(r => r.status).sort(), [200, 201]);
    await pedir(ruta, 'PATCH', { ...cambio, direccion: 'Otra dirección' }, tokens.cliente, 409);
    await pedir('/movimientos/ACME-OTRO/direccion', 'PATCH', cambio, tokens.cliente, 409);
    const publico = await pedir('/tracking/ACME-ENTREGA');
    assert.deepEqual(Object.keys(publico).sort(), ['estado', 'historial', 'numeroGuia']);
    assert.equal(JSON.stringify(publico).includes('confidencial'), false);
    assert.equal(publico.historial.filter(m => m.tipo === 'direccion_corregida').length, 1);
    const detalle = await pedir('/tracking/ACME-ENTREGA/detalle', 'GET', undefined, tokens.cliente);
    assert.equal(detalle.direccion, cambio.direccion);
    assert.equal(detalle.destinatario, 'Titular privado');
  });

  await t.test('entrega, movimientos concurrentes y estado terminal', async () => {
    const guia = 'ACME-ENTREGA';
    await escanear(guia, 'entregado', { receptor: 'Persona' }, 409);
    await escanear(guia, 'ingreso_almacen', { ubicacion: 'Almacén' }, 403, randomUUID(), tokens.repartidor);
    await llevarAlCentro(guia);
    await escanear(guia, 'salida_ruta');
    await pedir(`/movimientos/${guia}/direccion`, 'PATCH', { id: randomUUID(), direccion: 'Ya es tarde' }, tokens.cliente, 409);
    await escanear(guia, 'entregado', {}, 400);
    await escanear(guia, 'entregado', { receptor: '   ' }, 400);
    const id = randomUUID();
    const entregas = await Promise.all([1, 2].map(() => fetch(`${url}/api/v1/movimientos/escanear`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.repartidor}` },
      body: JSON.stringify({ id, numeroGuia: guia, tipo: 'entregado', receptor: 'Recibe de prueba' }),
    })));
    assert.deepEqual(entregas.map(r => r.status).sort(), [200, 201]);
    await escanear(guia, 'intento_fallido', { motivo: 'No estaba' }, 409);
    await escanear(guia, 'salida_ruta', {}, 409);
    const detalle = await pedir(`/tracking/${guia}/detalle`, 'GET', undefined, tokens.cliente);
    assert.equal(detalle.estado, 'entregado');
    assert.equal(detalle.historial.filter(m => m.tipo === 'entregado').length, 1);
    assert.equal(detalle.historial.at(-1).receptor, 'Recibe de prueba');
  });

  await t.test('tres días, franjas alternas, rollback y cierre de caso', async () => {
    const guia = 'ACME-REINTENTOS';
    await crearPaquete(guia);
    await llevarAlCentro(guia);
    await escanear(guia, 'salida_ruta');
    await escanear(guia, 'intento_fallido', {}, 400);
    const idFallo = randomUUID();
    await escanear(guia, 'intento_fallido', { motivo: 'Domicilio sin respuesta' }, 201, idFallo);
    await escanear(guia, 'intento_fallido', { motivo: 'Domicilio sin respuesta' }, 200, idFallo);
    let pendientes = await pedir('/reintentos', 'GET', undefined, tokens.repartidor);
    assert.equal(pendientes.length, 1);
    assert.equal(pendientes[0].fecha, '2026-10-17');
    assert.equal(pendientes[0].franja, 'tarde');
    const antes = await baseDatos.getRepository(Movimiento).countBy({ numeroGuia: guia });
    await escanear(guia, 'salida_ruta', {}, 409);
    instante = '2026-10-17T16:00:00Z'; // Mañana: no corresponde a la segunda franja.
    await escanear(guia, 'salida_ruta', {}, 409);
    assert.equal(await baseDatos.getRepository(Movimiento).countBy({ numeroGuia: guia }), antes);
    assert.equal(await baseDatos.getRepository(IntentoEntrega).countBy({ numeroGuia: guia }), 1);
    assert.equal(await baseDatos.getRepository(ProgramacionReintento).countBy({ numeroGuia: guia, estado: 'pendiente' }), 1);
    instante = '2026-10-17T21:00:00Z';
    await escanear(guia, 'salida_ruta');
    await escanear(guia, 'intento_fallido', { motivo: 'Segundo día sin respuesta' });
    pendientes = await pedir('/reintentos', 'GET', undefined, tokens.administrador);
    assert.equal(pendientes[0].fecha, '2026-10-18');
    assert.equal(pendientes[0].franja, 'manana');
    instante = '2026-10-18T16:00:00Z';
    await escanear(guia, 'salida_ruta');
    await escanear(guia, 'intento_fallido', { motivo: 'Tercer día sin respuesta' });
    assert.equal((await pedir(`/tracking/${guia}`)).estado, 'en_sucursal');
    assert.deepEqual(await pedir('/reintentos', 'GET', undefined, tokens.repartidor), []);
    const caso = `/paquetes/${guia}/caso`;
    await pedir(caso, 'PATCH', { clienteRespondio: false, notasContacto: 'Sin respuesta' }, tokens.repartidor, 403);
    await pedir(caso, 'PATCH', { clienteRespondio: true, notasContacto: 'Respondió', decisionProveedor: 'regresar' }, tokens.administrador, 400);
    const contacto = await pedir(caso, 'PATCH', { clienteRespondio: false, notasContacto: 'Llamada sin respuesta' }, tokens.administrador);
    assert.equal(contacto.casoCerradoEn, null);
    const cerrado = await pedir(caso, 'PATCH', { clienteRespondio: false, notasContacto: 'Proveedor autoriza devolución', decisionProveedor: 'regresar' }, tokens.administrador);
    assert.ok(cerrado.casoCerradoEn);
    assert.equal(cerrado.estado, 'en_sucursal');
    await pedir(caso, 'PATCH', { clienteRespondio: false, notasContacto: 'Repetido' }, tokens.administrador, 409);
    await escanear(guia, 'salida_ruta', {}, 409);
  });

  await t.test('un error de escritura revierte paquete e historial juntos', async () => {
    await crearPaquete('ACME-ROLLBACK');
    const original = app.get(require('../../dist/reintentos/reintentos.service').ReintentosService).registrarSalidaARuta;
    const servicio = app.get(require('../../dist/reintentos/reintentos.service').ReintentosService);
    await llevarAlCentro('ACME-ROLLBACK');
    servicio.registrarSalidaARuta = async (transaccion) => {
      await transaccion.query("INSERT INTO intentos_entrega (\"numeroGuia\") VALUES ('NO-EXISTE')");
    };
    try {
      await escanear('ACME-ROLLBACK', 'salida_ruta', {}, 503);
    } finally { servicio.registrarSalidaARuta = original; }
    const paquete = await baseDatos.getRepository(Paquete).findOneByOrFail({ numeroGuia: 'ACME-ROLLBACK' });
    assert.equal(paquete.estado, 'en_centro_distribucion');
    assert.equal(paquete.primeraSalidaEn, null);
    assert.equal(await baseDatos.getRepository(Movimiento).countBy({ numeroGuia: 'ACME-ROLLBACK', tipo: 'salida_ruta' }), 0);
  });

  await t.test('dos entregas distintas concurrentes solo confirman una', async () => {
    const guia = 'ACME-CONCURRENTE';
    await crearPaquete(guia);
    await llevarAlCentro(guia);
    await escanear(guia, 'salida_ruta');
    const respuestas = await Promise.all([1, 2].map(numero => fetch(`${url}/api/v1/movimientos/escanear`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.repartidor}` },
      body: JSON.stringify({ id: randomUUID(), numeroGuia: guia, tipo: 'entregado', receptor: `Persona ${numero}` }),
    })));
    assert.deepEqual(respuestas.map(r => r.status).sort(), [201, 409]);
    assert.equal(await baseDatos.getRepository(Movimiento).countBy({ numeroGuia: guia, tipo: 'entregado' }), 1);
  });

  await t.test('la demo pública ejecuta el recorrido completo sin alterar el reloj del servidor', async () => {
    const { execFile } = require('node:child_process');
    const { promisify } = require('node:util');
    const resultado = await promisify(execFile)(process.execPath, ['scripts/demo.mjs'], {
      env: { ...process.env, API_URL: url, DEMO_PASSWORD: 'AcmeDemo2026!' },
    });
    assert.match(resultado.stdout, /Demostración terminada/);
  });

  await t.test('logout revoca el token de inmediato', async () => {
    await pedir('/auth/logout', 'POST', {}, tokens.repartidor);
    await pedir('/reintentos', 'GET', undefined, tokens.repartidor, 401);
    await pedir('/tracking/ACME-ENTREGA');
  });

  await t.test('sin conexión a la base se responde 503 y no se exponen errores internos', async () => {
    const conexion = app.get(require('typeorm').DataSource);
    await conexion.destroy();
    try {
      await pedir('/health', 'GET', undefined, undefined, 503);
      const error = await pedir('/tracking/ACME-ENTREGA', 'GET', undefined, undefined, 503);
      assert.equal('stack' in error, false);
      await pedir('/reintentos', 'GET', undefined, tokens.administrador, 503);
    } finally { await conexion.initialize(); }
  });
});
