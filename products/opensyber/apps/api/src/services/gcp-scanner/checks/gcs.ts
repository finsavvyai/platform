/**
 * GCP Cloud Storage Security Checks
 *
 * Checks for publicly accessible GCS buckets by inspecting
 * iamConfiguration.publicAccessPrevention on each bucket.
 */

import type { SecurityFinding } from '../../aws-scanner/types.js';

const GCS_API_URL = 'https://storage.googleapis.com/storage/v1/b';

interface GcsBucket {
  name: string;
  iamConfiguration?: {
    publicAccessPrevention?: string;
    uniformBucketLevelAccess?: {
      enabled?: boolean;
    };
  };
}

interface GcsBucketListResponse {
  items?: GcsBucket[];
}

/**
 * Run GCP Cloud Storage security checks for a project
 */
export async function runGcpGcsChecks(
  accessToken: string,
  projectId: string,
): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];

  try {
    const response = await fetch(
      `${GCS_API_URL}?project=${projectId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GCS API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as GcsBucketListResponse;
    const buckets = data.items ?? [];

    for (const bucket of buckets) {
      const publicAccessPrevention =
        bucket.iamConfiguration?.publicAccessPrevention;

      if (publicAccessPrevention !== 'enforced') {
        findings.push({
          checkId: 'gcp-gcs-public-bucket',
          severity: 'critical',
          resourceId: bucket.name,
          resourceType: 'gcs-bucket',
          region: 'global',
          title: 'GCS bucket public access prevention not enforced',
          description: `Bucket "${bucket.name}" does not enforce public access prevention (current: "${publicAccessPrevention ?? 'unspecified'}"). This may allow public access to objects.`,
          remediation: 'Enable "Public access prevention" on the bucket by setting publicAccessPrevention to "enforced".',
          complianceFrameworks: ['CIS GCP 5.1', 'SOC2 CC6.6'],
        });
      }

      const uniformAccess =
        bucket.iamConfiguration?.uniformBucketLevelAccess?.enabled;
      if (!uniformAccess) {
        findings.push({
          checkId: 'gcp-gcs-uniform-access',
          severity: 'medium',
          resourceId: bucket.name,
          resourceType: 'gcs-bucket',
          region: 'global',
          title: 'GCS bucket uniform access not enabled',
          description: `Bucket "${bucket.name}" does not have uniform bucket-level access enabled. ACLs may grant unintended public access.`,
          remediation: 'Enable uniform bucket-level access to enforce IAM-only permissions.',
          complianceFrameworks: ['CIS GCP 5.2', 'SOC2 CC6.1'],
        });
      }
    }
  } catch (error) {
    findings.push({
      checkId: 'gcp-gcs-public-bucket',
      severity: 'low',
      resourceId: projectId,
      resourceType: 'gcp-project',
      region: 'global',
      title: 'Could not check GCS buckets',
      description: `Failed to list buckets: ${error instanceof Error ? error.message : 'Unknown error'}`,
      remediation: 'Verify the service account has storage.buckets.list permission.',
    });
  }

  return findings;
}
