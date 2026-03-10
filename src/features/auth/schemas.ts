import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Ingresá un email válido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
