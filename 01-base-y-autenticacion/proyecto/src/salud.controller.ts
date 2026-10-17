import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('health')
export class SaludController {
  constructor(private readonly baseDatos: DataSource) {}

  @Get()
  async comprobarSalud() {
    try {
      await this.baseDatos.query('SELECT 1');
      return { estado: 'UP', baseDatos: 'UP' };
    } catch {
      throw new ServiceUnavailableException('Base de datos no disponible');
    }
  }
}
