export interface DataSource {
  id: string
  name: string
  recordCount: number
  lastUpdated: string
  status: 'active' | 'pending' | 'planned'
  category: string
  coverageCountries: number
}

export const dataSources: DataSource[] = [
  {
    id: 'ofac', name: 'OFAC Consolidated List',
    recordCount: 12847, lastUpdated: '2024-01-13',
    status: 'active', category: 'US Sanctions', coverageCountries: 195,
  },
  {
    id: 'un', name: 'UN Security Council',
    recordCount: 3421, lastUpdated: '2024-01-12',
    status: 'active', category: 'International', coverageCountries: 193,
  },
  {
    id: 'eu', name: 'EU Financial Sanctions',
    recordCount: 8956, lastUpdated: '2024-01-13',
    status: 'active', category: 'EU Sanctions', coverageCountries: 27,
  },
  {
    id: 'opensanctions', name: 'OpenSanctions',
    recordCount: 98234, lastUpdated: '2024-01-13',
    status: 'active', category: 'Comprehensive', coverageCountries: 195,
  },
  {
    id: 'everypolitician', name: 'EveryPolitician PEP',
    recordCount: 1847263, lastUpdated: '2024-01-10',
    status: 'active', category: 'PEP Screening', coverageCountries: 178,
  },
  {
    id: 'icij', name: 'ICIJ Offshore Leaks',
    recordCount: 641234, lastUpdated: '2024-01-09',
    status: 'active', category: 'Intelligence', coverageCountries: 89,
  },
  {
    id: 'gleif', name: 'GLEIF Entity Data',
    recordCount: 3487123, lastUpdated: '2024-01-13',
    status: 'active', category: 'Corporate', coverageCountries: 195,
  },
]

export const statusColors: Record<string, string> = {
  active: '#C9A96E',
  pending: '#4F46E5',
  planned: '#D97706',
}

export const statusLabels: Record<string, string> = {
  active: 'Active',
  pending: 'Syncing',
  planned: 'Planned',
}
