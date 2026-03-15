import { z } from 'zod';

export const priceSchema = z.object({
  store_id: z.string().uuid('Selecciona una tienda valida'),
  item_id: z.string().uuid('Selecciona un material valido'),
  price: z.coerce.number().gt(0, 'El precio debe ser mayor a 0'),
  currency: z.string().trim().min(1).default('ARS'),
  observed_at: z
    .string()
    .trim()
    .min(1, 'La fecha es obligatoria')
    .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime()), 'La fecha es invalida'),
  quantity_reference: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type PriceFormValues = z.infer<typeof priceSchema>;
