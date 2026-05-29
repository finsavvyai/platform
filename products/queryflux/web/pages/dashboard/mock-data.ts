import { Database, Activity, Clock, TrendingUp } from 'lucide-react';
import type { MetricData } from '../../components/queryflux/MetricsCard';

export const metrics: MetricData[] = [
  {
    label: 'Active Connections',
    value: 12,
    icon: Database,
    iconColor: 'bg-blue-500/10 text-blue-500',
    change: { value: 20, trend: 'up' },
  },
  {
    label: 'Queries Today',
    value: '1,234',
    icon: Activity,
    iconColor: 'bg-green-500/10 text-green-500',
    change: { value: 12, trend: 'up' },
  },
  {
    label: 'Avg Query Time',
    value: '45ms',
    icon: Clock,
    iconColor: 'bg-yellow-500/10 text-yellow-500',
    change: { value: 5, trend: 'down' },
  },
  {
    label: 'Success Rate',
    value: '99.2%',
    icon: TrendingUp,
    iconColor: 'bg-purple-500/10 text-purple-500',
    change: { value: 0.5, trend: 'up' },
  },
];

export const recentQueries = [
  {
    id: 1,
    query: 'SELECT * FROM users WHERE created_at > NOW() - INTERVAL 1 DAY',
    database: 'production',
    time: '2 minutes ago',
    duration: '42ms',
    rows: 156,
  },
  {
    id: 2,
    query: 'UPDATE products SET stock = stock - 1 WHERE id = 123',
    database: 'production',
    time: '5 minutes ago',
    duration: '18ms',
    rows: 1,
  },
  {
    id: 3,
    query: "SELECT COUNT(*) FROM orders WHERE status = 'pending'",
    database: 'analytics',
    time: '12 minutes ago',
    duration: '156ms',
    rows: 1,
  },
];

export const activeConnections = [
  {
    id: 1,
    name: 'Production PostgreSQL',
    type: 'PostgreSQL',
    status: 'connected',
    queries: 234,
    lastUsed: '1 minute ago',
  },
  {
    id: 2,
    name: 'Analytics MySQL',
    type: 'MySQL',
    status: 'connected',
    queries: 89,
    lastUsed: '5 minutes ago',
  },
  {
    id: 3,
    name: 'Cache Redis',
    type: 'Redis',
    status: 'connected',
    queries: 567,
    lastUsed: '30 seconds ago',
  },
];
