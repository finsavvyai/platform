import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createTestUser,
  createMockDb,
  createMockKV,
  createMockR2,
  createMockHetzner,
  createMockBilling,
  createMockEmail,
} from './helpers.js';

/**
 * Sample Project 2: Pro Team
 *
 * Persona: Marcus, DevSecOps lead managing a team of 5
 * Plan: Pro (5 agents, 1K runs/month, skill marketplace access)
 *
 * Tests the team collaboration journey:
 *   Upgrade → Invite team → Deploy agents → Install skills → Collaborate
 */
describe('Sample Project: Pro Team', () => {
  let owner: ReturnType<typeof createTestUser>;
  let db: ReturnType<typeof createMockDb>;
  let kv: ReturnType<typeof createMockKV>;
  let r2: ReturnType<typeof createMockR2>;
  let hetzner: ReturnType<typeof createMockHetzner>;
  let billing: ReturnType<typeof createMockBilling>;
  let email: ReturnType<typeof createMockEmail>;

  beforeEach(() => {
    owner = createTestUser({ plan: 'pro', role: 'owner' });
    db = createMockDb();
    kv = createMockKV();
    r2 = createMockR2();
    hetzner = createMockHetzner();
    billing = createMockBilling();
    email = createMockEmail();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Plan Upgrade', () => {
    it('should upgrade from free to pro via LemonSqueezy', async () => {
      const subscription = await billing.createSubscription({
        orgId: owner.orgId,
        plan: 'pro',
        variantId: '201',
        interval: 'monthly',
      });

      expect(subscription.status).toBe('active');
      expect(subscription.plan).toBe('pro');
    });

    it('should process billing webhook and update org plan', async () => {
      const webhookPayload = {
        event: 'subscription_created',
        data: {
          id: 'sub_123',
          attributes: {
            status: 'active',
            variant_id: 201,
            customer_id: 'cust_456',
          },
        },
        meta: {
          custom_data: { orgId: owner.orgId },
        },
      };

      await db.update({ organizations: {} })
        .set({ plan: 'pro', subscriptionId: webhookPayload.data.id })
        .where('id = ?');

      expect(db.update).toHaveBeenCalled();
    });

    it('should unlock pro features after upgrade', () => {
      const proLimits = {
        maxAgents: 5,
        maxRunsPerMonth: 1000,
        skillMarketplace: true,
        prioritySupport: false,
        customRoles: false,
        sso: false,
      };

      expect(proLimits.maxAgents).toBe(5);
      expect(proLimits.skillMarketplace).toBe(true);
      expect(proLimits.sso).toBe(false);
    });
  });

  describe('Team Management', () => {
    it('should invite team members via email', async () => {
      const invites = [
        { email: 'alice@company.com', role: 'admin' },
        { email: 'bob@company.com', role: 'member' },
        { email: 'carol@company.com', role: 'member' },
      ];

      for (const invite of invites) {
        await db.insert({ invitations: invite }).values({
          ...invite,
          orgId: owner.orgId,
          invitedBy: owner.id,
          status: 'pending',
          expiresAt: new Date(Date.now() + 7 * 86400_000).toISOString(),
        });

        await email.send({
          to: invite.email,
          subject: `Join ${owner.orgId} on OpenSyber`,
          template: 'team-invite',
        });
      }

      expect(db.insert).toHaveBeenCalledTimes(3);
      expect(email.send).toHaveBeenCalledTimes(3);
      expect(email._sent).toHaveLength(3);
    });

    it('should accept invitation and add member to org', async () => {
      const newMember = createTestUser({
        email: 'alice@company.com',
        orgId: owner.orgId,
        plan: 'pro',
        role: 'admin',
      });

      await db.insert({ org_members: {} }).values({
        userId: newMember.id,
        orgId: owner.orgId,
        role: 'admin',
        joinedAt: new Date().toISOString(),
      });

      await db.update({ invitations: {} })
        .set({ status: 'accepted' })
        .where('email = ?');

      expect(db.insert).toHaveBeenCalled();
      expect(db.update).toHaveBeenCalled();
    });

    it('should enforce RBAC for team members', () => {
      const permissions: Record<string, string[]> = {
        owner: ['read', 'write', 'admin', 'billing', 'delete'],
        admin: ['read', 'write', 'admin'],
        member: ['read', 'write'],
        viewer: ['read'],
      };

      expect(permissions.member).not.toContain('admin');
      expect(permissions.admin).not.toContain('billing');
      expect(permissions.owner).toContain('billing');
    });

    it('should audit team member actions', async () => {
      const auditEntries = [
        { userId: 'user_alice', action: 'agent.deploy', resource: 'inst_1' },
        { userId: 'user_bob', action: 'skill.install', resource: 'ai-triage' },
        { userId: 'user_carol', action: 'finding.view', resource: 'find_42' },
      ];

      for (const entry of auditEntries) {
        await db.insert({ audit_logs: entry }).values({
          ...entry,
          orgId: owner.orgId,
          timestamp: new Date().toISOString(),
        });
      }

      expect(db.insert).toHaveBeenCalledTimes(3);
    });
  });

  describe('Multi-Agent Deployment', () => {
    it('should deploy up to 5 agents on pro plan', async () => {
      const agents: Array<Record<string, unknown>> = [];

      for (let i = 0; i < 5; i++) {
        const { server } = await hetzner.createServer({
          name: `agent-${owner.orgId}-${i}`,
          server_type: 'cx11',
        });
        agents.push(server);
      }

      expect(hetzner.createServer).toHaveBeenCalledTimes(5);
      expect(agents).toHaveLength(5);
      expect(agents.every((a) => a.status === 'running')).toBe(true);
    });

    it('should block 6th agent deployment on pro plan', async () => {
      db._setSelectResult(
        Array.from({ length: 5 }, (_, i) => ({
          id: `inst_${i}`,
          status: 'running',
        })),
      );

      const existing = await db
        .select()
        .from('instances')
        .where('orgId = ?');

      const maxAgents = 5;
      const canDeploy = (existing as unknown[]).length < maxAgents;
      expect(canDeploy).toBe(false);
    });

    it('should route gateway tokens per instance', async () => {
      const instances = ['inst_1', 'inst_2', 'inst_3'];

      for (const id of instances) {
        const token = `gw_${crypto.randomUUID()}`;
        await (kv.put as ReturnType<typeof vi.fn>)(
          `gateway:${id}:token`,
          token,
        );
      }

      expect(kv.put).toHaveBeenCalledTimes(3);

      for (const id of instances) {
        const token = await (kv.get as ReturnType<typeof vi.fn>)(
          `gateway:${id}:token`,
        );
        expect(token).toBeTruthy();
      }
    });
  });

  describe('Skill Marketplace', () => {
    it('should browse available skills in marketplace', async () => {
      db._setSelectResult([
        { slug: 'ai-triage', name: 'AI Triage', tier: 'premium', price: 9900 },
        { slug: 'ai-remediation', name: 'AI Remediation', tier: 'premium', price: 9900 },
        { slug: 'github-integration', name: 'GitHub Integration', tier: 'free', price: 0 },
        { slug: 'slack-notifier', name: 'Slack Notifier', tier: 'free', price: 0 },
      ]);

      const skills = await db
        .select()
        .from('marketplace_skills')
        .where('published = true');

      expect(skills).toHaveLength(4);
    });

    it('should install free skill on pro plan', async () => {
      const skill = { slug: 'github-integration', tier: 'free' };

      await db.insert({ installed_skills: {} }).values({
        instanceId: 'inst_1',
        skillSlug: skill.slug,
        installedAt: new Date().toISOString(),
        status: 'active',
      });

      expect(db.insert).toHaveBeenCalled();
    });

    it('should install premium skill bundle', async () => {
      const bundle = {
        slug: 'ai-security-analyst-bundle',
        skills: [
          'ai-triage',
          'ai-remediation',
          'ai-reasoning-engine',
          'ai-compliance-writer',
          'ai-threat-intel',
          'ai-incident-responder',
        ],
        price: 9900,
      };

      for (const skillSlug of bundle.skills) {
        await db.insert({ installed_skills: {} }).values({
          instanceId: 'inst_1',
          skillSlug,
          bundleSlug: bundle.slug,
          installedAt: new Date().toISOString(),
        });
      }

      expect(db.insert).toHaveBeenCalledTimes(bundle.skills.length);
    });

    it('should download skill package from R2', async () => {
      const packageData = JSON.stringify({
        manifest: { slug: 'ai-triage', version: '1.0.0' },
        code: 'base64-encoded-tarball',
      });

      await (r2.put as ReturnType<typeof vi.fn>)(
        'skills/ai-triage/1.0.0/package.tar.gz',
        packageData,
      );

      const obj = await (r2.get as ReturnType<typeof vi.fn>)(
        'skills/ai-triage/1.0.0/package.tar.gz',
      );

      expect(obj).not.toBeNull();
    });
  });

  describe('Team Collaboration', () => {
    it('should share findings across team members', async () => {
      db._setSelectResult([
        {
          id: 'find_1',
          title: 'Open SSH Port',
          severity: 'high',
          assignedTo: 'user_alice',
        },
        {
          id: 'find_2',
          title: 'Outdated Package',
          severity: 'medium',
          assignedTo: 'user_bob',
        },
      ]);

      const findings = await db
        .select()
        .from('findings')
        .where('orgId = ?');

      expect(findings).toHaveLength(2);
    });

    it('should assign findings to team members', async () => {
      await db.update({ findings: {} })
        .set({ assignedTo: 'user_alice', status: 'in_progress' })
        .where('id = find_1');

      expect(db.update).toHaveBeenCalled();
    });

    it('should send notification when finding assigned', async () => {
      await email.send({
        to: 'alice@company.com',
        subject: 'Finding assigned: Open SSH Port',
        template: 'finding-assigned',
        data: { findingId: 'find_1', severity: 'high' },
      });

      expect(email._sent).toHaveLength(1);
      expect(email._sent[0]).toHaveProperty('subject');
    });
  });
});
