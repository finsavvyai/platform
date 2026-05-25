import type { AssetType, SensitivityLevel, RelationType } from '@opensyber/shared';

export interface GraphNode {
  id: string;
  assetType: AssetType;
  name: string;
  identifier: string;
  sensitivity: SensitivityLevel;
  isCrownJewel: boolean;
  edges: GraphEdge[];
}

export interface GraphEdge {
  relationId: string;
  targetId: string;
  relationType: RelationType;
  confidence: number;
}

export interface ReachableAsset {
  asset: GraphNode;
  depth: number;
  path: string[];
}

export interface BfsResult {
  reachable: Map<string, ReachableAsset>;
}

export interface BfsOptions {
  maxDepth?: number;
  minConfidence?: number;
  filterAssetTypes?: AssetType[];
  filterSensitivity?: SensitivityLevel[];
  filterRelationTypes?: RelationType[];
}

export interface BlastRadiusResult {
  score: number;
  totalReachable: number;
  crownJewelsReached: number;
  byType: Record<string, number>;
  bySensitivity: Record<string, number>;
}

export interface AttackPath {
  targetAssetId: string;
  targetName: string;
  targetSensitivity: SensitivityLevel;
  isCrownJewel: boolean;
  hops: number;
  path: string[];
}

export interface CrownJewelPathResult {
  paths: AttackPath[];
  totalCrownJewels: number;
}
