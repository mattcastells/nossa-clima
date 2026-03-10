import { z } from 'zod';

const optionalTrimmedText = z.string().trim().optional();

export const itemSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio'),
  description: optionalTrimmedText,
  category: optionalTrimmedText,
  unit: optionalTrimmedText,
  sku: optionalTrimmedText,
  brand: optionalTrimmedText,
  item_type: z.enum(['product', 'tool', 'material', 'other']),
  is_active: z.boolean().default(true),
});

export type ItemFormValues = z.infer<typeof itemSchema>;
