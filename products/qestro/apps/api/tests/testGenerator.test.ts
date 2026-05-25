import { describe, it, expect, vi } from 'vitest';
import { testGenerator } from '../src/services/testGenerator';

describe('Test Generator', () => {
  const mockApiKey = 'test-key';

  describe('validate steps', () => {
    it('should accept valid steps', () => {
      const steps = [
        { action: 'navigate' as const, url: 'https://example.com' },
        { action: 'click' as const, selector: 'button.login' },
        { action: 'type' as const, selector: 'input[name=email]', value: 'test@test.com' },
        { action: 'assert' as const, expected: 'Login successful' },
      ];
      const result = testGenerator.validateSteps(steps);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid action', () => {
      const steps = [{ action: 'invalid' as any }];
      const result = testGenerator.validateSteps(steps);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should require selector for click', () => {
      const steps = [{ action: 'click' as const }];
      const result = testGenerator.validateSteps(steps);
      expect(result.valid).toBe(false);
    });

    it('should require selector and value for type', () => {
      const steps = [{ action: 'type' as const, selector: 'input' }];
      const result = testGenerator.validateSteps(steps);
      expect(result.valid).toBe(false);
    });

    it('should require duration for wait', () => {
      const steps = [{ action: 'wait' as const }];
      const result = testGenerator.validateSteps(steps);
      expect(result.valid).toBe(false);
    });

    it('should reject non-array steps', () => {
      const result = testGenerator.validateSteps({} as any);
      expect(result.valid).toBe(false);
    });
  });

  describe('generate', () => {
    it('should return fallback on API error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }));

      const result = await testGenerator.generate('test description', mockApiKey);
      expect(result.steps).toBeInstanceOf(Array);
      expect(result.estimatedDuration).toBeGreaterThan(0);
    });

    it('should return fallback on invalid JSON', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'invalid' } }] }),
      }));

      const result = await testGenerator.generate('test', mockApiKey);
      expect(result.steps).toBeInstanceOf(Array);
    });

    it('should parse valid response', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '{"steps": [{"action": "navigate", "url": "https://test.com"}], "estimatedDuration": 5000}',
              },
            },
          ],
        }),
      };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const result = await testGenerator.generate('test', mockApiKey);
      expect(result.steps.length).toBe(1);
      expect(result.steps[0].action).toBe('navigate');
    });

    it('should handle missing steps in response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '{"estimatedDuration": 1000}' } }] }),
      }));

      const result = await testGenerator.generate('test', mockApiKey);
      expect(result.steps).toBeInstanceOf(Array);
    });

    it('should set estimatedDuration', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '{"steps": [], "estimatedDuration": 15000}',
              },
            },
          ],
        }),
      };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const result = await testGenerator.generate('test', mockApiKey);
      expect(result.estimatedDuration).toBe(15000);
    });

    it('should escape quotes in description', async () => {
      let capturedBody = '';
      vi.stubGlobal('fetch', vi.fn((url, opts) => {
        capturedBody = (opts as any).body;
        return Promise.resolve({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: '{"steps": [], "estimatedDuration": 1000}' } }],
          }),
        });
      }));

      await testGenerator.generate('test "quoted"', mockApiKey);
      expect(capturedBody).toContain('\\"');
    });

    it('should handle network errors', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

      const result = await testGenerator.generate('test', mockApiKey);
      expect(result.steps).toBeInstanceOf(Array);
      expect(result.estimatedDuration).toBeGreaterThan(0);
    });
  });
});
