import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function generarHashContrasena(contrasena: string): string {
  const sal = randomBytes(16).toString('hex');
  return `${sal}:${scryptSync(contrasena, sal, 64).toString('hex')}`;
}

export function verificarContrasena(contrasena: string, hash: string): boolean {
  const [sal, clave] = hash.split(':');
  if (!sal || !clave) return false;
  const claveGuardada = Buffer.from(clave, 'hex');
  const claveRecibida = scryptSync(contrasena, sal, 64);
  return claveGuardada.length === claveRecibida.length && timingSafeEqual(claveGuardada, claveRecibida);
}
