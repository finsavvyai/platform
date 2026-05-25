/**
 * GCP IAM Security Checks
 *
 * Checks for overly permissive IAM bindings on GCP projects.
 * Flags service accounts with Owner or Editor roles.
 */

import type { SecurityFinding } from '../../aws-scanner/types.js';

const IAM_POLICY_URL = 'https://cloudresourcemanager.googleapis.com/v1/projects';
const OVERLY_BROAD_ROLES = ['roles/owner', 'roles/editor'];

interface IamBinding {
  role: string;
  members: string[];
}

interface IamPolicyResponse {
  bindings?: IamBinding[];
}

/**
 * Run GCP IAM security checks for a project
 */
export async function runGcpIamChecks(
  accessToken: string,
  projectId: string,
): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];

  try {
    const response = await fetch(
      `${IAM_POLICY_URL}/${projectId}:getIamPolicy`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ options: { requestedPolicyVersion: 3 } }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`IAM API error (${response.status}): ${errorText}`);
    }

    const policy = (await response.json()) as IamPolicyResponse;
    const bindings = policy.bindings ?? [];

    for (const binding of bindings) {
      if (!OVERLY_BROAD_ROLES.includes(binding.role)) continue;

      const serviceAccountMembers = binding.members.filter((m) =>
        m.startsWith('serviceAccount:'),
      );

      for (const member of serviceAccountMembers) {
        findings.push({
          checkId: 'gcp-iam-broad-role',
          severity: 'high',
          resourceId: member.replace('serviceAccount:', ''),
          resourceType: 'gcp-iam-binding',
          region: 'global',
          title: `Service account has overly broad role: ${binding.role}`,
          description: `Service account "${member}" is assigned "${binding.role}" on project "${projectId}". This grants excessive permissions.`,
          remediation: `Replace "${binding.role}" with fine-grained roles following the principle of least privilege.`,
          complianceFrameworks: ['CIS GCP 1.6', 'SOC2 CC6.3'],
        });
      }
    }
  } catch (error) {
    findings.push({
      checkId: 'gcp-iam-broad-role',
      severity: 'low',
      resourceId: projectId,
      resourceType: 'gcp-project',
      region: 'global',
      title: 'Could not check GCP IAM policy',
      description: `Failed to retrieve IAM policy: ${error instanceof Error ? error.message : 'Unknown error'}`,
      remediation: 'Verify the service account has resourcemanager.projects.getIamPolicy permission.',
    });
  }

  return findings;
}
