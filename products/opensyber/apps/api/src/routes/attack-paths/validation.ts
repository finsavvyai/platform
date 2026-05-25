import { z } from 'zod';
import { ASSET_TYPES, SENSITIVITY_LEVELS, RELATION_TYPES } from '@opensyber/shared';

export const attackPathQuerySchema = z.object({
  entryAssetId: z.string().min(1),
  maxDepth: z.number().min(1).max(20).default(10),
  minConfidence: z.number().min(0).max(1).default(0.5),
  filterAssetTypes: z.array(z.enum(ASSET_TYPES)).optional(),
  filterSensitivity: z.array(z.enum(SENSITIVITY_LEVELS)).optional(),
  filterRelationTypes: z.array(z.enum(RELATION_TYPES)).optional(),
});
