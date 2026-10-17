import { Controller, Get, UseGuards } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AutenticacionGuard, Roles } from '../usuarios/autenticacion';
import { Rol } from '../usuarios/usuario.entity';
import { ProgramacionReintento } from './reintento.entity';

@Controller('reintentos')
@UseGuards(AutenticacionGuard)
export class ReintentosController {
  constructor(private readonly baseDatos: DataSource) {}

  @Get() @Roles(Rol.REPARTIDOR, Rol.ADMINISTRADOR)
  consultarReintentosPendientes() {
    return this.baseDatos.getRepository(ProgramacionReintento).find({
      where: { estado: 'pendiente' }, order: { fecha: 'ASC', numeroGuia: 'ASC' },
    });
  }
}
