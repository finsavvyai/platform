'use client'

import { useEffect } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { Breadcrumb } from '@/components/navigation/breadcrumb'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/store/auth'
import { useUIStore } from '@/store/ui'
import { Users, FolderOpen, Activity, TrendingUp, Plus, Eye } from 'lucide-react'
import { stats, recentProjects, getStatusColor } from './data'
import { ActivityFeed } from './activity-feed'

function getStatusBadge(status: string) {
  switch (status) {
    case 'COMPLETED':
      return <Badge variant="default">Completed</Badge>
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

export default function DashboardPage() {
  const { user } = useAuthStore()
  const { setBreadcrumbs } = useUIStore()

  useEffect(() => {
    setBreadcrumbs([
      { label: 'Dashboard', active: true }
    ])
  }, [setBreadcrumbs])

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
                      <Button variant="ghost" size="sm" aria-label="View project">
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
          <ActivityFeed />
        </div>
      </div>
    </AppLayout>
  )
}
