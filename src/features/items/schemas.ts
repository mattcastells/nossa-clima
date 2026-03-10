import { z } from 'zod';

export const itemSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  description: z.string().optional(),
  category: z.string().optional(),
  unit: z.string().optional(),
  sku: z.string().optional(),
  brand: z.string().optional(),
  item_type: z.enum(['product', 'tool', 'material', 'other']),
  is_active: z.boolean().default(true),
});

export type ItemFormValues = z.infer<typeof itemSchema>;
