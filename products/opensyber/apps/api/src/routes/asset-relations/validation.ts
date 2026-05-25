import { z } from 'zod';
import { RELATION_TYPES, DISCOVERY_SOURCES } from '@opensyber/shared';

export const createRelationSchema = z.object({
  sourceAssetId: z.string().min(1),
  targetAssetId: z.string().min(1),
  relationType: z.enum(RELATION_TYPES),
  confidence: z.number().min(0).max(1).default(1.0),
  discoverySource: z.enum(DISCOVERY_SOURCES).default('manual'),
  metadata: z.record(z.unknown()).optional(),
});
