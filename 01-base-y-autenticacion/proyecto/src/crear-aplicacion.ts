import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ErroresBaseDatos } from './errores-base-datos';

export async function crearAplicacion(): Promise<INestApplication> {
  const aplicacion = await NestFactory.create(AppModule);
  aplicacion.setGlobalPrefix('api/v1', { exclude: [{ path: 'health', method: RequestMethod.GET }] });
  aplicacion.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  aplicacion.useGlobalFilters(new ErroresBaseDatos());
  aplicacion.enableShutdownHooks();
  return aplicacion;
}
