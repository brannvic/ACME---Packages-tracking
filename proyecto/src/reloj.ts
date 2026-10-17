import { Injectable } from '@nestjs/common';

// Las pruebas reemplazan este reloj; la API nunca acepta fechas del dispositivo.
@Injectable()
export class Reloj {
  ahora(): Date { return new Date(); }
}
