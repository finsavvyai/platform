/**
 * Kubernetes Security Scanner
 *
 * Runs 5 security checks against a Kubernetes cluster via its REST API:
 * 1. Pod Security Standards — privileged, root, host access
 * 2. RBAC Misconfiguration — cluster-admin bindings, unauthenticated access
 * 3. Exposed Services — LoadBalancer, NodePort without Ingress
 * 4. Container Image Vulnerabilities — latest tags, untagged images
 * 5. Namespace Isolation — missing pod security admission labels
 */

import type { KubeConfig, KubeApiResponse, SecurityFinding, PodSpec, ServiceSpec, RoleBindingSpec, NamespaceSpec } from './types.js';
import { checkPodSecurity, checkRbacMisconfig, checkExposedServices, checkContainerImages, checkNamespaceIsolation } from './checks.js';

async function kubeGet<T>(config: KubeConfig, path: string): Promise<T[]> {
  const url = `${config.apiServer}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.token}`,
    Accept: 'application/json',
  };

  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`K8s API ${path} failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as KubeApiResponse<T>;
  return data.items ?? [];
}

/** Run all K8s security checks and return consolidated findings. */
export async function runK8sScan(kubeConfig: KubeConfig): Promise<SecurityFinding[]> {
  const [pods, services, roleBindings, namespaces] = await Promise.all([
    kubeGet<PodSpec>(kubeConfig, '/api/v1/pods'),
    kubeGet<ServiceSpec>(kubeConfig, '/api/v1/services'),
    kubeGet<RoleBindingSpec>(kubeConfig, '/apis/rbac.authorization.k8s.io/v1/clusterrolebindings'),
    kubeGet<NamespaceSpec>(kubeConfig, '/api/v1/namespaces'),
  ]);

  const findings: SecurityFinding[] = [
    ...checkPodSecurity(pods),
    ...checkRbacMisconfig(roleBindings),
    ...checkExposedServices(services),
    ...checkContainerImages(pods),
    ...checkNamespaceIsolation(namespaces),
  ];

  return findings;
}

export type { SecurityFinding, KubeConfig } from './types.js';
