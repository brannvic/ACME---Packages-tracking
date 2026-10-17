import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { opcionesBaseDatos } from './base-datos';
import { ConsultaModule } from './consulta/consulta.module';
import { MovimientosModule } from './movimientos/movimientos.module';
import { ReintentosModule } from './reintentos/reintentos.module';
import { SaludController } from './salud.controller';
import { UsuariosModule } from './usuarios/usuarios.module';

@Module({
  imports: [TypeOrmModule.forRoot({ ...opcionesBaseDatos, retryAttempts: 3 }), UsuariosModule, MovimientosModule, ReintentosModule, ConsultaModule],
  controllers: [SaludController],
})
export class AppModule {}
