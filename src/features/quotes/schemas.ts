import { z } from 'zod';

export const quoteSchema = z.object({
  client_name: z.string().min(1, 'El cliente es obligatorio'),
  client_phone: z.string().optional(),
  title: z.string().min(1, 'El título es obligatorio'),
  description: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['draft', 'sent', 'approved', 'rejected']).default('draft'),
});

export const quoteMaterialItemSchema = z.object({
  quote_id: z.string().uuid(),
  item_id: z.string().uuid('Seleccioná un ítem'),
  quantity: z.coerce.number().gt(0, 'Cantidad inválida'),
  unit: z.string().optional(),
  unit_price: z.coerce.number().min(0, 'Precio inválido'),
  margin_percent: z.coerce.number().min(0).optional().nullable(),
  source_store_id: z.string().uuid().optional().nullable(),
  notes: z.string().optional(),
});

export const quoteServiceItemSchema = z.object({
  quote_id: z.string().uuid(),
  service_id: z.string().uuid('Seleccioná un servicio'),
  quantity: z.coerce.number().gt(0, 'Cantidad inválida'),
  unit_price: z.coerce.number().min(0, 'Precio inválido'),
  notes: z.string().optional(),
});

export type QuoteFormValues = z.infer<typeof quoteSchema>;
export type QuoteMaterialItemFormValues = z.infer<typeof quoteMaterialItemSchema>;
export type QuoteServiceItemFormValues = z.infer<typeof quoteServiceItemSchema>;
