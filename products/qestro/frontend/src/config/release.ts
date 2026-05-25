export const phaseOneReleaseMode = false;

export const blockedRouteLabels: Record<string, string> = {
  '/insights': 'Analytics',
  '/plans': 'Test Plans',
  '/cycles': 'Test Cycles',
  '/stories': 'Stories',
  '/explorations': 'Explorations',
  '/automation-runs': 'Automation Runs',
  '/cloud-devices': 'Cloud Devices',
  '/studio': 'API Studio',
  '/api-studio': 'API Studio',
  '/security': 'Security Center',
  '/compliance': 'Compliance Hub',
  '/agents': 'Agent Department',
  '/mission-control': 'Mission Control',
  '/service-virtualization': 'Virtualization',
  '/integrations': 'Integrations',
  '/ai-recorder': 'AI Recorder',
  '/ai-center': 'AI Command Center',
  '/test-gen': 'Test Generator',
  '/notifications': 'Notifications',
  '/channels': 'Channels',
};

const blockedRoutePrefixes = ['/cycles/'];

export const isBlockedReleaseRoute = (path: string) => {
  if (!phaseOneReleaseMode) {
    return false;
  }

  return Boolean(blockedRouteLabels[path]) || blockedRoutePrefixes.some((prefix) => path.startsWith(prefix));
};

export const getBlockedRouteLabel = (path: string) => {
  if (blockedRouteLabels[path]) {
    return blockedRouteLabels[path];
  }

  const prefixMatch = blockedRoutePrefixes.find((prefix) => path.startsWith(prefix));
  if (prefixMatch) {
    return 'Test Cycles';
  }

  return 'This feature';
};
