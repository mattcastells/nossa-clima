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

  it('rechaza nombre vacio', () => {
    const parsed = itemSchema.safeParse({
      ...basePayload,
      name: '   ',
    });

    expect(parsed.success).toBe(false);
  });
});
