import { Module } from '@nestjs/common';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { ReintentosService } from './reintentos.service';
import { ReintentosController } from './reintentos.controller';

@Module({ imports: [UsuariosModule], controllers: [ReintentosController], providers: [ReintentosService], exports: [ReintentosService] })
export class ReintentosModule {}
