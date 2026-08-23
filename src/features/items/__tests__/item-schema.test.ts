import { describe, expect, it } from 'vitest';

import { itemSchema } from '../schemas';

const basePayload = {
  name: 'Caño de cobre',
  description: '',
  notes: '',
  category: 'Cañerias',
  base_price_label: '',
  sku: '',
  item_type: 'material' as const,
};

describe('itemSchema', () => {
  it('acepta un material simple', () => {
    const parsed = itemSchema.safeParse(basePayload);

    expect(parsed.success).toBe(true);
  });

  it('acepta una referencia base opcional', () => {
    const parsed = itemSchema.safeParse({
      ...basePayload,
      base_price_label: 'Cobre',
    });

    expect(parsed.success).toBe(true);
  });

  it('acepta una unidad opcional y la recorta', () => {
    // La unidad la elige el usuario ("mt", "kg", "un"); vacia = sin unidad.
    // Antes el alta guardaba 'mt' fijo y el informe imprimia "1 mt" para un capacitor.
    const withUnit = itemSchema.safeParse({ ...basePayload, unit: ' mt ' });
    expect(withUnit.success).toBe(true);
    if (withUnit.success) expect(withUnit.data.unit).toBe('mt');

    const withoutUnit = itemSchema.safeParse({ ...basePayload, unit: '' });
    expect(withoutUnit.success).toBe(true);
    if (withoutUnit.success) expect(withoutUnit.data.unit).toBe('');

    const omitted = itemSchema.safeParse(basePayload);
    expect(omitted.success).toBe(true);
  });

  it('rechaza nombre vacio', () => {
    const parsed = itemSchema.safeParse({
      ...basePayload,
      name: '   ',
    });

    expect(parsed.success).toBe(false);
  });
});
