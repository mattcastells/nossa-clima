import { describe, expect, it } from 'vitest';

import { maskDateInput, maskTimeInput, normalizeDateInput, normalizeOptionalTimeInput } from '../dateTimeInput';

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
});
