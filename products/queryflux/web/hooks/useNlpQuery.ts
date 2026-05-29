import { useMutation } from '@tanstack/react-query';
import { api } from '../services/api';
import type { NlpQueryRequest, NlpQueryResponse } from '../types/api';

export function useNlpQuery() {
    return useMutation<NlpQueryResponse, Error, NlpQueryRequest>({
        mutationFn: (request) => api.nlp.generateSQL(request),
    });
}
