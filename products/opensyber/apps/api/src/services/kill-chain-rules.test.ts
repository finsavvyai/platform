import { describe, it, expect } from 'vitest';
import { KILL_CHAIN_RULES } from './kill-chain.js';

describe('kill-chain: rules', () => {
  describe('KILL_CHAIN_RULES', () => {
    it('has 3 built-in rules', () => {
      expect(KILL_CHAIN_RULES).toHaveLength(3);
    });

    it('each rule has required structure and fields', () => {
      for (const rule of KILL_CHAIN_RULES) {
        expect(rule.id).toBeDefined();
        expect(rule.name).toBeDefined();
        expect(rule.description).toBeDefined();
        expect(rule.stages).toBeInstanceOf(Array);
        expect(rule.stages.length).toBeGreaterThan(0);
        expect(rule.timeWindowMinutes).toBeGreaterThan(0);
        expect(rule.severity).toBe('critical');
      }
    });

    it('has phishing + MFA rule with correct properties', () => {
      const rule = KILL_CHAIN_RULES.find(r => r.id === 'kc-phishing-mfa')!;

      expect(rule.name).toBe('Phishing + MFA Anomaly');
      expect(rule.stages).toHaveLength(2);
      expect(rule.stages[0].integrationSlug).toBe('outlook');
      expect(rule.stages[0].eventType).toBe('phishing_detected');
      expect(rule.stages[1].integrationSlug).toBe('entra');
      expect(rule.stages[1].eventType).toBe('risky_signin');
      expect(rule.timeWindowMinutes).toBe(30);
    });

    it('has supply chain attack rule with correct properties', () => {
      const rule = KILL_CHAIN_RULES.find(r => r.id === 'kc-supply-chain')!;

      expect(rule.name).toBe('Supply Chain Attack');
      expect(rule.stages).toHaveLength(3);
      expect(rule.stages[0].integrationSlug).toBe('github');
      expect(rule.stages[1].integrationSlug).toBe('ide');
      expect(rule.stages[2].integrationSlug).toBe('cloudtrail');
      expect(rule.timeWindowMinutes).toBe(4320); // 72 hours
    });

    it('has AI agent compromise rule with correct properties', () => {
      const rule = KILL_CHAIN_RULES.find(r => r.id === 'kc-ai-compromise')!;

      expect(rule.name).toBe('AI Agent Compromise');
      expect(rule.stages).toHaveLength(3);
      expect(rule.stages[0].integrationSlug).toBe('ide');
      expect(rule.stages[0].eventType).toBe('suspicious_command');
      expect(rule.stages[1].integrationSlug).toBe('agent');
      expect(rule.stages[2].integrationSlug).toBe('cloudtrail');
      expect(rule.timeWindowMinutes).toBe(60);
    });

    it('each stage has valid integration slug and event type', () => {
      for (const rule of KILL_CHAIN_RULES) {
        for (const stage of rule.stages) {
          expect(typeof stage.integrationSlug).toBe('string');
          expect(typeof stage.eventType).toBe('string');
          expect(stage.integrationSlug.length).toBeGreaterThan(0);
          expect(stage.eventType.length).toBeGreaterThan(0);
        }
      }
    });
  });
});
