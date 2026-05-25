import { MCPOverflowConnectorService } from '../MCPOverflowConnectorService';

describe('MCPOverflowConnectorService', () => {
  let service: MCPOverflowConnectorService;

  beforeEach(() => {
    service = MCPOverflowConnectorService.getInstance({
      apiUrl: 'http://localhost:3001',
      timeout: 30000,
      retryCount: 2,
    });
  });

  describe('healthCheck', () => {
    it('should check service health', async () => {
      const health = await service.healthCheck();

      expect(health).toBeDefined();
      expect(health.status).toMatch(/healthy|unhealthy|degraded/);
      expect(health.openhands).toBeDefined();
    }, 10000);
  });

  describe('parseSpec', () => {
    it('should parse JSON spec', () => {
      const json = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
      });

      const spec = MCPOverflowConnectorService.parseSpec(json);

      expect(spec.openapi).toBe('3.0.0');
      expect(spec.info.title).toBe('Test API');
    });
  });

  describe('estimateGenerationTime', () => {
    it('should estimate simple API generation time', () => {
      const analysis = {
        endpoints: 5,
        methods: ['GET', 'POST'],
        complexity: 'simple' as const,
        estimatedGenerationTime: 20,
        recommendations: [],
      };

      const time = MCPOverflowConnectorService.estimateGenerationTime(analysis);

      expect(time).toBeGreaterThan(0);
      expect(time).toBeLessThan(60); // Simple APIs should be < 60s
    });

    it('should estimate complex API generation time', () => {
      const analysis = {
        endpoints: 20,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        complexity: 'complex' as const,
        estimatedGenerationTime: 100,
        recommendations: [],
      };

      const time = MCPOverflowConnectorService.estimateGenerationTime(analysis);

      expect(time).toBeGreaterThan(50);
    });
  });
});
