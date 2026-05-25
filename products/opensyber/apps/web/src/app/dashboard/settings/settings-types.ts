import type { Region, Plan } from '@opensyber/shared';

export interface UserData {
  id: string;
  plan: Plan;
  email: string;
}

export interface InstanceData {
  id: string;
  name: string;
  region: Region;
  hostname: string | null;
  hasGatewayToken: boolean;
  createdAt: string;
}

export interface SecretData {
  id: string;
  key: string;
  createdAt: string;
}
