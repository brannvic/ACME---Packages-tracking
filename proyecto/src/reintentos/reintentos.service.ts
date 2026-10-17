import { ConflictException, Injectable } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { EstadoPaquete, Movimiento, Paquete } from '../movimientos/paquete.entity';
import { estaDentroDeFranja, obtenerFechaSiguiente, obtenerFechaYHoraLocal } from './horarios';
import { IntentoEntrega, ProgramacionReintento } from './reintento.entity';

@Injectable()
export class ReintentosService {
  async registrarSalidaARuta(transaccion: EntityManager, paquete: Paquete, movimiento: Movimiento) {
    const intentos = transaccion.getRepository(IntentoEntrega);
    const local = obtenerFechaYHoraLocal(movimiento.registradoEn);
    const anteriores = await intentos.find({ where: { numeroGuia: paquete.numeroGuia }, order: { numero: 'ASC' } });
    if (anteriores.some(intento => intento.fecha === local.fecha)) {
      throw new ConflictException('Solo se permite un intento por día');
    }
    if (anteriores.length >= 3) throw new ConflictException('El paquete agotó sus tres intentos');
    const programaciones = transaccion.getRepository(ProgramacionReintento);
    const pendiente = await programaciones.findOneBy({ numeroGuia: paquete.numeroGuia, estado: 'pendiente' });
    if (anteriores.length > 0 && !pendiente) throw new ConflictException('No hay un reintento programado');
    if (pendiente) {
      if (local.fecha < pendiente.fecha || !estaDentroDeFranja(local.minutos, pendiente.franja)) {
        throw new ConflictException(`El reintento corresponde desde ${pendiente.fecha}, franja ${pendiente.franja}`);
      }
      pendiente.estado = 'consumido';
      await programaciones.save(pendiente);
    }
    await intentos.save(intentos.create({
      numeroGuia: paquete.numeroGuia, salidaMovimientoId: movimiento.id, resultadoMovimientoId: null,
      numero: anteriores.length + 1, fecha: local.fecha,
      franja: pendiente?.franja ?? (local.minutos < 14 * 60 ? 'manana' : 'tarde'), direccion: paquete.direccion,
    }));
  }

  async registrarResultadoEntrega(transaccion: EntityManager, paquete: Paquete, movimiento: Movimiento) {
    const intentos = transaccion.getRepository(IntentoEntrega);
    const intento = await intentos.findOneBy({ numeroGuia: paquete.numeroGuia, resultadoMovimientoId: IsNull() });
    if (!intento) throw new ConflictException('No hay un intento de entrega en curso');
    intento.resultadoMovimientoId = movimiento.id;
    await intentos.save(intento);
    return intento;
  }

  async programarSiguienteIntento(transaccion: EntityManager, paquete: Paquete, intento: IntentoEntrega, movimiento: Movimiento) {
    if (intento.numero === 3) {
      paquete.estado = EstadoPaquete.EN_SUCURSAL;
      return true;
    }
    // Si el resultado llegó al día siguiente, tampoco se programa un intento en el pasado.
    const fechaResultado = obtenerFechaYHoraLocal(movimiento.registradoEn).fecha;
    const programaciones = transaccion.getRepository(ProgramacionReintento);
    await programaciones.save(programaciones.create({
      numeroGuia: paquete.numeroGuia, movimientoFallidoId: movimiento.id,
      fecha: obtenerFechaSiguiente(fechaResultado), franja: intento.franja === 'manana' ? 'tarde' : 'manana',
      direccion: paquete.direccion, estado: 'pendiente',
    }));
    return false;
  }
}
