/**
 * Security baseline controls for regulated industries:
 * Fintech/Banking, Healthcare, Legal, Government.
 */

import { ctrl, type SecurityControl } from './security-baseline-data';

export function fintechControls(): SecurityControl[] {
	return [
		ctrl(1, 'Data Protection', 'DLP for financial data', 'Block sharing of credit card numbers, IBAN, SWIFT codes, and transaction data externally', 'required', ['PCI-DSS 3.4', 'SOX 302'], 'Financial data leaks can trigger regulatory fines and reputational damage'),
		ctrl(2, 'Communication Compliance', 'Insider trading monitoring', 'Monitor communications for material non-public information', 'required', ['SEC Rule 10b-5', 'FCA MAR'], 'Regulatory requirement to prevent and detect insider trading'),
		ctrl(3, 'Data Protection', 'Customer data protection', 'Restrict KYC/AML documents to authorized personnel only', 'required', ['AML 5AMLD', 'GDPR Art. 32'], 'KYC and AML data requires strict access controls'),
		ctrl(4, 'Identity & Access', 'Privileged access management', 'Enable PIM for just-in-time admin access with approval workflows', 'required', ['PCI-DSS 7.1', 'SOX 404'], 'Standing admin privileges create unnecessary risk for financial systems'),
		ctrl(5, 'Audit & Compliance', 'Audit logging with 7-year retention', 'Enable unified audit logging with SOX-compliant retention', 'required', ['SOX 802', 'PCI-DSS 10.2'], 'SOX requires 7-year retention of financial audit records'),
		ctrl(6, 'Communication Compliance', 'Information barriers', 'Set up ethical walls between investment banking and advisory teams', 'required', ['SEC', 'FCA'], 'Prevents conflicts of interest and insider information sharing'),
		ctrl(7, 'Data Protection', 'Encryption for financial documents', 'Customer-managed keys for sensitive financial data at rest', 'required', ['PCI-DSS 3.5', 'GDPR Art. 32'], 'Financial documents require strong encryption controls'),
		ctrl(8, 'Data Protection', 'Cross-border data transfer controls', 'Geo-restriction policies for financial data sharing', 'required', ['GDPR Art. 44', 'FCA'], 'Financial data transfers across borders face strict regulations'),
		ctrl(9, 'Identity & Access', 'Third-party app consent restrictions', 'Admin-only consent with security review for all OAuth apps', 'required', ['PCI-DSS 6.5'], 'Unvetted third-party apps can exfiltrate financial data'),
		ctrl(10, 'Identity & Access', 'Session timeout for financial systems', 'Enforce 15-minute idle timeout for financial applications', 'required', ['PCI-DSS 8.1.8'], 'Reduces risk of unauthorized access to active financial sessions'),
		ctrl(11, 'Email Security', 'Anti-phishing with impersonation protection', 'Strict anti-phishing policies targeting executive impersonation', 'recommended', ['CIS 2.1.1'], 'Financial firms are high-value targets for spear phishing'),
		ctrl(12, 'Endpoint Security', 'Compliant device access', 'Require compliant or domain-joined devices for financial apps', 'recommended', ['PCI-DSS 6.2'], 'Protects financial data from compromised endpoints'),
	];
}

export function healthcareControls(): SecurityControl[] {
	return [
		ctrl(1, 'Data Protection', 'PHI data protection', 'DLP rules to detect and block sharing of health records and patient IDs', 'required', ['HIPAA 164.312', 'GDPR Art. 9'], 'Protected health information requires the highest level of DLP controls'),
		ctrl(2, 'Identity & Access', 'Access controls for patient data', 'Role-based access with minimum necessary standard for patient records', 'required', ['HIPAA 164.312(a)', 'SOC 2'], 'HIPAA minimum necessary standard limits access to patient data'),
		ctrl(3, 'Audit & Compliance', 'Audit logging for PHI access', 'Full audit trail for all access to patient health information', 'required', ['HIPAA 164.312(b)', 'SOC 2'], 'HIPAA requires detailed audit logs of all PHI access'),
		ctrl(4, 'Data Protection', 'Encryption at rest and in transit', 'End-to-end encryption for all health data storage and transmission', 'required', ['HIPAA 164.312(a)(2)(iv)', 'GDPR Art. 32'], 'PHI must be encrypted to meet HIPAA safe harbor provisions'),
		ctrl(5, 'Data Protection', 'BAA tracking for third parties', 'Track and enforce Business Associate Agreements for all vendors with PHI access', 'required', ['HIPAA 164.308(b)'], 'All third parties handling PHI must have signed BAAs'),
		ctrl(6, 'Identity & Access', 'MFA for clinical systems', 'Mandatory MFA for all users accessing patient data', 'required', ['HIPAA 164.312(d)', 'SOC 2'], 'Multi-factor authentication prevents unauthorized PHI access'),
		ctrl(7, 'Data Protection', 'Automatic data classification', 'Sensitivity labels for PHI, PII, and clinical research data', 'required', ['HIPAA', 'GDPR'], 'Automated classification ensures consistent PHI handling'),
		ctrl(8, 'Email Security', 'Secure health data messaging', 'Encryption and DLP for emails containing patient information', 'required', ['HIPAA 164.312(e)'], 'Email is a common vector for accidental PHI disclosure'),
		ctrl(9, 'Endpoint Security', 'Mobile device management', 'Required MDM enrollment for devices accessing health systems', 'required', ['HIPAA 164.310(d)'], 'Mobile devices with PHI access must be managed and wipeable'),
		ctrl(10, 'Identity & Access', 'Emergency access procedures', 'Break-glass access for clinical emergencies with full audit', 'recommended', ['HIPAA 164.312(a)(2)(ii)'], 'Clinicians may need emergency access to patient data'),
	];
}

export function legalControls(): SecurityControl[] {
	return [
		ctrl(1, 'Data Protection', 'Client privilege protection', 'DLP to prevent accidental disclosure of attorney-client privileged material', 'required', ['SOC 2', 'GDPR Art. 32'], 'Attorney-client privilege is foundational to legal practice'),
		ctrl(2, 'Communication Compliance', 'Legal hold and eDiscovery', 'Automated legal holds and eDiscovery with access controls', 'required', ['SOC 2', 'FRCP'], 'Courts require demonstrable preservation of relevant materials'),
		ctrl(3, 'Data Protection', 'Document classification', 'Sensitivity labels for privileged, confidential, and public documents', 'required', ['SOC 2', 'GDPR'], 'Legal documents require clear classification and handling rules'),
		ctrl(4, 'Identity & Access', 'Matter-based access controls', 'Access restricted by matter or case assignment', 'required', ['SOC 2'], 'Ethical walls prevent conflicts of interest between matters'),
		ctrl(5, 'Audit & Compliance', 'Comprehensive audit logging', 'Full audit trail for document access and sharing activities', 'required', ['SOC 2', 'GDPR Art. 30'], 'Audit trails demonstrate compliance and detect unauthorized access'),
		ctrl(6, 'Data Protection', 'External sharing controls', 'Restrict file sharing to approved domains with expiration', 'required', ['SOC 2', 'GDPR'], 'Controls prevent inadvertent disclosure of client information'),
		ctrl(7, 'Email Security', 'Email encryption', 'Automatic encryption for emails containing confidential content', 'required', ['SOC 2', 'GDPR'], 'Email is the primary communication channel with clients'),
		ctrl(8, 'Identity & Access', 'MFA for all users', 'Mandatory multi-factor authentication for all firm members', 'required', ['SOC 2'], 'Prevents unauthorized access to privileged legal information'),
		ctrl(9, 'Endpoint Security', 'Device compliance', 'Require managed devices for access to firm data', 'recommended', ['SOC 2'], 'Protects client data from compromised personal devices'),
		ctrl(10, 'Data Protection', 'Data retention policies', 'Configurable retention aligned with engagement letters', 'recommended', ['SOC 2', 'GDPR Art. 17'], 'Retention must balance legal obligations and privacy rights'),
	];
}

export function governmentControls(): SecurityControl[] {
	return [
		ctrl(1, 'Identity & Access', 'Zero trust architecture', 'Implement NIST zero trust principles for all access decisions', 'required', ['NIST 800-207'], 'Federal mandates require zero trust adoption'),
		ctrl(2, 'Data Protection', 'CUI protection', 'DLP and encryption for Controlled Unclassified Information', 'required', ['NIST 800-171', 'CMMC'], 'CUI handling is mandated for government contractors'),
		ctrl(3, 'Identity & Access', 'PIV/CAC authentication', 'Smart card or phishing-resistant MFA for all users', 'required', ['NIST 800-63B', 'HSPD-12'], 'Government agencies require strong identity verification'),
		ctrl(4, 'Audit & Compliance', 'Continuous monitoring', 'Real-time security monitoring with automated alerting', 'required', ['NIST 800-137', 'FedRAMP'], 'Continuous monitoring is a FedRAMP requirement'),
		ctrl(5, 'Data Protection', 'FIPS 140-2 encryption', 'FIPS-validated encryption for data at rest and in transit', 'required', ['FIPS 140-2', 'FedRAMP'], 'Government systems require FIPS-validated cryptographic modules'),
		ctrl(6, 'Identity & Access', 'Least privilege enforcement', 'Role-based access with periodic access reviews', 'required', ['NIST 800-53 AC-6'], 'Least privilege is a fundamental federal security control'),
		ctrl(7, 'Audit & Compliance', 'Incident response plan', 'Documented and tested incident response procedures', 'required', ['NIST 800-61', 'FedRAMP'], 'Federal agencies must maintain and test incident response plans'),
		ctrl(8, 'Endpoint Security', 'Endpoint detection and response', 'EDR on all endpoints with centralized monitoring', 'required', ['NIST 800-53 SI-4'], 'Required for federal endpoint visibility'),
		ctrl(9, 'Data Protection', 'Data sovereignty', 'Ensure data residency within approved jurisdictions', 'required', ['FedRAMP'], 'Government data must remain in approved locations'),
		ctrl(10, 'Identity & Access', 'Supply chain risk management', 'Vet all third-party software and service providers', 'required', ['NIST 800-161'], 'Supply chain compromises are a top federal concern'),
	];
}
