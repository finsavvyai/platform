import { z } from 'zod';

export const installSkillSchema = z.object({
  skillId: z.string().min(1),
  version: z.string().min(1),
});
