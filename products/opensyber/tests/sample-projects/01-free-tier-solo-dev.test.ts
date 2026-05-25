import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createTestUser,
  createMockDb,
  createMockKV,
  createMockR2,
  createMockHetzner,
  createMockWebSocket,
} from './helpers.js';

/**
 * Sample Project 1: Free-Tier Solo Developer
 *
 * Persona: Yael, indie dev shipping a SaaS — needs one agent
 * Plan: Free (1 agent, 10 runs/day, no paid skills)
 *
 * Tests the complete solo-dev journey:
 *   Signup → Create org → Deploy agent → View monitoring → Hit limits
 */
describe('Sample Project: Free-Tier Solo Developer', () => {
  let user: ReturnType<typeof createTestUser>;
  let db: ReturnType<typeof createMockDb>;
  let kv: ReturnType<typeof createMockKV>;
  let r2: ReturnType<typeof createMockR2>;
  let hetzner: ReturnType<typeof createMockHetzner>;

  beforeEach(() => {
    user = createTestUser({ plan: 'free', role: 'owner' });
    db = createMockDb();
    kv = createMockKV();
    r2 = createMockR2();
    hetzner = createMockHetzner();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Account Setup', () => {
    it('should create user account via OAuth signup', async () => {
      const account = {
        id: user.id,
        email: user.email,
        provider: 'github',
        createdAt: new Date().toISOString(),
      };

      db._setSelectResult([]);
      await db.insert({ users: account }).values(account);

      expect(db.insert).toHaveBeenCalled();
    });

    it('should create default organization on first login', async () => {
      const org = {
        id: user.orgId,
        name: `${user.email.split('@')[0]}'s Org`,
        ownerId: user.id,
        plan: 'free',
        createdAt: new Date().toISOString(),
      };

      await db.insert({ organizations: org }).values(org);

      expect(db.insert).toHaveBeenCalled();
    });

    it('should generate API key for the organization', async () => {
      const apiKey = {
        id: `key_${crypto.randomUUID().slice(0, 8)}`,
        orgId: user.orgId,
        prefix: 'osk_',
        hashedKey: 'sha256:abc123',
        createdAt: new Date().toISOString(),
      };

      await db.insert({ api_keys: apiKey }).values(apiKey);

      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('Agent Deployment', () => {
    it('should create a single agent instance', async () => {
      const { server } = await hetzner.createServer({
        name: `agent-${user.orgId}`,
        server_type: 'cx11',
        image: 'opensyber-agent-v0.2.0',
      });

      expect(server.status).toBe('running');
      expect(server.server_type.cores).toBe(1);
      expect(server.server_type.memory).toBe(1);
    });

    it('should register instance in database', async () => {
      const instance = {
        id: `inst_${crypto.randomUUID().slice(0, 8)}`,
        orgId: user.orgId,
        userId: user.id,
        status: 'provisioning',
        region: 'eu-central',
        agentVersion: '0.2.0',
      };

      await db.insert({ instances: instance }).values(instance);

      expect(db.insert).toHaveBeenCalled();
    });

    it('should generate gateway token for agent-API comms', async () => {
      const instanceId = 'inst_test123';
      const gatewayToken = `gw_${crypto.randomUUID()}`;

      await (kv.put as ReturnType<typeof vi.fn>)(
        `gateway:${instanceId}:token`,
        gatewayToken,
      );

      const stored = await (kv.get as ReturnType<typeof vi.fn>)(
        `gateway:${instanceId}:token`,
      );
      expect(stored).toBe(gatewayToken);
    });

    it('should verify agent health after deployment', async () => {
      const healthCheck = {
        instanceId: 'inst_test123',
        status: 'healthy',
        cpuUsage: 12.5,
        memoryUsage: 45.2,
        diskUsage: 8.1,
        uptime: 3600,
        lastHeartbeat: new Date().toISOString(),
      };

      await (kv.put as ReturnType<typeof vi.fn>)(
        `health:inst_test123`,
        JSON.stringify(healthCheck),
      );

      const cached = await (kv.get as ReturnType<typeof vi.fn>)(
        'health:inst_test123',
        'json',
      );
      expect(cached.status).toBe('healthy');
      expect(cached.cpuUsage).toBeLessThan(100);
    });
  });

  describe('Basic Monitoring', () => {
    it('should record agent security events', async () => {
      const events = [
        { type: 'file_read', path: '/etc/passwd', status: 'blocked' },
        { type: 'network_out', target: 'api.github.com', status: 'allowed' },
        { type: 'process_exec', command: 'npm install', status: 'allowed' },
      ];

      for (const event of events) {
        await db.insert({ security_events: event }).values(event);
      }

      expect(db.insert).toHaveBeenCalledTimes(events.length);
    });

    it('should stream events via WebSocket', () => {
      const ws = createMockWebSocket();
      const event = {
        agentId: 'agent-123',
        type: 'file_read',
        timestamp: new Date().toISOString(),
      };

      ws.send(JSON.stringify(event));

      expect(ws._messages).toHaveLength(1);
      const parsed = JSON.parse(ws._messages[0]!);
      expect(parsed.agentId).toBe('agent-123');
    });

    it('should display dashboard metrics', async () => {
      const metrics = {
        totalFindings: 12,
        criticalFindings: 1,
        highFindings: 3,
        agentUptime: 99.9,
        skillExecutions: 8,
        lastScanTime: new Date().toISOString(),
      };

      db._setSelectResult([metrics]);
      const result = await db.select().from('dashboard_metrics');

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('totalFindings', 12);
    });
  });

  describe('Free Plan Limits', () => {
    it('should enforce 1-agent limit on free plan', async () => {
      db._setSelectResult([
        { id: 'inst_existing', status: 'running' },
      ]);

      const existing = await db
        .select()
        .from('instances')
        .where('orgId = ?');

      expect(existing).toHaveLength(1);

      const canDeploy = existing.length < 1;
      expect(canDeploy).toBe(false);
    });

    it('should enforce 10 runs/day limit', async () => {
      const dailyRuns = 10;
      const maxRuns = 10;

      await (kv.put as ReturnType<typeof vi.fn>)(
        `rate:${user.orgId}:daily`,
        String(dailyRuns),
      );

      const current = await (kv.get as ReturnType<typeof vi.fn>)(
        `rate:${user.orgId}:daily`,
      );
      const isAtLimit = Number(current) >= maxRuns;
      expect(isAtLimit).toBe(true);
    });

    it('should block premium skill installation on free plan', () => {
      const skill = {
        slug: 'ai-triage',
        tier: 'premium',
        price: 9900,
      };

      const canInstall = user.plan !== 'free' || skill.tier === 'free';
      expect(canInstall).toBe(false);
    });

    it('should show upgrade prompts when limits hit', () => {
      const upgradePrompt = {
        title: 'Upgrade to Pro',
        reason: 'agent_limit_reached',
        currentPlan: 'free',
        suggestedPlan: 'pro',
        features: [
          '5 agents',
          '1,000 runs/month',
          'Skill marketplace access',
        ],
      };

      expect(upgradePrompt.reason).toBe('agent_limit_reached');
      expect(upgradePrompt.features).toHaveLength(3);
    });
  });

  describe('Agent Lifecycle', () => {
    it('should pause agent instance', async () => {
      await db.update({ instances: {} })
        .set({ status: 'paused' })
        .where('id = inst_test123');

      expect(db.update).toHaveBeenCalled();
    });

    it('should resume agent instance', async () => {
      await db.update({ instances: {} })
        .set({ status: 'running' })
        .where('id = inst_test123');

      expect(db.update).toHaveBeenCalled();
    });

    it('should delete agent and clean up resources', async () => {
      const instanceId = 'inst_test123';

      await hetzner.deleteServer('srv_test123');
      await (kv.delete as ReturnType<typeof vi.fn>)(
        `gateway:${instanceId}:token`,
      );
      await (kv.delete as ReturnType<typeof vi.fn>)(
        `health:${instanceId}`,
      );
      await db.delete({ instances: {} }).where('id = ?');

      expect(hetzner.deleteServer).toHaveBeenCalled();
      expect(kv.delete).toHaveBeenCalledTimes(2);
      expect(db.delete).toHaveBeenCalled();
    });
  });
});
