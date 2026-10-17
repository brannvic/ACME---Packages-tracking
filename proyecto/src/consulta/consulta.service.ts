import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Movimiento, Paquete } from '../movimientos/paquete.entity';

@Injectable()
export class ConsultaService {
  constructor(private readonly baseDatos: DataSource) {}

  async consultarEstadoPublico(numeroGuia: string) {
    // Ambas lecturas ven la misma versión del paquete aunque llegue un movimiento concurrente.
    return this.baseDatos.transaction('REPEATABLE READ', async transaccion => {
      const paquete = await transaccion.findOneBy(Paquete, { numeroGuia });
      if (!paquete) throw new NotFoundException('No existe el paquete');
      const movimientos = await transaccion.find(Movimiento, {
        where: { numeroGuia }, order: { secuencia: 'ASC' },
      });
      return {
        numeroGuia, estado: paquete.estado,
        historial: movimientos.map(movimiento => ({ tipo: movimiento.tipo, registradoEn: movimiento.registradoEn })),
      };
    });
  }

  async consultarDetalleDelTitular(numeroGuia: string, clienteId: string) {
    return this.baseDatos.transaction('REPEATABLE READ', async transaccion => {
      const paquete = await transaccion.findOneBy(Paquete, { numeroGuia });
      if (!paquete) throw new NotFoundException('No existe el paquete');
      if (paquete.clienteId !== clienteId) throw new ForbiddenException('Solo el titular puede consultar el detalle');
      const historial = await transaccion.find(Movimiento, {
        where: { numeroGuia }, order: { secuencia: 'ASC' },
      });
      return { ...paquete, historial };
    });
  }
}
