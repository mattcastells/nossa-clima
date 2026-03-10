import { z } from 'zod';

export const priceSchema = z.object({
  store_id: z.string().uuid('Seleccioná una tienda válida'),
  item_id: z.string().uuid('Seleccioná un ítem válido'),
  price: z.coerce.number().gt(0, 'El precio debe ser mayor a 0'),
  currency: z.string().min(1).default('ARS'),
  observed_at: z.string().min(1, 'La fecha es obligatoria'),
  source_type: z.enum(['purchase', 'manual_update', 'quote', 'other']),
  quantity_reference: z.string().optional(),
  notes: z.string().optional(),
});

export type PriceFormValues = z.infer<typeof priceSchema>;
