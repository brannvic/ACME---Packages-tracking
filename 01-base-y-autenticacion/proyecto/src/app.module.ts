import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { opcionesBaseDatos } from './base-datos';
import { SaludController } from './salud.controller';
import { UsuariosModule } from './usuarios/usuarios.module';

@Module({
  imports: [TypeOrmModule.forRoot({ ...opcionesBaseDatos, retryAttempts: 3 }), UsuariosModule],
  controllers: [SaludController],
})
export class AppModule {}
