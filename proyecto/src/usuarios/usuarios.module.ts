import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AutenticacionGuard } from './autenticacion';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

@Module({
  imports: [JwtModule.registerAsync({ useFactory: () => {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) throw new Error('JWT_SECRET debe tener al menos 32 caracteres');
    return { secret, signOptions: { expiresIn: '12h' } };
  } })],
  controllers: [UsuariosController], providers: [UsuariosService, AutenticacionGuard],
  exports: [UsuariosService, AutenticacionGuard],
})
export class UsuariosModule {}
