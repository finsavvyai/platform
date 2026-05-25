import { z } from 'zod';

export const createScimUserSchema = z.object({
  schemas: z.array(z.string()).optional(),
  userName: z.string().max(255).optional(),
  name: z.object({
    givenName: z.string().max(255).optional(),
    familyName: z.string().max(255).optional(),
  }).optional(),
  emails: z.array(z.object({
    value: z.string().email(),
    primary: z.boolean().optional(),
  })).optional(),
  active: z.boolean().optional(),
  externalId: z.string().max(255).optional(),
});

export const updateScimUserSchema = z.object({
  schemas: z.array(z.string()).optional(),
  userName: z.string().max(255).optional(),
  name: z.object({
    givenName: z.string().max(255).optional(),
    familyName: z.string().max(255).optional(),
  }).optional(),
  emails: z.array(z.object({
    value: z.string().email(),
    primary: z.boolean().optional(),
  })).optional(),
  active: z.boolean().optional(),
  externalId: z.string().max(255).optional(),
});
