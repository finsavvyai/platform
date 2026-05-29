'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { recentActivity } from './data'
import type { ActivityItem } from './data'

function ActivityIcon({ type }: { type: ActivityItem['type'] }) {
  switch (type) {
    case 'completed':
    case 'deployed':
      return <CheckCircle className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
    case 'started':
      return <Clock className="h-4 w-4 text-blue-500 dark:text-blue-400" />
    case 'commented':
      return <AlertCircle className="h-4 w-4 text-amber-500 dark:text-amber-400" />
  }
}

function activityDotColor(type: ActivityItem['type']): string {
  switch (type) {
    case 'completed':
    case 'deployed':
      return 'bg-emerald-500 dark:bg-emerald-400'
    case 'started':
      return 'bg-blue-500 dark:bg-blue-400'
    case 'commented':
      return 'bg-amber-500 dark:bg-amber-400'
  }
}

export function ActivityFeed() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest updates across your projects</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentActivity.map((item) => (
            <div key={item.id} className="flex items-start space-x-3">
              <div className={`w-2 h-2 rounded-full mt-2 ${activityDotColor(item.type)}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{item.user}</span> {item.action}{' '}
                  <span className="font-medium">{item.target}</span>
                  {item.type === 'deployed' ? ' to production' : item.type === 'completed' ? ' task' : ''}
                </p>
                <p className="text-xs text-muted-foreground">{item.time}</p>
              </div>
              <ActivityIcon type={item.type} />
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Button variant="outline" className="w-full">
            View All Activity
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
