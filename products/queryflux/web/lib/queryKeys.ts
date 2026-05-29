/**
 * Shared React Query key factory for cache management.
 */

export const queryKeys = {
  auth: {
    all: ['auth'] as const,
    profile: () => ['auth', 'profile'] as const,
    session: () => ['auth', 'session'] as const,
  },

  connections: {
    all: ['connections'] as const,
    lists: () => ['connections', 'list'] as const,
    list: (filters: object) => ['connections', 'list', filters] as const,
    details: () => ['connections', 'detail'] as const,
    detail: (id: string) => ['connections', 'detail', id] as const,
  },

  queries: {
    all: ['queries'] as const,
    lists: () => ['queries', 'list'] as const,
    list: (filters: object) => ['queries', 'list', filters] as const,
    details: () => ['queries', 'detail'] as const,
    detail: (id: string) => ['queries', 'detail', id] as const,
    history: (connectionId: string) => ['queries', 'history', connectionId] as const,
    execution: (connectionId: string, sql: string) =>
      ['queries', 'execute', connectionId, sql] as const,
  },

  metrics: {
    all: ['metrics'] as const,
    latest: (connectionId: string) => ['metrics', 'latest', connectionId] as const,
    history: (connectionId: string, timeRange: string) =>
      ['metrics', 'history', connectionId, timeRange] as const,
    average: (connectionId: string, timeRange: string) =>
      ['metrics', 'average', connectionId, timeRange] as const,
  },

  alerts: {
    all: ['alerts'] as const,
    lists: () => ['alerts', 'list'] as const,
    list: (filters: object) => ['alerts', 'list', filters] as const,
    active: () => ['alerts', 'active'] as const,
    details: () => ['alerts', 'detail'] as const,
    detail: (id: string) => ['alerts', 'detail', id] as const,
    stats: (days: number) => ['alerts', 'stats', days] as const,
  },

  teams: {
    all: ['teams'] as const,
    lists: () => ['teams', 'list'] as const,
    details: () => ['teams', 'detail'] as const,
    detail: (id: string) => ['teams', 'detail', id] as const,
    members: (teamId: string) => ['teams', teamId, 'members'] as const,
  },

  health: {
    all: ['health'] as const,
    server: () => ['health', 'server'] as const,
    database: () => ['health', 'database'] as const,
  },
} as const;
