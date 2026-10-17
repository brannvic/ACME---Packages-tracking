import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum Rol {
  CLIENTE = 'cliente',
  REPARTIDOR = 'repartidor',
  ALMACENISTA = 'almacenista',
  ADMINISTRADOR = 'administrador',
}

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ unique: true }) correo!: string;
  @Column() nombre!: string;
  @Column({ select: false }) contrasenaHash!: string;
  @Column({ type: 'varchar' }) rol!: Rol;
}

@Entity('sesiones')
export class Sesion {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') usuarioId!: string;
  @Column('timestamptz') venceEn!: Date;
  @Column({ type: 'timestamptz', nullable: true }) revocadaEn!: Date | null;
}

export interface UsuarioAutenticado {
  id: string;
  rol: Rol;
  sesionId: string;
}
