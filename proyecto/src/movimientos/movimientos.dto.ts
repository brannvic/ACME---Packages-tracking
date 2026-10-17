import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { TipoMovimiento } from './paquete.entity';

const recortarTexto = () => Transform(({ value }) => typeof value === 'string' ? value.trim() : value);

export class CrearEnvioDto {
  @IsString() @Matches(/^[A-Z0-9-]{6,40}$/) numeroGuia!: string;
  @IsUUID() clienteId!: string;
  @recortarTexto() @IsString() @IsNotEmpty() @MaxLength(200) destinatario!: string;
  @recortarTexto() @IsString() @IsNotEmpty() @MaxLength(500) direccion!: string;
}

export class RegistrarMovimientoDto {
  @IsUUID() id!: string;
  @IsString() @Matches(/^[A-Z0-9-]{6,40}$/) numeroGuia!: string;
  @IsIn([TipoMovimiento.INGRESO_ALMACEN, TipoMovimiento.INGRESO_CENTRO, TipoMovimiento.SALIDA_RUTA,
    TipoMovimiento.INTENTO_FALLIDO, TipoMovimiento.ENTREGADO]) tipo!: TipoMovimiento;
  @IsOptional() @recortarTexto() @IsString() @IsNotEmpty() @MaxLength(200) ubicacion?: string;
  @IsOptional() @recortarTexto() @IsString() @IsNotEmpty() @MaxLength(500) motivo?: string;
  @IsOptional() @recortarTexto() @IsString() @IsNotEmpty() @MaxLength(200) receptor?: string;
}

export class CorregirDireccionDto {
  @IsUUID() id!: string;
  @recortarTexto() @IsString() @IsNotEmpty() @MaxLength(500) direccion!: string;
}

export class RegistrarCasoDto {
  @IsBoolean() clienteRespondio!: boolean;
  @recortarTexto() @IsString() @IsNotEmpty() @MaxLength(1000) notasContacto!: string;
  @IsOptional() @IsIn(['regresar', 'no_regresar']) decisionProveedor?: 'regresar' | 'no_regresar';
}
