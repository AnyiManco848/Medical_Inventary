import { describe, it, expect, afterEach, vi } from 'vitest';
import { getHoy, getHoraActual } from '../app/dashboard/_lib/fechas';

afterEach(() => {
  vi.useRealTimers();
});

// Las pruebas corren con TZ=America/Bogota (vitest.config.mjs)
describe('_lib/fechas.js', () => {
  it.each([
    ['de mañana', '2026-10-05T09:05:00-05:00', '2026-10-05', '09:05'],
    ['a las 23:30 (en UTC ya es el día siguiente)', '2026-10-05T23:30:00-05:00', '2026-10-05', '23:30'],
    ['a medianoche', '2026-01-01T00:00:00-05:00', '2026-01-01', '00:00'],
    ['el último día del año a las 23:59', '2026-12-31T23:59:00-05:00', '2026-12-31', '23:59'],
  ])('%s usa la fecha y hora locales', (_c, ahora, fecha, hora) => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(ahora) });

    expect(getHoy()).toBe(fecha);
    expect(getHoraActual()).toBe(hora);
  });
});
