import { z } from 'zod';

/**
 * Zod schema for creating a new skill signature entry.
 * Used by POST /api/skills/:slug/signatures.
 */
export const createSignatureSchema = z.object({
  version: z.string().min(1, 'version is required').max(50),
  sha256: z
    .string()
    .length(64, 'sha256 must be a 64-character hex string')
    .regex(/^[0-9a-f]{64}$/, 'sha256 must be lowercase hex'),
  sbomUrl: z.string().url().nullable().optional().default(null),
  reviewedAt: z
    .string()
    .datetime({ message: 'reviewedAt must be an ISO-8601 timestamp' }),
  reviewerId: z.string().min(1, 'reviewerId is required').max(200),
  signatureB64: z
    .string()
    .min(1, 'signatureB64 is required')
    .max(1024, 'signatureB64 is too long'),
});
