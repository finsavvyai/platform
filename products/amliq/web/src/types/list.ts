export interface ListSource {
  name: string;
  code: string;
  country?: string;
  type: 'ofac' | 'eu_sanctions' | 'un_sanctions' | 'custom' | 'internal';
  lastUpdated: string;
  entries: number;
  enabled: boolean;
}

export interface SanctionsList extends ListSource {
  id: string;
  createdAt: string;
  updatedAt: string;
}
