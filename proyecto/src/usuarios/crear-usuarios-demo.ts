import baseDatos from '../base-datos';
import { generarHashContrasena } from './contrasenas';
import { Rol, Usuario } from './usuario.entity';

async function crearUsuariosDemo() {
  const contrasena = process.env.DEMO_PASSWORD;
  if (!contrasena || contrasena.length < 12) throw new Error('DEMO_PASSWORD debe tener al menos 12 caracteres');
  await baseDatos.initialize();
  try {
    const usuarios = baseDatos.getRepository(Usuario);
    for (const rol of Object.values(Rol)) {
      const correo = `${rol}@acme.test`;
      await usuarios.createQueryBuilder().insert().values({
        correo, nombre: `Demo ${rol}`, rol, contrasenaHash: generarHashContrasena(contrasena),
      }).orIgnore().execute();
      console.log(`Disponible: ${correo}`);
    }
  } finally {
    await baseDatos.destroy();
  }
}

crearUsuariosDemo().catch(error => { console.error(error); process.exitCode = 1; });
