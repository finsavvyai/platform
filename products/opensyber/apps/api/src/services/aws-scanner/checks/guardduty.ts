/**
 * GuardDuty Security Checks
 *
 * Security checks for Amazon GuardDuty using fetch API.
 * Checks for GuardDuty detector status and enabled state.
 *
 * Based on CIS AWS Foundations Benchmark and Prowler best practices.
 */

import { XMLParser } from 'fast-xml-parser';
import type { ScanContext, SecurityFinding } from '../types.js';
import { guardDutyRequest } from './guardduty-request.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: '#text',
});

/**
 * Check GuardDuty.1: GuardDuty is enabled
 */
export async function checkGuardDutyEnabled(context: ScanContext): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];
  try {
    const response = await guardDutyRequest(context, 'ListDetectors', {});
    const parsed = parser.parse(response);
    const detectors = parsed?.ListDetectorsResponse?.detectorIds?.member || [];
    const detectorsList = Array.isArray(detectors) ? detectors : detectors ? [detectors] : [];

    if (detectorsList.length === 0) {
      findings.push({
        checkId: 'guardduty-not-enabled', severity: 'high',
        resourceId: context.accountId, resourceType: 'guardduty', region: context.region,
        title: 'GuardDuty is not enabled',
        description: 'Amazon GuardDuty threat detection is not enabled in this account.',
        remediation: 'Enable GuardDuty to continuously monitor for malicious activity and unauthorized behavior.',
        complianceFrameworks: ['CIS AWS 2.7', 'SOC2 CC6.1'],
      });
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    if (errorMsg.includes('AccessDenied') || errorMsg.includes('403')) {
      findings.push({
        checkId: 'guardduty-not-enabled', severity: 'high',
        resourceId: context.accountId, resourceType: 'guardduty', region: context.region,
        title: 'GuardDuty is not enabled',
        description: 'Amazon GuardDuty threat detection is not enabled in this account.',
        remediation: 'Enable GuardDuty to continuously monitor for malicious activity and unauthorized behavior.',
        complianceFrameworks: ['CIS AWS 2.7', 'SOC2 CC6.1'],
      });
    } else {
      findings.push({
        checkId: 'guardduty-not-enabled', severity: 'low',
        resourceId: context.accountId, resourceType: 'guardduty', region: context.region,
        title: 'Could not check GuardDuty status',
        description: `Failed to check GuardDuty: ${errorMsg}`,
        remediation: 'Verify IAM credentials have guardduty:ListDetectors permission.',
      });
    }
  }
  return findings;
}

/**
 * Check GuardDuty.2: Detector status is enabled
 */
export async function checkGuardDutyDetectorStatus(context: ScanContext): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];
  try {
    const response = await guardDutyRequest(context, 'ListDetectors', {});
    const parsed = parser.parse(response);
    const detectors = parsed?.ListDetectorsResponse?.detectorIds?.member || [];
    const detectorsList = Array.isArray(detectors) ? detectors : detectors ? [detectors] : [];

    for (const detectorId of detectorsList) {
      const id = typeof detectorId === 'object' ? detectorId?.['#text'] : detectorId;
      try {
        const detectorResponse = await guardDutyRequest(context, 'GetDetector', { DetectorId: id });
        const detectorParsed = parser.parse(detectorResponse);
        const statusRaw = detectorParsed?.GetDetectorResponse?.data?.status;
        const status = typeof statusRaw === 'object' ? statusRaw?.['#text'] : statusRaw;

        if (status !== 'ENABLED') {
          findings.push({
            checkId: 'guardduty-detector-disabled', severity: 'high',
            resourceId: id, resourceType: 'guardduty-detector', region: context.region,
            title: 'GuardDuty detector is not enabled',
            description: `GuardDuty detector "${id}" is in status "${status || 'unknown'}".`,
            remediation: 'Enable the GuardDuty detector to resume threat detection.',
            complianceFrameworks: ['CIS AWS 2.7', 'SOC2 CC6.1'],
          });
        }
      } catch { continue; }
    }
  } catch (error) {
    findings.push({
      checkId: 'guardduty-detector-disabled', severity: 'low',
      resourceId: context.accountId, resourceType: 'guardduty', region: context.region,
      title: 'Could not check GuardDuty detector status',
      description: `Failed to check detector: ${error instanceof Error ? error.message : 'Unknown error'}`,
      remediation: 'Verify IAM credentials have guardduty:ListDetectors and guardduty:GetDetector permission.',
    });
  }
  return findings;
}

/**
 * Run all GuardDuty security checks
 */
export async function runGuardDutyChecks(context: ScanContext): Promise<SecurityFinding[]> {
  const allFindings = await Promise.all([
    checkGuardDutyEnabled(context),
    checkGuardDutyDetectorStatus(context),
  ]);
  return allFindings.flat();
}
