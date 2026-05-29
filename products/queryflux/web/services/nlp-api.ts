import axios from 'axios';
import type { NlpQueryRequest, NlpQueryResponse } from '../types/api';

const NLP_BASE_URL = import.meta.env.VITE_NLP_API_URL || '';

// ============================================================================
// NLP API (QueryLens)
// ============================================================================

export const nlpAPI = {
    async generateSQL(request: NlpQueryRequest): Promise<NlpQueryResponse> {
        const response = await axios.post<NlpQueryResponse>(
            `${NLP_BASE_URL}/api/v1/nlp/query`, request);
        return response.data;
    },

    async health(): Promise<string> {
        const response = await axios.get<string>(
            `${NLP_BASE_URL}/api/v1/nlp/health`);
        return response.data;
    },
};
