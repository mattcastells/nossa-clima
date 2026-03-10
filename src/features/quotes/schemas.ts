import { z } from 'zod';

const optionalTrimmedText = z.string().trim().optional();

export const quoteSchema = z.object({
  client_name: z.string().trim().min(1, 'El cliente es obligatorio'),
  client_phone: optionalTrimmedText,
  title: z.string().trim().min(1, 'El título es obligatorio'),
  description: optionalTrimmedText,
  notes: optionalTrimmedText,
  status: z.enum(['draft', 'sent', 'approved', 'rejected']).default('draft'),
});

export const quoteMaterialItemSchema = z.object({
  quote_id: z.string().uuid(),
  item_id: z.string().uuid('Seleccioná un ítem'),
  quantity: z.coerce.number().gt(0, 'Cantidad inválida'),
  unit: optionalTrimmedText,
  unit_price: z.coerce.number().min(0, 'Precio inválido'),
  margin_percent: z.coerce.number().min(0, 'El margen no puede ser negativo').max(9999, 'El margen es demasiado alto').optional().nullable(),
  source_store_id: z.string().uuid().optional().nullable(),
  notes: optionalTrimmedText,
});

export const quoteServiceItemSchema = z.object({
  quote_id: z.string().uuid(),
  service_id: z.string().uuid('Seleccioná un servicio'),
  quantity: z.coerce.number().gt(0, 'Cantidad inválida'),
  unit_price: z.coerce.number().min(0, 'Precio inválido'),
  notes: optionalTrimmedText,
});

export type QuoteFormValues = z.infer<typeof quoteSchema>;
export type QuoteMaterialItemFormValues = z.infer<typeof quoteMaterialItemSchema>;
export type QuoteServiceItemFormValues = z.infer<typeof quoteServiceItemSchema>;
