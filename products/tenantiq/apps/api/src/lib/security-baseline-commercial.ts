/**
 * Security baseline controls for commercial industries:
 * Education, Technology, Retail, Manufacturing.
 */

import { ctrl, type SecurityControl } from './security-baseline-data';

export function educationControls(): SecurityControl[] {
	return [
		ctrl(1, 'Data Protection', 'Student record protection', 'DLP for student education records and personally identifiable information', 'required', ['FERPA', 'GDPR'], 'Student records are protected by FERPA and require strict controls'),
		ctrl(2, 'Identity & Access', 'Age-appropriate access controls', 'Separate access tiers for students, faculty, and staff', 'required', ['COPPA', 'FERPA'], 'Different user populations require different access levels'),
		ctrl(3, 'Data Protection', 'Parental consent management', 'Consent tracking for student data sharing under 13', 'required', ['COPPA', 'FERPA'], 'COPPA requires parental consent for children under 13'),
		ctrl(4, 'Email Security', 'Safe communication environment', 'Content filtering and anti-bullying controls in email and Teams', 'required', ['CIPA'], 'Educational institutions must provide safe digital environments'),
		ctrl(5, 'Identity & Access', 'MFA for staff and faculty', 'Multi-factor authentication for all staff accounts', 'required', ['FERPA', 'GDPR'], 'Staff accounts have access to sensitive student data'),
		ctrl(6, 'Audit & Compliance', 'Student data access audit', 'Audit logging for all access to student records', 'required', ['FERPA'], 'FERPA requires accounting of disclosures of student records'),
		ctrl(7, 'Data Protection', 'Third-party app vetting', 'Review and approve all educational apps accessing student data', 'required', ['FERPA', 'COPPA'], 'EdTech apps must meet privacy standards before deployment'),
		ctrl(8, 'Data Protection', 'Data minimization', 'Collect only necessary student data with defined retention', 'recommended', ['GDPR Art. 5', 'FERPA'], 'Minimizing data reduces breach impact and regulatory risk'),
		ctrl(9, 'Endpoint Security', 'Shared device management', 'MDM for shared classroom devices with session isolation', 'recommended', ['FERPA'], 'Shared devices need session boundaries to protect student data'),
		ctrl(10, 'Identity & Access', 'Federated identity for research', 'InCommon or eduGAIN federation for research collaboration', 'optional', ['GDPR'], 'Federated identity enables secure research partnerships'),
	];
}

export function technologyControls(): SecurityControl[] {
	return [
		ctrl(1, 'Data Protection', 'Source code and IP protection', 'DLP to prevent exfiltration of source code and trade secrets', 'required', ['SOC 2', 'ISO 27001 A.8'], 'Intellectual property is the primary asset for technology companies'),
		ctrl(2, 'Identity & Access', 'Zero trust access', 'Context-aware access policies based on device, location, and risk', 'required', ['SOC 2', 'ISO 27001 A.9'], 'Remote-first workforce needs risk-adaptive access controls'),
		ctrl(3, 'Identity & Access', 'Developer access management', 'Just-in-time access for production systems with approval', 'required', ['SOC 2', 'ISO 27001 A.9.4'], 'Standing developer access to production increases breach risk'),
		ctrl(4, 'Audit & Compliance', 'Security event monitoring', 'SIEM integration with automated alerting for anomalies', 'required', ['SOC 2', 'ISO 27001 A.12.4'], 'Early detection of security incidents minimizes impact'),
		ctrl(5, 'Data Protection', 'Customer data isolation', 'Tenant isolation and encryption for customer data', 'required', ['SOC 2', 'GDPR Art. 32'], 'Multi-tenant platforms must isolate customer data'),
		ctrl(6, 'Identity & Access', 'SSO and MFA', 'Single sign-on with mandatory MFA for all employees', 'required', ['SOC 2', 'ISO 27001'], 'SSO with MFA is baseline for technology companies'),
		ctrl(7, 'Email Security', 'Phishing-resistant authentication', 'FIDO2 or hardware keys for privileged accounts', 'recommended', ['ISO 27001 A.9.4'], 'Technology staff are high-value phishing targets'),
		ctrl(8, 'Data Protection', 'API secret management', 'Centralized secret management with rotation policies', 'required', ['SOC 2', 'ISO 27001 A.10'], 'API keys and secrets must be managed and rotated'),
		ctrl(9, 'Endpoint Security', 'BYOD controls', 'Conditional access and app protection for personal devices', 'recommended', ['ISO 27001 A.6.2'], 'BYOD is common in tech but needs guardrails'),
		ctrl(10, 'Audit & Compliance', 'Vulnerability management', 'Automated scanning with SLA-based remediation timelines', 'required', ['SOC 2', 'ISO 27001 A.12.6'], 'Continuous vulnerability management prevents exploitation'),
	];
}

export function retailControls(): SecurityControl[] {
	return [
		ctrl(1, 'Data Protection', 'Payment card data protection', 'DLP for credit card numbers, CVVs, and cardholder data', 'required', ['PCI-DSS 3.4', 'GDPR'], 'Payment card data is the primary regulatory target for retail'),
		ctrl(2, 'Data Protection', 'Customer PII protection', 'DLP for customer personal information in email and files', 'required', ['GDPR Art. 32', 'PCI-DSS'], 'Customer data breaches carry significant fines and brand damage'),
		ctrl(3, 'Identity & Access', 'Privileged access for POS systems', 'Restricted admin access to point-of-sale and payment systems', 'required', ['PCI-DSS 7.1'], 'POS system compromise is a leading retail breach vector'),
		ctrl(4, 'Audit & Compliance', 'Transaction audit logging', 'Comprehensive logging of payment and refund transactions', 'required', ['PCI-DSS 10.2', 'GDPR'], 'PCI-DSS requires detailed transaction audit trails'),
		ctrl(5, 'Identity & Access', 'MFA for administrative access', 'MFA required for all admin and back-office accounts', 'required', ['PCI-DSS 8.3', 'GDPR'], 'Admin accounts are primary targets in retail breaches'),
		ctrl(6, 'Email Security', 'Anti-phishing controls', 'Strict anti-phishing for store managers and corporate staff', 'required', ['CIS 2.1.1'], 'Retail staff are common targets for credential phishing'),
		ctrl(7, 'Data Protection', 'Encryption for customer data', 'Encryption at rest and in transit for all customer records', 'required', ['PCI-DSS 3.5', 'GDPR Art. 32'], 'Encryption provides safe harbor in breach notifications'),
		ctrl(8, 'Endpoint Security', 'Store device management', 'MDM and hardening for in-store devices and kiosks', 'required', ['PCI-DSS 9.1'], 'Unmanaged store devices are a significant attack surface'),
		ctrl(9, 'Data Protection', 'Third-party vendor controls', 'Security requirements for all vendors with data access', 'recommended', ['PCI-DSS 12.8', 'GDPR Art. 28'], 'Supply chain vendors are a common entry point for retail breaches'),
		ctrl(10, 'Identity & Access', 'Seasonal worker access lifecycle', 'Automated provisioning and deprovisioning for temporary staff', 'recommended', ['PCI-DSS 8.1', 'GDPR'], 'High staff turnover requires automated access lifecycle'),
	];
}

export function manufacturingControls(): SecurityControl[] {
	return [
		ctrl(1, 'Data Protection', 'Trade secret and IP protection', 'DLP for CAD files, formulas, and manufacturing processes', 'required', ['ISO 27001 A.8', 'NIST 800-171'], 'Manufacturing IP is a top target for industrial espionage'),
		ctrl(2, 'Identity & Access', 'OT/IT network segmentation', 'Strict network boundaries between corporate and operational technology', 'required', ['NIST 800-82', 'IEC 62443'], 'IT/OT convergence creates pathways to production systems'),
		ctrl(3, 'Identity & Access', 'Privileged access for SCADA/ICS', 'Just-in-time access for industrial control system administration', 'required', ['NIST 800-82', 'ISO 27001'], 'Standing admin access to ICS increases sabotage risk'),
		ctrl(4, 'Audit & Compliance', 'Production system audit logging', 'Comprehensive logging of access to manufacturing systems', 'required', ['ISO 27001 A.12.4', 'NIST 800-82'], 'Audit trails are essential for incident investigation'),
		ctrl(5, 'Data Protection', 'Supply chain data protection', 'Controls for sharing specifications and blueprints with suppliers', 'required', ['ISO 27001 A.15', 'NIST 800-161'], 'Supply chain data sharing must be controlled and audited'),
		ctrl(6, 'Identity & Access', 'MFA for corporate systems', 'Mandatory MFA for all corporate and engineering accounts', 'required', ['ISO 27001 A.9.4', 'NIST'], 'Engineering accounts with IP access require strong authentication'),
		ctrl(7, 'Email Security', 'Anti-phishing for engineering', 'Enhanced phishing protection for engineering and R&D teams', 'required', ['ISO 27001', 'NIST'], 'Engineering staff are targeted for IP theft via phishing'),
		ctrl(8, 'Endpoint Security', 'Engineering workstation security', 'Hardened workstations for CAD and design environments', 'required', ['ISO 27001 A.8.1'], 'Engineering workstations contain high-value IP'),
		ctrl(9, 'Data Protection', 'Export control compliance', 'Controls for ITAR/EAR regulated technical data', 'recommended', ['ITAR', 'EAR'], 'Export-controlled data requires additional handling procedures'),
		ctrl(10, 'Audit & Compliance', 'Quality management integration', 'Security controls aligned with ISO 9001 quality management', 'recommended', ['ISO 9001', 'ISO 27001'], 'Security and quality management should be integrated'),
	];
}
