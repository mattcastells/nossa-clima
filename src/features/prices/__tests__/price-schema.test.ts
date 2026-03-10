import { describe, expect, it } from 'vitest';

import { priceSchema } from '../schemas';

describe('priceSchema', () => {
  it('rejects non-positive prices', () => {
    const parsed = priceSchema.safeParse({
      store_id: '550e8400-e29b-41d4-a716-446655440000',
      item_id: '550e8400-e29b-41d4-a716-446655440001',
      price: 0,
      currency: 'ARS',
      observed_at: '2024-01-01',
      source_type: 'manual_update',
    });

    expect(parsed.success).toBe(false);
  });
});
