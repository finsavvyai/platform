export type CountryRisk = 'low' | 'medium' | 'high'

export interface RiskCountry {
  code: string
  name: string
  risk: CountryRisk
}

// FATF high-risk + jurisdictions under increased monitoring (grey list) as
// of the most recent FATF plenary. Medium-risk reflects EU-commission
// enhanced due diligence list overlap. Low is everything else.
export const RISK_COUNTRIES: RiskCountry[] = [
  // FATF high-risk (black list)
  { code: 'KP', name: 'North Korea', risk: 'high' },
  { code: 'IR', name: 'Iran', risk: 'high' },
  { code: 'MM', name: 'Myanmar (Burma)', risk: 'high' },

  // FATF grey list / EU enhanced DD
  { code: 'AF', name: 'Afghanistan', risk: 'high' },
  { code: 'SY', name: 'Syria', risk: 'high' },
  { code: 'YE', name: 'Yemen', risk: 'high' },
  { code: 'AL', name: 'Albania', risk: 'medium' },
  { code: 'BB', name: 'Barbados', risk: 'medium' },
  { code: 'BF', name: 'Burkina Faso', risk: 'medium' },
  { code: 'KH', name: 'Cambodia', risk: 'medium' },
  { code: 'KY', name: 'Cayman Islands', risk: 'medium' },
  { code: 'HT', name: 'Haiti', risk: 'medium' },
  { code: 'JM', name: 'Jamaica', risk: 'medium' },
  { code: 'JO', name: 'Jordan', risk: 'medium' },
  { code: 'ML', name: 'Mali', risk: 'medium' },
  { code: 'MA', name: 'Morocco', risk: 'medium' },
  { code: 'MZ', name: 'Mozambique', risk: 'medium' },
  { code: 'NI', name: 'Nicaragua', risk: 'medium' },
  { code: 'PK', name: 'Pakistan', risk: 'medium' },
  { code: 'PA', name: 'Panama', risk: 'medium' },
  { code: 'PH', name: 'Philippines', risk: 'medium' },
  { code: 'SN', name: 'Senegal', risk: 'medium' },
  { code: 'SS', name: 'South Sudan', risk: 'medium' },
  { code: 'TR', name: 'Turkey', risk: 'medium' },
  { code: 'UG', name: 'Uganda', risk: 'medium' },
  { code: 'AE', name: 'United Arab Emirates', risk: 'medium' },

  // Low-risk — common jurisdictions
  { code: 'AU', name: 'Australia', risk: 'low' },
  { code: 'AT', name: 'Austria', risk: 'low' },
  { code: 'BE', name: 'Belgium', risk: 'low' },
  { code: 'BR', name: 'Brazil', risk: 'low' },
  { code: 'CA', name: 'Canada', risk: 'low' },
  { code: 'CL', name: 'Chile', risk: 'low' },
  { code: 'CN', name: 'China', risk: 'low' },
  { code: 'CZ', name: 'Czech Republic', risk: 'low' },
  { code: 'DK', name: 'Denmark', risk: 'low' },
  { code: 'FI', name: 'Finland', risk: 'low' },
  { code: 'FR', name: 'France', risk: 'low' },
  { code: 'DE', name: 'Germany', risk: 'low' },
  { code: 'GR', name: 'Greece', risk: 'low' },
  { code: 'HK', name: 'Hong Kong', risk: 'low' },
  { code: 'HU', name: 'Hungary', risk: 'low' },
  { code: 'IS', name: 'Iceland', risk: 'low' },
  { code: 'IN', name: 'India', risk: 'low' },
  { code: 'ID', name: 'Indonesia', risk: 'low' },
  { code: 'IE', name: 'Ireland', risk: 'low' },
  { code: 'IL', name: 'Israel', risk: 'low' },
  { code: 'IT', name: 'Italy', risk: 'low' },
  { code: 'JP', name: 'Japan', risk: 'low' },
  { code: 'LU', name: 'Luxembourg', risk: 'low' },
  { code: 'MY', name: 'Malaysia', risk: 'low' },
  { code: 'MX', name: 'Mexico', risk: 'low' },
  { code: 'NL', name: 'Netherlands', risk: 'low' },
  { code: 'NZ', name: 'New Zealand', risk: 'low' },
  { code: 'NO', name: 'Norway', risk: 'low' },
  { code: 'PL', name: 'Poland', risk: 'low' },
  { code: 'PT', name: 'Portugal', risk: 'low' },
  { code: 'RO', name: 'Romania', risk: 'low' },
  { code: 'SA', name: 'Saudi Arabia', risk: 'low' },
  { code: 'SG', name: 'Singapore', risk: 'low' },
  { code: 'SK', name: 'Slovakia', risk: 'low' },
  { code: 'ZA', name: 'South Africa', risk: 'low' },
  { code: 'KR', name: 'South Korea', risk: 'low' },
  { code: 'ES', name: 'Spain', risk: 'low' },
  { code: 'SE', name: 'Sweden', risk: 'low' },
  { code: 'CH', name: 'Switzerland', risk: 'low' },
  { code: 'TW', name: 'Taiwan', risk: 'low' },
  { code: 'TH', name: 'Thailand', risk: 'low' },
  { code: 'GB', name: 'United Kingdom', risk: 'low' },
  { code: 'US', name: 'United States', risk: 'low' },
  { code: 'VN', name: 'Vietnam', risk: 'low' },
]
