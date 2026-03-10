import { z } from 'zod';

export const serviceSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  description: z.string().optional(),
  category: z.string().optional(),
  base_price: z.coerce.number().min(0, 'El precio base no puede ser negativo'),
  unit_type: z.string().optional(),
  is_active: z.boolean().default(true),
});

export type ServiceFormValues = z.infer<typeof serviceSchema>;
