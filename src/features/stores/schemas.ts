import { z } from 'zod';

const optionalTrimmedText = z.string().trim().optional();

/** Acepta `friosur.com.ar` sin protocolo, que es como lo escribe la gente. */
const optionalWebsite = z
  .string()
  .trim()
  .optional()
  .refine(
    (value) => !value || /^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i.test(value),
    'Sitio web invalido. Ejemplo: friosur.com.ar',
  );

const optionalEmail = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || z.string().email().safeParse(value).success, 'Email invalido');

export const storeSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio'),
  description: optionalTrimmedText,
  address: optionalTrimmedText,
  phone: optionalTrimmedText,
  website: optionalWebsite,
  email: optionalEmail,
  notes: optionalTrimmedText,
});

export type StoreFormValues = z.infer<typeof storeSchema>;
