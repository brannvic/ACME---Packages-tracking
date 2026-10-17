const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generarHashContrasena, verificarContrasena } = require('../dist/usuarios/contrasenas');
const { obtenerFechaYHoraLocal, obtenerFechaSiguiente, estaDentroDeFranja } = require('../dist/reintentos/horarios');

test('las contraseñas usan sal distinta y rechazan una clave incorrecta', () => {
  const hash = generarHashContrasena('AcmeDemo2026!');
  assert.notEqual(hash, generarHashContrasena('AcmeDemo2026!'));
  assert.equal(verificarContrasena('AcmeDemo2026!', hash), true);
  assert.equal(verificarContrasena('incorrecta', hash), false);
  assert.equal(verificarContrasena('incorrecta', 'invalido'), false);
});

test('la fecha del intento usa Ciudad de México, incluso cerca de medianoche UTC', () => {
  assert.deepEqual(obtenerFechaYHoraLocal(new Date('2026-10-17T03:30:00Z')), { fecha: '2026-10-16', minutos: 1290 });
  assert.equal(obtenerFechaSiguiente('2026-12-31'), '2027-01-01');
  assert.equal(obtenerFechaSiguiente('2028-02-28'), '2028-02-29');
});

test('los límites de las franjas no admiten la pausa ni las horas de cierre', () => {
  for (const [hora, franja, esperado] of [
    [539, 'manana', false], [540, 'manana', true], [779, 'manana', true], [780, 'manana', false],
    [839, 'tarde', false], [840, 'tarde', true], [1079, 'tarde', true], [1080, 'tarde', false],
  ]) assert.equal(estaDentroDeFranja(hora, franja), esperado);
});
