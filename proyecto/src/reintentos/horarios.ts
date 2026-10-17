import { Franja } from './reintento.entity';

export function obtenerFechaYHoraLocal(instante: Date) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(instante);
  const valor = (tipo: string) => partes.find(parte => parte.type === tipo)!.value;
  return {
    fecha: `${valor('year')}-${valor('month')}-${valor('day')}`,
    minutos: Number(valor('hour')) * 60 + Number(valor('minute')),
  };
}

export function obtenerFechaSiguiente(fecha: string): string {
  const siguiente = new Date(`${fecha}T12:00:00Z`);
  siguiente.setUTCDate(siguiente.getUTCDate() + 1);
  return siguiente.toISOString().slice(0, 10);
}

export function estaDentroDeFranja(minutos: number, franja: Franja): boolean {
  return franja === 'manana' ? minutos >= 9 * 60 && minutos < 13 * 60 : minutos >= 14 * 60 && minutos < 18 * 60;
}
