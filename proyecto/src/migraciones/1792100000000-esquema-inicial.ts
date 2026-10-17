import { MigrationInterface, QueryRunner } from 'typeorm';

export class EsquemaInicial1792100000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE usuarios (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        correo varchar NOT NULL UNIQUE, nombre varchar NOT NULL,
        "contrasenaHash" varchar NOT NULL,
        rol varchar NOT NULL CHECK (rol IN ('cliente','repartidor','almacenista','administrador'))
      );
      CREATE TABLE sesiones (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "usuarioId" uuid NOT NULL REFERENCES usuarios(id),
        "venceEn" timestamptz NOT NULL, "revocadaEn" timestamptz
      );
      CREATE TABLE paquetes (
        "numeroGuia" varchar PRIMARY KEY,
        "clienteId" uuid NOT NULL REFERENCES usuarios(id),
        destinatario varchar NOT NULL, direccion varchar NOT NULL,
        estado varchar NOT NULL CHECK (estado IN ('creado','en_almacen','en_centro_distribucion','en_ruta','intento_fallido','entregado','en_sucursal')),
        "creadoEn" timestamptz NOT NULL, "primeraSalidaEn" timestamptz,
        "contactoEn" timestamptz, "clienteRespondio" boolean, "notasContacto" text,
        "decisionProveedor" varchar CHECK ("decisionProveedor" IN ('regresar','no_regresar')),
        "casoCerradoEn" timestamptz
      );
      CREATE TABLE historial_movimientos (
        id uuid PRIMARY KEY,
        secuencia serial NOT NULL UNIQUE,
        "numeroGuia" varchar NOT NULL REFERENCES paquetes("numeroGuia"),
        "usuarioId" uuid NOT NULL REFERENCES usuarios(id),
        tipo varchar NOT NULL CHECK (tipo IN ('envio_creado','ingreso_almacen','ingreso_centro_distribucion','salida_ruta','intento_fallido','entregado','direccion_corregida','paso_sucursal')),
        "registradoEn" timestamptz NOT NULL,
        ubicacion text, motivo text, receptor text, "direccionNueva" text,
        CHECK (tipo <> 'entregado' OR length(trim(receptor)) > 0 AND receptor IS NOT NULL),
        CHECK (tipo <> 'intento_fallido' OR length(trim(motivo)) > 0 AND motivo IS NOT NULL)
      );
      CREATE INDEX movimientos_por_paquete ON historial_movimientos ("numeroGuia", "registradoEn");
      CREATE TABLE intentos_entrega (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "numeroGuia" varchar NOT NULL REFERENCES paquetes("numeroGuia"),
        "salidaMovimientoId" uuid NOT NULL UNIQUE REFERENCES historial_movimientos(id),
        "resultadoMovimientoId" uuid UNIQUE REFERENCES historial_movimientos(id),
        numero integer NOT NULL CHECK (numero BETWEEN 1 AND 3), fecha date NOT NULL,
        franja varchar NOT NULL CHECK (franja IN ('manana','tarde')), direccion varchar NOT NULL,
        UNIQUE ("numeroGuia", fecha), UNIQUE ("numeroGuia", numero)
      );
      CREATE TABLE programacion_reintentos (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "numeroGuia" varchar NOT NULL REFERENCES paquetes("numeroGuia"),
        "movimientoFallidoId" uuid NOT NULL UNIQUE REFERENCES historial_movimientos(id),
        fecha date NOT NULL, franja varchar NOT NULL CHECK (franja IN ('manana','tarde')),
        direccion varchar NOT NULL, estado varchar NOT NULL CHECK (estado IN ('pendiente','consumido'))
      );
      CREATE UNIQUE INDEX un_reintento_pendiente ON programacion_reintentos ("numeroGuia") WHERE estado = 'pendiente';
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE programacion_reintentos, intentos_entrega, historial_movimientos, paquetes, sesiones, usuarios');
  }
}
