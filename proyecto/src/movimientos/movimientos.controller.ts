import { Body, Controller, Param, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AutenticacionGuard, Roles, UsuarioActual } from '../usuarios/autenticacion';
import { Rol, UsuarioAutenticado } from '../usuarios/usuario.entity';
import { CorregirDireccionDto, CrearEnvioDto, RegistrarCasoDto, RegistrarMovimientoDto } from './movimientos.dto';
import { MovimientosService } from './movimientos.service';

@Controller('paquetes')
@UseGuards(AutenticacionGuard)
@Roles(Rol.ADMINISTRADOR)
export class PaquetesController {
  constructor(private readonly movimientos: MovimientosService) {}

  @Post()
  crearEnvio(@Body() datos: CrearEnvioDto, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.movimientos.crearEnvio(datos, usuario);
  }

  @Patch(':numero_guia/caso')
  registrarContactoYDecision(@Param('numero_guia') numeroGuia: string, @Body() datos: RegistrarCasoDto) {
    return this.movimientos.registrarContactoYDecision(numeroGuia, datos);
  }
}

@Controller('movimientos')
@UseGuards(AutenticacionGuard)
export class MovimientosController {
  constructor(private readonly movimientos: MovimientosService) {}

  @Post('escanear') @Roles(Rol.ALMACENISTA, Rol.REPARTIDOR)
  async registrarMovimiento(@Body() datos: RegistrarMovimientoDto, @UsuarioActual() usuario: UsuarioAutenticado,
    @Res({ passthrough: true }) respuesta: Response) {
    const resultado = await this.movimientos.registrarMovimiento(datos, usuario);
    respuesta.status(resultado.duplicado ? 200 : 201);
    return resultado;
  }

  @Patch(':numero_guia/direccion') @Roles(Rol.CLIENTE)
  async corregirDireccion(@Param('numero_guia') numeroGuia: string, @Body() datos: CorregirDireccionDto,
    @UsuarioActual() usuario: UsuarioAutenticado, @Res({ passthrough: true }) respuesta: Response) {
    const resultado = await this.movimientos.corregirDireccion(numeroGuia, datos, usuario);
    respuesta.status(resultado.duplicado ? 200 : 201);
    return resultado;
  }
}
