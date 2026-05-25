/**
 * Kubernetes Scanner Types
 *
 * Shared types for K8s security scanning.
 */

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface SecurityFinding {
  checkId: string;
  severity: Severity;
  title: string;
  description: string;
  resourceId: string;
  resourceType: string;
  namespace: string;
  remediation: string;
}

export interface KubeConfig {
  apiServer: string;
  token: string;
  caCert?: string;
}

export interface KubeApiResponse<T = unknown> {
  kind: string;
  items: T[];
}

export interface PodSpec {
  metadata: { name: string; namespace: string; labels?: Record<string, string> };
  spec: {
    securityContext?: { runAsNonRoot?: boolean; readOnlyRootFilesystem?: boolean };
    containers: Array<{
      name: string;
      image: string;
      securityContext?: {
        runAsNonRoot?: boolean;
        readOnlyRootFilesystem?: boolean;
        privileged?: boolean;
        allowPrivilegeEscalation?: boolean;
      };
    }>;
    hostNetwork?: boolean;
    hostPID?: boolean;
  };
}

export interface ServiceSpec {
  metadata: { name: string; namespace: string };
  spec: { type: string; ports?: Array<{ port: number; nodePort?: number }> };
}

export interface RoleBindingSpec {
  metadata: { name: string; namespace: string };
  roleRef: { kind: string; name: string };
  subjects?: Array<{ kind: string; name: string; namespace?: string }>;
}

export interface NamespaceSpec {
  metadata: { name: string; labels?: Record<string, string> };
}
