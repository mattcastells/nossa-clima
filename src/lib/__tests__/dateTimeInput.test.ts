import { describe, expect, it } from 'vitest';

import { dayHeadingLabel, getWeekDays, maskDateInput, maskTimeInput, normalizeDateInput, normalizeOptionalTimeInput } from '../dateTimeInput';

describe('dateTimeInput', () => {
  it('autocompleta separadores de fecha mientras se escribe', () => {
    expect(maskDateInput('15032026')).toBe('15-03-2026');
    expect(maskDateInput('15-03-2026')).toBe('15-03-2026');
  });

  it('autocompleta separadores de hora mientras se escribe', () => {
    expect(maskTimeInput('0930')).toBe('09:30');
    expect(maskTimeInput('09:30')).toBe('09:30');
  });

  it('normaliza fechas en formato local a ISO', () => {
    expect(normalizeDateInput('15032026')).toBe('2026-03-15');
    expect(normalizeDateInput('15-03-2026')).toBe('2026-03-15');
    expect(normalizeDateInput('2026-03-15')).toBe('2026-03-15');
  });

  it('normaliza horas opcionales a HH:mm:ss', () => {
    expect(normalizeOptionalTimeInput('0930')).toBe('09:30:00');
    expect(normalizeOptionalTimeInput('09:30')).toBe('09:30:00');
    expect(normalizeOptionalTimeInput('')).toBeNull();
  });

  it('rechaza fechas y horas invalidas', () => {
    expect(() => normalizeDateInput('31-02-2026')).toThrow('La fecha ingresada no es valida.');
    expect(() => normalizeOptionalTimeInput('2560')).toThrow('La hora debe tener formato HH:mm.');
  });

  it('arma la semana de lunes a domingo', () => {
    // 2026-07-15 es miercoles.
    expect(getWeekDays('2026-07-15')).toEqual([
      '2026-07-13',
      '2026-07-14',
      '2026-07-15',
      '2026-07-16',
      '2026-07-17',
      '2026-07-18',
      '2026-07-19',
    ]);
  });

  it('mantiene la semana cuando el dia ya es lunes o domingo', () => {
    expect(getWeekDays('2026-07-13')[0]).toBe('2026-07-13');
    expect(getWeekDays('2026-07-19')[0]).toBe('2026-07-13');
  });

  it('cruza el borde de mes sin romper la semana', () => {
    // 2026-08-01 es sabado: la semana arranca en julio.
    expect(getWeekDays('2026-08-01')).toEqual([
      '2026-07-27',
      '2026-07-28',
      '2026-07-29',
      '2026-07-30',
      '2026-07-31',
      '2026-08-01',
      '2026-08-02',
    ]);
  });

  it('etiqueta el dia con nombre y numero', () => {
    expect(dayHeadingLabel('2026-07-16')).toBe('Jueves 16');
  });
});
