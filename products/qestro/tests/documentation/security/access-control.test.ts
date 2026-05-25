/**
 * Access Control Tests
 *
 * Tests to ensure documentation access permissions work correctly
 * and sensitive information is properly protected.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import DocumentationTestUtils from '../utils/documentationTestUtils';
import { getTestConfig } from '../config/testConfig';

describe('Access Control Security Tests', () => {
  const config = getTestConfig();
  let documentationFiles: string[] = [];
  const projectRoot = path.resolve(process.cwd(), '..');

  beforeAll(async () => {
    // Get all documentation files
    documentationFiles = await DocumentationTestUtils.getDocumentationFiles(
      path.join(projectRoot, 'docs'),
      ['.md', '.txt', '.json', '.yaml', '.yml']
    );

    console.log(`Found ${documentationFiles.length} documentation files for security testing`);
  });

  describe('Sensitive Information Protection', () => {
    it('should not contain exposed API keys or secrets', () => {
      const sensitivePatterns = [
        /api[_-]?key[_-]?=\s*['"]?([a-zA-Z0-9_-]{20,})['"]?/gi,
        /secret[_-]?=\s*['"]?([a-zA-Z0-9_-]{20,})['"]?/gi,
        /token[_-]?=\s*['"]?([a-zA-Z0-9._-]{20,})['"]?/gi,
        /password[_-]?=\s*['"]?([a-zA-Z0-9_-]{8,})['"]?/gi,
        /sk_[a-zA-Z0-9_-]{20,}/gi, // Stripe keys
        /ghp_[a-zA-Z0-9_-]{36}/gi, // GitHub personal access tokens
        /gho_[a-zA-Z0-9_-]{36}/gi, // GitHub OAuth tokens
        /ghu_[a-zA-Z0-9_-]{36}/gi, // GitHub user tokens
        /ghs_[a-zA-Z0-9_-]{36}/gi, // GitHub server tokens
        /ghr_[a-zA-Z0-9_-]{36}/gi, // GitHub refresh tokens
        /xox[baprs]-[a-zA-Z0-9_-]{10,}/gi, // Slack tokens
        /AKIA[0-9A-Z]{16}/gi, // AWS access keys
      ];

      const leakedSecrets: Array<{ file: string; type: string; line: number }> = [];

      for (const filePath of documentationFiles) {
        try {
          const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
          const content = docFile.content;
          const lines = content.split('\n');

          lines.forEach((line, lineIndex) => {
            sensitivePatterns.forEach(pattern => {
              const matches = line.match(pattern);
              if (matches) {
                matches.forEach(match => {
                  // Check if it's clearly an example (contains placeholder text)
                  const isExample = match.toLowerCase().includes('your_') ||
                                   match.toLowerCase().includes('example') ||
                                   match.toLowerCase().includes('placeholder') ||
                                   match.includes('...') ||
                                   match.toLowerCase().includes('xxx') ||
                                   match.toLowerCase().includes('test');

                  if (!isExample) {
                    leakedSecrets.push({
                      file: filePath,
                      type: 'potential_secret',
                      line: lineIndex + 1
                    });
                  }
                });
              }
            });
          });
        } catch (error) {
          console.warn(`Could not read file for security check: ${filePath}`);
        }
      }

      if (leakedSecrets.length > 0) {
        console.error('POTENTIALLY EXPOSED SECRETS FOUND:', leakedSecrets);
      }

      expect(leakedSecrets).toHaveLength(0);
    });

    it('should not contain exposed database credentials', () => {
      const credentialPatterns = [
        /mysql:\/\/[^:]+:[^@]+@/gi,
        /postgresql:\/\/[^:]+:[^@]+@/gi,
        /mongodb:\/\/[^:]+:[^@]+@/gi,
        /redis:\/\/[^:]+:[^@]+@/gi,
        /database[_-]?url[_-]?=\s*['"]?[^'"]*:[^'"]*@[^'"]*['"]?/gi,
        /db[_-]?password[_-]?=\s*['"]?[^'"]{4,}['"]?/gi,
      ];

      const leakedCredentials: Array<{ file: string; type: string }> = [];

      for (const filePath of documentationFiles) {
        try {
          const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
          const content = docFile.content;

          credentialPatterns.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches) {
              matches.forEach(match => {
                // Check if it's clearly an example
                const isExample = match.toLowerCase().includes('your_') ||
                                 match.toLowerCase().includes('example') ||
                                 match.toLowerCase().includes('localhost') ||
                                 match.toLowerCase().includes('127.0.0.1') ||
                                 match.includes('...') ||
                                 match.toLowerCase().includes('test');

                if (!isExample) {
                  leakedCredentials.push({
                    file: filePath,
                    type: 'database_credential'
                  });
                }
              });
            }
          });
        } catch (error) {
          console.warn(`Could not read file for credential check: ${filePath}`);
        }
      }

      if (leakedCredentials.length > 0) {
        console.error('POTENTIALLY EXPOSED DATABASE CREDENTIALS FOUND:', leakedCredentials);
      }

      expect(leakedCredentials).toHaveLength(0);
    });

    it('should not contain exposed private keys or certificates', () => {
      const keyPatterns = [
        /-----BEGIN [A-Z]+ KEY-----[\s\S]*?-----END [A-Z]+ KEY-----/gi,
        /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/gi,
        /-----BEGIN RSA PRIVATE KEY-----[\s\S]*?-----END RSA PRIVATE KEY-----/gi,
        /-----BEGIN OPENSSH PRIVATE KEY-----[\s\S]*?-----END OPENSSH PRIVATE KEY-----/gi,
        /[a-zA-Z0-9_-]{40,}/gi, // Potential long base64 strings (could be keys)
      ];

      const leakedKeys: Array<{ file: string; type: string }> = [];

      for (const filePath of documentationFiles) {
        try {
          const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
          const content = docFile.content;

          keyPatterns.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches) {
              // Check if it's clearly marked as an example
              const isExample = matches.some(match =>
                match.toLowerCase().includes('example') ||
                match.toLowerCase().includes('your') ||
                match.toLowerCase().includes('placeholder')
              );

              if (!isExample) {
                leakedKeys.push({
                  file: filePath,
                  type: 'private_key_or_certificate'
                });
              }
            }
          });
        } catch (error) {
          console.warn(`Could not read file for key check: ${filePath}`);
        }
      }

      if (leakedKeys.length > 0) {
        console.error('POTENTIALLY EXPOSED KEYS/CERTIFICATES FOUND:', leakedKeys);
      }

      expect(leakedKeys).toHaveLength(0);
    });

    it('should not contain exposed internal URLs or endpoints', () => {
      const internalUrlPatterns = [
        /https?:\/\/[a-zA-Z0-9_-]+\.internal\//gi,
        /https?:\/\/[a-zA-Z0-9_-]+\.local\//gi,
        /https?:\/\/10\./gi, // Private IP ranges
        /https?:\/\/172\.1[6-9]\./gi, // Private IP ranges
        /https?:\/\/172\.2[0-9]\./gi, // Private IP ranges
        /https?:\/\/172\.3[0-1]\./gi, // Private IP ranges
        /https?:\/\/192\.168\./gi, // Private IP ranges
        /https?:\/\/127\./gi, // Loopback
        /https?:\/\/169\.254\./gi, // Link-local
      ];

      const leakedInternalUrls: Array<{ file: string; url: string }> = [];

      for (const filePath of documentationFiles) {
        try {
          const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
          const content = docFile.content;

          internalUrlPatterns.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches) {
              matches.forEach(match => {
                // Check if it's clearly an example
                const isExample = match.toLowerCase().includes('example') ||
                                 match.toLowerCase().includes('your') ||
                                 match.toLowerCase().includes('placeholder') ||
                                 match.includes('localhost') && match.includes('3000'); // Common dev port

                if (!isExample) {
                  leakedInternalUrls.push({
                    file: filePath,
                    url: match
                  });
                }
              });
            }
          });
        } catch (error) {
          console.warn(`Could not read file for internal URL check: ${filePath}`);
        }
      }

      if (leakedInternalUrls.length > 0) {
        console.warn('Potentially exposed internal URLs found:', leakedInternalUrls);
      }

      // Allow some localhost examples but limit actual internal URLs
      const realInternalUrls = leakedInternalUrls.filter(url =>
        !url.url.includes('localhost')
      );
      expect(realInternalUrls).toHaveLength(0);
    });
  });

  describe('Information Disclosure Prevention', () => {
    it('should not contain detailed internal system information', () => {
      const sensitiveSystemInfo = [
        /internal.*server.*name/gi,
        /production.*database.*host/gi,
        /admin.*panel.*url/gi,
        /internal.*api.*endpoint/gi,
        /backup.*location/gi,
        /server.*architecture/gi,
        /network.*topology/gi,
        /security.*configuration/gi,
      ];

      const informationDisclosure: Array<{ file: string; type: string }> = [];

      for (const filePath of documentationFiles) {
        try {
          const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
          const content = docFile.content;

          sensitiveSystemInfo.forEach(pattern => {
            if (pattern.test(content)) {
              // Check if it's generic documentation vs specific internal info
              const isGeneric = content.includes('example') ||
                              content.includes('your') ||
                              content.includes('replace with');

              if (!isGeneric) {
                informationDisclosure.push({
                  file: filePath,
                  type: 'system_information_disclosure'
                });
              }
            }
          });
        } catch (error) {
          console.warn(`Could not read file for system info check: ${filePath}`);
        }
      }

      if (informationDisclosure.length > 0) {
        console.warn('Potential information disclosure:', informationDisclosure);
      }

      expect(informationDisclosure.length).toBeLessThan(3); // Allow some generic examples
    });

    it('should not contain employee personal information', () => {
      const personalInfoPatterns = [
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email patterns
        /\+?1?-?\.?\s?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})/g, // Phone patterns
        /\b\d{3}-\d{2}-\d{4}\b/g, // SSN patterns
      ];

      const personalInfoFound: Array<{ file: string; type: string; matches: string[] }> = [];

      for (const filePath of documentationFiles) {
        try {
          const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
          const content = docFile.content;

          personalInfoPatterns.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches) {
              // Filter out example emails
              const realInfo = matches.filter(match =>
                !match.includes('example') &&
                !match.includes('test') &&
                !match.includes('your') &&
                !match.includes('email') &&
                !match.includes('contact') &&
                !match.includes('support') &&
                !match.includes('info')
              );

              if (realInfo.length > 0) {
                personalInfoFound.push({
                  file: filePath,
                  type: 'personal_information',
                  matches: realInfo
                });
              }
            }
          });
        } catch (error) {
          console.warn(`Could not read file for personal info check: ${filePath}`);
        }
      }

      if (personalInfoFound.length > 0) {
        console.warn('Potential personal information exposure:', personalInfoFound);
      }

      expect(personalInfoFound).toHaveLength(0);
    });

    it('should not contain commented-out secrets or credentials', () => {
      const commentedSecretPatterns = [
        /\/\/.*api[_-]?key/gi,
        /\/\/.*secret/gi,
        /\/\/.*password/gi,
        /\/\/.*token/gi,
        /#.*api[_-]?key/gi,
        /#.*secret/gi,
        /#.*password/gi,
        /#.*token/gi,
        /<!--.*api[_-]?key.*-->/gi,
        /<!--.*secret.*-->/gi,
      ];

      const commentedSecrets: Array<{ file: string; line: string }> = [];

      for (const filePath of documentationFiles) {
        try {
          const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
          const content = docFile.content;
          const lines = content.split('\n');

          lines.forEach(line => {
            commentedSecretPatterns.forEach(pattern => {
              if (pattern.test(line)) {
                // Check if it's clearly an example
                const isExample = line.toLowerCase().includes('your_') ||
                                 line.toLowerCase().includes('example') ||
                                 line.includes('...');

                if (!isExample && line.length > 20) { // Avoid short comments
                  commentedSecrets.push({
                    file: filePath,
                    line: line.trim()
                  });
                }
              }
            });
          });
        } catch (error) {
          console.warn(`Could not read file for commented secrets check: ${filePath}`);
        }
      }

      if (commentedSecrets.length > 0) {
        console.warn('Potentially exposed commented secrets:', commentedSecrets);
      }

      expect(commentedSecrets).toHaveLength(0);
    });
  });

  describe('Access Control Documentation', () => {
    it('should document access control mechanisms properly', async () => {
      let accessControlDocs = false;

      for (const filePath of documentationFiles) {
        try {
          const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
          const content = docFile.content.toLowerCase();

          if (content.includes('access control') ||
              content.includes('authentication') ||
              content.includes('authorization') ||
              content.includes('rbac') ||
              content.includes('role based') ||
              content.includes('permissions')) {
            accessControlDocs = true;
            break;
          }
        } catch (error) {
          console.warn(`Could not read file for access control docs check: ${filePath}`);
        }
      }

      expect(accessControlDocs).toBe(true);
    });

    it('should document security best practices', async () => {
      let securityBestPractices = false;

      for (const filePath of documentationFiles) {
        try {
          const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
          const content = docFile.content.toLowerCase();

          if (content.includes('security best practices') ||
              content.includes('secure coding') ||
              content.includes('security guidelines') ||
              content.includes('protect against') ||
              content.includes('prevent security')) {
            securityBestPractices = true;
            break;
          }
        } catch (error) {
          console.warn(`Could not read file for security practices check: ${filePath}`);
        }
      }

      expect(securityBestPractices).toBe(true);
    });

    it('should document incident response procedures', async () => {
      let incidentResponseDocs = false;

      for (const filePath of documentationFiles) {
        try {
          const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
          const content = docFile.content.toLowerCase();

          if (content.includes('incident response') ||
              content.includes('security incident') ||
              content.includes('breach') ||
              content.includes('emergency') ||
              content.includes('security team')) {
            incidentResponseDocs = true;
            break;
          }
        } catch (error) {
          console.warn(`Could not read file for incident response check: ${filePath}`);
        }
      }

      expect(incidentResponseDocs).toBe(true);
    });
  });

  describe('Data Classification and Handling', () => {
    it('should not contain highly sensitive business information', () => {
      const sensitiveBusinessInfo = [
        /revenue.*\$\d+/gi,
        /profit.*\$\d+/gi,
        /customer.*count.*\d+/gi,
        /user.*base.*\d+/gi,
        /confidential.*strategy/gi,
        /internal.*roadmap/gi,
        /secret.*feature/gi,
        /proprietary.*algorithm/gi,
      ];

      const businessInfoDisclosure: Array<{ file: string; type: string }> = [];

      for (const filePath of documentationFiles) {
        try {
          const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
          const content = docFile.content;

          sensitiveBusinessInfo.forEach(pattern => {
            if (pattern.test(content)) {
              businessInfoDisclosure.push({
                file: filePath,
                type: 'sensitive_business_information'
              });
            }
          });
        } catch (error) {
          console.warn(`Could not read file for business info check: ${filePath}`);
        }
      }

      if (businessInfoDisclosure.length > 0) {
        console.warn('Potential business information disclosure:', businessInfoDisclosure);
      }

      // Allow some business info in general documentation but limit specific numbers
      const specificNumbers = businessInfoDisclosure.filter(item =>
        documentationFiles.find(file => file === item.file)?.includes('API_DOCUMENTATION.md')
      );

      expect(specificNumbers.length).toBeLessThan(3);
    });

    it('should handle PII appropriately in examples', () => {
      const piiPatterns = [
        /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
        /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Credit card
        /\b[A-Z]{2}\d{7}\b/g, // Passport numbers
      ];

      let piiInExamples = false;

      for (const filePath of documentationFiles) {
        try {
          const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
          const content = docFile.content;

          piiPatterns.forEach(pattern => {
            if (pattern.test(content)) {
              // Check if it's clearly marked as fake/example data
              const isExample = content.includes('example') ||
                              content.includes('fake') ||
                              content.includes('test') ||
                              content.includes('sample') ||
                              content.includes('555-'); // Fake phone prefix

              if (!isExample) {
                piiInExamples = true;
              }
            }
          });
        } catch (error) {
          console.warn(`Could not read file for PII check: ${filePath}`);
        }
      }

      expect(piiInExamples).toBe(false);
    });
  });

  describe('Security Configuration', () => {
    it('should not expose detailed security configurations', () => {
      const securityConfigPatterns = [
        /firewall.*rules/gi,
        /iptables.*-A/gi,
        /security.*group/gi,
        /access.*control.*list/gi,
        /security.*policy/gi,
        /ssl.*certificate.*path/gi,
        /private.*key.*path/gi,
      ];

      const securityConfigExposure: Array<{ file: string; type: string }> = [];

      for (const filePath of documentationFiles) {
        try {
          const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
          const content = docFile.content;

          securityConfigPatterns.forEach(pattern => {
            if (pattern.test(content)) {
              // Check if it's clearly an example
              const isExample = content.includes('example') ||
                              content.includes('your') ||
                              content.includes('replace');

              if (!isExample) {
                securityConfigExposure.push({
                  file: filePath,
                  type: 'security_configuration'
                });
              }
            }
          });
        } catch (error) {
          console.warn(`Could not read file for security config check: ${filePath}`);
        }
      }

      if (securityConfigExposure.length > 0) {
        console.warn('Potential security configuration exposure:', securityConfigExposure);
      }

      expect(securityConfigExposure.length).toBeLessThan(2); // Allow generic examples
    });

    it('should document secure configuration practices', async () => {
      let secureConfigDocs = false;

      for (const filePath of documentationFiles) {
        try {
          const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
          const content = docFile.content.toLowerCase();

          if (content.includes('secure configuration') ||
              content.includes('security hardening') ||
              content.includes('security best') ||
              content.includes('protect configuration') ||
              content.includes('secure setup')) {
            secureConfigDocs = true;
            break;
          }
        } catch (error) {
          console.warn(`Could not read file for secure config docs check: ${filePath}`);
        }
      }

      expect(secureConfigDocs).toBe(true);
    });
  });

  describe('Third-Party Service Security', () => {
    it('should not expose third-party API keys', () => {
      const thirdPartyPatterns = [
        /google_api_key/gi,
        /aws_access_key/gi,
        /aws_secret_key/gi,
        /stripe_secret/gi,
        /sendgrid_key/gi,
        /twilio_key/gi,
        /github_token/gi,
        /slack_token/gi,
      ];

      const thirdPartyKeyExposure: Array<{ file: string; type: string }> = [];

      for (const filePath of documentationFiles) {
        try {
          const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
          const content = docFile.content;

          thirdPartyPatterns.forEach(pattern => {
            if (pattern.test(content)) {
              // Check if it's clearly an example
              const isExample = content.includes('your_') ||
                              content.includes('example') ||
                              content.includes('test') ||
                              content.includes('demo');

              if (!isExample) {
                thirdPartyKeyExposure.push({
                  file: filePath,
                  type: 'third_party_key'
                });
              }
            }
          });
        } catch (error) {
          console.warn(`Could not read file for third-party key check: ${filePath}`);
        }
      }

      if (thirdPartyKeyExposure.length > 0) {
        console.warn('Potential third-party key exposure:', thirdPartyKeyExposure);
      }

      expect(thirdPartyKeyExposure).toHaveLength(0);
    });

    it('should document third-party integration security', async () => {
      let thirdPartySecurityDocs = false;

      for (const filePath of documentationFiles) {
        try {
          const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
          const content = docFile.content.toLowerCase();

          if (content.includes('third party security') ||
              content.includes('api security') ||
              content.includes('integration security') ||
              content.includes('webhook security') ||
              content.includes('oauth security')) {
            thirdPartySecurityDocs = true;
            break;
          }
        } catch (error) {
          console.warn(`Could not read file for third-party security check: ${filePath}`);
        }
      }

      expect(thirdPartySecurityDocs).toBe(true);
    });
  });

  describe('Compliance and Regulations', () => {
    it('should document compliance requirements', async () => {
      let complianceDocs = false;

      for (const filePath of documentationFiles) {
        try {
          const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
          const content = docFile.content.toLowerCase();

          if (content.includes('compliance') ||
              content.includes('gdpr') ||
              content.includes('hipaa') ||
              content.includes('soc 2') ||
              content.includes('pci dss') ||
              content.includes('data protection')) {
            complianceDocs = true;
            break;
          }
        } catch (error) {
          console.warn(`Could not read file for compliance docs check: ${filePath}`);
        }
      }

      expect(complianceDocs).toBe(true);
    });

    it('should not violate data handling regulations', () => {
      const regulatoryViolationPatterns = [
        /store.*credit.*card/gi,
        /store.*ssn/gi,
        /store.*medical.*record/gi,
        /store.*personal.*data/gi,
        /process.*pii.*without.*consent/gi,
      ];

      const regulatoryViolations: Array<{ file: string; type: string }> = [];

      for (const filePath of documentationFiles) {
        try {
          const docFile = await DocumentationTestUtils.readDocumentationFile(filePath);
          const content = docFile.content;

          regulatoryViolationPatterns.forEach(pattern => {
            if (pattern.test(content)) {
              // Check if it's about proper handling or a warning
              const isWarningOrProper = content.includes('do not') ||
                                      content.includes('never') ||
                                      content.includes('warning') ||
                                      content.includes('avoid');

              if (!isWarningOrProper) {
                regulatoryViolations.push({
                  file: filePath,
                  type: 'potential_regulatory_violation'
                });
              }
            }
          });
        } catch (error) {
          console.warn(`Could not read file for regulatory compliance check: ${filePath}`);
        }
      }

      if (regulatoryViolations.length > 0) {
        console.warn('Potential regulatory violations:', regulatoryViolations);
      }

      expect(regulatoryViolations).toHaveLength(0);
    });
  });
});
