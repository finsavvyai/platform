export interface PEPProfile {
  id: string
  name: string
  position: string
  country: string
  tier: 'Tier1' | 'Tier2' | 'Tier3' | 'Tier4'
  riskWeight: number
  isActive: boolean
  startDate: string
  endDate?: string
  aliases: string[]
  sanctions: string[]
}

export const SAMPLE_PEP_PROFILES: PEPProfile[] = [
  {
    id: 'PEP-001', name: 'Vladimir V. Putin', position: 'President',
    country: 'Russia', tier: 'Tier1', riskWeight: 1.0, isActive: true,
    startDate: '2000-05-07', aliases: ['Путин Владимир Владимирович'],
    sanctions: ['OFAC SDN', 'EU Consolidated', 'UK Sanctions'],
  },
  {
    id: 'PEP-002', name: 'Xi Jinping', position: 'President',
    country: 'China', tier: 'Tier1', riskWeight: 1.0, isActive: true,
    startDate: '2013-03-14', aliases: ['习近平'],
    sanctions: [],
  },
  {
    id: 'PEP-003', name: 'Mohammed bin Salman', position: 'Crown Prince',
    country: 'Saudi Arabia', tier: 'Tier1', riskWeight: 1.0, isActive: true,
    startDate: '2017-06-21', aliases: ['MBS', 'محمد بن سلمان'],
    sanctions: [],
  },
  {
    id: 'PEP-004', name: 'Sergei Lavrov', position: 'Foreign Minister',
    country: 'Russia', tier: 'Tier2', riskWeight: 0.8, isActive: true,
    startDate: '2004-03-09', aliases: ['Лавров Сергей Викторович'],
    sanctions: ['OFAC SDN', 'EU Consolidated'],
  },
  {
    id: 'PEP-005', name: 'Hassan Nasrallah', position: 'Secretary General',
    country: 'Lebanon', tier: 'Tier2', riskWeight: 0.8, isActive: false,
    startDate: '1992-02-16', endDate: '2024-09-27',
    aliases: ['حسن نصر الله'], sanctions: ['OFAC SDN'],
  },
  {
    id: 'PEP-006', name: 'Elvira Nabiullina', position: 'Central Bank Governor',
    country: 'Russia', tier: 'Tier2', riskWeight: 0.8, isActive: true,
    startDate: '2013-06-24', aliases: ['Набиуллина Эльвира'],
    sanctions: ['EU Consolidated'],
  },
  {
    id: 'PEP-007', name: 'Kim Jong-un', position: 'Supreme Leader',
    country: 'North Korea', tier: 'Tier1', riskWeight: 1.0, isActive: true,
    startDate: '2011-12-30', aliases: ['김정은'],
    sanctions: ['OFAC SDN', 'UN Consolidated', 'EU Consolidated'],
  },
  {
    id: 'PEP-008', name: 'Bashar al-Assad', position: 'Former President',
    country: 'Syria', tier: 'Tier1', riskWeight: 1.0, isActive: false,
    startDate: '2000-07-17', endDate: '2024-12-08',
    aliases: ['بشار الأسد'], sanctions: ['OFAC SDN', 'EU Consolidated'],
  },
  {
    id: 'PEP-009', name: 'Recep Tayyip Erdogan', position: 'President',
    country: 'Turkey', tier: 'Tier1', riskWeight: 1.0, isActive: true,
    startDate: '2014-08-28', aliases: ['رجب طيب أردوغان'],
    sanctions: [],
  },
  {
    id: 'PEP-010', name: 'Nikolai Patrushev', position: 'Security Council Secretary',
    country: 'Russia', tier: 'Tier2', riskWeight: 0.8, isActive: true,
    startDate: '2008-05-12', aliases: ['Патрушев Николай'],
    sanctions: ['OFAC SDN', 'EU Consolidated', 'UK Sanctions'],
  },
]
