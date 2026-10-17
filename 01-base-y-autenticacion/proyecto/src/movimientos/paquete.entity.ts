import { Column, Entity, PrimaryColumn } from 'typeorm';

export enum EstadoPaquete {
  CREADO = 'creado',
  EN_ALMACEN = 'en_almacen',
  EN_CENTRO = 'en_centro_distribucion',
  EN_RUTA = 'en_ruta',
  INTENTO_FALLIDO = 'intento_fallido',
  ENTREGADO = 'entregado',
  EN_SUCURSAL = 'en_sucursal',
}

export enum TipoMovimiento {
  ENVIO_CREADO = 'envio_creado',
  INGRESO_ALMACEN = 'ingreso_almacen',
  INGRESO_CENTRO = 'ingreso_centro_distribucion',
  SALIDA_RUTA = 'salida_ruta',
  INTENTO_FALLIDO = 'intento_fallido',
  ENTREGADO = 'entregado',
  DIRECCION_CORREGIDA = 'direccion_corregida',
  PASO_SUCURSAL = 'paso_sucursal',
}

@Entity('paquetes')
export class Paquete {
  @PrimaryColumn() numeroGuia!: string;
  @Column('uuid') clienteId!: string;
  @Column() destinatario!: string;
  @Column() direccion!: string;
  @Column({ type: 'varchar' }) estado!: EstadoPaquete;
  @Column('timestamptz') creadoEn!: Date;
  @Column({ type: 'timestamptz', nullable: true }) primeraSalidaEn!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) contactoEn!: Date | null;
  @Column({ type: 'boolean', nullable: true }) clienteRespondio!: boolean | null;
  @Column({ type: 'text', nullable: true }) notasContacto!: string | null;
  @Column({ type: 'varchar', nullable: true }) decisionProveedor!: 'regresar' | 'no_regresar' | null;
  @Column({ type: 'timestamptz', nullable: true }) casoCerradoEn!: Date | null;
}

@Entity('historial_movimientos')
export class Movimiento {
  @PrimaryColumn('uuid') id!: string;
  @Column({ type: 'int', generated: 'increment' }) secuencia!: number;
  @Column() numeroGuia!: string;
  @Column('uuid') usuarioId!: string;
  @Column({ type: 'varchar' }) tipo!: TipoMovimiento;
  @Column('timestamptz') registradoEn!: Date;
  @Column({ type: 'text', nullable: true }) ubicacion!: string | null;
  @Column({ type: 'text', nullable: true }) motivo!: string | null;
  @Column({ type: 'text', nullable: true }) receptor!: string | null;
  @Column({ type: 'text', nullable: true }) direccionNueva!: string | null;
}
