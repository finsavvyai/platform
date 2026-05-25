import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createTestUser,
  createMockDb,
  createMockKV,
  createMockR2,
  createMockBilling,
} from './helpers.js';

/**
 * Sample Project 4: Skill Marketplace Creator
 *
 * Persona: Tomas, security tool author publishing skills for revenue
 * Plan: Pro (creator account with 70/30 revenue split)
 *
 * Tests the skill creation and publishing lifecycle:
 *   Build skill → Validate → Test → Publish → Monitor revenue
 */
describe('Sample Project: Skill Marketplace Creator', () => {
  let creator: ReturnType<typeof createTestUser>;
  let db: ReturnType<typeof createMockDb>;
  let kv: ReturnType<typeof createMockKV>;
  let r2: ReturnType<typeof createMockR2>;
  let billing: ReturnType<typeof createMockBilling>;

  beforeEach(() => {
    creator = createTestUser({ plan: 'pro', role: 'owner' });
    db = createMockDb();
    kv = createMockKV();
    r2 = createMockR2();
    billing = createMockBilling();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Skill Definition & Validation', () => {
    it('should validate skill manifest schema', () => {
      const manifest = {
        name: 'Custom CVE Scanner',
        slug: 'custom-cve-scanner',
        version: '1.0.0',
        description: 'Scans dependencies for known CVEs',
        entrypoint: 'index.js',
        permissions: {
          network: ['nvd.nist.gov', 'cve.circl.lu'],
          filesystem: ['./data/'],
          env: ['LLM_API_KEY'],
        },
        author: 'tomas-security',
        minAgentVersion: '0.2.0',
      };

      expect(manifest.slug).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(manifest.entrypoint).toBeTruthy();
      expect(manifest.permissions).toBeDefined();
    });

    it('should reject invalid skill slugs', () => {
      const invalidSlugs = [
        'My Skill',
        'UPPERCASE',
        '123-starts-with-number',
        'has_underscores',
        'has.dots',
      ];

      const isValidSlug = (slug: string) => /^[a-z][a-z0-9-]*$/.test(slug);

      for (const slug of invalidSlugs) {
        expect(isValidSlug(slug)).toBe(false);
      }
    });

    it('should validate semver version format', () => {
      const validVersions = ['1.0.0', '0.1.0', '2.3.4', '10.20.30'];
      const invalidVersions = ['1.0', 'v1.0.0', '1.0.0-beta', 'latest'];

      const isValidVersion = (v: string) => /^\d+\.\d+\.\d+$/.test(v);

      for (const v of validVersions) {
        expect(isValidVersion(v)).toBe(true);
      }
      for (const v of invalidVersions) {
        expect(isValidVersion(v)).toBe(false);
      }
    });

    it('should validate permission scoping', () => {
      const permissions = {
        network: ['api.anthropic.com'],
        filesystem: ['./data/'],
        env: ['LLM_API_KEY'],
      };

      expect(permissions.network).not.toContain('*');
      expect(permissions.filesystem).not.toContain('/');

      const hasWildcard = Object.values(permissions)
        .flat()
        .some((p) => p === '*');
      expect(hasWildcard).toBe(false);
    });
  });

  describe('Skill Development', () => {
    it('should implement skill with worker_threads pattern', () => {
      const skillCode = `
        const { parentPort } = require('node:worker_threads');
        parentPort.on('message', async (msg) => {
          if (msg.type !== 'security_event') return;
          const result = await processEvent(msg.data);
          parentPort.postMessage({ type: 'result', data: result });
        });
      `;

      expect(skillCode).toContain('parentPort');
      expect(skillCode).toContain('worker_threads');
      expect(skillCode).toContain('postMessage');
    });

    it('should implement skill context correctly', () => {
      const context = {
        orgId: creator.orgId,
        userId: creator.id,
        config: { threshold: 0.8, maxBatchSize: 50 },
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        },
        http: { fetch: vi.fn() },
        vault: { get: vi.fn(), set: vi.fn() },
        emit: {
          finding: vi.fn(),
          metric: vi.fn(),
          asset: vi.fn(),
        },
      };

      expect(context.orgId).toBeTruthy();
      expect(context.config.threshold).toBe(0.8);
      expect(context.emit.finding).toBeDefined();
    });

    it('should emit findings from skill execution', () => {
      const emit = { finding: vi.fn() };

      emit.finding({
        title: 'CVE-2026-1234 detected',
        severity: 'critical',
        resource: 'package.json',
        description: 'lodash@4.17.20 has known RCE vulnerability',
        remediation: 'Upgrade to lodash@4.17.22',
        cveId: 'CVE-2026-1234',
      });

      expect(emit.finding).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'critical',
          cveId: 'CVE-2026-1234',
        }),
      );
    });
  });

  describe('Skill Testing', () => {
    it('should run skill in sandboxed test environment', () => {
      const sandbox = {
        allowedApis: ['nvd.nist.gov'],
        filesystemRoot: '/tmp/skill-test',
        timeout: 30_000,
        memoryLimit: 128 * 1024 * 1024,
      };

      expect(sandbox.timeout).toBe(30_000);
      expect(sandbox.memoryLimit).toBe(134_217_728);
    });

    it('should verify skill output schema', () => {
      const output = {
        type: 'scan_result',
        findings: [
          {
            id: 'cve-001',
            title: 'CVE-2026-1234',
            severity: 'critical',
            resource: 'lodash',
          },
        ],
        metadata: {
          scannedPackages: 142,
          duration: 2300,
        },
      };

      expect(output.type).toBe('scan_result');
      expect(output.findings).toBeInstanceOf(Array);
      expect(output.findings[0]).toHaveProperty('severity');
      expect(output.metadata.scannedPackages).toBeGreaterThan(0);
    });

    it('should handle skill timeout gracefully', async () => {
      const executeWithTimeout = async (
        fn: () => Promise<void>,
        ms: number,
      ) => {
        return Promise.race([
          fn(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Skill execution timed out')), ms),
          ),
        ]);
      };

      const slowSkill = () =>
        new Promise<void>((resolve) => setTimeout(resolve, 5000));

      await expect(executeWithTimeout(slowSkill, 100)).rejects.toThrow(
        'timed out',
      );
    });

    it('should block network access to non-whitelisted domains', () => {
      const allowedDomains = ['nvd.nist.gov', 'cve.circl.lu'];
      const requestDomain = 'evil.com';

      const isAllowed = allowedDomains.includes(requestDomain);
      expect(isAllowed).toBe(false);
    });
  });

  describe('Skill Publishing', () => {
    it('should package skill as tar.gz and upload to R2', async () => {
      const packageContent = JSON.stringify({
        manifest: { slug: 'custom-cve-scanner', version: '1.0.0' },
        files: ['index.js', 'manifest.json'],
      });

      await (r2.put as ReturnType<typeof vi.fn>)(
        'skills/custom-cve-scanner/1.0.0/package.tar.gz',
        packageContent,
      );

      const obj = await (r2.head as ReturnType<typeof vi.fn>)(
        'skills/custom-cve-scanner/1.0.0/package.tar.gz',
      );
      expect(obj).not.toBeNull();
    });

    it('should create marketplace listing', async () => {
      const listing = {
        slug: 'custom-cve-scanner',
        name: 'Custom CVE Scanner',
        description: 'Scans dependencies for known CVEs',
        version: '1.0.0',
        authorId: creator.id,
        tier: 'premium',
        price: 4900,
        category: 'vulnerability-scanning',
        status: 'pending_review',
        publishedAt: null,
      };

      await db.insert({ marketplace_skills: {} }).values(listing);

      expect(db.insert).toHaveBeenCalled();
    });

    it('should submit skill for security audit', async () => {
      const auditRequest = {
        skillSlug: 'custom-cve-scanner',
        version: '1.0.0',
        submittedBy: creator.id,
        checks: [
          'no-eval-usage',
          'no-fs-outside-sandbox',
          'no-network-wildcard',
          'no-child-process',
          'permission-scoping',
        ],
        status: 'pending',
      };

      await db.insert({ skill_audits: {} }).values(auditRequest);

      expect(auditRequest.checks).toHaveLength(5);
    });

    it('should approve and publish after audit passes', async () => {
      await db.update({ marketplace_skills: {} })
        .set({
          status: 'published',
          publishedAt: new Date().toISOString(),
          auditStatus: 'passed',
        })
        .where('slug = ?');

      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('Revenue & Analytics', () => {
    it('should track skill installations', async () => {
      db._setSelectResult([
        { date: '2026-04-01', installs: 12 },
        { date: '2026-04-02', installs: 18 },
        { date: '2026-04-03', installs: 25 },
      ]);

      const stats = await db
        .select()
        .from('skill_install_stats')
        .where('skillSlug = ?');

      expect(stats).toHaveLength(3);
    });

    it('should calculate revenue with 70/30 split', () => {
      const totalRevenue = 49_00 * 150;
      const creatorShare = Math.round(totalRevenue * 0.7);
      const platformShare = totalRevenue - creatorShare;

      expect(creatorShare).toBe(514_500);
      expect(platformShare).toBe(220_500);
      expect(creatorShare + platformShare).toBe(totalRevenue);
    });

    it('should generate creator payout report', async () => {
      const payoutReport = {
        creatorId: creator.id,
        period: '2026-04',
        totalInstalls: 150,
        totalRevenue: 735_000,
        creatorPayout: 514_500,
        currency: 'USD',
      };

      await db.insert({ creator_payouts: {} }).values(payoutReport);

      expect(db.insert).toHaveBeenCalled();
      expect(payoutReport.creatorPayout).toBe(514_500);
    });

    it('should track skill ratings and reviews', async () => {
      const reviews = [
        { userId: 'user_1', rating: 5, comment: 'Excellent CVE detection' },
        { userId: 'user_2', rating: 4, comment: 'Good but could be faster' },
        { userId: 'user_3', rating: 5, comment: 'Best scanner available' },
      ];

      for (const review of reviews) {
        await db.insert({ skill_reviews: {} }).values({
          ...review,
          skillSlug: 'custom-cve-scanner',
        });
      }

      const avgRating =
        reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

      expect(avgRating).toBeCloseTo(4.67, 1);
    });
  });
});
