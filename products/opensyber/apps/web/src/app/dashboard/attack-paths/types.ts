export interface AssetNode {
  id: string;
  name: string;
  assetType: string;
  sensitivity: string;
  isCrownJewel: boolean;
  hops: number;
  path: string[];
}

export interface AttackPath {
  targetAssetId: string;
  targetName: string;
  targetSensitivity: string;
  isCrownJewel: boolean;
  hops: number;
  path: string[];
}

export interface BlastRadiusData {
  entryAssetId: string;
  blastRadius: {
    score: number;
    totalReachable: number;
    crownJewelsReached: number;
    byType: Record<string, number>;
    bySensitivity: Record<string, number>;
  };
  crownJewelPaths: AttackPath[];
  totalCrownJewels: number;
  reachableAssets: AssetNode[];
}

export interface AssetRecord {
  id: string;
  orgId: string;
  assetType: string;
  name: string;
  identifier: string;
  sensitivity: string;
  isCrownJewel: boolean;
  metadata: string | null;
  discoverySource: string;
  status: string;
  firstSeenAt: string;
  lastSeenAt: string;
}
