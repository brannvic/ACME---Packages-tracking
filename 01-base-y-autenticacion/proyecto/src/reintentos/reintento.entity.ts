import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type Franja = 'manana' | 'tarde';

@Entity('intentos_entrega')
export class IntentoEntrega {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column() numeroGuia!: string;
  @Column('uuid', { unique: true }) salidaMovimientoId!: string;
  @Column({ type: 'uuid', nullable: true, unique: true }) resultadoMovimientoId!: string | null;
  @Column('int') numero!: number;
  @Column('date') fecha!: string;
  @Column({ type: 'varchar' }) franja!: Franja;
  @Column() direccion!: string;
}

@Entity('programacion_reintentos')
export class ProgramacionReintento {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column() numeroGuia!: string;
  @Column('uuid', { unique: true }) movimientoFallidoId!: string;
  @Column('date') fecha!: string;
  @Column({ type: 'varchar' }) franja!: Franja;
  @Column() direccion!: string;
  @Column({ type: 'varchar' }) estado!: 'pendiente' | 'consumido';
}
