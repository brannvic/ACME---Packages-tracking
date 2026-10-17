import 'reflect-metadata';
import 'dotenv/config';
import { crearAplicacion } from './crear-aplicacion';

async function iniciarServidor() {
  const aplicacion = await crearAplicacion();
  await aplicacion.listen(Number(process.env.PORT ?? 8080), '0.0.0.0');
}

iniciarServidor().catch(error => { console.error(error); process.exitCode = 1; });
