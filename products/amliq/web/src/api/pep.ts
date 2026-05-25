import { api } from './client';

export interface PEPProfile {
  id: string;
  name: string;
  country: string;
  position: string;
  level: 'head_of_state' | 'senior_official' | 'regional' | 'family' | 'associate';
  active: boolean;
}

export interface PEPScreenResult {
  is_pep: boolean;
  confidence: number;
  matches: PEPProfile[];
}

interface PEPListResponse {
  profiles: PEPProfile[];
  total: number;
}

export const pepApi = {
  screen: (name: string, country?: string) =>
    api.post<PEPScreenResult>('/pep/screen', { name, country }),
  listByCountry: (country?: string) => {
    const qs = country ? `?country=${country}` : '';
    return api.get<PEPListResponse>(`/pep${qs}`);
  },
};
