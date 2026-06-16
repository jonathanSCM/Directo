/**
 * Utilidades de fecha/hora "de pared" (sin zona horaria) para visitas.
 * Se trabaja en UTC de forma consistente: la fecha es un DATE y la hora un TIME,
 * ambos sin TZ, así que UTC evita corrimientos por husos horarios.
 */

export function parseDateUTC(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

export function parseTimeUTC(timeStr: string): Date {
  return new Date(`1970-01-01T${timeStr}:00.000Z`);
}

export function formatDateUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function formatTimeUTC(d: Date): string {
  return d.toISOString().slice(11, 16);
}

/** 0=domingo .. 6=sábado (coincide con la columna weekday). */
export function weekdayUTC(dateStr: string): number {
  return parseDateUTC(dateStr).getUTCDay();
}

export function timeStrToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function timeDateToMinutes(d: Date): number {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

export function minutesToTimeStr(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function todayStrUTC(): string {
  return formatDateUTC(new Date());
}

/** Lista de fechas (YYYY-MM-DD) entre dos fechas inclusive. */
export function dateRange(fromStr: string, toStr: string, maxDays = 60): string[] {
  const out: string[] = [];
  const from = parseDateUTC(fromStr);
  const to = parseDateUTC(toStr);
  let cursor = from;
  let guard = 0;
  while (cursor <= to && guard < maxDays) {
    out.push(formatDateUTC(cursor));
    cursor = new Date(cursor.getTime() + 86_400_000);
    guard++;
  }
  return out;
}
