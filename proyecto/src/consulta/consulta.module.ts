import { Module } from '@nestjs/common';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { ConsultaController } from './consulta.controller';
import { ConsultaService } from './consulta.service';

@Module({ imports: [UsuariosModule], controllers: [ConsultaController], providers: [ConsultaService] })
export class ConsultaModule {}
