import { randomUUID } from 'node:crypto';

const baseUrl = process.env.API_URL ?? 'http://localhost:8080';
const contrasena = process.env.DEMO_PASSWORD ?? 'AcmeDemo2026!';
const guia = `ACME-${randomUUID().slice(0, 8).toUpperCase()}`;

async function pedir(ruta, metodo = 'GET', cuerpo, token, esperado = 200) {
  const respuesta = await fetch(`${baseUrl}${ruta === '/health' ? '' : '/api/v1'}${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(30_000),
  });
  const datos = await respuesta.json();
  if (respuesta.status !== esperado) throw new Error(`${metodo} ${ruta}: ${respuesta.status} ${JSON.stringify(datos)}`);
  console.log(`${respuesta.status} ${metodo} ${ruta}`);
  return datos;
}

async function demostrarMonolito() {
  await pedir('/health');
  const sesiones = {};
  for (const rol of ['administrador', 'cliente', 'almacenista', 'repartidor']) {
    sesiones[rol] = await pedir('/auth/login', 'POST', { correo: `${rol}@acme.test`, contrasena });
  }
  const tokenCliente = sesiones.cliente.token;
  await pedir('/paquetes', 'POST', {
    numeroGuia: guia, clienteId: sesiones.cliente.usuario.id,
    destinatario: 'Cliente de demostración', direccion: 'Calle de Prueba 123, Ciudad de México',
  }, sesiones.administrador.token, 201);
  await pedir(`/tracking/${guia}`);
  const correccion = { id: randomUUID(), direccion: 'Calle Corregida 456, Ciudad de México' };
  await pedir(`/movimientos/${guia}/direccion`, 'PATCH', correccion, tokenCliente, 201);
  await pedir(`/movimientos/${guia}/direccion`, 'PATCH', correccion, tokenCliente, 200);
  for (const tipo of ['ingreso_almacen', 'ingreso_centro_distribucion', 'salida_ruta']) {
    await pedir('/movimientos/escanear', 'POST', {
      id: randomUUID(), numeroGuia: guia, tipo,
      ...(tipo !== 'salida_ruta' ? { ubicacion: 'Nodo de demostración' } : {}),
    }, sesiones[tipo === 'salida_ruta' ? 'repartidor' : 'almacenista'].token, 201);
  }
  await pedir(`/movimientos/${guia}/direccion`, 'PATCH', { id: randomUUID(), direccion: 'Cambio fuera de ventana' }, tokenCliente, 409);
  await pedir('/movimientos/escanear', 'POST', { id: randomUUID(), numeroGuia: guia, tipo: 'entregado' }, sesiones.repartidor.token, 400);
  const entrega = { id: randomUUID(), numeroGuia: guia, tipo: 'entregado', receptor: 'Persona que recibió de prueba' };
  await pedir('/movimientos/escanear', 'POST', entrega, sesiones.repartidor.token, 201);
  await pedir('/movimientos/escanear', 'POST', entrega, sesiones.repartidor.token, 200);
  const publico = await pedir(`/tracking/${guia}`);
  if (publico.estado !== 'entregado' || JSON.stringify(publico).includes('Calle')) throw new Error('Estado o privacidad incorrectos');
  const detalle = await pedir(`/tracking/${guia}/detalle`, 'GET', undefined, tokenCliente);
  console.log(JSON.stringify(detalle, null, 2));
  for (const sesion of Object.values(sesiones)) await pedir('/auth/logout', 'POST', {}, sesion.token);
  await pedir(`/tracking/${guia}/detalle`, 'GET', undefined, tokenCliente, 401);
  console.log(`\nDemostración terminada. Guía persistida: ${guia}`);
  console.log('Los tres días de reintentos se verifican con el reloj controlado de npm run test:integration.');
}

demostrarMonolito().catch(error => { console.error(error.message); process.exitCode = 1; });
