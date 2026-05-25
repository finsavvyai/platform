/**
 * Control mapping definitions by framework.
 * Each control lists the PipeWarden finding categories it covers.
 */

import type {
  ComplianceFramework,
  ControlDefinition,
} from './compliance-report-types';

export const CONTROL_MAPPINGS: Record<
  ComplianceFramework,
  Record<string, ControlDefinition>
> = {
  SOC2: {
    'CC6.1': {
      description:
        'Manage logical access - Control access to systems and data',
      categories: ['secrets', 'permissions'],
    },
    'CC6.3': {
      description: 'Access control - Restrict access based on need-to-know',
      categories: ['permissions'],
    },
    'CC6.6': {
      description:
        'Logical access control - Manage access to the system',
      categories: ['supply-chain'],
    },
    'CC7.1': {
      description:
        'System monitoring - Monitor system components and operations',
      categories: ['missing-tests'],
    },
    'CC8.1': {
      description:
        'Detection and prevention - Detect and prevent unauthorized changes',
      categories: ['branch-security'],
    },
  },
  HIPAA: {
    '164.312(a)': {
      description:
        'Access Control - Implement technical policies and procedures',
      categories: ['permissions', 'secrets'],
    },
    '164.308(a)(3)': {
      description:
        'Workforce Security - Manage workforce access and conduct audits',
      categories: ['permissions'],
    },
    '164.308(a)(5)': {
      description:
        'Security Awareness and Training - Educate workforce on security',
      categories: ['secrets'],
    },
  },
  GDPR: {
    'Art.32': {
      description:
        'Security of processing - Implement appropriate technical measures',
      categories: ['secrets', 'branch-security'],
    },
    'Art.33': {
      description:
        'Data breach notification - Report breaches to authorities',
      categories: ['secrets'],
    },
    'Art.5': {
      description:
        'Principles - Integrity and confidentiality of personal data',
      categories: ['secrets', 'permissions'],
    },
  },
  'PCI-DSS': {
    '3.4': {
      description:
        'Secure cryptography - Render PAN unreadable anywhere it is stored',
      categories: ['secrets'],
    },
    '6.2': {
      description:
        'Security patches - Install security patches and updates',
      categories: ['missing-tests', 'supply-chain'],
    },
    '7.1': {
      description:
        'Access control - Restrict access based on need-to-know',
      categories: ['permissions'],
    },
  },
};

/** Get all known frameworks. */
export function getFrameworks(): ComplianceFramework[] {
  return ['SOC2', 'HIPAA', 'GDPR', 'PCI-DSS'];
}
