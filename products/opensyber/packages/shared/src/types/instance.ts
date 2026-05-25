export interface Instance {
  id: string;
  userId: string;
  name: string;
  containerId: string | null;
  hostname: string | null;
  region: Region;
  status: InstanceStatus;
  engineVersion: string | null;
  agentVersion: string | null;
  gatewayTokenEncrypted: string | null;
  tailscaleNodeId: string | null;
  tailscaleIp: string | null;
  lastHealthCheck: string | null;
  lastBackup: string | null;
  createdAt: string;
}

export type Region = 'eu-central' | 'us-east' | 'us-west' | 'ap-southeast';

export type InstanceStatus =
  | 'provisioning'
  | 'installing'
  | 'ready'
  | 'running'
  | 'stopped'
  | 'error'
  | 'suspended'
  | 'destroying';

export interface CreateInstanceInput {
  userId: string;
  name?: string;
  region: Region;
}

export interface InstanceHealthReport {
  instanceId: string;
  status: InstanceStatus;
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
  engineRunning: boolean;
  agentVersion: string;
  engineVersion: string;
  timestamp: string;
}

export const REGION_LABELS: Record<Region, string> = {
  'eu-central': 'Europe (Frankfurt)',
  'us-east': 'US East (Ashburn)',
  'us-west': 'US West (Hillsboro)',
  'ap-southeast': 'Asia Pacific (Singapore)',
};

/** Cloudflare region hints for container placement */
export const CF_REGION_MAP: Record<Region, string> = {
  'eu-central': 'weur',
  'us-east': 'enam',
  'us-west': 'wnam',
  'ap-southeast': 'apac',
};

export const PLAN_INSTANCE_LIMITS: Record<string, number> = {
  free: 1,
  personal: 1,
  pro: 1,
  team: 5,
};

/** Container resource tier per plan */
export const PLAN_CONTAINER_SPECS: Record<string, {
  memory: string;
  vcpu: number;
}> = {
  free: { memory: '256Mi', vcpu: 1 },
  personal: { memory: '512Mi', vcpu: 1 },
  pro: { memory: '1Gi', vcpu: 2 },
  team: { memory: '2Gi', vcpu: 4 },
};
