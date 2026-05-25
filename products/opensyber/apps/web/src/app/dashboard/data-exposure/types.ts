export interface ExposureStats {
  anonymousLinks: number;
  avgOrgLinks: number;
  externalShares: number;
  piiRecords: number;
  unencryptedFiles: number;
}

export interface DataClassification {
  id: string;
  type: 'PII' | 'PHI' | 'Financial' | 'Credentials' | 'Source Code' | 'Internal Docs';
  count: number;
  exposure: 'Public' | 'External' | 'Internal' | 'Protected';
  riskColor: string;
}

export interface ServiceExposure {
  id: string;
  service: string;
  count: number;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  color: string;
}

export interface ExposureEvent {
  id: string;
  dataType: string;
  location: string;
  exposureType: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  detected: string;
}

export const EXPOSURE_COLORS: Record<string, string> = {
  Public: 'bg-red-500/20 text-red-400',
  External: 'bg-amber-500/20 text-amber-400',
  Internal: 'bg-info/20 text-info',
  Protected: 'bg-green-500/20 text-green-400',
};

export const SEVERITY_COLORS: Record<string, string> = {
  Critical: 'bg-red-500/20 text-red-400',
  High: 'bg-amber-500/20 text-amber-400',
  Medium: 'bg-info/20 text-info',
  Low: 'bg-neutral-500/20 text-neutral-400',
};
