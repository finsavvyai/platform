import { z } from 'zod';

export const createEvidenceSchema = z.object({
  controlId: z.string().min(1).max(50),
  tsc: z.string().min(1).max(50),
  evidenceType: z.string().min(1).max(100),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).nullish(),
  artifactUrl: z.string().url().max(2000).nullish(),
  validUntil: z.string().max(50).nullish(),
});
