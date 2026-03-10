import { z } from 'zod';

const optionalTrimmedText = z.string().trim().optional();

export const serviceSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio'),
  description: optionalTrimmedText,
  category: optionalTrimmedText,
  base_price: z.coerce.number().min(0, 'El precio base no puede ser negativo'),
  unit_type: optionalTrimmedText,
  is_active: z.boolean().default(true),
});

export type ServiceFormValues = z.infer<typeof serviceSchema>;
