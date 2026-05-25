import { ModeContext, Mode } from "lunaforge-core";

export interface AuraMetrics {
    languageStats: Record<string, number>;
    fileCount: number;
    totalSize: number;
    lastUpdated: number;
    // Phase 6 Advanced Metrics
    complexityScore?: number;      // 0-100 (higher = more complex)
    busFactor?: BusFactorInfo;
    dependencyHealth?: DependencyHealth;
}

export interface BusFactorInfo {
    score: number;                 // 1-10 (1 = high risk, 10 = healthy)
    singleOwnerFiles: string[];    // Files with only one contributor
    topContributors: Array<{ name: string; fileCount: number }>;
}

export interface DependencyHealth {
    circularDeps: string[][];      // Array of circular dependency chains
    orphanFiles: string[];         // Files not imported anywhere
    healthScore: number;           // 0-100 (100 = perfectly healthy)
}

export interface AuraAPI {
    getMetrics(): Promise<AuraMetrics>;
    refresh(): Promise<void>;
}
