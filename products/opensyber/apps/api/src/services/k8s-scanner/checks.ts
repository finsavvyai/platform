/**
 * K8s Security Checks
 *
 * Individual check functions for Kubernetes security scanning.
 * Each returns an array of SecurityFinding for any issues found.
 */

import type { SecurityFinding, PodSpec, ServiceSpec, RoleBindingSpec, NamespaceSpec } from './types.js';

/** Check pod security standards (privileged, root, host access). */
export function checkPodSecurity(pods: PodSpec[]): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  for (const pod of pods) {
    const ns = pod.metadata.namespace;
    const name = pod.metadata.name;

    if (pod.spec.hostNetwork) {
      findings.push({
        checkId: 'K8S-POD-001', severity: 'high', title: 'Pod uses host network',
        description: `Pod ${name} in ${ns} has hostNetwork enabled.`,
        resourceId: name, resourceType: 'Pod', namespace: ns,
        remediation: 'Remove hostNetwork: true from pod spec.',
      });
    }
    if (pod.spec.hostPID) {
      findings.push({
        checkId: 'K8S-POD-002', severity: 'high', title: 'Pod uses host PID namespace',
        description: `Pod ${name} in ${ns} has hostPID enabled.`,
        resourceId: name, resourceType: 'Pod', namespace: ns,
        remediation: 'Remove hostPID: true from pod spec.',
      });
    }
    for (const ctr of pod.spec.containers) {
      if (ctr.securityContext?.privileged) {
        findings.push({
          checkId: 'K8S-POD-003', severity: 'critical', title: 'Privileged container',
          description: `Container ${ctr.name} in pod ${name} runs privileged.`,
          resourceId: `${name}/${ctr.name}`, resourceType: 'Container', namespace: ns,
          remediation: 'Set securityContext.privileged to false.',
        });
      }
      if (ctr.securityContext?.allowPrivilegeEscalation !== false) {
        findings.push({
          checkId: 'K8S-POD-004', severity: 'medium', title: 'Privilege escalation allowed',
          description: `Container ${ctr.name} in pod ${name} allows privilege escalation.`,
          resourceId: `${name}/${ctr.name}`, resourceType: 'Container', namespace: ns,
          remediation: 'Set allowPrivilegeEscalation: false in securityContext.',
        });
      }
    }
  }
  return findings;
}

/** Check for RBAC misconfigurations (cluster-admin bindings, wildcard). */
export function checkRbacMisconfig(bindings: RoleBindingSpec[]): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  for (const b of bindings) {
    if (b.roleRef.name === 'cluster-admin') {
      findings.push({
        checkId: 'K8S-RBAC-001', severity: 'high',
        title: 'cluster-admin binding detected',
        description: `RoleBinding ${b.metadata.name} grants cluster-admin.`,
        resourceId: b.metadata.name, resourceType: 'ClusterRoleBinding',
        namespace: b.metadata.namespace ?? 'cluster',
        remediation: 'Use least-privilege roles instead of cluster-admin.',
      });
    }
    for (const subj of b.subjects ?? []) {
      if (subj.kind === 'Group' && subj.name === 'system:unauthenticated') {
        findings.push({
          checkId: 'K8S-RBAC-002', severity: 'critical',
          title: 'Unauthenticated access granted',
          description: `Binding ${b.metadata.name} grants access to unauthenticated users.`,
          resourceId: b.metadata.name, resourceType: 'RoleBinding',
          namespace: b.metadata.namespace ?? 'cluster',
          remediation: 'Remove system:unauthenticated from role binding subjects.',
        });
      }
    }
  }
  return findings;
}

/** Check for externally exposed services (LoadBalancer, NodePort). */
export function checkExposedServices(services: ServiceSpec[]): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  for (const svc of services) {
    if (svc.spec.type === 'LoadBalancer') {
      findings.push({
        checkId: 'K8S-SVC-001', severity: 'medium', title: 'LoadBalancer service exposed',
        description: `Service ${svc.metadata.name} in ${svc.metadata.namespace} is externally exposed.`,
        resourceId: svc.metadata.name, resourceType: 'Service', namespace: svc.metadata.namespace,
        remediation: 'Use ClusterIP with an Ingress controller instead.',
      });
    }
    if (svc.spec.type === 'NodePort') {
      findings.push({
        checkId: 'K8S-SVC-002', severity: 'medium', title: 'NodePort service detected',
        description: `Service ${svc.metadata.name} in ${svc.metadata.namespace} uses NodePort.`,
        resourceId: svc.metadata.name, resourceType: 'Service', namespace: svc.metadata.namespace,
        remediation: 'Replace NodePort with ClusterIP + Ingress.',
      });
    }
  }
  return findings;
}

/** Check container images for known vulnerability patterns. */
export function checkContainerImages(pods: PodSpec[]): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  for (const pod of pods) {
    for (const ctr of pod.spec.containers) {
      if (ctr.image.endsWith(':latest') || !ctr.image.includes(':')) {
        findings.push({
          checkId: 'K8S-IMG-001', severity: 'medium', title: 'Image uses latest tag',
          description: `Container ${ctr.name} in pod ${pod.metadata.name} uses latest/untagged image.`,
          resourceId: `${pod.metadata.name}/${ctr.name}`, resourceType: 'Container',
          namespace: pod.metadata.namespace,
          remediation: 'Pin container images to a specific version or digest.',
        });
      }
    }
  }
  return findings;
}

/** Check namespace isolation (missing network policies). */
export function checkNamespaceIsolation(namespaces: NamespaceSpec[]): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const systemNs = ['kube-system', 'kube-public', 'kube-node-lease', 'default'];
  for (const ns of namespaces) {
    if (systemNs.includes(ns.metadata.name)) continue;
    const labels = ns.metadata.labels ?? {};
    if (!labels['pod-security.kubernetes.io/enforce']) {
      findings.push({
        checkId: 'K8S-NS-001', severity: 'medium',
        title: 'Namespace missing pod security standard',
        description: `Namespace ${ns.metadata.name} lacks pod security admission labels.`,
        resourceId: ns.metadata.name, resourceType: 'Namespace', namespace: ns.metadata.name,
        remediation: 'Add pod-security.kubernetes.io/enforce label (baseline or restricted).',
      });
    }
  }
  return findings;
}
