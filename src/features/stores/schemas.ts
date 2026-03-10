import { z } from 'zod';

const optionalTrimmedText = z.string().trim().optional();

export const storeSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio'),
  description: optionalTrimmedText,
  address: optionalTrimmedText,
  phone: optionalTrimmedText,
  notes: optionalTrimmedText,
  is_active: z.boolean().default(true),
});

export type StoreFormValues = z.infer<typeof storeSchema>;
