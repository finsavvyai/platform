export type IdentityType = 'human' | 'service' | 'bot' | 'automation';

export interface IdentityPermissions {
  admin: number;
  write: number;
  read: number;
  execute: number;
}

export interface Identity {
  id: string;
  name: string;
  email?: string;
  type: IdentityType;
  owner?: string;
  granted: number;
  used: number;
  grantedBreakdown: IdentityPermissions;
  usedBreakdown: IdentityPermissions;
  riskScore: number;
  lastActive: string;
  createdAt: string;
}

export interface EntitlementStats {
  totalIdentities: number;
  overPrivileged: number;
  unusedPermissions: number;
  nonHumanIdentities: number;
}

export function calcGap(granted: number, used: number): number {
  if (granted === 0) return 0;
  return Math.round(((granted - used) / granted) * 100);
}
