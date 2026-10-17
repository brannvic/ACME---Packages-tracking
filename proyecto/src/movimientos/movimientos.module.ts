import { Module } from '@nestjs/common';
import { Reloj } from '../reloj';
import { ReintentosModule } from '../reintentos/reintentos.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { MovimientosController, PaquetesController } from './movimientos.controller';
import { MovimientosService } from './movimientos.service';

@Module({
  imports: [UsuariosModule, ReintentosModule], controllers: [MovimientosController, PaquetesController],
  providers: [MovimientosService, Reloj],
})
export class MovimientosModule {}
