import { describe, it, expect } from 'vitest';
import { checkUnverifiedSkillAllowed, getSecurityDashboardTier, getPlanFeatures } from './plan-enforcement.js';

describe('Plan Enforcement', () => {
  describe('checkUnverifiedSkillAllowed', () => {
    it('disallows unverified skills on free plan', () => {
      expect(checkUnverifiedSkillAllowed('free')).toBe(false);
    });

    it('disallows unverified skills on personal plan', () => {
      expect(checkUnverifiedSkillAllowed('personal')).toBe(false);
    });

    it('allows unverified skills on pro plan', () => {
      expect(checkUnverifiedSkillAllowed('pro')).toBe(true);
    });

    it('allows unverified skills on team plan', () => {
      expect(checkUnverifiedSkillAllowed('team')).toBe(true);
    });
  });

  describe('getSecurityDashboardTier', () => {
    it('returns basic for free plan', () => {
      expect(getSecurityDashboardTier('free')).toBe('basic');
    });

    it('returns basic for personal plan', () => {
      expect(getSecurityDashboardTier('personal')).toBe('basic');
    });

    it('returns full for pro plan', () => {
      expect(getSecurityDashboardTier('pro')).toBe('full');
    });

    it('returns full for team plan', () => {
      expect(getSecurityDashboardTier('team')).toBe('full');
    });
  });

  describe('getPlanFeatures', () => {
    it('returns correct features for free plan', () => {
      const features = getPlanFeatures('free');
      expect(features.plan).toBe('free');
      expect(features.instanceLimit).toBe(1);
      expect(features.verifiedSkillLimit).toBe(3);
      expect(features.allowUnverifiedSkills).toBe(false);
      expect(features.securityDashboard).toBe('basic');
      expect(features.auditLogRetentionDays).toBe(3);
      expect(features.supportLevel).toBe('community');
    });

    it('returns correct features for team plan', () => {
      const features = getPlanFeatures('team');
      expect(features.plan).toBe('team');
      expect(features.instanceLimit).toBe(3);
      expect(features.verifiedSkillLimit).toBeNull();
      expect(features.allowUnverifiedSkills).toBe(true);
      expect(features.securityDashboard).toBe('full');
      expect(features.auditLogRetentionDays).toBe(90);
      expect(features.supportLevel).toBe('email');
    });

    it('returns correct features for pro plan', () => {
      const features = getPlanFeatures('pro');
      expect(features.instanceLimit).toBe(1);
      expect(features.verifiedSkillLimit).toBeNull();
      expect(features.auditLogRetentionDays).toBe(90);
    });
  });
});
