import { describe, expect, it } from 'vitest';

import {
  formatItemDisplayName,
  formatItemPresentation,
  formatMeasuredItemDisplayName,
  formatMeasurementDisplayLabel,
  parsePositiveDecimalInput,
} from '../itemDisplay';

describe('itemDisplay', () => {
  it('arma el nombre visible legacy con variante y presentacion', () => {
    expect(
      formatItemDisplayName({
        name: 'Varilla de cobre',
        variant_label: '3/8"',
        presentation_quantity: 3,
        presentation_unit: 'm',
        unit: 'barra',
      }),
    ).toBe('Varilla de cobre · 3/8" · 3 m por barra');
  });

  it('omite la presentacion incompleta', () => {
    expect(
      formatItemPresentation({
        presentation_quantity: 3,
        unit: 'barra',
      }),
    ).toBeNull();
  });

  it('arma el nombre de material con medida', () => {
    expect(formatMeasuredItemDisplayName({ name: 'Caño de cobre' }, { label: '1/2', unit: 'mt' })).toBe('Caño de cobre 1/2 (mt)');
    expect(formatMeasurementDisplayLabel({ label: '3/8', unit: 'mt' })).toBe('3/8 (mt)');
  });

  it('parsea decimales positivos con coma', () => {
    expect(parsePositiveDecimalInput('2,5')).toBe(2.5);
    expect(parsePositiveDecimalInput('0')).toBeNull();
  });
});
