'use client'

import { useEffect } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { Breadcrumb } from '@/components/navigation/breadcrumb'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/store/auth'
import { useUIStore } from '@/store/ui'
import {
  Users,
  FolderOpen,
  Activity,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus,
  Eye,
} from 'lucide-react'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const { setBreadcrumbs } = useUIStore()

  useEffect(() => {
    setBreadcrumbs([
      { label: 'Dashboard', active: true }
    ])
  }, [setBreadcrumbs])

  // Mock data - replace with real data from API
  const stats = {
    totalUsers: 1247,
    activeUsers: 892,
    totalProjects: 342,
    activeProjects: 156,
    monthlyGrowth: 12.5,
    systemHealth: 'good',
  }

  const recentProjects = [
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-500'
      case 'IN_PROGRESS':
        return 'bg-blue-500'
      case 'ON_HOLD':
        return 'bg-yellow-500'
      case 'CANCELLED':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="default" className="bg-green-500">Completed</Badge>
      case 'IN_PROGRESS':
        return <Badge variant="default">In Progress</Badge>
      case 'ON_HOLD':
        return <Badge variant="secondary">On Hold</Badge>
      case 'CANCELLED':
        return <Badge variant="destructive">Cancelled</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Breadcrumb />
          <div className="mt-4">
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back, {user?.name || 'User'}! Here's what's happening with your projects today.
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                +{stats.monthlyGrowth}% from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeUsers.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {Math.round((stats.activeUsers / stats.totalUsers) * 100)}% of total users
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalProjects}</div>
              <p className="text-xs text-muted-foreground">
                {stats.activeProjects} currently active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Health</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold capitalize">{stats.systemHealth}</div>
              <p className="text-xs text-muted-foreground">
                All systems operational
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Projects */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Projects</CardTitle>
                  <CardDescription>Your most recently updated projects</CardDescription>
                </div>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  New Project
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentProjects.map((project) => (
                  <div key={project.id} className="flex items-center space-x-4">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(project.status)}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{project.name}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        {getStatusBadge(project.status)}
                        <span className="text-xs text-muted-foreground">
                          {project.progress}% complete
                        </span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">
                          {project.lastUpdated}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="flex -space-x-2">
                        {project.team.slice(0, 3).map((member, index) => (
                          <div
                            key={index}
                            className="w-6 h-6 bg-muted rounded-full flex items-center justify-center text-xs border-2 border-background"
                            title={member}
                          >
                            {member.charAt(0)}
                          </div>
                        ))}
                      </div>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Button variant="outline" className="w-full">
                  View All Projects
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Activity Feed */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest updates across your projects</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">Sarah Miller</span> completed the{' '}
                      <span className="font-medium">UI Design</span> task
                    </p>
                    <p className="text-xs text-muted-foreground">10 minutes ago</p>
                  </div>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">Mike Johnson</span> started working on{' '}
                      <span className="font-medium">API Integration</span>
                    </p>
                    <p className="text-xs text-muted-foreground">1 hour ago</p>
                  </div>
                  <Clock className="h-4 w-4 text-blue-500" />
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">Alex Thompson</span> commented on{' '}
                      <span className="font-medium">Database Schema</span>
                    </p>
                    <p className="text-xs text-muted-foreground">3 hours ago</p>
                  </div>
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">Lisa Wang</span> deployed{' '}
                      <span className="font-medium">v2.1.0</span> to production
                    </p>
                    <p className="text-xs text-muted-foreground">5 hours ago</p>
                  </div>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </div>
              </div>
              <div className="mt-4">
                <Button variant="outline" className="w-full">
                  View All Activity
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
