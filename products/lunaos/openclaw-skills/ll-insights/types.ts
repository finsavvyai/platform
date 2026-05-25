export type InsightSource = 'analytics' | 'support' | 'feedback' | 'surveys' | 'sales' | 'research';

export type ImpactDimension =
    | 'business'
    | 'product'
    | 'usability'
    | 'environmental'
    | 'combined';

export interface ImpactWeights {
    business: number;
    product: number;
    usability: number;
    environmental: number;
}

export interface InsightsConfig {
    lunaosApiUrl: string;
    lunaosApiKey: string;
    ragIndexName: string;
}

export interface IngestParams {
    sources: InsightSource[];
    windowDays?: number;
}

export interface IngestResult {
    ingested: number;
    bySource: Record<InsightSource, number>;
}

export interface ClusteredIssue {
    id: string;
    title: string;
    tags: string[];
    evidence: string[];
    cluster_size: number;
}

export interface BacklogItem extends ClusteredIssue {
    impact: {
        business: number;
        product: number;
        usability: number;
        environmental?: number;
        combined: number;
    };
    effortHours?: number;
    roi?: number;
}

export interface ScoreParams {
    issues: ClusteredIssue[];
    weights?: Partial<ImpactWeights>;
    minScore?: number;
    dimension?: ImpactDimension;
    limit?: number;
}

export interface ScoreResult {
    backlog: BacklogItem[];
    summary: {
        scored: number;
        filtered: number;
        emitted: number;
    };
}

export interface EmitParams {
    backlog: BacklogItem[];
    emitTo: 'json' | 'webhook' | 'workflow' | 'stdout';
    targetWorkflowId?: string;
    webhookUrl?: string;
}
