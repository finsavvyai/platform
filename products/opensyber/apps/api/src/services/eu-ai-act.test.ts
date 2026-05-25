import { describe, it, expect, beforeEach } from 'vitest';
import { createMockDb } from '../test/mock-db.js';
import {
  classifyAiRisk,
  mapToNistAiRmf,
  exportAuditTrail,
  AI_RISK_CATEGORIES,
  NIST_AI_RMF_FUNCTIONS,
} from './eu-ai-act.js';

describe('EU AI Act Compliance Service', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = createMockDb();
  });

;

  describe('AI_RISK_CATEGORIES', () => {
    it('should contain 4 risk levels', () => {
      expect(AI_RISK_CATEGORIES.MINIMAL).toBe('minimal');
      expect(AI_RISK_CATEGORIES.LIMITED).toBe('limited');
      expect(AI_RISK_CATEGORIES.HIGH_RISK).toBe('high-risk');
      expect(AI_RISK_CATEGORIES.UNACCEPTABLE).toBe('unacceptable');
    });

    it('should have exactly 4 categories', () => {
      const categories = Object.values(AI_RISK_CATEGORIES);
      expect(categories).toHaveLength(4);
    });
  });

  describe('NIST_AI_RMF_FUNCTIONS', () => {
    it('should contain all 4 NIST RMF functions', () => {
      expect(NIST_AI_RMF_FUNCTIONS.GOVERN).toBe('AI-GOVERN');
      expect(NIST_AI_RMF_FUNCTIONS.MAP).toBe('AI-MAP');
      expect(NIST_AI_RMF_FUNCTIONS.MEASURE).toBe('AI-MEASURE');
      expect(NIST_AI_RMF_FUNCTIONS.MANAGE).toBe('AI-MANAGE');
      expect(NIST_AI_RMF_FUNCTIONS.MONITOR).toBe('AI-MONITOR');
    });

    it('should have 5 functions (including MONITOR)', () => {
      const functions = Object.values(NIST_AI_RMF_FUNCTIONS);
      expect(functions).toHaveLength(5);
    });
  });

  describe('mapToNistAiRmf', () => {
    it('should map data-quality to MAP function', () => {
      const finding = {
        id: 'finding-1',
        finding: 'Poor data quality',
        nistCategory: 'data-quality',
        severity: 'medium',
        timestamp: '2024-03-20T10:00:00Z',
      };

      const result = mapToNistAiRmf(finding);

      expect(result.nistFunction).toBe('AI-MAP');
      expect(result.controls).toContain('AI-1.1');
      expect(result.controls).toContain('AI-1.2');
    });

    it('should map model-transparency to GOVERN function', () => {
      const finding = {
        id: 'finding-2',
        finding: 'Lack of transparency',
        nistCategory: 'model-transparency',
        severity: 'high',
        timestamp: '2024-03-20T10:00:00Z',
      };

      const result = mapToNistAiRmf(finding);

      expect(result.nistFunction).toBe('AI-GOVERN');
      expect(result.controls).toContain('AI-2.1');
    });

    it('should map bias-detection to MEASURE function', () => {
      const finding = {
        id: 'finding-3',
        finding: 'Detected bias',
        nistCategory: 'bias-detection',
        severity: 'high',
        timestamp: '2024-03-20T10:00:00Z',
      };

      const result = mapToNistAiRmf(finding);

      expect(result.nistFunction).toBe('AI-MEASURE');
      expect(result.controls).toContain('AI-3.1');
    });

    it('should map performance-monitoring to MONITOR function', () => {
      const finding = {
        id: 'finding-4',
        finding: 'Performance drift',
        nistCategory: 'performance-monitoring',
        severity: 'medium',
        timestamp: '2024-03-20T10:00:00Z',
      };

      const result = mapToNistAiRmf(finding);

      expect(result.nistFunction).toBe('AI-MONITOR');
      expect(result.controls).toContain('AI-5.1');
    });

    it('should map risk-mitigation to MANAGE function', () => {
      const finding = {
        id: 'finding-5',
        finding: 'Unmitigated risk',
        nistCategory: 'risk-mitigation',
        severity: 'critical',
        timestamp: '2024-03-20T10:00:00Z',
      };

      const result = mapToNistAiRmf(finding);

      expect(result.nistFunction).toBe('AI-MANAGE');
      expect(result.controls).toContain('AI-4.1');
    });

    it('should handle case-insensitive category matching', () => {
      const finding = {
        id: 'finding-6',
        finding: 'Test',
        nistCategory: 'DATA-QUALITY',
        severity: 'low',
        timestamp: '2024-03-20T10:00:00Z',
      };

      const result = mapToNistAiRmf(finding);

      expect(result.nistFunction).toBe('AI-MAP');
    });

    it('should default to GOVERN for unmapped categories', () => {
      const finding = {
        id: 'finding-7',
        finding: 'Unknown finding',
        nistCategory: 'unknown-category',
        severity: 'info',
        timestamp: '2024-03-20T10:00:00Z',
      };

      const result = mapToNistAiRmf(finding);

      expect(result.nistFunction).toBe('AI-GOVERN');
      expect(result.controls).toEqual([]);
    });
  });

  describe('exportAuditTrail', () => {
    it('should return audit trail with correct period', async () => {
      const from = new Date('2024-03-01T00:00:00Z');
      const to = new Date('2024-03-31T23:59:59Z');
      const trail = await exportAuditTrail(mockDb, from, to);
      expect(trail.events).toEqual([]);
      expect(trail.totalEvents).toBe(0);
    });
  });
});
