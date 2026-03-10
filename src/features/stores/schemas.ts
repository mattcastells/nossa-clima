import { z } from 'zod';

export const storeSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  description: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  is_active: z.boolean().default(true),
});

export type StoreFormValues = z.infer<typeof storeSchema>;
