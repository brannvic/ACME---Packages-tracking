import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError, TypeORMError } from 'typeorm';

@Catch(TypeORMError)
export class ErroresBaseDatos implements ExceptionFilter {
  catch(error: TypeORMError, contexto: ArgumentsHost) {
    const respuesta = contexto.switchToHttp().getResponse<Response>();
    const codigo = error instanceof QueryFailedError ? (error.driverError as { code?: string }).code : undefined;
    const conflicto = ['23505', '23503', '40001', '40P01'].includes(codigo ?? '');
    const statusCode = conflicto ? HttpStatus.CONFLICT : HttpStatus.SERVICE_UNAVAILABLE;
    respuesta.status(statusCode).json({ statusCode, message: conflicto
      ? 'La operación entra en conflicto con los datos actuales; consulta el estado antes de reintentar'
      : 'La base de datos no está disponible; intenta de nuevo más tarde' });
  }
}
