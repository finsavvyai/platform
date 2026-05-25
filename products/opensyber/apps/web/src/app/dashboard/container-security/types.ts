export type Registry = 'Docker Hub' | 'ECR' | 'GCR' | 'ACR';
export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';
export type ContainerStatus = 'Running' | 'Stopped' | 'Error';

export interface ContainerImage {
  id: string;
  name: string;
  tag: string;
  registry: Registry;
  vulns: Record<Severity, number>;
  sizeMB: number;
  lastScanned: string;
  baseImage: string;
}

export interface RuntimeContainer {
  id: string;
  containerId: string;
  imageId: string;
  imageName: string;
  status: ContainerStatus;
  cpuPercent: number;
  memPercent: number;
  uptime: string;
  riskScore: number;
}

export interface CveDataPoint {
  date: string;
  count: number;
}

export const REGISTRY_COLORS: Record<Registry, string> = {
  'Docker Hub': 'bg-info/20 text-info border-info/30',
  ECR: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  GCR: 'bg-green-500/20 text-green-400 border-green-500/30',
  ACR: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

export const SEVERITY_COLORS: Record<Severity, string> = {
  Critical: 'bg-red-500/20 text-red-400',
  High: 'bg-amber-500/20 text-amber-400',
  Medium: 'bg-info/20 text-info',
  Low: 'bg-neutral-500/20 text-neutral-400',
};

export const STATUS_COLORS: Record<ContainerStatus, string> = {
  Running: 'bg-green-500',
  Stopped: 'bg-neutral-500',
  Error: 'bg-red-500',
};
