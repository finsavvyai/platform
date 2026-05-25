import type { PEPProfile } from './pepProfiles'

export const PEP_PROFILES_EXTRA: PEPProfile[] = [
  {
    id: 'PEP-011', name: 'Benjamin Netanyahu', position: 'Prime Minister',
    country: 'Israel', tier: 'Tier1', riskWeight: 1.0, isActive: true,
    startDate: '2022-12-29', aliases: ['Bibi', 'בנימין נתניהו'],
    sanctions: [],
  },
  {
    id: 'PEP-012', name: 'Bill Clinton', position: 'Former President',
    country: 'United States', tier: 'Tier1', riskWeight: 0.6, isActive: false,
    startDate: '1993-01-20', endDate: '2001-01-20',
    aliases: ['William Jefferson Clinton'], sanctions: [],
  },
  {
    id: 'PEP-013', name: 'Joe Biden', position: 'President',
    country: 'United States', tier: 'Tier1', riskWeight: 1.0, isActive: true,
    startDate: '2021-01-20', aliases: ['Joseph Robinette Biden Jr.'],
    sanctions: [],
  },
  {
    id: 'PEP-014', name: 'Emmanuel Macron', position: 'President',
    country: 'France', tier: 'Tier1', riskWeight: 1.0, isActive: true,
    startDate: '2017-05-14', aliases: ['Макрон'], sanctions: [],
  },
  {
    id: 'PEP-015', name: 'Donald Trump', position: 'President',
    country: 'United States', tier: 'Tier1', riskWeight: 1.0, isActive: true,
    startDate: '2025-01-20', aliases: ['DJT'], sanctions: [],
  },
  {
    id: 'PEP-016', name: 'Olaf Scholz', position: 'Chancellor',
    country: 'Germany', tier: 'Tier1', riskWeight: 1.0, isActive: true,
    startDate: '2021-12-08', aliases: [], sanctions: [],
  },
  {
    id: 'PEP-017', name: 'Narendra Modi', position: 'Prime Minister',
    country: 'India', tier: 'Tier1', riskWeight: 1.0, isActive: true,
    startDate: '2014-05-26', aliases: ['नरेन्द्र मोदी'], sanctions: [],
  },
  {
    id: 'PEP-018', name: 'Keir Starmer', position: 'Prime Minister',
    country: 'United Kingdom', tier: 'Tier1', riskWeight: 1.0, isActive: true,
    startDate: '2024-07-05', aliases: [], sanctions: [],
  },
  {
    id: 'PEP-019', name: 'Yair Lapid', position: 'Opposition Leader',
    country: 'Israel', tier: 'Tier2', riskWeight: 0.7, isActive: true,
    startDate: '2023-01-01', aliases: ['יאיר לפיד'], sanctions: [],
  },
  {
    id: 'PEP-020', name: 'Hillary Clinton', position: 'Former Secretary of State',
    country: 'United States', tier: 'Tier2', riskWeight: 0.6, isActive: false,
    startDate: '2009-01-21', endDate: '2013-02-01',
    aliases: ['Hillary Rodham Clinton'], sanctions: [],
  },
]
