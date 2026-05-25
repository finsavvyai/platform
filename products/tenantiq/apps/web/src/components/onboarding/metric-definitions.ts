export interface MetricDefinition {
  name: string;
  description: string;
  defaultThreshold: number;
  unit: string;
}

export const AVAILABLE_METRICS: Record<string, MetricDefinition> = {
  availability: {
    name: 'Availability/Uptime',
    description: 'Monitor tenant uptime and availability',
    defaultThreshold: 99.5,
    unit: '%'
  },
  cpu: {
    name: 'CPU Usage',
    description: 'Track CPU utilization',
    defaultThreshold: 80,
    unit: '%'
  },
  memory: {
    name: 'Memory Usage',
    description: 'Monitor memory consumption',
    defaultThreshold: 85,
    unit: '%'
  },
  disk: {
    name: 'Disk Space',
    description: 'Track disk usage',
    defaultThreshold: 90,
    unit: '%'
  },
  latency: {
    name: 'Response Latency',
    description: 'Monitor response times',
    defaultThreshold: 500,
    unit: 'ms'
  },
  errorRate: {
    name: 'Error Rate',
    description: 'Track application errors',
    defaultThreshold: 5,
    unit: '%'
  },
  throughput: {
    name: 'Throughput',
    description: 'Monitor requests per second',
    defaultThreshold: 100,
    unit: 'req/s'
  },
  database: {
    name: 'Database Performance',
    description: 'Track database query times',
    defaultThreshold: 1000,
    unit: 'ms'
  }
};

export const DEFAULT_ENABLED_METRICS = ['availability', 'cpu', 'memory'];

export const VALID_FREQUENCIES = ['realtime', '5min', '15min', '1hour', '1day'] as const;
export const VALID_RETENTIONS = ['7days', '30days', '90days', '1year'] as const;

export const FREQUENCY_COST_MULTIPLIER: Record<string, number> = {
  realtime: 5,
  '5min': 1,
  '15min': 0.3,
  '1hour': 0.07,
  '1day': 0.003
};

export const RETENTION_COST_MULTIPLIER: Record<string, number> = {
  '7days': 0.5,
  '30days': 1,
  '90days': 1.5,
  '1year': 2
};
