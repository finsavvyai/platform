/**
 * Azure RBAC Security Checks
 *
 * Checks for overly broad role assignments at the subscription scope.
 * Flags Owner and Contributor built-in roles assigned at subscription level.
 */

import type { SecurityFinding } from '../../aws-scanner/types.js';

const ROLE_ASSIGNMENTS_API = 'https://management.azure.com/subscriptions';
const API_VERSION = '2022-04-01';

/** Built-in role definition IDs for overly broad roles */
const OVERLY_BROAD_ROLE_IDS: Record<string, string> = {
  '8e3af657-a8ff-443c-a75c-2fe8c4bcb635': 'Owner',
  'b24988ac-6180-42a0-ab88-20f7382dd24c': 'Contributor',
};

interface RoleAssignment {
  id: string;
  properties: {
    roleDefinitionId: string;
    principalId: string;
    principalType?: string;
    scope: string;
  };
}

interface RoleAssignmentsResponse {
  value?: RoleAssignment[];
}

/**
 * Run Azure RBAC security checks for a subscription
 */
export async function runAzureRbacChecks(
  accessToken: string,
  subscriptionId: string,
): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];

  try {
    const url = `${ROLE_ASSIGNMENTS_API}/${subscriptionId}/providers/Microsoft.Authorization/roleAssignments?api-version=${API_VERSION}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Azure RBAC API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as RoleAssignmentsResponse;
    const assignments = data.value ?? [];

    for (const assignment of assignments) {
      const roleDefId = extractRoleDefinitionId(assignment.properties.roleDefinitionId);
      const roleName = OVERLY_BROAD_ROLE_IDS[roleDefId];
      if (!roleName) continue;

      const isSubscriptionScope =
        assignment.properties.scope === `/subscriptions/${subscriptionId}`;
      if (!isSubscriptionScope) continue;

      findings.push({
        checkId: 'azure-rbac-broad-role',
        severity: 'high',
        resourceId: assignment.properties.principalId,
        resourceType: 'azure-role-assignment',
        region: 'global',
        title: `${roleName} role assigned at subscription scope`,
        description: `Principal "${assignment.properties.principalId}" (${assignment.properties.principalType ?? 'unknown'}) has "${roleName}" role at subscription scope. This grants excessive permissions.`,
        remediation: `Replace the "${roleName}" role with a more specific role following the principle of least privilege.`,
        complianceFrameworks: ['CIS Azure 1.23', 'SOC2 CC6.3'],
      });
    }
  } catch (error) {
    findings.push({
      checkId: 'azure-rbac-broad-role',
      severity: 'low',
      resourceId: subscriptionId,
      resourceType: 'azure-subscription',
      region: 'global',
      title: 'Could not check Azure RBAC assignments',
      description: `Failed to retrieve role assignments: ${error instanceof Error ? error.message : 'Unknown error'}`,
      remediation: 'Verify the service principal has Microsoft.Authorization/roleAssignments/read permission.',
    });
  }

  return findings;
}

function extractRoleDefinitionId(fullId: string): string {
  const parts = fullId.split('/');
  return parts[parts.length - 1] ?? fullId;
}
