import { z } from 'zod';

const optionalTrimmedText = z.string().trim().optional();

export const quoteSchema = z.object({
  client_name: z.string().trim().min(1, 'El cliente es obligatorio'),
  client_phone: optionalTrimmedText,
  title: z.string().trim().min(1, 'El titulo es obligatorio'),
  // Domicilio del cliente. Persiste en quotes.description (columna existente
  // sin uso previo): el informe PDF lo muestra como DOMICILIO.
  description: optionalTrimmedText,
  // Tecnico encargado. Se imprime en el bloque de cliente del informe.
  technician_name: optionalTrimmedText,
  // Datos de acceso del cliente (timbre, piso, quien recibe). Se imprimen.
  client_notes: optionalTrimmedText,
  // Resumen del trabajo. Se imprime en el informe bajo el titulo RESUMEN.
  notes: optionalTrimmedText,
  // Notas privadas del tecnico. NUNCA se imprimen en el informe.
  technician_notes: optionalTrimmedText,
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
