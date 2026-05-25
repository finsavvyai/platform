import { z } from 'zod';
import { PERMISSION_LIST } from '@opensyber/shared';

const permissionEnum = z.enum(
  PERMISSION_LIST as [string, ...string[]],
);

export const createCustomRoleSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(500).optional(),
  permissions: z.array(permissionEnum).min(1, 'At least one permission required'),
  isDefault: z.boolean().optional(),
});

export const updateCustomRoleSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(500).nullable().optional(),
  permissions: z.array(permissionEnum).min(1).optional(),
  isDefault: z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field is required' },
);
