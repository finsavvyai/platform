// Integration Tests for Unified Compliance Platform
// Tests the integration between all platform adapters

import { strict as assert } from 'node:assert';
import { describe, it, before, after } from 'node:test';

// Mock Cloudflare Workers environment
global.fetch = async (url, options = {}) => {
  // Mock implementation for testing
  if (url.includes('/api/health')) {
    return {
      ok: true,
      json: async () => ({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      })
    };
  }

  if (url.includes('/api/compliance/validate')) {
    return {
      ok: true,
      json: async () => ({
        compliant: true,
        riskScore: 0.2,
        recommendations: []
      })
    };
  }

  return {
    ok: true,
    json: async () => ({})
  };
};

describe('Unified Platform Integration Tests', () => {
  let platform;
  let qestroAdapter;
  let pipewardenAdapter;
  let mcpAdapter;

  before(async () => {
    // Initialize platform and adapters
    const { UnifiedPlatform } = await import('../../src/index.js');
    platform = new UnifiedPlatform({
      environment: 'test',
      adapters: ['qestro', 'pipewarden', 'mcpoverflow']
    });

    await platform.initialize();
    qestroAdapter = platform.getAdapter('qestro');
    pipewardenAdapter = platform.getAdapter('pipewarden');
    mcpAdapter = platform.getAdapter('mcpoverflow');
  });

  after(async () => {
    // Cleanup
    if (platform) {
      await platform.cleanup();
    }
  });

  describe('Platform Initialization', () => {
    it('should initialize all adapters successfully', async () => {
      assert.ok(platform, 'Platform should be initialized');
      assert.ok(qestroAdapter, 'Qestro adapter should be available');
      assert.ok(pipewardenAdapter, 'PipeWarden adapter should be available');
      assert.ok(mcpAdapter, 'MCPOverflow adapter should be available');
    });

    it('should have shared compliance configuration', async () => {
      const config = await platform.getComplianceConfig();
      assert.ok(config.frameworks, 'Should have compliance frameworks');
      assert.ok(config.policies, 'Should have compliance policies');
      assert.ok(Array.isArray(config.frameworks), 'Frameworks should be an array');
    });

    it('should have unified authentication system', async () => {
      const authStatus = await platform.getAuthStatus();
      assert.ok(authStatus.enabled, 'Authentication should be enabled');
      assert.ok(authStatus.unified, 'Should use unified authentication');
    });
  });

  describe('Qestro Adapter Integration', () => {
    it('should validate orchestration workflows', async () => {
      const workflow = {
        name: 'data-processing-pipeline',
        tools: ['openai-gpt4', 'data-processor'],
        dataTypes: ['customer-data'],
        complianceFrameworks: ['GDPR']
      };

      const result = await qestroAdapter.validateWorkflow(workflow);
      assert.ok(result.valid, 'Workflow should be valid');
      assert.ok(result.complianceCheck, 'Should perform compliance check');
      assert.equal(result.issues.length, 0, 'Should have no compliance issues');
    });

    it('should detect non-compliant workflows', async () => {
      const workflow = {
        name: 'risky-workflow',
        tools: ['unknown-tool'],
        dataTypes: ['sensitive-data'],
        complianceFrameworks: ['HIPAA']
      };

      const result = await qestroAdapter.validateWorkflow(workflow);
      assert.equal(result.valid, false, 'Workflow should be invalid');
      assert.ok(result.issues.length > 0, 'Should have compliance issues');
    });

    it('should integrate with LAM policy learning', async () => {
      const learningData = {
        workflowResults: [
          { workflow: 'test-workflow', success: true, violations: 0 },
          { workflow: 'risky-workflow', success: false, violations: 2 }
        ]
      };

      const update = await qestroAdapter.updateLAMPolicies(learningData);
      assert.ok(update.acknowledged, 'LAM policy update should be acknowledged');
    });
  });

  describe('PipeWarden Adapter Integration', () => {
    it('should validate security policies', async () => {
      const policy = {
        name: 'strict-access-control',
        rules: [
          { type: 'authentication', required: true },
          { type: 'encryption', required: true, level: 'AES-256' }
        ],
        complianceFrameworks: ['SOC2', 'ISO27001']
      };

      const result = await pipewardenAdapter.validateSecurityPolicy(policy);
      assert.ok(result.compliant, 'Policy should be compliant');
      assert.ok(result.riskScore < 0.5, 'Risk score should be acceptable');
    });

    it('should detect security vulnerabilities', async () => {
      const scanResult = await pipewardenAdapter.performSecurityScan({
        target: 'test-application',
        scanType: 'vulnerability'
      });

      assert.ok(scanResult.completed, 'Security scan should complete');
      assert.ok(Array.isArray(scanResult.vulnerabilities), 'Should return vulnerabilities');
      assert.ok(scanResult.riskAssessment, 'Should provide risk assessment');
    });

    it('should enforce compliance standards', async () => {
      const standards = ['NIST', 'CIS', 'ISO27001'];
      const compliance = await pipewardenAdapter.checkComplianceStandards(standards);

      for (const standard of standards) {
        assert.ok(compliance[standard], `Should be compliant with ${standard}`);
      }
    });
  });

  describe('MCPOverflow Adapter Integration', () => {
    it('should validate MCP tools', async () => {
      const tool = {
        name: 'database-query',
        server: 'customer-database',
        description: 'Query customer database',
        dataClassification: 'sensitive'
      };

      const result = await mcpAdapter.validateMCPTool(tool);
      assert.ok(result.validated, 'Tool should be validated');
      assert.ok(result.complianceCheck, 'Should perform compliance check');
    });

    it('should register MCP servers safely', async () => {
      const server = {
        name: 'compliant-db-server',
        endpoint: 'https://api.example.com/mcp',
        authentication: {
          type: 'bearer',
          token: 'test-token'
        },
        dataHandling: {
          encryption: true,
          logging: true,
          retention: '90d'
        }
      };

      const registration = await mcpAdapter.registerMCPServer(server);
      assert.ok(registration.success, 'Server registration should succeed');
      assert.ok(registration.serverId, 'Should assign server ID');
      assert.ok(registration.complianceStatus, 'Should provide compliance status');
    });

    it('should enforce MCP protocol compliance', async () => {
      const protocolTest = {
        version: '2024-11-05',
        capabilities: ['tools', 'resources'],
        tools: ['query', 'update', 'delete']
      };

      const compliance = await mcpAdapter.checkMCPProtocolCompliance(protocolTest);
      assert.ok(compliant.compliant, 'Should be MCP protocol compliant');
      assert.ok(compliance.supportedVersion, 'Should support protocol version');
    });
  });

  describe('Cross-Platform Integration', () => {
    it('should share compliance data across adapters', async () => {
      // Create compliance data in Qestro
      const qestroData = {
        frameworks: ['GDPR', 'SOC2'],
        policies: ['data-protection', 'access-control']
      };

      await qestroAdapter.updateComplianceData(qestroData);

      // Verify data is available in PipeWarden
      const pipewardenData = await pipewardenAdapter.getSharedComplianceData();
      assert.deepStrictEqual(pipewardenData.frameworks, qestroData.frameworks);

      // Verify data is available in MCPOverflow
      const mcpData = await mcpAdapter.getSharedComplianceData();
      assert.deepStrictEqual(mcpData.frameworks, qestroData.frameworks);
    });

    it('should coordinate unified audit logging', async () => {
      const auditEvent = {
        timestamp: new Date().toISOString(),
        platform: 'unified',
        action: 'compliance-check',
        result: 'passed',
        metadata: {
          adapters: ['qestro', 'pipewarden', 'mcpoverflow']
        }
      };

      // Log from multiple adapters
      await qestroAdapter.logAuditEvent(auditEvent);
      await pipewardenAdapter.logAuditEvent(auditEvent);
      await mcpAdapter.logAuditEvent(auditEvent);

      // Verify unified audit log
      const unifiedLog = await platform.getUnifiedAuditLog();
      assert.ok(unifiedLog.length >= 3, 'Should have entries from all adapters');
      assert.ok(unifiedLog.every(entry => entry.platform === 'unified'), 'All entries should be unified');
    });

    it('should handle cross-platform compliance violations', async () => {
      // Simulate a compliance violation
      const violation = {
        type: 'data-privacy',
        severity: 'high',
        description: 'PII data exposed in logs',
        affectedAdapters: ['qestro', 'mcpoverflow'],
        timestamp: new Date().toISOString()
      };

      const response = await platform.handleComplianceViolation(violation);
      assert.ok(response.acknowledged, 'Violation should be acknowledged');
      assert.ok(response.mitigationActions.length > 0, 'Should have mitigation actions');
      assert.ok(response.notifiedAdapters.includes('pipewarden'), 'Should notify other adapters');
    });

    it('should synchronize LAM learning across platforms', async () => {
      const learningInsights = {
        patterns: [
          {
            type: 'workflow-optimization',
            suggestion: 'Use encrypted data transfer',
            confidence: 0.95,
            platforms: ['qestro', 'pipewarden']
          }
        ],
        riskFactors: [
          {
            factor: 'insufficient-audit-logging',
            severity: 'medium',
            platforms: ['mcpoverflow']
          }
        ]
      };

      const syncResult = await platform.synchronizeLAMLearning(learningInsights);
      assert.ok(syncResult.success, 'Learning synchronization should succeed');
      assert.ok(syncResult.updatedAdapters.length > 0, 'Should update adapters');

      // Verify insights are applied
      for (const adapterName of syncResult.updatedAdapters) {
        const adapter = platform.getAdapter(adapterName);
        const insights = await adapter.getLAMInsights();
        assert.ok(insights.length > 0, `Adapter ${adapterName} should have LAM insights`);
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle concurrent requests across adapters', async () => {
      const concurrentRequests = [];

      // Create concurrent requests to all adapters
      for (let i = 0; i < 10; i++) {
        concurrentRequests.push(
          qestroAdapter.validateWorkflow({
            name: `test-workflow-${i}`,
            tools: ['test-tool'],
            dataTypes: ['test-data']
          })
        );

        concurrentRequests.push(
          pipewardenAdapter.validateSecurityPolicy({
            name: `test-policy-${i}`,
            rules: [{ type: 'test', required: true }]
          })
        );

        concurrentRequests.push(
          mcpAdapter.validateMCPTool({
            name: `test-tool-${i}`,
            server: 'test-server'
          })
        );
      }

      // Wait for all requests to complete
      const results = await Promise.all(concurrentRequests);

      // Verify all requests succeeded
      assert.equal(results.length, 30, 'All requests should complete');
      assert.ok(results.every(result => result !== null), 'All results should be valid');
    });

    it('should maintain performance under load', async () => {
      const startTime = Date.now();
      const requests = [];

      // Create load test
      for (let i = 0; i < 100; i++) {
        requests.push(platform.getSystemStatus());
      }

      await Promise.all(requests);
      const duration = Date.now() - startTime;

      // Should complete within reasonable time (less than 5 seconds for 100 requests)
      assert.ok(duration < 5000, `Load test should complete quickly (took ${duration}ms)`);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle adapter failures gracefully', async () => {
      // Simulate adapter failure
      const originalValidate = qestroAdapter.validateWorkflow;
      qestroAdapter.validateWorkflow = () => {
        throw new Error('Adapter temporarily unavailable');
      };

      // System should continue operating
      const status = await platform.getSystemStatus();
      assert.ok(status.overall === 'degraded', 'System should be in degraded state');
      assert.ok(status.adapters.qestro.status === 'error', 'Qestro adapter should show error');

      // Restore adapter
      qestroAdapter.validateWorkflow = originalValidate;

      // System should recover
      const recoveredStatus = await platform.getSystemStatus();
      assert.ok(recoveredStatus.adapters.qestro.status !== 'error', 'Qestro adapter should recover');
    });

    it('should provide meaningful error messages', async () => {
      try {
        await qestroAdapter.validateWorkflow(null); // Invalid input
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error.message.includes('validation'), 'Error should be descriptive');
        assert.ok(error.code, 'Error should have code');
      }
    });

    it('should maintain data consistency during failures', async () => {
      // Start a complex operation
      const operation = platform.performComplexComplianceOperation();

      // Simulate failure mid-operation
      setTimeout(async () => {
        await qestroAdapter.simulateFailure();
      }, 100);

      try {
        await operation;
        assert.fail('Operation should fail due to adapter failure');
      } catch (error) {
        // Verify data consistency is maintained
        const auditLog = await platform.getUnifiedAuditLog();
        const failedOperations = auditLog.filter(entry => entry.status === 'failed');

        assert.ok(failedOperations.length > 0, 'Should log failed operations');
        assert.ok(
          failedOperations.every(entry => entry.rollback || entry.compensated),
          'Failed operations should be rolled back or compensated'
        );
      }
    });
  });
});