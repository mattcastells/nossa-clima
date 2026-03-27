import { z } from 'zod';

const optionalTrimmedText = z.string().trim().optional();

export const quoteSchema = z.object({
  client_name: z.string().trim().min(1, 'El cliente es obligatorio'),
  client_phone: optionalTrimmedText,
  title: z.string().trim().min(1, 'El titulo es obligatorio'),
  notes: optionalTrimmedText,
});

export const quoteServiceItemSchema = z.object({
  quote_id: z.string().uuid(),
  service_id: z.string().uuid('Selecciona un servicio'),
  quantity: z.coerce.number().gt(0, 'Cantidad invalida'),
  unit_price: z.coerce.number().min(0, 'Precio invalido'),
  notes: optionalTrimmedText,
});

export type QuoteFormValues = z.infer<typeof quoteSchema>;
export type QuoteServiceItemFormValues = z.infer<typeof quoteServiceItemSchema>;
