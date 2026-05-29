export const stats = {
  totalUsers: 1247,
  activeUsers: 892,
  totalProjects: 342,
  activeProjects: 156,
  monthlyGrowth: 12.5,
  systemHealth: 'good',
}

export interface RecentProject {
  id: string
  name: string
  status: string
  progress: number
  lastUpdated: string
  team: string[]
}

export const recentProjects: RecentProject[] = [
  {
    id: '1',
    name: 'Mobile App Redesign',
    status: 'IN_PROGRESS',
    progress: 65,
    lastUpdated: '2 hours ago',
    team: ['John D.', 'Sarah M.', 'Mike R.'],
  },
  {
    id: '2',
    name: 'API Integration',
    status: 'COMPLETED',
    progress: 100,
    lastUpdated: '1 day ago',
    team: ['Alex K.', 'Lisa T.'],
  },
  {
    id: '3',
    name: 'Database Migration',
    status: 'ON_HOLD',
    progress: 30,
    lastUpdated: '3 days ago',
    team: ['Tom W.'],
  },
]

export function getStatusColor(status: string): string {
  switch (status) {
    case 'COMPLETED': return 'bg-green-500 dark:bg-green-400'
    case 'IN_PROGRESS': return 'bg-blue-500 dark:bg-blue-400'
    case 'ON_HOLD': return 'bg-amber-500 dark:bg-amber-400'
    case 'CANCELLED': return 'bg-destructive'
    default: return 'bg-muted-foreground'
  }
}

export interface ActivityItem {
  id: number
  user: string
  action: string
  target: string
  time: string
  type: 'completed' | 'started' | 'commented' | 'deployed'
}

export const recentActivity: ActivityItem[] = [
  { id: 1, user: 'Sarah Miller', action: 'completed the', target: 'UI Design', time: '10 minutes ago', type: 'completed' },
  { id: 2, user: 'Mike Johnson', action: 'started working on', target: 'API Integration', time: '1 hour ago', type: 'started' },
  { id: 3, user: 'Alex Thompson', action: 'commented on', target: 'Database Schema', time: '3 hours ago', type: 'commented' },
  { id: 4, user: 'Lisa Wang', action: 'deployed', target: 'v2.1.0', time: '5 hours ago', type: 'deployed' },
]
