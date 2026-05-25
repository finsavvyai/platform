import { z } from 'zod';

const VALID_ROLES = ['owner', 'admin', 'security', 'developer', 'viewer'] as const;

export const createInvitationSchema = z.object({
  email: z.string().email('email is required and must be valid'),
  role: z.enum(VALID_ROLES, {
    errorMap: () => ({
      message: `role must be one of: ${VALID_ROLES.join(', ')}`,
    }),
  }),
});
