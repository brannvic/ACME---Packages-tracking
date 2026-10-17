import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { Sesion, Usuario, UsuarioAutenticado } from './usuario.entity';
import { verificarContrasena } from './contrasenas';

@Injectable()
export class UsuariosService {
  constructor(private readonly baseDatos: DataSource, private readonly tokens: JwtService) {}

  async iniciarSesion(correo: string, contrasena: string) {
    const usuario = await this.baseDatos.getRepository(Usuario).findOne({
      where: { correo: correo.toLowerCase() }, select: ['id', 'rol', 'nombre', 'contrasenaHash'],
    });
    if (!usuario || !verificarContrasena(contrasena, usuario.contrasenaHash)) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }
    const sesiones = this.baseDatos.getRepository(Sesion);
    const sesion = await sesiones.save(sesiones.create({
      usuarioId: usuario.id, venceEn: new Date(Date.now() + 12 * 60 * 60 * 1000), revocadaEn: null,
    }));
    return {
      token: await this.tokens.signAsync({ sub: usuario.id, sid: sesion.id }),
      venceEn: sesion.venceEn,
      usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
    };
  }

  async autenticarToken(token: string): Promise<UsuarioAutenticado> {
    let datos: { sub: string; sid: string };
    try {
      datos = await this.tokens.verifyAsync(token);
      if (typeof datos.sub !== 'string' || typeof datos.sid !== 'string') throw new Error();
    } catch {
      throw new UnauthorizedException('Token inválido o vencido');
    }
    const sesion = await this.baseDatos.getRepository(Sesion).findOneBy({ id: datos.sid, usuarioId: datos.sub });
    if (!sesion || sesion.revocadaEn || sesion.venceEn.getTime() <= Date.now()) {
      throw new UnauthorizedException('Sesión terminada');
    }
    const usuario = await this.baseDatos.getRepository(Usuario).findOneBy({ id: datos.sub });
    if (!usuario) throw new UnauthorizedException('Usuario inexistente');
    return { id: usuario.id, rol: usuario.rol, sesionId: sesion.id };
  }

  async cerrarSesion(usuario: UsuarioAutenticado) {
    await this.baseDatos.getRepository(Sesion).update(usuario.sesionId, { revocadaEn: new Date() });
    return { mensaje: 'Sesión cerrada' };
  }
}
