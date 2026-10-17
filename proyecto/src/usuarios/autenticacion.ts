import { CanActivate, createParamDecorator, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Rol, UsuarioAutenticado } from './usuario.entity';
import { UsuariosService } from './usuarios.service';

export const Roles = (...roles: Rol[]) => SetMetadata('roles', roles);
type SolicitudAutenticada = Request & { usuario: UsuarioAutenticado };

export const UsuarioActual = createParamDecorator((_datos: unknown, contexto: ExecutionContext): UsuarioAutenticado =>
  contexto.switchToHttp().getRequest<SolicitudAutenticada>().usuario);

@Injectable()
export class AutenticacionGuard implements CanActivate {
  constructor(private readonly usuarios: UsuariosService, private readonly reflector: Reflector) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const solicitud = contexto.switchToHttp().getRequest<SolicitudAutenticada>();
    const encabezado = solicitud.headers.authorization;
    if (!encabezado?.startsWith('Bearer ')) throw new UnauthorizedException('Se requiere un token Bearer');
    solicitud.usuario = await this.usuarios.autenticarToken(encabezado.slice(7));
    const roles = this.reflector.getAllAndOverride<Rol[]>('roles', [contexto.getHandler(), contexto.getClass()]);
    if (roles && !roles.includes(solicitud.usuario.rol)) throw new ForbiddenException('Tu rol no permite esta operación');
    return true;
  }
}
