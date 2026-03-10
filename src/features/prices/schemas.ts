import { z } from 'zod';

export const priceSchema = z.object({
  store_id: z.string().uuid('Seleccioná una tienda válida'),
  item_id: z.string().uuid('Seleccioná un ítem válido'),
  price: z.coerce.number().gt(0, 'El precio debe ser mayor a 0'),
  currency: z.string().trim().min(1).default('ARS'),
  observed_at: z
    .string()
    .trim()
    .min(1, 'La fecha es obligatoria')
    .refine((value) => !Number.isNaN(new Date(value).getTime()), 'La fecha es inválida'),
  source_type: z.enum(['purchase', 'manual_update', 'quote', 'other']),
  quantity_reference: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type PriceFormValues = z.infer<typeof priceSchema>;
