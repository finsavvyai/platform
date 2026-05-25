import { z } from 'zod';
import {
  ASSET_TYPES, SENSITIVITY_LEVELS,
  DISCOVERY_SOURCES, ASSET_STATUS,
} from '@opensyber/shared';

export const createAssetSchema = z.object({
  assetType: z.enum(ASSET_TYPES),
  name: z.string().min(1).max(200),
  identifier: z.string().min(1).max(500),
  sensitivity: z.enum(SENSITIVITY_LEVELS).default('medium'),
  isCrownJewel: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional(),
  discoverySource: z.enum(DISCOVERY_SOURCES).default('manual'),
});

export const updateAssetSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  sensitivity: z.enum(SENSITIVITY_LEVELS).optional(),
  isCrownJewel: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
  status: z.enum(ASSET_STATUS).optional(),
});

export const listAssetsQuerySchema = z.object({
  assetType: z.enum(ASSET_TYPES).optional(),
  sensitivity: z.enum(SENSITIVITY_LEVELS).optional(),
  status: z.enum(ASSET_STATUS).optional(),
  crownJewel: z.enum(['true', 'false']).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
});
