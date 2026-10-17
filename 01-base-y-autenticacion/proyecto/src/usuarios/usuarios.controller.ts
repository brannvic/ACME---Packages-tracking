import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { AutenticacionGuard, UsuarioActual } from './autenticacion';
import { UsuarioAutenticado } from './usuario.entity';
import { UsuariosService } from './usuarios.service';

class InicioSesionDto {
  @IsEmail() @MaxLength(254) correo!: string;
  @IsString() @MinLength(1) @MaxLength(128) contrasena!: string;
}

@Controller('auth')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Post('login') @HttpCode(200)
  iniciarSesion(@Body() datos: InicioSesionDto) {
    return this.usuarios.iniciarSesion(datos.correo, datos.contrasena);
  }

  @Post('logout') @HttpCode(200) @UseGuards(AutenticacionGuard)
  cerrarSesion(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.usuarios.cerrarSesion(usuario);
  }
}
