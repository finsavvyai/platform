// Individual Adapter Tests
// Tests each platform adapter independently

import { strict as assert } from 'node:assert';
import { describe, it, before, after } from 'node:test';

describe('Qestro Adapter Tests', () => {
  let qestroAdapter;

  before(async () => {
    const QestroAdapter = (await import('../../adapters/qestro-adapter.js')).default;
    qestroAdapter = new QestroAdapter({
      environment: 'test',
      lamEnabled: true,
      complianceFrameworks: ['GDPR', 'SOC2']
    });
    await qestroAdapter.initialize();
  });

  after(async () => {
    await qestroAdapter.cleanup();
  });

  describe('Workflow Validation', () => {
    it('should validate simple workflows', async () => {
      const workflow = {
        name: 'simple-workflow',
        tools: ['openai-gpt4'],
        dataTypes: ['public-data'],
        complianceFrameworks: ['GDPR']
      };

      const result = await qestroAdapter.validateWorkflow(workflow);
      assert.ok(result.valid, 'Simple workflow should be valid');
      assert.equal(result.issues.length, 0, 'Should have no issues');
    });

    it('should reject workflows with unknown tools', async () => {
      const workflow = {
        name: 'invalid-workflow',
        tools: ['unknown-tool'],
        dataTypes: ['test-data'],
        complianceFrameworks: ['GDPR']
      };

      const result = await qestroAdapter.validateWorkflow(workflow);
      assert.equal(result.valid, false, 'Should reject unknown tools');
      assert.ok(result.issues.length > 0, 'Should have issues');
    });

    it('should handle complex multi-step workflows', async () => {
      const workflow = {
        name: 'complex-workflow',
        steps: [
          {
            name: 'data-ingestion',
            tools: ['data-processor'],
            dataTypes: ['customer-data']
          },
          {
            name: 'ai-processing',
            tools: ['openai-gpt4'],
            dataTypes: ['processed-data']
          },
          {
            name: 'output-generation',
            tools: ['report-generator'],
            dataTypes: ['report-data']
          }
        ],
        complianceFrameworks: ['GDPR', 'SOC2']
      };

      const result = await qestroAdapter.validateWorkflow(workflow);
      assert.ok(result.valid, 'Complex workflow should be valid');
      assert.ok(result.complianceCheck, 'Should perform compliance check');
    });
  });

  describe('Tool Integration', () => {
    it('should validate individual tools', async () => {
      const tool = {
        name: 'openai-gpt4',
        type: 'ai-model',
        provider: 'openai',
        capabilities: ['text-generation', 'analysis'],
        dataHandling: {
          encryption: true,
          logging: true,
          retention: '30d'
        }
      };

      const validation = await qestroAdapter.validateTool(tool);
      assert.ok(validation.compliant, 'Tool should be compliant');
      assert.ok(validation.riskScore < 0.3, 'Tool should have low risk score');
    });

    it('should handle tool integration failures gracefully', async () => {
      const invalidTool = {
        name: 'broken-tool',
        type: 'unknown',
        provider: 'unknown-provider'
      };

      const validation = await qestroAdapter.validateTool(invalidTool);
      assert.equal(validation.compliant, false, 'Invalid tool should not be compliant');
      assert.ok(validation.errors.length > 0, 'Should have validation errors');
    });
  });
});

describe('PipeWarden Adapter Tests', () => {
  let pipewardenAdapter;

  before(async () => {
    const PipeWardenAdapter = (await import('../../adapters/pipewarden-adapter.js')).default;
    pipewardenAdapter = new PipeWardenAdapter({
      environment: 'test',
      securityLevel: 'high',
      frameworks: ['NIST', 'CIS']
    });
    await pipewardenAdapter.initialize();
  });

  after(async () => {
    await pipewardenAdapter.cleanup();
  });

  describe('Security Policy Validation', () => {
    it('should validate strong security policies', async () => {
      const policy = {
        name: 'strong-security-policy',
        authentication: {
          required: true,
          methods: ['mfa', 'sso'],
          strength: 'high'
        },
        encryption: {
          atRest: 'AES-256',
          inTransit: 'TLS-1.3',
          keyManagement: 'HSM'
        },
        accessControl: {
          model: 'zero-trust',
          principle: 'least-privilege'
        }
      };

      const result = await pipewardenAdapter.validateSecurityPolicy(policy);
      assert.ok(result.compliant, 'Strong policy should be compliant');
      assert.ok(result.securityScore > 0.8, 'Should have high security score');
    });

    it('should identify weak security policies', async () => {
      const weakPolicy = {
        name: 'weak-policy',
        authentication: {
          required: false
        },
        encryption: {
          atRest: 'none',
          inTransit: 'none'
        }
      };

      const result = await pipewardenAdapter.validateSecurityPolicy(weakPolicy);
      assert.equal(result.compliant, false, 'Weak policy should not be compliant');
      assert.ok(result.vulnerabilities.length > 0, 'Should identify vulnerabilities');
    });
  });

  describe('Threat Detection', () => {
    it('should detect common security threats', async () => {
      const scanData = {
        target: 'test-application',
        scanTypes: ['vulnerability', 'malware', 'misconfiguration'],
        depth: 'deep'
      };

      const threats = await pipewardenAdapter.detectThreats(scanData);
      assert.ok(Array.isArray(threats), 'Should return threats array');
      assert.ok(threats.every(threat => threat.type && threat.severity), 'Threats should have type and severity');
    });

    it('should provide risk assessment', async () => {
      const assessment = await pipewardenAdapter.performRiskAssessment({
        assets: ['customer-data', 'api-keys'],
        threats: ['data-breach', 'unauthorized-access'],
        controls: ['encryption', 'access-control']
      });

      assert.ok(assessment.overallRisk, 'Should provide overall risk rating');
      assert.ok(assessment.recommendations, 'Should provide recommendations');
    });
  });
});

describe('MCPOverflow Adapter Tests', () => {
  let mcpAdapter;

  before(async () => {
    const MCPOverflowAdapter = (await import('../../adapters/mcpoverflow-adapter.js')).default;
    mcpAdapter = new MCPOverflowAdapter({
      environment: 'test',
      protocolVersion: '2024-11-05',
      securityLevel: 'standard'
    });
    await mcpAdapter.initialize();
  });

  after(async () => {
    await mcpAdapter.cleanup();
  });

  describe('MCP Protocol Compliance', () => {
    it('should validate MCP protocol compliance', async () => {
      const protocol = {
        version: '2024-11-05',
        capabilities: {
          tools: true,
          resources: true,
          prompts: false
        },
        tools: [
          {
            name: 'database-query',
            description: 'Query database',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string' }
              }
            }
          }
        ]
      };

      const compliance = await mcpAdapter.checkProtocolCompliance(protocol);
      assert.ok(compliance.compliant, 'Protocol should be compliant');
      assert.ok(compliance.supportedFeatures, 'Should identify supported features');
    });

    it('should reject incompatible protocol versions', async () => {
      const oldProtocol = {
        version: '2020-01-01',
        capabilities: {},
        tools: []
      };

      const compliance = await mcpAdapter.checkProtocolCompliance(oldProtocol);
      assert.equal(compliance.compliant, false, 'Old protocol should not be compliant');
      assert.ok(compliance.issues.some(issue => issue.includes('version')), 'Should identify version issue');
    });
  });

  describe('Server Registration', () => {
    it('should register compliant MCP servers', async () => {
      const server = {
        name: 'compliant-server',
        version: '1.0.0',
        endpoint: 'https://api.example.com/mcp',
        authentication: {
          type: 'bearer',
          token: 'secure-token'
        },
        capabilities: {
          tools: true,
          resources: true
        },
        security: {
          tls: true,
          authentication: true,
          authorization: true
        }
      };

      const registration = await mcpAdapter.registerServer(server);
      assert.ok(registration.success, 'Server registration should succeed');
      assert.ok(registration.serverId, 'Should assign server ID');
    });

    it('should reject insecure servers', async () => {
      const insecureServer = {
        name: 'insecure-server',
        endpoint: 'http://insecure.example.com/mcp',
        authentication: null,
        security: {
          tls: false,
          authentication: false
        }
      };

      const registration = await mcpAdapter.registerServer(insecureServer);
      assert.equal(registration.success, false, 'Insecure server should be rejected');
      assert.ok(registration.errors.length > 0, 'Should provide error details');
    });
  });

  describe('Tool Validation', () => {
    it('should validate secure MCP tools', async () => {
      const tool = {
        name: 'secure-data-processor',
        description: 'Process data securely',
        inputSchema: {
          type: 'object',
          properties: {
            data: { type: 'string' },
            options: { type: 'object' }
          },
          required: ['data']
        },
        security: {
          dataClassification: 'confidential',
          encryption: true,
          auditLogging: true
        }
      };

      const validation = await mcpAdapter.validateTool(tool);
      assert.ok(validation.valid, 'Secure tool should be valid');
      assert.ok(validation.riskScore < 0.5, 'Should have acceptable risk score');
    });

    it('should identify risky tool configurations', async () => {
      const riskyTool = {
        name: 'risky-tool',
        description: 'Tool with security risks',
        inputSchema: {
          type: 'object',
          properties: {
            credentials: { type: 'string' },
            systemCommand: { type: 'string' }
          }
        },
        security: {
          dataClassification: 'public',
          encryption: false,
          auditLogging: false
        }
      };

      const validation = await mcpAdapter.validateTool(riskyTool);
      assert.equal(validation.valid, false, 'Risky tool should not be valid');
      assert.ok(validation.warnings.length > 0, 'Should provide security warnings');
    });
  });
});