import { z } from 'zod';

export const enterpriseContactSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(200),
  company: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
});
