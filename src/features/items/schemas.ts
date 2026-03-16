import { z } from 'zod';

const optionalTrimmedText = z.string().trim().optional();

export const itemSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio'),
  description: optionalTrimmedText,
  notes: optionalTrimmedText,
  category: optionalTrimmedText,
  base_price_label: optionalTrimmedText,
  sku: optionalTrimmedText,
  item_type: z.enum(['product', 'tool', 'material', 'other']),
});

export type ItemFormValues = z.infer<typeof itemSchema>;
