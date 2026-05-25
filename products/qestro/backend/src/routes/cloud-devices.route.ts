import { Hono } from 'hono';
import { verifyJWT } from '../auth/jwt';

type Env = {
  Bindings: { ENVIRONMENT: string; JWT_SECRET: string; CLOUD_DEVICES_ALLOW_DEMO_MODE?: string };
  Variables: { userId: string; userRole: string };
};

type DeviceStatus = 'available' | 'busy' | 'offline' | 'maintenance';
type ProviderType = 'browserstack' | 'saucelabs' | 'lambdatest' | 'local';

type CloudDevice = {
  id: string;
  name: string;
  platform: 'ios' | 'android' | 'chrome';
  model: string;
  osVersion: string;
  status: DeviceStatus;
  provider: ProviderType;
  location: { type: 'cloud' | 'local'; region?: string };
  capabilities: {
    supportsScreenshots: boolean;
    supportsVideoRecording: boolean;
    supportsNetworkSimulation: boolean;
    maxConcurrentTests: number;
  };
  lastSeen: string;
  tags: string[];
};

type CloudProvider = {
  id: ProviderType;
  name: string;
  type: ProviderType;
  connected: boolean;
  deviceCount: number;
  icon: string;
  configuredAt?: string;
};

type DeviceReservation = {
  id: string;
  deviceId: string;
  userId: string;
  projectId: string;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
};

const route = new Hono<Env>();

const now = () => new Date().toISOString();
const makeId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
const ok = (data: unknown, message?: string) => ({
  success: true,
  data,
  message,
  timestamp: now(),
});

const providerNames: Record<ProviderType, string> = {
  browserstack: 'BrowserStack',
  saucelabs: 'Sauce Labs',
  lambdatest: 'LambdaTest',
  local: 'Local Simulators',
};

const providerIcons: Record<ProviderType, string> = {
  browserstack: 'bs',
  saucelabs: 'sl',
  lambdatest: 'lt',
  local: 'local',
};

const providers = new Map<ProviderType, CloudProvider>();
const devices = new Map<string, CloudDevice>();
const reservations = new Map<string, DeviceReservation>();

const isProductionEnv = (environment?: string) => ['production', 'prod'].includes((environment || '').toLowerCase());
const isDemoAllowed = (environment?: string, demoFlag?: string) =>
  !isProductionEnv(environment) && String(demoFlag || '').toLowerCase() === 'true';

const createProvider = (
  id: ProviderType,
  connected = id === 'local',
  deviceCount = 0,
): CloudProvider => ({
  id,
  name: providerNames[id],
  type: id,
  connected,
  deviceCount,
  icon: providerIcons[id],
  configuredAt: connected ? now() : undefined,
});

const createDevice = (
  id: string,
  provider: ProviderType,
  name: string,
  platform: CloudDevice['platform'],
  model: string,
  osVersion: string,
  tags: string[],
  region?: string,
): CloudDevice => ({
  id,
  name,
  platform,
  model,
  osVersion,
  status: 'available',
  provider,
  location: provider === 'local' ? { type: 'local' } : { type: 'cloud', region },
  capabilities: {
    supportsScreenshots: true,
    supportsVideoRecording: true,
    supportsNetworkSimulation: provider !== 'local',
    maxConcurrentTests: provider === 'local' ? 1 : 5,
  },
  lastSeen: now(),
  tags,
});

const ensureSeedData = () => {
  if (providers.size === 0) {
    providers.set('browserstack', createProvider('browserstack', true, 2));
    providers.set('saucelabs', createProvider('saucelabs', true, 1));
    providers.set('lambdatest', createProvider('lambdatest', false, 0));
    providers.set('local', createProvider('local', true, 2));
  }

  if (devices.size === 0) {
    [
      createDevice('local-iphone-15-pro', 'local', 'iPhone 15 Pro', 'ios', 'iPhone 15 Pro', '17.4', ['ios', 'local', 'simulator']),
      createDevice('local-pixel-8', 'local', 'Pixel 8 Pro', 'android', 'Pixel 8 Pro', '14', ['android', 'local', 'emulator']),
      createDevice('bs-iphone-15-pro-max', 'browserstack', 'iPhone 15 Pro Max', 'ios', 'iPhone 15 Pro Max', '17.2', ['ios', 'browserstack', 'real-device'], 'us-west-1'),
      createDevice('bs-galaxy-s24', 'browserstack', 'Samsung Galaxy S24 Ultra', 'android', 'Galaxy S24 Ultra', '14', ['android', 'browserstack', 'real-device'], 'us-west-1'),
      createDevice('sl-pixel-8', 'saucelabs', 'Google Pixel 8', 'android', 'Pixel 8', '14', ['android', 'saucelabs', 'real-device'], 'us-central-1'),
    ].forEach((device) => devices.set(device.id, device));
  }
};

const refreshProviderCounts = () => {
  for (const provider of providers.values()) {
    provider.deviceCount = [...devices.values()].filter((device) => device.provider === provider.id).length;
  }
};

route.use('*', async (c, next) => {
  const authorization = c.req.header('Authorization');
  const environment = c.env?.ENVIRONMENT;
  const demoMode = isDemoAllowed(environment, c.env?.CLOUD_DEVICES_ALLOW_DEMO_MODE);

  if (!authorization?.startsWith('Bearer ')) {
    if (demoMode) {
      c.set('userId', 'demo-user');
      c.set('userRole', 'developer');
      await next();
      return;
    }

    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  try {
    const payload = await verifyJWT(authorization.slice(7), c.env.JWT_SECRET);
    c.set('userId', String(payload.userId || payload.sub));
    c.set('userRole', String(payload.role || 'user'));
    await next();
  } catch {
    return c.json({ success: false, error: 'Invalid or expired token' }, 401);
  }
});

const discoverProviderDevices = (providerId: ProviderType) => {
  const id = crypto.randomUUID().slice(0, 8);
  if (providerId === 'browserstack') {
    return [
      createDevice(`bs-iphone-16-${id}`, providerId, 'iPhone 16 Pro', 'ios', 'iPhone 16 Pro', '18.1', ['ios', 'browserstack', 'real-device'], 'us-east-1'),
      createDevice(`bs-pixel-9-${id}`, providerId, 'Google Pixel 9', 'android', 'Pixel 9', '15', ['android', 'browserstack', 'real-device'], 'us-east-1'),
    ];
  }

  if (providerId === 'saucelabs') {
    return [
      createDevice(`sl-galaxy-z-${id}`, providerId, 'Galaxy Z Fold6', 'android', 'Galaxy Z Fold6', '14', ['android', 'saucelabs', 'foldable'], 'us-central-1'),
    ];
  }

  if (providerId === 'lambdatest') {
    return [
      createDevice(`lt-oneplus-12-${id}`, providerId, 'OnePlus 12', 'android', 'OnePlus 12', '14', ['android', 'lambdatest', 'real-device'], 'ap-south-1'),
    ];
  }

  return [
    createDevice(`local-ios-${id}`, providerId, 'iPhone 16 Simulator', 'ios', 'iPhone 16', '18.0', ['ios', 'local', 'simulator']),
  ];
};

route.get('/', (c) => {
  if (isDemoAllowed(c.env?.ENVIRONMENT, c.env?.CLOUD_DEVICES_ALLOW_DEMO_MODE)) ensureSeedData();
  if (isProductionEnv(c.env?.ENVIRONMENT)) {
    return c.json(ok([], 'Cloud devices are in beta until real providers are configured.'));
  }

  const provider = c.req.query('provider');
  const platform = c.req.query('platform');
  const status = c.req.query('status');

  const data = [...devices.values()].filter((device) => {
    if (provider && device.provider !== provider) return false;
    if (platform && device.platform !== platform) return false;
    if (status && device.status !== status) return false;
    return true;
  });

  return c.json(ok(data));
});

route.get('/providers', (c) => {
  if (isDemoAllowed(c.env?.ENVIRONMENT, c.env?.CLOUD_DEVICES_ALLOW_DEMO_MODE)) ensureSeedData();
  refreshProviderCounts();
  if (isProductionEnv(c.env?.ENVIRONMENT) && providers.size === 0) {
    return c.json(ok(
      (['browserstack', 'saucelabs', 'lambdatest', 'local'] as ProviderType[]).map((providerId) => createProvider(providerId, false, 0)),
      'No cloud device providers are configured',
    ));
  }
  return c.json(ok([...providers.values()]));
});

route.post('/providers/:providerId/configure', async (c) => {
  if (isDemoAllowed(c.env?.ENVIRONMENT, c.env?.CLOUD_DEVICES_ALLOW_DEMO_MODE)) ensureSeedData();
  const providerId = c.req.param('providerId') as ProviderType;
  if (!providerNames[providerId]) {
    return c.json({ success: false, error: 'Unsupported provider' }, 404);
  }

  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}));
  if (isProductionEnv(c.env?.ENVIRONMENT)) {
    const hasCredential =
      typeof body.accessKey === 'string' ||
      typeof body.apiKey === 'string' ||
      (typeof body.username === 'string' && typeof body.password === 'string');
    if (!hasCredential) {
      return c.json({ success: false, error: 'Provider credentials are required' }, 400);
    }

    return c.json(
      {
        success: false,
        error: 'Cloud device provider integration is not enabled in production yet',
        provider: providerId,
      },
      501,
    );
  }

  const provider = providers.get(providerId) ?? createProvider(providerId, true, 0);
  provider.connected = true;
  provider.configuredAt = now();
  providers.set(providerId, provider);
  refreshProviderCounts();

  return c.json(ok(provider, `${provider.name} configured successfully`));
});

route.post('/discover/:providerId', (c) => {
  if (isDemoAllowed(c.env?.ENVIRONMENT, c.env?.CLOUD_DEVICES_ALLOW_DEMO_MODE)) ensureSeedData();
  const providerId = c.req.param('providerId') as ProviderType;
  if (isProductionEnv(c.env?.ENVIRONMENT)) {
    return c.json(
      {
        success: false,
        error: 'Cloud device discovery is not enabled in production until a real provider integration is configured',
        provider: providerId,
      },
      501,
    );
  }

  const provider = providers.get(providerId);
  if (!provider) {
    return c.json({ success: false, error: 'Unsupported provider' }, 404);
  }
  if (!provider.connected) {
    return c.json({ success: false, error: 'Provider is not configured' }, 400);
  }

  const discovered = discoverProviderDevices(providerId);
  discovered.forEach((device) => devices.set(device.id, device));
  refreshProviderCounts();
  return c.json(ok(discovered, `Discovered ${discovered.length} devices from ${provider.name}`));
});

route.post('/:deviceId/reserve', async (c) => {
  if (isDemoAllowed(c.env?.ENVIRONMENT, c.env?.CLOUD_DEVICES_ALLOW_DEMO_MODE)) ensureSeedData();
  if (isProductionEnv(c.env?.ENVIRONMENT)) {
    return c.json({ success: false, error: 'Cloud device reservations are not enabled in production yet' }, 501);
  }

  const device = devices.get(c.req.param('deviceId'));
  if (!device) {
    return c.json({ success: false, error: 'Device not found' }, 404);
  }
  if (device.status !== 'available') {
    return c.json({ success: false, error: `Device is currently ${device.status}` }, 409);
  }

  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}));
  const duration = Number(body.duration || 60);
  const start = Date.now();
  const reservation: DeviceReservation = {
    id: makeId('dev_res'),
    deviceId: device.id,
    userId: c.get('userId'),
    projectId: typeof body.projectId === 'string' ? body.projectId : 'demo',
    startTime: new Date(start).toISOString(),
    endTime: new Date(start + Math.max(1, duration) * 60 * 1000).toISOString(),
    status: 'active',
  };

  reservations.set(reservation.id, reservation);
  device.status = 'busy';
  device.lastSeen = now();

  return c.json(ok(reservation, `Device reserved for ${Math.max(1, duration)} minutes`));
});

route.delete('/reservations/:reservationId', (c) => {
  if (isDemoAllowed(c.env?.ENVIRONMENT, c.env?.CLOUD_DEVICES_ALLOW_DEMO_MODE)) ensureSeedData();
  const reservation = reservations.get(c.req.param('reservationId'));
  if (!reservation || reservation.userId !== c.get('userId')) {
    return c.json({ success: false, error: 'Reservation not found' }, 404);
  }

  reservation.status = 'completed';
  reservation.endTime = now();

  const device = devices.get(reservation.deviceId);
  if (device) {
    device.status = 'available';
    device.lastSeen = now();
  }

  return c.json(ok(reservation, 'Device released successfully'));
});

route.get('/:deviceId', (c) => {
  if (isDemoAllowed(c.env?.ENVIRONMENT, c.env?.CLOUD_DEVICES_ALLOW_DEMO_MODE)) ensureSeedData();
  if (isProductionEnv(c.env?.ENVIRONMENT)) {
    return c.json({ success: false, error: 'Device not found' }, 404);
  }

  const device = devices.get(c.req.param('deviceId'));
  if (!device) {
    return c.json({ success: false, error: 'Device not found' }, 404);
  }
  return c.json(ok(device));
});

export default route;
