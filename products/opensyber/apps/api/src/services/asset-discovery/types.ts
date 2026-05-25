import type { AssetType, SensitivityLevel, RelationType, DiscoverySource } from '@opensyber/shared';

export interface DiscoveredAsset {
  assetType: AssetType;
  name: string;
  identifier: string;
  sensitivity: SensitivityLevel;
  isCrownJewel?: boolean;
  metadata?: Record<string, unknown>;
  discoverySource: DiscoverySource;
}

export interface DiscoveredRelation {
  sourceIdentifier: string;
  targetIdentifier: string;
  relationType: RelationType;
  confidence: number;
  discoverySource: DiscoverySource;
  metadata?: Record<string, unknown>;
}

export interface DiscoveryResult {
  assets: DiscoveredAsset[];
  relations: DiscoveredRelation[];
}

export interface AgentActivityRecord {
  id: string;
  sessionId: string;
  agent: string;
  type: string;
  risk: string;
  path: string | null;
  summary: string;
  secretsCount: number;
}

export interface CspmFindingRecord {
  checkId: string;
  severity: string;
  resourceId: string;
  resourceType: string;
  region: string | null;
  title: string;
}
