import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/honoAuth';
import { parseJsonBody } from '../utils/validateJsonBody';

type Env = {
  Bindings: { DB: D1Database; ENVIRONMENT: string; JWT_SECRET: string };
  Variables: { userId: string; userRole: string };
};

type MissionType = 'TICKET' | 'SCOUT' | 'CONCIERGE';
type MissionStatus = 'QUEUED' | 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

type Mission = {
  id: string;
  type: MissionType;
  title: string;
  input: string;
  status: MissionStatus;
  agent: string;
  progress: number;
  startTime: string;
  createdAt: string;
  userId: string;
};

const missionSchema = z.object({
  type: z.enum(['TICKET', 'SCOUT', 'CONCIERGE']),
  input: z.string().min(1).max(2000),
});

const missionsRoute = new Hono<Env>();
missionsRoute.use('*', requireAuth);

const formatResponse = <T>(data: T, message?: string) => ({
  success: true,
  data,
  message,
  timestamp: new Date().toISOString(),
});

const getRelativeTime = (isoDate: string) => {
  const diff = Date.now() - new Date(isoDate).getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))} mins ago`;
  if (diff < 86_400_000) return `${Math.max(1, Math.floor(diff / 3_600_000))} hours ago`;
  return 'Yesterday';
};

const buildMissionTitle = (type: MissionType, input: string) => {
  if (type === 'TICKET') {
    return input.slice(0, 50) + (input.length > 50 ? '...' : '');
  }

  if (type === 'SCOUT') {
    try {
      const url = new URL(input);
      return `Explore ${url.hostname}`;
    } catch {
      return `Explore ${input.slice(0, 30)}`;
    }
  }

  return `Onboard ${input.split('/').pop() || input.slice(0, 30)}`;
};

const buildMissionAgent = (type: MissionType) => {
  switch (type) {
    case 'TICKET':
      return 'Architect';
    case 'SCOUT':
      return 'Scout';
    case 'CONCIERGE':
      return 'Concierge';
    default:
      return 'Qestro';
  }
};

const seedMission = (
  id: string,
  type: MissionType,
  input: string,
  status: MissionStatus,
  progress: number,
  createdAt: string,
): Mission => ({
  id,
  type,
  title: buildMissionTitle(type, input),
  input,
  status,
  agent: buildMissionAgent(type),
  progress,
  startTime: getRelativeTime(createdAt),
  createdAt,
  userId: 'seed-user',
});

const store = new Map<string, Mission>([
  [
    'mission-ticket-1',
    seedMission(
      'mission-ticket-1',
      'TICKET',
      'Verify that retry and recovery paths preserve cart integrity.',
      'ACTIVE',
      68,
      new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    ),
  ],
  [
    'mission-scout-1',
    seedMission(
      'mission-scout-1',
      'SCOUT',
      'https://staging.qestro.app',
      'COMPLETED',
      100,
      new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    ),
  ],
]);

missionsRoute.get('/', (c) => {
  const status = c.req.query('status');
  const type = c.req.query('type');
  const items = Array.from(store.values())
    .filter((item) => (status ? item.status === status : true))
    .filter((item) => (type ? item.type === type : true))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((item) => ({ ...item, startTime: getRelativeTime(item.createdAt) }));

  return c.json(formatResponse(items));
});

missionsRoute.get('/stats/summary', (c) => {
  const items = Array.from(store.values());
  return c.json(formatResponse({
    total: items.length,
    active: items.filter((item) => item.status === 'ACTIVE').length,
    completed: items.filter((item) => item.status === 'COMPLETED').length,
    failed: items.filter((item) => item.status === 'FAILED').length,
    queued: items.filter((item) => item.status === 'QUEUED').length,
  }));
});

missionsRoute.get('/:id', (c) => {
  const mission = store.get(c.req.param('id'));
  if (!mission) {
    return c.json({ success: false, error: 'Mission not found' }, 404);
  }

  return c.json(formatResponse({ ...mission, startTime: getRelativeTime(mission.createdAt) }));
});

missionsRoute.post('/', async (c) => {
  const parsed = await parseJsonBody(c, missionSchema);
  if ('response' in parsed) {
    return parsed.response;
  }

  const { type, input } = parsed.data;
  const createdAt = new Date().toISOString();
  const mission: Mission = {
    id: `mission-${crypto.randomUUID().slice(0, 8)}`,
    type,
    title: buildMissionTitle(type, input),
    input,
    status: 'ACTIVE',
    agent: buildMissionAgent(type),
    progress: 12,
    startTime: 'Just now',
    createdAt,
    userId: c.get('userId'),
  };

  store.set(mission.id, mission);
  return c.json(formatResponse(mission, 'Mission created successfully'), 201);
});

missionsRoute.delete('/:id', (c) => {
  const id = c.req.param('id');
  if (!store.has(id)) {
    return c.json({ success: false, error: 'Mission not found' }, 404);
  }

  store.delete(id);
  return c.json(formatResponse(null, 'Mission deleted successfully'));
});

missionsRoute.post('/:id/cancel', (c) => {
  const id = c.req.param('id');
  const mission = store.get(id);
  if (!mission) {
    return c.json({ success: false, error: 'Mission not found' }, 404);
  }

  const nextMission: Mission = {
    ...mission,
    status: 'CANCELLED',
    progress: mission.status === 'COMPLETED' ? 100 : mission.progress,
    startTime: getRelativeTime(mission.createdAt),
  };
  store.set(id, nextMission);

  return c.json(formatResponse(nextMission, 'Mission cancelled successfully'));
});

export default missionsRoute;
