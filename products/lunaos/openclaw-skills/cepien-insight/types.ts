export interface CepienConfig {
    apiUrl: string;
    apiKey: string;
    lunaosApiUrl: string;
    lunaosApiKey: string;
}

export interface ImpactScore {
    business: number;
    product: number;
    usability: number;
    combined: number;
}

export interface Recommendation {
    id: string;
    title: string;
    summary?: string;
    impact: ImpactScore;
    evidence?: string[];
    proposed_actions?: string[];
    created_at?: string;
}

export type ImpactDimension = keyof ImpactScore;

export interface ListParams {
    projectId?: string;
    minImpactScore?: number;
    impactDimension?: ImpactDimension;
    limit?: number;
}

export interface ListResult {
    recommendations: Recommendation[];
    summary: {
        fetched: number;
        filtered: number;
        skipped: number;
    };
}

export interface DispatchParams {
    recommendationId: string;
    workflowId: string;
    extraInput?: Record<string, unknown>;
}

export interface DispatchResult {
    runId?: string;
    status: 'dispatched' | 'error';
    error?: string;
}
