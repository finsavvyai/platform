export interface IacFinding {
  id: string;
  rule: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  resource: string;
  line: number;
  description: string;
  remediation: string;
}

export interface IacScan {
  id: string;
  fileName: string;
  framework: 'terraform' | 'cloudformation' | 'kubernetes' | 'dockerfile';
  status: 'passed' | 'failed' | 'warning';
  findings: IacFinding[];
  scannedAt: string;
  linesScanned: number;
}

export type Framework = IacScan['framework'];

export const FRAMEWORK_CONFIG: Record<Framework, { label: string; color: string }> = {
  terraform: { label: 'Terraform', color: 'bg-purple-500/20 text-purple-400' },
  cloudformation: { label: 'CloudFormation', color: 'bg-amber-500/20 text-amber-400' },
  kubernetes: { label: 'Kubernetes', color: 'bg-info/20 text-info' },
  dockerfile: { label: 'Dockerfile', color: 'bg-info/20 text-info' },
};

export const SEVERITY_COLORS: Record<IacFinding['severity'], string> = {
  critical: 'bg-red-500/20 text-red-400',
  high: 'bg-amber-500/20 text-amber-400',
  medium: 'bg-info/20 text-info',
  low: 'bg-neutral-500/20 text-neutral-400',
};

export const STATUS_COLORS: Record<IacScan['status'], string> = {
  passed: 'bg-green-500/20 text-green-400',
  failed: 'bg-red-500/20 text-red-400',
  warning: 'bg-amber-500/20 text-amber-400',
};
