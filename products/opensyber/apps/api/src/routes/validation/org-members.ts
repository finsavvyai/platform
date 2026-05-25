import { z } from 'zod';

export const changeMemberRoleSchema = z.object({
  role: z.string().min(1).max(50),
});
