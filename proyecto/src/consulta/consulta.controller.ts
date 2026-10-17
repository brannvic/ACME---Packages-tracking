import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AutenticacionGuard, Roles, UsuarioActual } from '../usuarios/autenticacion';
import { Rol, UsuarioAutenticado } from '../usuarios/usuario.entity';
import { ConsultaService } from './consulta.service';

@Controller('tracking')
export class ConsultaController {
  constructor(private readonly consulta: ConsultaService) {}

  @Get(':numero_guia')
  consultarEstadoPublico(@Param('numero_guia') numeroGuia: string) {
    return this.consulta.consultarEstadoPublico(numeroGuia);
  }

  @Get(':numero_guia/detalle') @UseGuards(AutenticacionGuard) @Roles(Rol.CLIENTE)
  consultarDetalleDelTitular(@Param('numero_guia') numeroGuia: string, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.consulta.consultarDetalleDelTitular(numeroGuia, usuario.id);
  }
}
